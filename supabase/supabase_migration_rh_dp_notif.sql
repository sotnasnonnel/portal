-- ============================================================================
-- RH/DP: flag de visibilidade total + marca de "visto" p/ notificações
-- (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Maicon e Ana (RH/DP) passam a VER (somente leitura) todas as requisições,
-- etapas e o detalhe de contratação. ajudas_custo/mapeamentos/vagas já são
-- USING(true). solic_visto_em guarda a última visita (badge de concluídas).
-- ============================================================================

alter table public.colaboradores
  add column if not exists rh_dp boolean not null default false,
  add column if not exists solic_visto_em timestamptz;

update public.colaboradores set rh_dp = true
where id in ('6c13b1c3-7560-4f49-9afe-d99456731a61', '3300e828-5098-4bd2-b704-32fc089d8525');

-- helper: o usuário logado é RH/DP?
create or replace function app_private.is_rh_dp()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and rh_dp = true
  )
$$;
revoke all on function app_private.is_rh_dp() from public;
grant execute on function app_private.is_rh_dp() to authenticated;

-- RLS: leitura total para RH (só SELECT).
drop policy if exists solic_rh_select on public.solicitacoes_rh;
create policy solic_rh_select on public.solicitacoes_rh
for select to authenticated
using (
  gestor_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or app_private.is_aprovador_da_solic(id)
  or app_private.is_rh_dp()
);

drop policy if exists etapas_select on public.solicitacoes_rh_etapas;
create policy etapas_select on public.solicitacoes_rh_etapas
for select to authenticated
using (
  app_private.is_admin()
  or app_private.is_aprovador_da_solic(solicitacao_id)
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
  or app_private.is_rh_dp()
);

drop policy if exists form_select on public.formularios_contratacao;
create policy form_select on public.formularios_contratacao
for select to authenticated
using (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
  or app_private.is_rh_dp()
);

-- RPC: marca "visto" das requisições do usuário logado (zera a parcela de concluídas).
create or replace function public.solic_marcar_visto()
returns void language sql security definer set search_path = '' as $$
  update public.colaboradores set solic_visto_em = now() where auth_id = (select auth.uid());
$$;
revoke all on function public.solic_marcar_visto() from public;
grant execute on function public.solic_marcar_visto() to authenticated;
