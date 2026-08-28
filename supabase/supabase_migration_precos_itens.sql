-- ============================================================================
-- Módulo DP — Ajustes de Valores (catálogo global de preços)
-- ----------------------------------------------------------------------------
-- Preço por item dos catálogos que já existem nos formulários de requisição:
--   equipamento (Nova Vaga) | software | epi | beneficio (Contratação).
-- Preços GLOBAIS (um valor por item, vale para todos).
--
-- Leitura: qualquer autenticado (os formulários mostram o preço ao lado da opção).
-- Escrita: só quem é gestor ou admin do DP (helper app_private.is_gestor_or_admin).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: o usuário logado é gestor OU admin do DP?
-- (SECURITY DEFINER p/ não recursar na RLS de colaboradores; ver rls_dp.sql)
-- ----------------------------------------------------------------------------
create or replace function app_private.is_gestor_or_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and perfil in ('gestor', 'admin')
  )
$$;

revoke all on function app_private.is_gestor_or_admin() from public;
grant execute on function app_private.is_gestor_or_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- Tabela de preços
-- ----------------------------------------------------------------------------
create table if not exists public.precos_itens (
  id uuid primary key default gen_random_uuid(),
  catalogo text not null check (catalogo in ('equipamento', 'software', 'epi', 'beneficio')),
  item text not null,
  preco numeric(12,2),                                   -- null = sem preço definido
  updated_at timestamptz not null default now(),
  updated_by uuid references public.colaboradores(id),
  unique (catalogo, item)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.precos_itens enable row level security;

drop policy if exists precos_itens_select on public.precos_itens;
create policy precos_itens_select on public.precos_itens
for select to authenticated
using (true);

drop policy if exists precos_itens_write on public.precos_itens;
create policy precos_itens_write on public.precos_itens
for all to authenticated
using (app_private.is_gestor_or_admin())
with check (app_private.is_gestor_or_admin());

-- ----------------------------------------------------------------------------
-- Seed opcional (único item da lista de referência que casa com uma opção
-- existente do formulário — EPI "Agasalho"). Os demais preços são digitados
-- na tela "Ajustes de Valores".
-- ----------------------------------------------------------------------------
insert into public.precos_itens (catalogo, item, preco)
values ('epi', 'Agasalho', 150.00)
on conflict (catalogo, item) do nothing;
