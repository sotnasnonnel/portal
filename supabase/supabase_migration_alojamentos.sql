-- Migration: alojamentos (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Módulo de Gestão de Alojamentos (card "Administrativo" da Home).
--
-- Substitui a planilha docs/ref/ADM_GESTAO_DE_ALOJAMENTOS.xlsx. As telas e as
-- regras vêm do protótipo docs/ref/"Gestão de Alojamentos PHD - HTML.html", que
-- gravava em coleções de um artifact; aqui cada coleção virou tabela, e o que
-- era aninhado no documento (contrato.fim, aluguel.valor, proprietario.nome...)
-- virou coluna explícita, achatada.
--
-- SEM PRÉ-REQUISITO DE DEPLOY: aplique antes do front. As tabelas são novas, e
-- as rotas ficam atrás de SETOR_ADM_EM_BREVE (src/config/setorAdm.js).
--
-- O COFRE FICOU DE FORA DE PROPÓSITO. A aba "Acessos" do protótipo guarda logins
-- e senhas de portais (energia, internet, Wi-Fi) em texto puro. Não há tabela
-- para isso aqui: o dono do sistema ainda vai decidir se e como isso entra.
--
-- PRÉ-REQUISITO: supabase_migration_setor_adm_acesso.sql (cria os helpers).
--
-- PERMISSÃO: nenhum papel novo. Os helpers setor_adm_time() / setor_adm_admin()
-- exigem administrativo_role E estar na lista de lançamento restrito. Excluir um
-- alojamento (que leva junto todo o histórico dele) é só do admin.
--
-- Nota sobre os `revoke`: o Supabase tem um ALTER DEFAULT PRIVILEGES que concede
-- tudo em objeto novo de public para anon, authenticated e service_role.
-- `revoke ... from public` NÃO desfaz isso, porque é um grant direto ao papel.
-- Por isso cada tabela e função abaixo revoga de `anon` explicitamente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------
create table if not exists public.alojamentos (
  id uuid primary key default gen_random_uuid(),

  -- Identificação
  nome text not null,
  sigla text,
  status text not null default 'ativo' check (status in ('ativo', 'desmobilizacao', 'inativo')),
  tipo text,
  endereco text,
  cidade text,
  uf text,
  cep text,
  pais text default 'Brasil',
  composicao text,

  -- Gestão
  cnpj_locacao text,
  centro_custo text,
  gerente text,
  projeto text,

  -- Contrato de locação
  contrato_inicio date,
  contrato_fim date,
  contrato_prazo text,
  contrato_renovacao_automatica boolean not null default false,
  contrato_observacao text,
  encerramento_previsto date,
  devolucao_data date,
  devolucao_obs text,

  -- Valores. O dia de vencimento é texto porque a planilha traz "10" e também
  -- coisas como "último dia útil".
  aluguel_valor numeric(12, 2),
  aluguel_vencimento text,
  aluguel_cobranca text,
  condominio_nome text,
  condominio_valor numeric(12, 2),
  condominio_cobranca text,
  iptu numeric(12, 2),
  caucao numeric(12, 2),

  -- Contatos
  proprietario_nome text,
  proprietario_telefone text,
  proprietario_email text,
  imobiliaria_nome text,
  imobiliaria_telefone text,
  imobiliaria_email text,
  sindico_nome text,
  sindico_telefone text,
  diarista_nome text,
  diarista_telefone text,
  diarista_valor numeric(12, 2),
  diarista_intervalo text,
  garagem_vagas int,
  garagem_usuarios text,

  -- Contas que entram como "a lançar" no quadro de pagamentos.
  contas_controladas text[] not null default '{}',

  observacoes text,
  origem text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alojamentos_quartos (
  id uuid primary key default gen_random_uuid(),
  alojamento_id uuid not null references public.alojamentos(id) on delete cascade,
  nome text not null,
  vagas int not null default 1 check (vagas >= 1),
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alojamentos_quartos_aloj_idx on public.alojamentos_quartos (alojamento_id);

-- A estadia sobrevive ao quarto: quarto_id vira NULL quando o quarto sai, e o
-- gatilho abaixo guarda o nome dele em quarto_nome para o histórico continuar
-- dizendo onde a pessoa morou.
create table if not exists public.alojamentos_estadias (
  id uuid primary key default gen_random_uuid(),
  alojamento_id uuid not null references public.alojamentos(id) on delete cascade,
  quarto_id uuid references public.alojamentos_quartos(id) on delete set null,
  quarto_nome text,
  morador text not null,
  entrada date,
  saida_prevista date,
  saida date,
  chave text not null default 'com_morador' check (chave in (
    'com_morador', 'com_terceiro', 'devolvida', 'pendente', 'nao_entregue', 'nao_informado'
  )),
  chave_obs text,
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alojamentos_estadias_aloj_idx on public.alojamentos_estadias (alojamento_id);
create index if not exists alojamentos_estadias_quarto_idx on public.alojamentos_estadias (quarto_id);

-- Sem unique em (alojamento, conta, competência): uma conta pode ter mais de um
-- lançamento no mês, e o quadro soma os dois.
create table if not exists public.alojamentos_pagamentos (
  id uuid primary key default gen_random_uuid(),
  alojamento_id uuid not null references public.alojamentos(id) on delete cascade,
  conta text not null,
  competencia text not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  valor numeric(12, 2),
  vencimento date,
  data_pagamento date,
  status text not null default 'pago' check (status in ('pago', 'pendente', 'agendado')),
  forma text,
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alojamentos_pagamentos_aloj_idx on public.alojamentos_pagamentos (alojamento_id, competencia);
create index if not exists alojamentos_pagamentos_comp_idx on public.alojamentos_pagamentos (competencia);

create table if not exists public.alojamentos_itens (
  id uuid primary key default gen_random_uuid(),
  alojamento_id uuid not null references public.alojamentos(id) on delete cascade,
  produto text not null,
  quantidade int not null default 1 check (quantidade >= 1),
  preco_unitario numeric(12, 2),
  fornecedor text,
  data_compra date,
  destino text not null default 'Em uso',
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alojamentos_itens_aloj_idx on public.alojamentos_itens (alojamento_id);

create table if not exists public.alojamentos_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  alojamento_id uuid not null references public.alojamentos(id) on delete cascade,
  data date not null,
  tipo text,
  descricao text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alojamentos_ocorrencias_aloj_idx on public.alojamentos_ocorrencias (alojamento_id);

create table if not exists public.alojamentos_pendencias (
  id uuid primary key default gen_random_uuid(),
  alojamento_id uuid not null references public.alojamentos(id) on delete cascade,
  texto text not null,
  feito boolean not null default false,
  feito_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alojamentos_pendencias_aloj_idx on public.alojamentos_pendencias (alojamento_id);

-- Cadastro das concessionárias do imóvel (no protótipo, a lista alojamento.contas).
-- Não confundir com os lançamentos mensais: remover a conta daqui não apaga os
-- pagamentos já lançados.
create table if not exists public.alojamentos_contas_consumo (
  id uuid primary key default gen_random_uuid(),
  alojamento_id uuid not null references public.alojamentos(id) on delete cascade,
  tipo text not null,
  fornecedor text,
  codigo text,
  vencimento text,
  cobranca text,
  status text not null default 'ativa' check (status in ('ativa', 'cancelada')),
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alojamentos_contas_consumo_aloj_idx on public.alojamentos_contas_consumo (alojamento_id);

-- ----------------------------------------------------------------------------
-- Gatilhos
-- ----------------------------------------------------------------------------
create or replace function app_private.aloj_carimbar_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function app_private.aloj_carimbar_updated_at() from public;
revoke execute on function app_private.aloj_carimbar_updated_at() from anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'alojamentos', 'alojamentos_quartos', 'alojamentos_estadias', 'alojamentos_pagamentos',
    'alojamentos_itens', 'alojamentos_ocorrencias', 'alojamentos_pendencias', 'alojamentos_contas_consumo'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at_trg', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function app_private.aloj_carimbar_updated_at()',
      t || '_updated_at_trg', t
    );
  end loop;
end;
$$;

-- Guarda o nome do quarto nas estadias antes de o FK zerar quarto_id. É no
-- momento da exclusão, e não ao gravar a estadia, para valer o nome mais recente
-- caso o quarto tenha sido renomeado depois da entrada.
create or replace function app_private.aloj_guardar_nome_quarto()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.alojamentos_estadias
     set quarto_nome = old.nome
   where quarto_id = old.id;
  return old;
end;
$$;
revoke all on function app_private.aloj_guardar_nome_quarto() from public;
revoke execute on function app_private.aloj_guardar_nome_quarto() from anon, authenticated;

drop trigger if exists alojamentos_quartos_guarda_nome_trg on public.alojamentos_quartos;
create trigger alojamentos_quartos_guarda_nome_trg
  before delete on public.alojamentos_quartos
  for each row execute function app_private.aloj_guardar_nome_quarto();

-- ----------------------------------------------------------------------------
-- RLS: só quem está liberado (setor_adm_time). Nada de consulta geral: são custos, contatos de
-- terceiros e o nome de quem mora em cada imóvel.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'alojamentos', 'alojamentos_quartos', 'alojamentos_estadias', 'alojamentos_pagamentos',
    'alojamentos_itens', 'alojamentos_ocorrencias', 'alojamentos_pendencias', 'alojamentos_contas_consumo'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app_private.setor_adm_time())',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (app_private.setor_adm_time())',
      t || '_insert', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (app_private.setor_adm_time()) with check (app_private.setor_adm_time())',
      t || '_update', t
    );

    -- Excluir o imóvel leva o histórico inteiro em cascata: só o admin. Os
    -- registros de dentro dele são do dia a dia do time.
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      t || '_delete', t,
      case when t = 'alojamentos' then 'app_private.setor_adm_admin()' else 'app_private.setor_adm_time()' end
    );
  end loop;
end;
$$;
