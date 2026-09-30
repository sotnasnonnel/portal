-- Migration: Mobilização — fluxo "Inclusão de treinamento" (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido da Edijane (30/09/2026): acompanhar a inclusão de treinamentos para
-- quem JÁ está mobilizado no contrato (ex.: RAC 04 e PRO para o Eduardo, na VBM).
--
-- Decisões do usuário (30/09/2026):
--   - Nasce de CHAMADO no Atendimento, como os outros: nova opção "Inclusão de
--     treinamento" no formulário de Mobilização. Passa pela aprovação de sempre
--     e o gatilho abre o processo.
--   - Etapas e prazos (dias úteis) iniciais abaixo; o time ajusta em
--     "Catálogo e SLAs" sem deploy.
--   - "Novo ASO, quando aplicável": a etapa existe sempre e o time marca
--     "Não se aplica" no processo quando não precisar — o mesmo mecanismo que
--     já existe (status 'dispensada').
--
-- O quarto fluxo mexe em QUATRO lugares, e todos precisam mudar juntos:
--   1. os CHECKs de fluxo do catálogo e dos processos;
--   2. app_private.mob_abrir, que tem a lista de fluxos permitidos;
--   3. app_private.mob_fluxo_do_movimento (movimento do chamado -> fluxo);
--   4. app_private.mob_dados_do_chamado, que leva os treinamentos pedidos.
-- mob_abrir abaixo é o corpo de produção de 30/09/2026 com o fluxo a mais.
--
-- ORDEM DE DEPLOY: esta migração ANTES do front. Com ela antes, o front antigo
-- segue igual (ninguém escolhe o movimento novo). Com o front antes, o chamado
-- de inclusão abriria sem processo e cairia em mobilizacao_gatilho_falhas.
-- ============================================================================

-- 1) Travas de fluxo
alter table public.mobilizacao_catalogo_etapas drop constraint if exists mobilizacao_catalogo_etapas_fluxo_check;
alter table public.mobilizacao_catalogo_etapas add constraint mobilizacao_catalogo_etapas_fluxo_check
  check (fluxo = any (array['mobilizacao_pessoa', 'desmobilizacao_pessoa', 'mobilizacao_empresa', 'inclusao_treinamento']));

alter table public.mobilizacao_processos drop constraint if exists mobilizacao_processos_fluxo_check;
alter table public.mobilizacao_processos add constraint mobilizacao_processos_fluxo_check
  check (fluxo = any (array['mobilizacao_pessoa', 'desmobilizacao_pessoa', 'mobilizacao_empresa', 'inclusao_treinamento']));

-- 2) mob_abrir: corpo de produção + o fluxo novo na lista
create or replace function app_private.mob_abrir(p_fluxo text, p_dados jsonb, p_origem text default 'manual'::text, p_origem_chamado uuid default null::uuid)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_id uuid;
  v_eu uuid := app_private.my_colaborador_id();
  v_titulo text;
  v_datas jsonb := coalesce(p_dados -> 'datas', '{}'::jsonb);
  v_qtd int;
begin
  if p_fluxo not in ('mobilizacao_pessoa', 'desmobilizacao_pessoa', 'mobilizacao_empresa', 'inclusao_treinamento') then
    raise exception 'Fluxo desconhecido: %', p_fluxo;
  end if;

  if p_origem_chamado is not null then
    select id into v_id from public.mobilizacao_processos
     where origem_chamado_id = p_origem_chamado;
    if v_id is not null then return v_id; end if;
  end if;

  if nullif(btrim(p_dados ->> 'carga_chave'), '') is not null then
    select id into v_id from public.mobilizacao_processos
     where carga_chave = btrim(p_dados ->> 'carga_chave');
    if v_id is not null then return v_id; end if;
  end if;

  v_titulo := coalesce(
    nullif(btrim(p_dados ->> 'titulo'), ''),
    nullif(btrim(p_dados ->> 'profissional_nome'), ''),
    nullif(btrim(p_dados ->> 'cliente_phd'), ''),
    'Processo sem identificação'
  );

  insert into public.mobilizacao_processos (
    fluxo, titulo, profissional_id, profissional_nome,
    empresa_phd, cliente_phd, cliente_final, local_obra, cod_ct, cod_phd,
    coo_phd, ger_phd, contrato, data_base, observacoes, campos,
    solicitante_id, responsavel_id, origem, origem_chamado_id, carga_chave
  ) values (
    p_fluxo, v_titulo,
    nullif(p_dados ->> 'profissional_id', '')::uuid,
    nullif(btrim(p_dados ->> 'profissional_nome'), ''),
    nullif(btrim(p_dados ->> 'empresa_phd'), ''),
    nullif(btrim(p_dados ->> 'cliente_phd'), ''),
    nullif(btrim(p_dados ->> 'cliente_final'), ''),
    nullif(btrim(p_dados ->> 'local_obra'), ''),
    nullif(btrim(p_dados ->> 'cod_ct'), ''),
    nullif(btrim(p_dados ->> 'cod_phd'), ''),
    nullif(btrim(p_dados ->> 'coo_phd'), ''),
    nullif(btrim(p_dados ->> 'ger_phd'), ''),
    nullif(btrim(p_dados ->> 'contrato'), ''),
    nullif(p_dados ->> 'data_base', '')::date,
    nullif(btrim(p_dados ->> 'observacoes'), ''),
    coalesce(p_dados -> 'campos', '{}'::jsonb),
    coalesce(nullif(p_dados ->> 'solicitante_id', '')::uuid, v_eu),
    nullif(p_dados ->> 'responsavel_id', '')::uuid,
    p_origem, p_origem_chamado,
    nullif(btrim(p_dados ->> 'carga_chave'), '')
  ) returning id into v_id;

  insert into public.mobilizacao_etapas (
    processo_id, catalogo_id, codigo, ordem, titulo, descricao,
    depende_de, sla_dias_uteis, responsavel_id, data_prevista
  )
  select v_id, c.id, c.codigo, c.ordem, c.titulo, c.descricao,
         c.depende_de, c.sla_dias_uteis, c.responsavel_id,
         nullif(v_datas ->> c.codigo, '')::date
    from public.mobilizacao_catalogo_etapas c
   where c.fluxo = p_fluxo and c.ativo
     and app_private.mob_condicao_ok(c.condicao, p_dados)
   order by c.ordem;

  get diagnostics v_qtd = row_count;

  insert into public.mobilizacao_eventos (processo_id, tipo, autor_id, para, dados)
  values (v_id, 'criado', v_eu, p_fluxo,
          jsonb_build_object('origem', p_origem, 'etapas', v_qtd,
                             'catalogo_vazio', v_qtd = 0));

  perform app_private.mob_recalcular(v_id);

  return v_id;
end $function$;

-- 3) Movimento do chamado -> fluxo
create or replace function app_private.mob_fluxo_do_movimento(p_movimento text)
returns text language sql immutable set search_path to '' as $function$
  select case p_movimento
    when 'Nova mobilização'             then 'mobilizacao_pessoa'
    when 'Movimentação de profissional' then 'mobilizacao_pessoa'
    when 'Desmobilização'               then 'desmobilizacao_pessoa'
    when 'Inclusão de treinamento'      then 'inclusao_treinamento'
    else null
  end
$function$;

-- 4) Os treinamentos pedidos viajam para os campos do processo
create or replace function app_private.mob_dados_do_chamado(p_campos jsonb, p_solicitante uuid)
returns jsonb language sql stable set search_path to '' as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'profissional_id',   nullif(p_campos ->> 'profissional_id', ''),
    'profissional_nome', nullif(btrim(coalesce(p_campos ->> 'profissional', '')), ''),
    'local_obra',        nullif(btrim(coalesce(p_campos ->> 'local_obra', '')), ''),
    'cod_ct',            nullif(btrim(coalesce(p_campos ->> 'cc', '')), ''),
    'ger_phd',           nullif(btrim(coalesce(p_campos ->> 'gestor', '')), ''),
    'cliente_phd',       nullif(btrim(coalesce(p_campos ->> 'cliente', '')), ''),
    'cliente_final',     nullif(btrim(coalesce(p_campos ->> 'cliente_final', '')), ''),
    'empresa_phd',       nullif(btrim(coalesce(p_campos ->> 'empresa_phd', '')), ''),
    'campos',            nullif(jsonb_strip_nulls(jsonb_build_object(
                           'contato_cliente',     nullif(btrim(coalesce(p_campos ->> 'contato_cliente', '')), ''),
                           'data_inicio_cliente', nullif(p_campos ->> 'data_inicio_cliente', ''),
                           'data_desmobilizacao', nullif(p_campos ->> 'data_desmobilizacao', ''),
                           'treinamentos',        nullif(btrim(coalesce(p_campos ->> 'treinamentos', '')), '')
                         )), '{}'::jsonb),
    'data_base',         to_char(current_date, 'YYYY-MM-DD'),
    'solicitante_id',    p_solicitante::text,
    'movimento',         nullif(p_campos ->> 'movimento', '')
  ))
$function$;

-- 5) O catálogo do fluxo novo (o time ajusta prazos e responsáveis depois)
insert into public.mobilizacao_catalogo_etapas
  (fluxo, codigo, ordem, titulo, descricao, depende_de, sla_dias_uteis, responsavel_papel, obrigatoria)
values
  ('inclusao_treinamento', 'agendamento_treinamento', 1, 'Agendamento do treinamento',
   'Agendar os treinamentos pedidos no chamado.', null, 1, 'sesmt', true),
  ('inclusao_treinamento', 'realizacao_treinamento', 2, 'Realização do treinamento',
   'Profissional concluiu os treinamentos.', 'agendamento_treinamento', 7, 'sesmt', true),
  ('inclusao_treinamento', 'novo_aso', 3, 'Novo ASO',
   'Só quando o treinamento exige. Se não precisar, marque "Não se aplica".', null, 2, 'dp', false),
  ('inclusao_treinamento', 'postagem_sgc', 4, 'Postagem dos documentos no SGC',
   'Postar os certificados (e o ASO, quando houver) para inclusão da RAC.', 'realizacao_treinamento', 2, 'adm', true),
  ('inclusao_treinamento', 'aprovacao_cliente', 5, 'Aprovação pelo cliente',
   null, 'postagem_sgc', 5, 'cliente', true),
  ('inclusao_treinamento', 'liberacao_passaporte', 6, 'Liberação do passaporte',
   'Passaporte do profissional liberado com os novos treinamentos.', 'aprovacao_cliente', 1, 'cliente', true)
on conflict (fluxo, codigo) do nothing;

notify pgrst, 'reload schema';
