-- ============================================================================
-- Requisições (DP) — esconder DESLIGAMENTO para pessoas específicas
-- ----------------------------------------------------------------------------
-- Regra: certos usuários mantêm o nível de permissão NORMAL deles, porém NÃO
-- podem ver requisições de desligamento. É por PESSOA (flag), não pelo tipo de
-- acesso — futuros usuários (inclusive rh_dp) seguem vendo desligamento.
-- Marcados agora: Ana Claudia Rodrigues da Costa e Maicon Henrique Vieira Morais
-- (acesso de acompanhamento). Para incluir/remover alguém depois, basta alterar
-- colaboradores.pode_ver_desligamento.
-- Aditivo e idempotente.
-- ============================================================================

alter table public.colaboradores
  add column if not exists pode_ver_desligamento boolean not null default true;

update public.colaboradores set pode_ver_desligamento = false
where id in (
  '3300e828-5098-4bd2-b704-32fc089d8525', -- Ana Claudia Rodrigues da Costa
  '6c13b1c3-7560-4f49-9afe-d99456731a61'  -- Maicon Henrique Vieira Morais
);

-- O chamador está bloqueado de ver desligamento?
create or replace function app_private.oculta_desligamento()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and pode_ver_desligamento = false
  )
$$;
revoke all on function app_private.oculta_desligamento() from public;
revoke execute on function app_private.oculta_desligamento() from anon;
grant execute on function app_private.oculta_desligamento() to authenticated;

-- O pai é desligamento? (usado na policy de etapas; SECURITY DEFINER lê sem RLS
-- e evita recursão de policy).
create or replace function app_private.solic_eh_desligamento(p_sol uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.solicitacoes_rh s
    where s.id = p_sol and s.tipo = 'desligamento'
  )
$$;
revoke all on function app_private.solic_eh_desligamento(uuid) from public;
revoke execute on function app_private.solic_eh_desligamento(uuid) from anon;
grant execute on function app_private.solic_eh_desligamento(uuid) to authenticated;

-- Envelope: mantém a visibilidade normal e apenas SUBTRAI desligamento p/ os
-- marcados.
alter policy solic_rh_select on public.solicitacoes_rh
using (
  (
    gestor_id = app_private.my_colaborador_id()
    or app_private.is_admin()
    or app_private.is_aprovador_da_solic(id)
    or app_private.is_rh_dp()
  )
  and not (app_private.oculta_desligamento() and tipo = 'desligamento')
);

-- Etapas: idem (senão a timeline do desligamento vazaria).
alter policy etapas_select on public.solicitacoes_rh_etapas
using (
  (
    app_private.is_admin()
    or app_private.is_aprovador_da_solic(solicitacao_id)
    or exists (
      select 1 from public.solicitacoes_rh s
      where s.id = solicitacoes_rh_etapas.solicitacao_id
        and s.gestor_id = app_private.my_colaborador_id()
    )
    or app_private.is_rh_dp()
  )
  and not (app_private.oculta_desligamento() and app_private.solic_eh_desligamento(solicitacao_id))
);
