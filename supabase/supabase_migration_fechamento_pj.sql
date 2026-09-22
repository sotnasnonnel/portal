-- Migration: fechamento_pj (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Fechamento PJ — fechamento mensal dos prestadores PJ, dentro de Gestão de
-- Pessoas. Substitui o protótipo pj_fechamento.html, que guardava tudo no
-- localStorage de UMA máquina.
--
-- O QUE MUDA EM RELAÇÃO AO PROTÓTIPO (de propósito)
--
--   * ENVELOPE POR COMPETÊNCIA. O protótipo tinha uma lista única de pessoas
--     cujo bruto/descontos era sobrescrito todo mês; o passado sobrevivia só como
--     "snapshot" de totais. Aqui o envelope é (competência, prestador), e o
--     cadastro (razão social, CNPJ, rateio) é congelado no envelope ao fechar —
--     um mês fechado não muda quando o cadastro muda depois.
--
--   * COMPETÊNCIA FECHADA É IMUTÁVEL NO BANCO, não só na tela. O gatilho
--     pj_trava_envelope recusa mexer em evento, cálculo ou valor de envelope
--     de competência fechada. Continuam liberados termo, envio e os números de
--     NF / documento RM, que por natureza chegam depois do fechamento.
--
--   * CENTRO DE CUSTO RM COM DE-PARA. O organograma fala COD CT ("CORP>MKT"); o
--     TXT do RM exige d.ddd.dddddd. pj_centros_custo é a ponte, e o check do
--     formato mora na coluna.
--
--   * AUTORIA. Todo log, cálculo, fechamento e auditoria grava QUEM (o protótipo
--     assinava tudo como "Washington").
--
-- O cálculo (proporcionalidade, divergências, rateio) mora em
-- src/modules/fechamentoPj/lib — é JS puro com teste. O banco guarda, trava e
-- faz as transições que precisam ser atômicas (gravar lote de envelopes,
-- fechar, reabrir, abrir a próxima).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Portão
--    Espelha podeAcessarFechamentoPj() em src/config/fechamentoPj.js:
--    DP (a mesma regra das Horas Extras do DP) E, enquanto o módulo estiver em
--    lançamento, a lista de liberados. A lista está AQUI também porque a tabela
--    tem CPF e conta bancária: sem ela, qualquer rh_dp leria tudo pela API.
--    Quando FECHAMENTO_PJ_EM_BREVE virar false, tire a lista dos dois lugares.
-- ----------------------------------------------------------------------------
create or replace function app_private.pode_fechamento_pj()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_horas_extras_dp()
     and lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
       'lennon.santos@phdengenharia.eng.br',
       'washington.maciel@phdengenharia.eng.br'
     )
$$;
revoke all on function app_private.pode_fechamento_pj() from public;
revoke execute on function app_private.pode_fechamento_pj() from anon;
grant execute on function app_private.pode_fechamento_pj() to authenticated;

-- Carimbo de autoria/atualização comum às tabelas do módulo.
create or replace function app_private.pj_carimbo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := app_private.my_colaborador_id();
  return new;
end $$;
revoke all on function app_private.pj_carimbo() from public;
revoke execute on function app_private.pj_carimbo() from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1) Configuração (linha única)
-- ----------------------------------------------------------------------------
create table if not exists public.pj_config (
  id smallint primary key default 1 check (id = 1),
  empresa_padrao text not null default 'PHD ASSESSORIA',
  email_financeiro text not null default '',
  contatos_extras jsonb not null default '[]',          -- [{nome, email}] em cópia
  base_proporcional text not null default '30_dias'
    check (base_proporcional in ('30_dias', 'dias_corridos')),
  proporcional_admissao boolean not null default true,
  proporcional_encerramento boolean not null default true,
  indenizacao_percentual numeric(5,2) not null default 50 check (indenizacao_percentual between 0 and 100),
  motivos_encerramento text[] not null default array[
    'Término do projeto', 'Solicitação do prestador', 'Decisão da empresa',
    'Término do prazo contratual', 'Acordo entre as partes'],
  modo_envio text not null default 'individual' check (modo_envio in ('individual', 'lote')),
  assunto_email text not null default 'Termo para emissão da Nota Fiscal — {{competencia}}',
  copia_financeiro boolean not null default true,
  cadastro_automatico boolean not null default true,     -- linha da planilha sem cadastro vira prestador novo
  bloquear_termo_divergencia boolean not null default true,
  tolerancia_bruto numeric(12,2) not null default 0.01,  -- bruto da planilha x valor contratual
  -- Parâmetros do layout de pagamento no TOTVS RM.
  rm jsonb not null default '{
    "coligada": "1", "filial": "1",
    "tipoDocumento": "29", "tipoDocumentoDesc": "PIX",
    "serie": "@@@",
    "natureza": "2.03.04.13", "naturezaDesc": "Profissionais PJ",
    "contaCaixa": "001", "contaCaixaDesc": "ITAÚ",
    "dadosBancarios": "2", "dadosBancariosDesc": "PIX CNPJ",
    "diaEmissao": 28
  }',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.colaboradores(id)
);
insert into public.pj_config (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2) Códigos de cálculo (proventos e descontos)
-- ----------------------------------------------------------------------------
create table if not exists public.pj_codigos (
  codigo text primary key check (codigo ~ '^[0-9A-Z]{1,8}$'),
  descricao text not null check (length(trim(descricao)) > 0),
  natureza text not null check (natureza in ('provento', 'desconto')),
  ativo boolean not null default true,
  origem text not null default 'Cadastro padrão',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.colaboradores(id)
);
insert into public.pj_codigos (codigo, descricao, natureza, origem) values
  ('1000', 'VALOR BRUTO CONTRATUAL', 'provento', 'Cadastro padrão'),
  ('1100', 'AJUDA DE CUSTO / OUTROS PROVENTOS', 'provento', 'Cadastro padrão'),
  ('2001', 'PLANO DE SAÚDE / DEPENDENTES', 'desconto', 'Planilha de fechamento PJ'),
  ('2002', 'COPARTICIPAÇÃO TITULAR / DEPENDENTES', 'desconto', 'Planilha de fechamento PJ'),
  ('2003', 'PLANO ODONTOLÓGICO', 'desconto', 'Planilha de fechamento PJ'),
  ('2004', 'PREVIDÊNCIA PRIVADA', 'desconto', 'Planilha de fechamento PJ'),
  ('2100', 'OUTROS DESCONTOS CONTRATUAIS', 'desconto', 'Planilha de fechamento PJ')
on conflict (codigo) do nothing;

-- ----------------------------------------------------------------------------
-- 3) Centros de custo: COD CT do organograma -> código RM
-- ----------------------------------------------------------------------------
create table if not exists public.pj_centros_custo (
  cod_ct text primary key check (length(trim(cod_ct)) > 0),
  codigo_rm text check (codigo_rm is null or codigo_rm ~ '^\d\.\d{3}\.\d{6}$'),
  descricao text,
  origem text not null default 'Manual',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.colaboradores(id)
);

-- ----------------------------------------------------------------------------
-- 4) Prestadores
-- ----------------------------------------------------------------------------
create table if not exists public.pj_prestadores (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^\d{6}$'),
  nome text not null check (length(trim(nome)) > 0),
  empresa text not null default 'PHD ASSESSORIA' check (empresa in ('PHD ASSESSORIA', 'PHD ENGENHARIA')),
  email text,                                   -- e-mail corporativo (recebe o termo)
  situacao text not null default 'ativo' check (situacao in ('ativo', 'desligado')),
  cadastro_origem text not null default 'manual' check (cadastro_origem in ('manual', 'planilha', 'carga')),
  -- Documentação
  razao_social text,
  cnpj text,
  cpf text,
  rg text,
  data_nascimento date,
  sexo text check (sexo is null or sexo in ('M', 'F')),
  telefone text,
  email_pessoal text,
  -- Endereço residencial (fonte: comprovante de endereço)
  cep text, tipo_logradouro text, logradouro text, numero text, complemento text,
  bairro text, municipio text, uf text, pais text default 'Brasil',
  -- Contrato
  modalidade text not null default 'CNPJ',
  data_inicio date,
  data_fim date,
  funcao text,
  projeto text,
  gestor text,
  secao_codigo text,
  secao_nome text,
  municipio_atuacao text,
  uf_atuacao text,
  valor_mensal numeric(12,2) not null default 0 check (valor_mensal >= 0),
  -- Pagamento
  banco text, banco_codigo text, agencia text, conta text, pix text,
  contabilidade text check (contabilidade is null or contabilidade in ('Montservice', 'Externo')),
  -- Benefícios e dependentes (alimentados pela conferência Bradesco)
  beneficios jsonb not null default '{}',       -- {medico:{ativo,plano,valor,fonte,atualizadoEm}, odonto:{...}}
  dependentes jsonb not null default '[]',      -- [{nome,cpf,nascimento,sexo,parentesco,situacao,fonte,beneficio}]
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.colaboradores(id)
);
create index if not exists pj_prestadores_cnpj_idx on public.pj_prestadores (regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'));
create index if not exists pj_prestadores_cpf_idx on public.pj_prestadores (regexp_replace(coalesce(cpf, ''), '\D', '', 'g'));

-- Rateio fixo do cadastro (vem do organograma). O envelope congela uma cópia.
create table if not exists public.pj_prestador_rateios (
  id uuid primary key default gen_random_uuid(),
  prestador_id uuid not null references public.pj_prestadores(id) on delete cascade,
  cod_ct text not null,
  percentual numeric(9,6) not null check (percentual > 0 and percentual <= 100),
  alocacao_organograma numeric(9,6),
  origem text not null default 'Manual',
  importado_em timestamptz not null default now(),
  unique (prestador_id, cod_ct)
);
create index if not exists pj_prestador_rateios_prestador_idx on public.pj_prestador_rateios (prestador_id);

-- Histórico de valor contratual e função. Só o gatilho escreve.
create table if not exists public.pj_historico_valores (
  id uuid primary key default gen_random_uuid(),
  prestador_id uuid not null references public.pj_prestadores(id) on delete cascade,
  vigencia date not null default current_date,
  valor_anterior numeric(12,2),
  valor_novo numeric(12,2),
  funcao_anterior text,
  funcao_nova text,
  motivo text not null,
  registrado_em timestamptz not null default now(),
  registrado_por uuid references public.colaboradores(id)
);
create index if not exists pj_historico_valores_prestador_idx on public.pj_historico_valores (prestador_id, registrado_em desc);

create or replace function app_private.pj_historico_valor()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  mudou_valor boolean := abs(coalesce(new.valor_mensal, 0) - coalesce(old.valor_mensal, 0)) > 0.009;
  mudou_funcao boolean := upper(trim(coalesce(new.funcao, ''))) <> upper(trim(coalesce(old.funcao, '')));
begin
  if mudou_valor or mudou_funcao then
    insert into public.pj_historico_valores
      (prestador_id, vigencia, valor_anterior, valor_novo, funcao_anterior, funcao_nova, motivo, registrado_por)
    values (new.id, current_date, old.valor_mensal, new.valor_mensal, old.funcao, new.funcao,
      case when mudou_valor and mudou_funcao then 'Alteração de valor contratual e função'
           when mudou_valor then 'Alteração do valor contratual'
           else 'Alteração de função' end,
      app_private.my_colaborador_id());
  end if;
  return new;
end $$;
revoke all on function app_private.pj_historico_valor() from public;
revoke execute on function app_private.pj_historico_valor() from anon, authenticated;

drop trigger if exists pj_prestadores_carimbo on public.pj_prestadores;
create trigger pj_prestadores_carimbo before update on public.pj_prestadores
  for each row execute function app_private.pj_carimbo();
drop trigger if exists pj_prestadores_historico on public.pj_prestadores;
create trigger pj_prestadores_historico after update of valor_mensal, funcao on public.pj_prestadores
  for each row execute function app_private.pj_historico_valor();

-- ----------------------------------------------------------------------------
-- 5) Cadastro Cliente/Fornecedor TOTVS RM
-- ----------------------------------------------------------------------------
create table if not exists public.pj_fornecedores_rm (
  id uuid primary key default gen_random_uuid(),
  prestador_id uuid unique references public.pj_prestadores(id) on delete set null,
  codigo_rm text check (codigo_rm is null or codigo_rm ~ '^\d{7}$'),
  nome_fantasia text,
  razao_social text,
  cnpj text,
  classificacao text not null default 'Fornecedor' check (classificacao in ('Cliente', 'Fornecedor', 'Ambos')),
  categoria text not null default 'Pessoa Jurídica' check (categoria in ('Pessoa Física', 'Pessoa Jurídica')),
  inscricao_estadual text,
  inscricao_municipal text,
  tipo_codigo text default '2',
  tipo_descricao text default 'SERVIÇO',
  global boolean not null default true,
  ativo boolean not null default true,
  bloqueado boolean not null default false,
  endereco jsonb not null default '{}',   -- fonte: cartão CNPJ
  contatos jsonb not null default '{}',   -- {telefone, celular, fax, email, contato}
  bancos jsonb not null default '[]',     -- [{ref, descricao, ativo, filial, filialNome, formaPagamento, banco, agencia, agenciaDigito, agenciaNome, conta, contaDigito, tipoConta, camara, favorecido, favorecidoDoc, pixTipo, pixChave}]
  origem text not null default 'Manual',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.colaboradores(id)
);
create unique index if not exists pj_fornecedores_rm_codigo_uidx on public.pj_fornecedores_rm (codigo_rm) where codigo_rm is not null;
drop trigger if exists pj_fornecedores_rm_carimbo on public.pj_fornecedores_rm;
create trigger pj_fornecedores_rm_carimbo before update on public.pj_fornecedores_rm
  for each row execute function app_private.pj_carimbo();

-- ----------------------------------------------------------------------------
-- 6) Competências
--    competencia = primeiro dia do mês. Status 'aberta' é o "Em conferência".
-- ----------------------------------------------------------------------------
create table if not exists public.pj_competencias (
  competencia date primary key check (extract(day from competencia) = 1),
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  origem text not null default 'app' check (origem in ('app', 'historico')),
  -- Calendário do termo
  data_envio_termos date,
  prazo_nf timestamptz,
  data_pagamento date,
  -- Totais congelados no fechamento
  prestadores integer,
  bruto numeric(14,2),
  descontos numeric(14,2),
  liquido numeric(14,2),
  calculada_em timestamptz,
  fechada_em timestamptz,
  fechada_por uuid references public.colaboradores(id),
  reaberta_em timestamptz,
  reaberta_por uuid references public.colaboradores(id),
  motivo_reabertura text,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.colaboradores(id) default app_private.my_colaborador_id()
);

-- ----------------------------------------------------------------------------
-- 7) Envelopes, eventos e cálculos
-- ----------------------------------------------------------------------------
create table if not exists public.pj_envelopes (
  id uuid primary key default gen_random_uuid(),
  competencia date not null references public.pj_competencias(competencia) on delete cascade,
  prestador_id uuid not null references public.pj_prestadores(id) on delete restrict,
  origem text not null default 'app' check (origem in ('app', 'historico')),
  bruto numeric(12,2) not null default 0,
  descontos numeric(12,2) not null default 0,
  liquido numeric(12,2) generated always as (bruto - descontos) stored,
  -- Proporcionalidade aplicada no último cálculo
  valor_base numeric(12,2),
  dias_ativos integer,
  divisor integer,
  proporcional_motivo text,
  -- Conferência
  conferencia text not null default 'ok' check (conferencia in ('ok', 'divergente')),
  divergencias jsonb not null default '[]',   -- [{tipo, titulo, detalhe, esperado, encontrado, sugestao, codigo}]
  resolucoes jsonb not null default '[]',     -- [{tipo, acao, observacao, por, porNome, em}]
  planilha jsonb,                             -- valores crus da última importação (para as regras de conferência)
  -- Termo
  termo text not null default 'disponivel' check (termo in ('disponivel', 'gerado', 'bloqueado')),
  envio text not null default 'nao_enviado' check (envio in ('nao_enviado', 'preparado', 'enviado')),
  termo_gerado_em timestamptz,
  termo_gerado_por uuid references public.colaboradores(id),
  enviado_em timestamptz,
  enviado_por uuid references public.colaboradores(id),
  -- Pagamento
  nf_numero text,
  rm_documento text,
  calculado_em timestamptz,
  -- Congelados no fechamento
  cadastro jsonb,   -- {nome, empresa, email, razaoSocial, cnpj, cpf, funcao, dataInicio}
  rateio jsonb,     -- [{codCt, codigoRm, percentual}]
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.colaboradores(id),
  unique (competencia, prestador_id)
);
create index if not exists pj_envelopes_prestador_idx on public.pj_envelopes (prestador_id, competencia desc);

create table if not exists public.pj_eventos (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.pj_envelopes(id) on delete cascade,
  codigo text not null references public.pj_codigos(codigo) on update cascade,
  descricao text not null,
  natureza text not null check (natureza in ('provento', 'desconto')),
  referencia numeric(10,2) not null default 0,
  valor numeric(12,2) not null check (valor >= 0),
  valor_original numeric(12,2),
  forcado boolean not null default false,
  origem text not null default 'Lançamento manual no envelope',
  ordem integer not null default 0,
  unique (envelope_id, codigo)
);
create index if not exists pj_eventos_envelope_idx on public.pj_eventos (envelope_id);

-- Log de cálculo do envelope. Só insert (é histórico).
create table if not exists public.pj_calculos (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.pj_envelopes(id) on delete cascade,
  calculado_em timestamptz not null default now(),
  calculado_por uuid references public.colaboradores(id) default app_private.my_colaborador_id(),
  origem text not null,
  bruto_anterior numeric(12,2),
  bruto numeric(12,2) not null,
  descontos numeric(12,2) not null,
  liquido numeric(12,2) not null,
  rateio_total numeric(9,4),
  conferencia text not null,
  memoria jsonb not null default '{}'   -- {proporcional:{...}, eventos:[{codigo, descricao, natureza, prioridade, regra, formula, valor}], rateio:[...]}
);
create index if not exists pj_calculos_envelope_idx on public.pj_calculos (envelope_id, calculado_em desc);

-- ----------------------------------------------------------------------------
-- 8) Encerramento de contrato
-- ----------------------------------------------------------------------------
create table if not exists public.pj_encerramentos (
  id uuid primary key default gen_random_uuid(),
  prestador_id uuid not null references public.pj_prestadores(id) on delete cascade,
  competencia date not null references public.pj_competencias(competencia),
  data_encerramento date not null,
  data_calculo date not null,
  data_pagamento date not null,
  data_ultimo_movimento date not null,
  motivo text not null check (length(trim(motivo)) >= 5),
  observacao text,
  prazo_determinado boolean not null default false,
  indenizacao boolean not null default false,
  indenizacao_percentual numeric(5,2),
  dias_ativos integer,
  divisor integer,
  valor_proporcional numeric(12,2),
  valor_indenizacao numeric(12,2),
  descontos numeric(12,2),
  status text not null default 'programado' check (status in ('programado', 'encerrado', 'cancelado')),
  registrado_em timestamptz not null default now(),
  registrado_por uuid references public.colaboradores(id) default app_private.my_colaborador_id(),
  cancelado_em timestamptz,
  cancelado_por uuid references public.colaboradores(id),
  check (data_ultimo_movimento <= data_encerramento)
);
-- No máximo um encerramento vigente por prestador.
create unique index if not exists pj_encerramentos_vigente_uidx
  on public.pj_encerramentos (prestador_id) where status <> 'cancelado';

-- ----------------------------------------------------------------------------
-- 9) Importações e auditoria
-- ----------------------------------------------------------------------------
create table if not exists public.pj_importacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('folha', 'organograma', 'bradesco', 'historico', 'documental')),
  competencia date,
  arquivo text not null,
  modo text check (modo is null or modo in ('descontos', 'completo')),
  linhas integer not null default 0,
  localizados integer not null default 0,
  novos integer not null default 0,
  sem_correspondencia integer not null default 0,
  bruto numeric(14,2),
  descontos numeric(14,2),
  liquido numeric(14,2),
  resumo jsonb not null default '{}',
  importado_em timestamptz not null default now(),
  importado_por uuid references public.colaboradores(id) default app_private.my_colaborador_id()
);
create index if not exists pj_importacoes_em_idx on public.pj_importacoes (importado_em desc);

create table if not exists public.pj_auditoria (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  por uuid references public.colaboradores(id) default app_private.my_colaborador_id(),
  acao text not null,
  detalhe text,
  competencia date,
  prestador_id uuid references public.pj_prestadores(id) on delete set null
);
create index if not exists pj_auditoria_em_idx on public.pj_auditoria (em desc);

-- O autor da auditoria é sempre quem está logado — a tela não escolhe.
create or replace function app_private.pj_autor_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.por := coalesce(app_private.my_colaborador_id(), new.por);
  new.em := now();
  return new;
end $$;
revoke all on function app_private.pj_autor_auditoria() from public;
revoke execute on function app_private.pj_autor_auditoria() from anon, authenticated;
drop trigger if exists pj_auditoria_autor on public.pj_auditoria;
create trigger pj_auditoria_autor before insert on public.pj_auditoria
  for each row execute function app_private.pj_autor_auditoria();

-- ----------------------------------------------------------------------------
-- 10) Trava de competência fechada
-- ----------------------------------------------------------------------------
create or replace function app_private.pj_competencia_fechada(p_competencia date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pj_competencias
                  where competencia = p_competencia and status = 'fechada')
$$;
revoke all on function app_private.pj_competencia_fechada(date) from public;
revoke execute on function app_private.pj_competencia_fechada(date) from anon;
grant execute on function app_private.pj_competencia_fechada(date) to authenticated;

create or replace function app_private.pj_trava_envelope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if app_private.pj_competencia_fechada(old.competencia) then
      raise exception 'Competência fechada: reabra antes de excluir envelopes.' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    -- A carga histórica entra já com a competência fechada; o resto não.
    if new.origem <> 'historico' and app_private.pj_competencia_fechada(new.competencia) then
      raise exception 'Competência fechada: reabra antes de incluir envelopes.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- UPDATE: numa competência fechada só termo, envio, NF e documento RM mudam.
  if app_private.pj_competencia_fechada(old.competencia)
     and (new.bruto, new.descontos, new.valor_base, new.dias_ativos, new.divisor, new.proporcional_motivo,
          new.conferencia, new.divergencias, new.resolucoes, new.planilha, new.calculado_em,
          new.cadastro, new.rateio, new.competencia, new.prestador_id)
         is distinct from
         (old.bruto, old.descontos, old.valor_base, old.dias_ativos, old.divisor, old.proporcional_motivo,
          old.conferencia, old.divergencias, old.resolucoes, old.planilha, old.calculado_em,
          old.cadastro, old.rateio, old.competencia, old.prestador_id) then
    raise exception 'Competência fechada: os valores do envelope não podem mudar. Reabra a competência.'
      using errcode = 'check_violation';
  end if;
  new.atualizado_em := now();
  new.atualizado_por := app_private.my_colaborador_id();
  return new;
end $$;
revoke all on function app_private.pj_trava_envelope() from public;
revoke execute on function app_private.pj_trava_envelope() from anon, authenticated;
drop trigger if exists pj_envelopes_trava on public.pj_envelopes;
create trigger pj_envelopes_trava before insert or update or delete on public.pj_envelopes
  for each row execute function app_private.pj_trava_envelope();

create or replace function app_private.pj_trava_filho()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_env uuid := case when tg_op = 'DELETE' then old.envelope_id else new.envelope_id end;
  v_comp date;
  v_origem text;
begin
  select competencia, origem into v_comp, v_origem from public.pj_envelopes where id = v_env;
  if v_origem is distinct from 'historico' and app_private.pj_competencia_fechada(v_comp) then
    raise exception 'Competência fechada: reabra antes de alterar eventos ou cálculos.' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $;
revoke all on function app_private.pj_trava_filho() from public;
revoke execute on function app_private.pj_trava_filho() from anon, authenticated;
drop trigger if exists pj_eventos_trava on public.pj_eventos;
create trigger pj_eventos_trava before insert or update or delete on public.pj_eventos
  for each row execute function app_private.pj_trava_filho();
drop trigger if exists pj_calculos_trava on public.pj_calculos;
create trigger pj_calculos_trava before insert on public.pj_calculos
  for each row execute function app_private.pj_trava_filho();

-- Carimbos das tabelas de apoio.
drop trigger if exists pj_config_carimbo on public.pj_config;
create trigger pj_config_carimbo before update on public.pj_config
  for each row execute function app_private.pj_carimbo();
drop trigger if exists pj_codigos_carimbo on public.pj_codigos;
create trigger pj_codigos_carimbo before update on public.pj_codigos
  for each row execute function app_private.pj_carimbo();
drop trigger if exists pj_centros_custo_carimbo on public.pj_centros_custo;
create trigger pj_centros_custo_carimbo before update on public.pj_centros_custo
  for each row execute function app_private.pj_carimbo();

-- ----------------------------------------------------------------------------
-- 11) RLS — tudo do módulo passa pelo mesmo portão.
--     Histórico de valores, cálculos, importações e auditoria: sem update/delete.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pj_config', 'pj_codigos', 'pj_centros_custo', 'pj_prestadores',
    'pj_prestador_rateios', 'pj_fornecedores_rm', 'pj_competencias', 'pj_envelopes', 'pj_eventos',
    'pj_encerramentos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_escrita', t);
    execute format('create policy %I on public.%I for select to authenticated using (app_private.pode_fechamento_pj())', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated using (app_private.pode_fechamento_pj()) with check (app_private.pode_fechamento_pj())', t || '_escrita', t);
  end loop;

  foreach t in array array['pj_historico_valores', 'pj_calculos', 'pj_importacoes', 'pj_auditoria']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for select to authenticated using (app_private.pode_fechamento_pj())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (app_private.pode_fechamento_pj())', t || '_insert', t);
  end loop;
end $$;

-- pj_historico_valores só é escrito pelo gatilho (security definer).
drop policy if exists pj_historico_valores_insert on public.pj_historico_valores;

-- ----------------------------------------------------------------------------
-- 12) RPCs de transição
--     security invoker: a RLS acima vale dentro delas. O portão é conferido
--     logo na entrada para dar erro claro em vez de "zero linhas".
-- ----------------------------------------------------------------------------
create or replace function app_private.pj_exigir_acesso()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.pode_fechamento_pj() then
    raise exception 'Sem acesso ao Fechamento PJ.' using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function app_private.pj_exigir_acesso() from public;
revoke execute on function app_private.pj_exigir_acesso() from anon;
grant execute on function app_private.pj_exigir_acesso() to authenticated;

-- Grava um lote de envelopes calculados no front, numa transação.
-- p_envelopes: [{prestador_id, bruto, descontos, valor_base, dias_ativos, divisor,
--   proporcional_motivo, conferencia, divergencias, resolucoes?, planilha?, termo?, envio?,
--   eventos:[{codigo, descricao, natureza, referencia, valor, valor_original, forcado, origem, ordem}],
--   calculo?: {origem, bruto_anterior, rateio_total, memoria}}]
-- Envelope sem "calculo" grava os valores mas não conta como calculado
-- (é o caso de editar um evento sem recalcular).
create or replace function public.pj_gravar_envelopes(p_competencia date, p_envelopes jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  e jsonb;
  v_id uuid;
  n integer := 0;
begin
  perform app_private.pj_exigir_acesso();
  if app_private.pj_competencia_fechada(p_competencia) then
    raise exception 'Competência fechada: reabra antes de recalcular.' using errcode = 'check_violation';
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_envelopes, '[]'))
  loop
    insert into public.pj_envelopes as env (competencia, prestador_id, bruto, descontos, valor_base, dias_ativos,
      divisor, proporcional_motivo, conferencia, divergencias, resolucoes, planilha, termo, envio, calculado_em)
    values (p_competencia, (e->>'prestador_id')::uuid,
      coalesce((e->>'bruto')::numeric, 0), coalesce((e->>'descontos')::numeric, 0),
      (e->>'valor_base')::numeric, (e->>'dias_ativos')::int, (e->>'divisor')::int, e->>'proporcional_motivo',
      coalesce(e->>'conferencia', 'ok'), coalesce(e->'divergencias', '[]'), coalesce(e->'resolucoes', '[]'),
      e->'planilha', coalesce(e->>'termo', 'disponivel'), coalesce(e->>'envio', 'nao_enviado'),
      case when e ? 'calculo' then now() end)
    on conflict (competencia, prestador_id) do update set
      bruto = excluded.bruto,
      descontos = excluded.descontos,
      valor_base = excluded.valor_base,
      dias_ativos = excluded.dias_ativos,
      divisor = excluded.divisor,
      proporcional_motivo = excluded.proporcional_motivo,
      conferencia = excluded.conferencia,
      divergencias = excluded.divergencias,
      resolucoes = case when e ? 'resolucoes' then excluded.resolucoes else env.resolucoes end,
      planilha = case when e ? 'planilha' then excluded.planilha else env.planilha end,
      termo = excluded.termo,
      envio = excluded.envio,
      calculado_em = case when e ? 'calculo' then now() else env.calculado_em end
    returning id into v_id;

    if e ? 'eventos' then
      delete from public.pj_eventos where envelope_id = v_id;
      insert into public.pj_eventos (envelope_id, codigo, descricao, natureza, referencia, valor, valor_original, forcado, origem, ordem)
      select v_id, ev->>'codigo', ev->>'descricao', ev->>'natureza',
             coalesce((ev->>'referencia')::numeric, 0), coalesce((ev->>'valor')::numeric, 0),
             (ev->>'valor_original')::numeric, coalesce((ev->>'forcado')::boolean, false),
             coalesce(ev->>'origem', 'Lançamento manual no envelope'), coalesce((ev->>'ordem')::int, 0)
        from jsonb_array_elements(e->'eventos') ev;
    end if;

    if e ? 'calculo' then
      insert into public.pj_calculos (envelope_id, origem, bruto_anterior, bruto, descontos, liquido, rateio_total, conferencia, memoria)
      values (v_id, coalesce(e->'calculo'->>'origem', 'Cálculo do envelope'),
        (e->'calculo'->>'bruto_anterior')::numeric,
        coalesce((e->>'bruto')::numeric, 0), coalesce((e->>'descontos')::numeric, 0),
        coalesce((e->>'bruto')::numeric, 0) - coalesce((e->>'descontos')::numeric, 0),
        (e->'calculo'->>'rateio_total')::numeric, coalesce(e->>'conferencia', 'ok'),
        coalesce(e->'calculo'->'memoria', '{}'));
    end if;
    n := n + 1;
  end loop;

  if exists (select 1 from jsonb_array_elements(coalesce(p_envelopes, '[]')) x where x ? 'calculo') then
    update public.pj_competencias set calculada_em = now() where competencia = p_competencia;
  end if;
  return n;
end $$;
revoke all on function public.pj_gravar_envelopes(date, jsonb) from public;
revoke execute on function public.pj_gravar_envelopes(date, jsonb) from anon;
grant execute on function public.pj_gravar_envelopes(date, jsonb) to authenticated;

-- Fecha a competência: todos calculados, nenhuma divergência em aberto.
-- Congela cadastro e rateio no envelope e os totais na competência.
create or replace function public.pj_fechar_competencia(p_competencia date)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_pend integer;
  v_div integer;
  v_total integer;
begin
  perform app_private.pj_exigir_acesso();
  if not exists (select 1 from public.pj_competencias where competencia = p_competencia and status = 'aberta') then
    raise exception 'A competência não está aberta.' using errcode = 'check_violation';
  end if;

  select count(*), count(*) filter (where calculado_em is null), count(*) filter (where conferencia = 'divergente')
    into v_total, v_pend, v_div
    from public.pj_envelopes where competencia = p_competencia;
  if v_total = 0 then
    raise exception 'Não há envelopes nesta competência.' using errcode = 'check_violation';
  end if;
  if v_pend > 0 then
    raise exception '% envelope(s) sem cálculo. Calcule antes de fechar.', v_pend using errcode = 'check_violation';
  end if;
  if v_div > 0 then
    raise exception '% envelope(s) com divergência. Resolva antes de fechar.', v_div using errcode = 'check_violation';
  end if;

  update public.pj_envelopes e set
    cadastro = jsonb_build_object(
      'nome', p.nome, 'empresa', p.empresa, 'email', p.email, 'razaoSocial', p.razao_social,
      'cnpj', p.cnpj, 'cpf', p.cpf, 'funcao', p.funcao, 'dataInicio', p.data_inicio, 'codigo', p.codigo),
    rateio = coalesce((
      select jsonb_agg(jsonb_build_object('codCt', r.cod_ct, 'codigoRm', cc.codigo_rm, 'percentual', r.percentual) order by r.cod_ct)
        from public.pj_prestador_rateios r
        left join public.pj_centros_custo cc on cc.cod_ct = r.cod_ct
       where r.prestador_id = p.id), '[]')
  from public.pj_prestadores p
  where p.id = e.prestador_id and e.competencia = p_competencia;

  update public.pj_competencias c set
    status = 'fechada',
    fechada_em = now(),
    fechada_por = app_private.my_colaborador_id(),
    prestadores = t.n, bruto = t.b, descontos = t.d, liquido = t.b - t.d
  from (select count(*) n, coalesce(sum(bruto), 0) b, coalesce(sum(descontos), 0) d
          from public.pj_envelopes where competencia = p_competencia) t
  where c.competencia = p_competencia;

  insert into public.pj_auditoria (acao, detalhe, competencia)
  values ('Competência fechada', format('%s envelope(s) congelados', v_total), p_competencia);
end $$;
revoke all on function public.pj_fechar_competencia(date) from public;
revoke execute on function public.pj_fechar_competencia(date) from anon;
grant execute on function public.pj_fechar_competencia(date) to authenticated;

create or replace function public.pj_reabrir_competencia(p_competencia date, p_motivo text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform app_private.pj_exigir_acesso();
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Informe o motivo da reabertura (mínimo 5 caracteres).' using errcode = 'check_violation';
  end if;
  update public.pj_competencias set
    status = 'aberta', reaberta_em = now(), reaberta_por = app_private.my_colaborador_id(),
    motivo_reabertura = trim(p_motivo)
  where competencia = p_competencia and status = 'fechada' and origem = 'app';
  if not found then
    raise exception 'Só uma competência fechada no app pode ser reaberta (a carga histórica não reabre).'
      using errcode = 'check_violation';
  end if;
  insert into public.pj_auditoria (acao, detalhe, competencia)
  values ('Competência reaberta', trim(p_motivo), p_competencia);
end $$;
revoke all on function public.pj_reabrir_competencia(date, text) from public;
revoke execute on function public.pj_reabrir_competencia(date, text) from anon;
grant execute on function public.pj_reabrir_competencia(date, text) to authenticated;

-- Abre uma competência nova a partir da última fechada.
-- Leva: prestadores ativos (e quem tem encerramento programado dentro do mês),
-- com os eventos do mês anterior (ou 1000 = valor mensal para quem não tinha).
-- Zera: cálculos, termo, envio, divergências, resoluções, NF.
create or replace function public.pj_abrir_competencia(
  p_competencia date, p_envio_termos date default null, p_prazo_nf timestamptz default null, p_pagamento date default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_base date;
  v_n integer;
  v_fim date := (p_competencia + interval '1 month - 1 day')::date;
begin
  perform app_private.pj_exigir_acesso();
  if extract(day from p_competencia) <> 1 then
    raise exception 'Competência inválida.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.pj_competencias where competencia = p_competencia) then
    raise exception 'A competência já existe.' using errcode = 'unique_violation';
  end if;
  if exists (select 1 from public.pj_competencias where status = 'aberta') then
    raise exception 'Feche a competência em aberto antes de abrir outra.' using errcode = 'check_violation';
  end if;
  select max(competencia) into v_base from public.pj_competencias where competencia < p_competencia;

  insert into public.pj_competencias (competencia, data_envio_termos, prazo_nf, data_pagamento)
  values (p_competencia, p_envio_termos, p_prazo_nf, p_pagamento);

  insert into public.pj_envelopes (competencia, prestador_id, bruto, descontos)
  select p_competencia, p.id, coalesce(prev.bruto, p.valor_mensal), coalesce(prev.descontos, 0)
    from public.pj_prestadores p
    left join public.pj_envelopes prev on prev.prestador_id = p.id and prev.competencia = v_base
   where (p.situacao = 'ativo' or (p.data_fim between p_competencia and v_fim))
     and (p.data_inicio is null or p.data_inicio <= v_fim)
     and (p.data_fim is null or p.data_fim >= p_competencia);
  get diagnostics v_n = row_count;

  -- Eventos: copia os do mês anterior quando existem (a carga histórica só tem totais).
  insert into public.pj_eventos (envelope_id, codigo, descricao, natureza, referencia, valor, valor_original, forcado, origem, ordem)
  select e.id, ev.codigo, ev.descricao, ev.natureza, ev.referencia, ev.valor, ev.valor_original, ev.forcado,
         'Transportado de ' || to_char(v_base, 'MM/YYYY'), ev.ordem
    from public.pj_envelopes e
    join public.pj_envelopes prev on prev.prestador_id = e.prestador_id and prev.competencia = v_base
    join public.pj_eventos ev on ev.envelope_id = prev.id
   where e.competencia = p_competencia;

  -- Quem ficou sem evento nenhum recebe o 1000 do valor contratual.
  insert into public.pj_eventos (envelope_id, codigo, descricao, natureza, referencia, valor, valor_original, origem, ordem)
  select e.id, '1000', 'VALOR BRUTO CONTRATUAL', 'provento', 30, p.valor_mensal, p.valor_mensal, 'Cadastro contratual', 0
    from public.pj_envelopes e
    join public.pj_prestadores p on p.id = e.prestador_id
   where e.competencia = p_competencia
     and not exists (select 1 from public.pj_eventos x where x.envelope_id = e.id);

  update public.pj_envelopes e set
    bruto = coalesce((select sum(valor) from public.pj_eventos where envelope_id = e.id and natureza = 'provento'), 0),
    descontos = coalesce((select sum(valor) from public.pj_eventos where envelope_id = e.id and natureza = 'desconto'), 0)
  where e.competencia = p_competencia;

  insert into public.pj_auditoria (acao, detalhe, competencia)
  values ('Competência aberta', format('%s envelope(s) criados a partir de %s', v_n, coalesce(to_char(v_base, 'MM/YYYY'), 'cadastro')), p_competencia);
  return v_n;
end $$;
revoke all on function public.pj_abrir_competencia(date, date, timestamptz, date) from public;
revoke execute on function public.pj_abrir_competencia(date, date, timestamptz, date) from anon;
grant execute on function public.pj_abrir_competencia(date, date, timestamptz, date) to authenticated;

-- Inclui no mês aberto um prestador que entrou depois da abertura.
create or replace function public.pj_incluir_no_mes(p_competencia date, p_prestador uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  perform app_private.pj_exigir_acesso();
  insert into public.pj_envelopes (competencia, prestador_id, bruto)
  select p_competencia, p.id, p.valor_mensal from public.pj_prestadores p where p.id = p_prestador
  on conflict (competencia, prestador_id) do nothing
  returning id into v_id;
  if v_id is not null then
    insert into public.pj_eventos (envelope_id, codigo, descricao, natureza, referencia, valor, valor_original, origem)
    select v_id, '1000', 'VALOR BRUTO CONTRATUAL', 'provento', 30, p.valor_mensal, p.valor_mensal, 'Cadastro contratual'
      from public.pj_prestadores p where p.id = p_prestador;
  end if;
  return v_id;
end $$;
revoke all on function public.pj_incluir_no_mes(date, uuid) from public;
revoke execute on function public.pj_incluir_no_mes(date, uuid) from anon;
grant execute on function public.pj_incluir_no_mes(date, uuid) to authenticated;

notify pgrst, 'reload schema';
