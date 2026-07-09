-- ============================================================================
-- Controle de Horas — papel PRÓPRIO do módulo, editável em /portal-admin.
-- ----------------------------------------------------------------------------
-- Antes o admin do Horas era derivado de colaboradores.perfil='admin' (não dava
-- para editar). Agora vive em `colaboradores.horas_role` ('usuario' | 'admin'),
-- no mesmo padrão do flag `rh_dp` que já existe naquela tabela.
--
-- Aditivo: adiciona coluna e funções; substitui apenas as policies das tabelas
-- horas_* (trocando is_admin() por is_horas_admin()). Nada é apagado.
-- ============================================================================

alter table public.colaboradores
  add column if not exists horas_role text not null default 'usuario';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'colaboradores_horas_role_check') then
    alter table public.colaboradores
      add constraint colaboradores_horas_role_check check (horas_role in ('usuario','admin'));
  end if;
end $$;

-- Preserva o comportamento anterior: admins do portal seguem admins do Horas.
update public.colaboradores set horas_role = 'admin'
where perfil = 'admin' and horas_role <> 'admin';

-- Admin do módulo (SECURITY DEFINER: evita recursão de RLS ao ler colaboradores).
create or replace function app_private.is_horas_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and horas_role = 'admin'
  )
$$;
revoke all on function app_private.is_horas_admin() from public;
grant execute on function app_private.is_horas_admin() to authenticated;

-- Lista de colaboradores para as visões de admin do Horas.
-- Devolve SÓ id/nome/funcao (nunca salário/senha) e apenas para admin do módulo.
-- Sem isso, um admin do Horas que não é admin do portal não leria `colaboradores`
-- (RLS), e liberar a tabela inteira exporia dados sensíveis.
create or replace function public.horas_colaboradores()
returns table (id uuid, nome text, funcao text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.funcao
  from public.colaboradores c
  where app_private.is_horas_admin() or app_private.is_portal_super_admin()
  order by c.nome
$$;
revoke all on function public.horas_colaboradores() from public;
grant execute on function public.horas_colaboradores() to authenticated;

-- ---- RLS das tabelas horas_*: is_admin() -> is_horas_admin() ----------------

drop policy if exists horas_projetos_write on public.horas_projetos;
create policy horas_projetos_write on public.horas_projetos
for all to authenticated
using (app_private.is_horas_admin() or app_private.is_portal_super_admin())
with check (app_private.is_horas_admin() or app_private.is_portal_super_admin());

drop policy if exists horas_apont_select on public.horas_apontamentos;
create policy horas_apont_select on public.horas_apontamentos
for select to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_admin()
  or app_private.is_portal_super_admin()
);

drop policy if exists horas_apont_insert on public.horas_apontamentos;
create policy horas_apont_insert on public.horas_apontamentos
for insert to authenticated
with check (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_admin()
  or app_private.is_portal_super_admin()
);

drop policy if exists horas_apont_update on public.horas_apontamentos;
create policy horas_apont_update on public.horas_apontamentos
for update to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_admin()
  or app_private.is_portal_super_admin()
)
with check (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_admin()
  or app_private.is_portal_super_admin()
);

drop policy if exists horas_apont_delete on public.horas_apontamentos;
create policy horas_apont_delete on public.horas_apontamentos
for delete to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_admin()
  or app_private.is_portal_super_admin()
);
