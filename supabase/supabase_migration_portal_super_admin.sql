-- ============================================================================
-- Super-admin do Portal (por e-mail) — independe do papel em qualquer app.
-- Permite que lennon.santos gerencie acessos em /portal-admin mesmo sendo
-- "usuario" no Gestão de Pessoas (ou em qualquer módulo), e alterne o próprio
-- papel sem se trancar para fora.
-- O e-mail vem do claim verificado do JWT (não é editável pelo usuário).
-- ============================================================================

create or replace function app_private.is_portal_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'lennon.santos@phdengenharia.eng.br'
$$;
revoke all on function app_private.is_portal_super_admin() from public;
grant execute on function app_private.is_portal_super_admin() to authenticated;

-- colaboradores: super-admin sempre lê e escreve
drop policy if exists colaboradores_select on public.colaboradores;
create policy colaboradores_select on public.colaboradores
for select to authenticated
using (
  auth_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))
  or app_private.is_admin()
  or app_private.is_portal_super_admin()
  or superior_id = app_private.my_colaborador_id()
);

drop policy if exists colaboradores_admin_write on public.colaboradores;
create policy colaboradores_admin_write on public.colaboradores
for all to authenticated
using (app_private.is_admin() or app_private.is_portal_super_admin())
with check (app_private.is_admin() or app_private.is_portal_super_admin());

-- reembolso_profiles: super-admin sempre lê e escreve
drop policy if exists reembolso_profiles_select on public.reembolso_profiles;
create policy reembolso_profiles_select on public.reembolso_profiles
for select to authenticated
using (
  id = (select auth.uid())
  or reembolso_private.my_role() = any (array['gestor'::reembolso_role, 'admin'::reembolso_role])
  or app_private.is_portal_super_admin()
);

drop policy if exists reembolso_profiles_update on public.reembolso_profiles;
create policy reembolso_profiles_update on public.reembolso_profiles
for update to authenticated
using (id = (select auth.uid()) or reembolso_private.my_role() = 'admin'::reembolso_role or app_private.is_portal_super_admin())
with check (id = (select auth.uid()) or reembolso_private.my_role() = 'admin'::reembolso_role or app_private.is_portal_super_admin());

-- guard do reembolso: não reverte troca de role/manager feita pelo super-admin
create or replace function reembolso_private.guard_profile()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if (new.role is distinct from old.role or new.manager_id is distinct from old.manager_id)
     and coalesce(reembolso_private.my_role(), 'solicitante') <> 'admin'
     and not app_private.is_portal_super_admin() then
    new.role := old.role;
    new.manager_id := old.manager_id;
  end if;
  return new;
end; $$;
