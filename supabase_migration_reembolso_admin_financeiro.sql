-- Reembolso: admin do Financeiro enxerga como a Alessandra
-- ---------------------------------------------------------------------------
-- Ate aqui, "admin do reembolso" era so quem tinha reembolso_profiles.role =
-- 'admin' (Alessandra). O time do Financeiro (colaboradores.financeiro_role =
-- 'admin') passa a ter a mesma visao: enxerga todos os pedidos, agenda
-- pagamento e gera o PDF com as notas anexadas.
--
-- my_role() continua devolvendo o papel real (o gestor segue gestor e aprova a
-- equipe). Quem responde "e admin aqui?" agora e is_admin(), usada nas policies
-- e nos helpers can_view/can_edit.

create or replace function reembolso_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select role = 'admin' from reembolso_profiles where id = auth.uid()), false)
      or exists (
           select 1 from colaboradores c
           where c.auth_id = auth.uid()
             and c.financeiro_role = 'admin'
         );
$function$;

create or replace function reembolso_private.can_view(rid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from reembolso_reimbursements r
    where r.id = rid
      and ( r.requester_id = auth.uid()
            or r.manager_id = auth.uid()
            or reembolso_private.is_admin() )
  );
$function$;

create or replace function reembolso_private.can_edit(rid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from reembolso_reimbursements r
    where r.id = rid
      and ( r.requester_id = auth.uid()
            or reembolso_private.is_admin() )
  );
$function$;

-- Pedidos: ver / editar / excluir
drop policy if exists reembolso_reimb_select on reembolso_reimbursements;
create policy reembolso_reimb_select on reembolso_reimbursements
  for select using (
    requester_id = auth.uid()
    or manager_id = auth.uid()
    or reembolso_private.is_admin()
  );

drop policy if exists reembolso_reimb_update on reembolso_reimbursements;
create policy reembolso_reimb_update on reembolso_reimbursements
  for update using (
    requester_id = auth.uid()
    or manager_id = auth.uid()
    or reembolso_private.is_admin()
  ) with check (
    requester_id = auth.uid()
    or manager_id = auth.uid()
    or reembolso_private.is_admin()
  );

drop policy if exists reembolso_reimb_delete on reembolso_reimbursements;
create policy reembolso_reimb_delete on reembolso_reimbursements
  for delete using (reembolso_private.is_admin());

-- Cadastro de perfis do reembolso (Gerenciar acessos)
drop policy if exists reembolso_profiles_select on reembolso_profiles;
create policy reembolso_profiles_select on reembolso_profiles
  for select using (
    id = (select auth.uid())
    or reembolso_private.my_role() = any (array['gestor'::reembolso_role, 'admin'::reembolso_role])
    or reembolso_private.is_admin()
    or app_private.is_portal_super_admin()
  );

drop policy if exists reembolso_profiles_update on reembolso_profiles;
create policy reembolso_profiles_update on reembolso_profiles
  for update using (
    id = (select auth.uid())
    or reembolso_private.is_admin()
    or app_private.is_portal_super_admin()
  ) with check (
    id = (select auth.uid())
    or reembolso_private.is_admin()
    or app_private.is_portal_super_admin()
  );

drop policy if exists reembolso_profiles_insert on reembolso_profiles;
create policy reembolso_profiles_insert on reembolso_profiles
  for insert with check (reembolso_private.is_admin());
