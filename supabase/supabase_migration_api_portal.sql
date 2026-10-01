-- Migration: API de leitura do portal (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Consultas da Edge Function `api-portal` (supabase/functions/api-portal), que
-- entrega para sistemas de FORA do portal (BI, integrações) os dados de:
--   - Ausência Programada (pedidos e períodos com saldo)  — Gestão de Pessoas
--   - Adicional de Ausências                              — Gestão de Pessoas
--   - Apontamento                                         — Gestão de Horas
--   - Horas Extras                                        — Gestão de Horas
-- Contrato da API (rotas, filtros, exemplos): docs/api-portal.md.
--
-- POR QUE FUNÇÕES, e não a Edge Function lendo as tabelas direto:
--   - o SALDO da ausência já é calculado em três lugares
--     (supabase_migration_ausencia_adicionais.sql). Uma quarta conta, em
--     TypeScript, é a que ia ficar para trás na próxima mudança de regra. Aqui
--     o saldo sai de app_private.ausencia_saldo, a mesma função da trava do
--     pedido;
--   - os nomes (colaborador, aprovador, projeto, equipe) saem resolvidos no
--     mesmo SELECT, como nas RPCs *_listar das telas.
--
-- QUEM CHAMA: só a service_role (a Edge Function). São SECURITY DEFINER e NÃO
-- olham quem está logado — devolvem a empresa toda. Por isso o EXECUTE é
-- tirado de anon e authenticated: nenhum usuário do portal alcança estas
-- funções pelo PostgREST. Quem autentica o consumidor é a Edge Function, pela
-- chave do secret API_PORTAL_KEYS.
--
-- Só LEITURA: nenhuma tabela é criada ou alterada. Não depende de deploy do
-- front. ORDEM: esta migração ANTES do deploy da Edge Function.
--
-- Todas devolvem jsonb { total, dados }: `total` é a contagem do filtro inteiro
-- e `dados` é a página (p_limite entre 1 e 2000, p_offset >= 0).
--
-- Para derrubar:
--     drop function if exists public.api_portal_ausencias(date, date, text, text, int, int);
--     drop function if exists public.api_portal_ausencia_periodos(text, int, int);
--     drop function if exists public.api_portal_adicionais(date, date, text, text, int, int);
--     drop function if exists public.api_portal_apontamentos(date, date, text, int, int);
--     drop function if exists public.api_portal_horas_extras(date, date, text, text, int, int);
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Ausência Programada — pedidos
-- ----------------------------------------------------------------------------
-- p_de/p_ate: ausências que TOCAM o intervalo (não só as que começam nele).
-- Rascunho não sai: ainda não é pedido, é anotação de quem está preenchendo
-- (mesmo corte dos painéis do gestor e do RH).
-- `concluida` = aprovada cujo fim já passou — a tela deriva, aqui vem pronto.
create or replace function public.api_portal_ausencias(
  p_de date default null,
  p_ate date default null,
  p_status text default null,
  p_email text default null,
  p_limite int default 500,
  p_offset int default 0
)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (
    select s.id, s.numero, s.status,
           (s.status = 'aprovada' and s.data_fim < current_date) as concluida,
           s.origem, s.fora_do_prazo,
           s.colaborador_id, c.nome as colaborador_nome, c.email as colaborador_email,
           c.funcao as colaborador_funcao, c.formato as colaborador_formato,
           s.aprovador_id, a.nome as aprovador_nome, a.email as aprovador_email,
           s.periodo_id, p.inicio_periodo as periodo_inicio, p.fim_periodo as periodo_fim,
           p.data_inicial as periodo_data_inicial, p.data_limite as periodo_data_limite,
           s.data_inicio, s.data_fim, s.dias, s.observacao,
           s.motivo_reprovacao, s.motivo_cancelamento,
           s.dias_antes_correcao, s.motivo_correcao, s.corrigido_em,
           s.enviado_em, s.decidido_em, d.nome as decidido_por_nome,
           s.cancelado_em, s.created_at, s.updated_at
    from public.ausencia_solicitacoes s
    join public.colaboradores c on c.id = s.colaborador_id
    join public.ausencia_periodos p on p.id = s.periodo_id
    left join public.colaboradores a on a.id = s.aprovador_id
    left join public.colaboradores d on d.id = s.decidido_por
    where s.status <> 'rascunho'
      and (p_de is null or s.data_fim >= p_de)
      and (p_ate is null or s.data_inicio <= p_ate)
      and (p_status is null or s.status = p_status)
      and (p_email is null or lower(c.email) = lower(trim(p_email)))
  ),
  pagina as (
    select b.*, row_number() over (order by b.data_inicio desc, b.numero desc) as ord
    from base b
    order by ord
    limit least(greatest(coalesce(p_limite, 500), 1), 2000)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'dados', coalesce((select jsonb_agg(to_jsonb(pg) - 'ord' order by pg.ord) from pagina pg), '[]'::jsonb)
  )
$$;
revoke all on function public.api_portal_ausencias(date, date, text, text, int, int) from public;
revoke execute on function public.api_portal_ausencias(date, date, text, text, int, int) from anon, authenticated;
grant execute on function public.api_portal_ausencias(date, date, text, text, int, int) to service_role;

-- ----------------------------------------------------------------------------
-- 2) Ausência Programada — períodos e saldo
-- ----------------------------------------------------------------------------
-- Tirados/agendados/pendentes com o mesmo corte de ausencia_periodos_listar; o
-- saldo vem de app_private.ausencia_saldo (já conta os adicionais aprovados).
-- Quem foi tirado do controle pelo RH (ausencia_fora_do_controle) CONTINUA
-- saindo, marcado em `fora_do_controle`: quem consome decide se filtra.
create or replace function public.api_portal_ausencia_periodos(
  p_email text default null,
  p_limite int default 500,
  p_offset int default 0
)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (
    select p.id, p.colaborador_id, c.nome as colaborador_nome, c.email as colaborador_email,
           c.funcao as colaborador_funcao, c.formato as colaborador_formato,
           (c.ativo is distinct from false) as colaborador_ativo,
           (c.ausencia_fora_do_controle is true) as fora_do_controle,
           sup.nome as superior_nome,
           p.inicio_periodo, p.fim_periodo, p.data_inicial, p.data_limite,
           p.dias_direito, p.dias_ajuste, p.ajuste_motivo,
           app_private.ausencia_adicionais_do_periodo(p.id) as dias_adicionais,
           coalesce(u.tirados, 0) as dias_tirados,
           coalesce(u.agendados, 0) as dias_agendados,
           coalesce(u.pendentes, 0) as dias_pendentes,
           app_private.ausencia_saldo(p.id) as saldo,
           p.observacao, p.origem, p.created_at, p.updated_at
    from public.ausencia_periodos p
    join public.colaboradores c on c.id = p.colaborador_id
    left join public.colaboradores sup on sup.id = c.superior_id
    left join lateral (
      select
        sum(s.dias) filter (where s.status = 'aprovada' and s.data_fim < current_date)::int  as tirados,
        sum(s.dias) filter (where s.status = 'aprovada' and s.data_fim >= current_date)::int as agendados,
        sum(s.dias) filter (where s.status = 'pendente')::int                                as pendentes
      from public.ausencia_solicitacoes s
      where s.periodo_id = p.id
    ) u on true
    where (p_email is null or lower(c.email) = lower(trim(p_email)))
  ),
  pagina as (
    select b.*, row_number() over (order by b.colaborador_nome, b.inicio_periodo desc, b.id) as ord
    from base b
    order by ord
    limit least(greatest(coalesce(p_limite, 500), 1), 2000)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'dados', coalesce((select jsonb_agg(to_jsonb(pg) - 'ord' order by pg.ord) from pagina pg), '[]'::jsonb)
  )
$$;
revoke all on function public.api_portal_ausencia_periodos(text, int, int) from public;
revoke execute on function public.api_portal_ausencia_periodos(text, int, int) from anon, authenticated;
grant execute on function public.api_portal_ausencia_periodos(text, int, int) to service_role;

-- ----------------------------------------------------------------------------
-- 3) Adicional de Ausências
-- ----------------------------------------------------------------------------
-- O registro não tem data própria (é crédito de dias, não ausência com datas):
-- p_de/p_ate filtram pelo dia em que foi REGISTRADO, no horário de Brasília.
create or replace function public.api_portal_adicionais(
  p_de date default null,
  p_ate date default null,
  p_status text default null,
  p_email text default null,
  p_limite int default 500,
  p_offset int default 0
)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (
    select a.id, a.numero, a.status,
           a.colaborador_id, c.nome as colaborador_nome, c.email as colaborador_email,
           c.funcao as colaborador_funcao,
           a.registrado_por, r.nome as registrado_por_nome, r.email as registrado_por_email,
           a.aprovador_id, ap.nome as aprovador_nome, ap.email as aprovador_email,
           a.projeto_id, a.projeto_nome, a.dias, a.observacao,
           a.periodo_id, p.inicio_periodo as periodo_inicio, p.fim_periodo as periodo_fim,
           a.motivo_reprovacao, a.motivo_cancelamento,
           a.decidido_em, d.nome as decidido_por_nome,
           a.cancelado_em, a.created_at, a.updated_at
    from public.ausencia_adicionais a
    join public.colaboradores c on c.id = a.colaborador_id
    join public.colaboradores r on r.id = a.registrado_por
    left join public.colaboradores ap on ap.id = a.aprovador_id
    left join public.colaboradores d on d.id = a.decidido_por
    left join public.ausencia_periodos p on p.id = a.periodo_id
    where (p_de is null or (a.created_at at time zone 'America/Sao_Paulo')::date >= p_de)
      and (p_ate is null or (a.created_at at time zone 'America/Sao_Paulo')::date <= p_ate)
      and (p_status is null or a.status = p_status)
      and (p_email is null or lower(c.email) = lower(trim(p_email)))
  ),
  pagina as (
    select b.*, row_number() over (order by b.created_at desc, b.numero desc) as ord
    from base b
    order by ord
    limit least(greatest(coalesce(p_limite, 500), 1), 2000)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'dados', coalesce((select jsonb_agg(to_jsonb(pg) - 'ord' order by pg.ord) from pagina pg), '[]'::jsonb)
  )
$$;
revoke all on function public.api_portal_adicionais(date, date, text, text, int, int) from public;
revoke execute on function public.api_portal_adicionais(date, date, text, text, int, int) from anon, authenticated;
grant execute on function public.api_portal_adicionais(date, date, text, text, int, int) to service_role;

-- ----------------------------------------------------------------------------
-- 4) Apontamento (Gestão de Horas)
-- ----------------------------------------------------------------------------
-- p_de/p_ate pelo dia do INÍCIO do apontamento, no horário de Brasília (`data`
-- sai com esse mesmo dia). `horas` é duracao_ms em horas, com 2 casas.
-- `campos` são os campos configurados por equipe (horas_campos_apontamento);
-- sigla/tarefa/etiqueta/tarefa2/ativ são o formato anterior, que os registros
-- antigos ainda usam.
create or replace function public.api_portal_apontamentos(
  p_de date default null,
  p_ate date default null,
  p_email text default null,
  p_limite int default 500,
  p_offset int default 0
)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (
    select ap.id,
           ap.colaborador_id, c.nome as colaborador_nome, c.email as colaborador_email,
           c.funcao as colaborador_funcao,
           ap.gerencia_id, g.nome as gerencia_nome,
           ap.projeto_id, pr.nome as projeto_nome, pr.cliente as projeto_cliente,
           (ap.inicio at time zone 'America/Sao_Paulo')::date as data,
           ap.inicio, ap.fim, ap.duracao_ms,
           round(ap.duracao_ms / 3600000.0, 2) as horas,
           ap.descricao, ap.sigla, ap.tarefa, ap.tarefa2, ap.etiqueta, ap.ativ, ap.campos,
           ap.criado_em
    from public.horas_apontamentos ap
    join public.colaboradores c on c.id = ap.colaborador_id
    left join public.horas_gerencias g on g.id = ap.gerencia_id
    left join public.horas_projetos pr on pr.id = ap.projeto_id
    where (p_de is null or (ap.inicio at time zone 'America/Sao_Paulo')::date >= p_de)
      and (p_ate is null or (ap.inicio at time zone 'America/Sao_Paulo')::date <= p_ate)
      and (p_email is null or lower(c.email) = lower(trim(p_email)))
  ),
  pagina as (
    select b.*, row_number() over (order by b.inicio desc, b.id) as ord
    from base b
    order by ord
    limit least(greatest(coalesce(p_limite, 500), 1), 2000)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'dados', coalesce((select jsonb_agg(to_jsonb(pg) - 'ord' order by pg.ord) from pagina pg), '[]'::jsonb)
  )
$$;
revoke all on function public.api_portal_apontamentos(date, date, text, int, int) from public;
revoke execute on function public.api_portal_apontamentos(date, date, text, int, int) from anon, authenticated;
grant execute on function public.api_portal_apontamentos(date, date, text, int, int) to service_role;

-- ----------------------------------------------------------------------------
-- 5) Horas Extras (Gestão de Horas)
-- ----------------------------------------------------------------------------
-- p_de/p_ate pela data da hora extra (data_he). Percentual não existe aqui: é
-- aplicado pelo DP/RM conforme a CCT (ver supabase_migration_horas_extras.sql).
create or replace function public.api_portal_horas_extras(
  p_de date default null,
  p_ate date default null,
  p_status text default null,
  p_email text default null,
  p_limite int default 500,
  p_offset int default 0
)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (
    select s.id, s.numero, s.status, s.destino,
           s.colaborador_id, c.nome as colaborador_nome, c.email as colaborador_email,
           s.aprovador_id, a.nome as aprovador_nome, a.email as aprovador_email,
           s.gerencia_id, g.nome as gerencia_nome,
           s.projeto_id, pr.nome as projeto_nome, pr.cliente as projeto_cliente,
           s.cargo, s.matricula, s.centro_custo,
           s.data_he, s.hora_inicio, s.hora_fim, s.minutos,
           s.motivo, s.justificativa,
           s.compensacao_data, s.compensacao_periodo, s.compensacao_minutos,
           s.observacao_destino, s.motivo_reprovacao, s.motivo_alteracao,
           s.limite_horario, (s.excecao_id is not null) as liberada_por_excecao,
           s.decidido_em, d.nome as decidido_por_nome,
           s.created_at, s.updated_at
    from public.horas_extras_solicitacoes s
    join public.colaboradores c on c.id = s.colaborador_id
    left join public.colaboradores a on a.id = s.aprovador_id
    left join public.colaboradores d on d.id = s.decidido_por
    left join public.horas_gerencias g on g.id = s.gerencia_id
    left join public.horas_projetos pr on pr.id = s.projeto_id
    where (p_de is null or s.data_he >= p_de)
      and (p_ate is null or s.data_he <= p_ate)
      and (p_status is null or s.status = p_status)
      and (p_email is null or lower(c.email) = lower(trim(p_email)))
  ),
  pagina as (
    select b.*, row_number() over (order by b.data_he desc, b.numero desc) as ord
    from base b
    order by ord
    limit least(greatest(coalesce(p_limite, 500), 1), 2000)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'dados', coalesce((select jsonb_agg(to_jsonb(pg) - 'ord' order by pg.ord) from pagina pg), '[]'::jsonb)
  )
$$;
revoke all on function public.api_portal_horas_extras(date, date, text, text, int, int) from public;
revoke execute on function public.api_portal_horas_extras(date, date, text, text, int, int) from anon, authenticated;
grant execute on function public.api_portal_horas_extras(date, date, text, text, int, int) to service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- Depois de aplicar (no SQL Editor, como postgres):
--   select public.api_portal_ausencias(p_limite => 2) -> 'total';
--   select public.api_portal_horas_extras() -> 'total';
-- E conferir que um usuário comum NÃO executa:
--   select has_function_privilege('authenticated',
--     'public.api_portal_ausencias(date, date, text, text, int, int)', 'execute');  -- false
-- ============================================================================
