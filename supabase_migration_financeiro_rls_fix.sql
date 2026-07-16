-- Migration: financeiro_rls_fix (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Corrige a RLS do Financeiro criada em supabase_migration_financeiro_solicitacoes.sql.
-- Dois defeitos reais, encontrados em uso:
--
-- 1) RECURSÃO INFINITA ("infinite recursion detected in policy for relation
--    solicitacoes_financeiro"): a policy do envelope consultava a tabela de
--    etapas, e a policy de etapas consultava o envelope — ciclo. Os helpers
--    abaixo são SECURITY DEFINER: leem as tabelas SEM RLS e quebram o ciclo.
--
-- 2) SOMBREAMENTO DE COLUNA (silencioso): em
--       exists (select 1 from solicitacoes_financeiro_etapas e
--               where e.solicitacao_id = id and ...)
--    o `id` casava com `e.id` (coluna da própria subquery), não com o `id` do
--    envelope. Resultado: a cláusula "aprovador enxerga a solicitação" NUNCA
--    era verdadeira. Parâmetro nomeado (p_sol) elimina a ambiguidade.
--
-- Além disso, a leitura de etapas passa a mostrar a CADEIA COMPLETA para quem
-- participa (antes o aprovador via só a própria etapa, e a linha do tempo do
-- fluxo aparecia pela metade).
-- ============================================================================

create or replace function app_private.fin_eh_aprovador(p_sol uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.solicitacoes_financeiro_etapas e
    where e.solicitacao_id = p_sol
      and e.aprovador_id = app_private.my_colaborador_id()
  )
$$;
revoke all on function app_private.fin_eh_aprovador(uuid) from public;
grant execute on function app_private.fin_eh_aprovador(uuid) to authenticated;

create or replace function app_private.fin_eh_solicitante(p_sol uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.solicitacoes_financeiro s
    where s.id = p_sol
      and s.solicitante_id = app_private.my_colaborador_id()
  )
$$;
revoke all on function app_private.fin_eh_solicitante(uuid) from public;
grant execute on function app_private.fin_eh_solicitante(uuid) to authenticated;

-- ---- Envelope ----
drop policy if exists solic_fin_select on public.solicitacoes_financeiro;
create policy solic_fin_select on public.solicitacoes_financeiro
for select to authenticated
using (
  solicitante_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or app_private.fin_eh_aprovador(solicitacoes_financeiro.id)
);

drop policy if exists solic_fin_update on public.solicitacoes_financeiro;
create policy solic_fin_update on public.solicitacoes_financeiro
for update to authenticated
using (
  solicitante_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or app_private.fin_eh_aprovador(solicitacoes_financeiro.id)
)
with check (
  solicitante_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or app_private.fin_eh_aprovador(solicitacoes_financeiro.id)
);

-- ---- Etapas ----
-- Leitura: participa da solicitação => vê a cadeia inteira.
drop policy if exists solic_fin_etapas_select on public.solicitacoes_financeiro_etapas;
create policy solic_fin_etapas_select on public.solicitacoes_financeiro_etapas
for select to authenticated
using (
  app_private.is_financeiro_admin()
  or app_private.fin_eh_solicitante(solicitacoes_financeiro_etapas.solicitacao_id)
  or app_private.fin_eh_aprovador(solicitacoes_financeiro_etapas.solicitacao_id)
);

-- Escrita: só decide o aprovador NOMEADO da etapa, ou o admin do Financeiro
-- (etapa de execução tem aprovador_id nulo).
drop policy if exists solic_fin_etapas_write on public.solicitacoes_financeiro_etapas;
create policy solic_fin_etapas_write on public.solicitacoes_financeiro_etapas
for all to authenticated
using (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or app_private.fin_eh_solicitante(solicitacoes_financeiro_etapas.solicitacao_id)
)
with check (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or app_private.fin_eh_solicitante(solicitacoes_financeiro_etapas.solicitacao_id)
);
