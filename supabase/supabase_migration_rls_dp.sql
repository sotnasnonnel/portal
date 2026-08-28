-- ============================================================================
-- RLS Portal PHD — módulo DP  (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Habilita RLS nas 5 tabelas hoje EXPOSTAS sem proteção e cria políticas por
-- perfil. Helpers ficam num schema privado (SECURITY DEFINER) para checar
-- admin/equipe sem causar recursão de RLS na própria tabela colaboradores.
--
-- ATENÇÃO: rode primeiro numa BRANCH do Supabase (ou em horário de baixo uso)
-- e valide login + cada módulo. Ligar RLS onde hoje não há = nega tudo que
-- não estiver coberto por uma policy.
--
-- Pré-requisito de código: a vinculação do auth_id no 1º login deixa de ser um
-- UPDATE direto e passa a chamar a função public.link_my_auth() (ver no fim).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Schema privado + helpers
-- ----------------------------------------------------------------------------
create schema if not exists app_private;
grant usage on schema app_private to authenticated;   -- só p/ executar as funções abaixo

-- id do colaborador logado (sem recursão: lê por auth_id ignorando RLS)
create or replace function app_private.my_colaborador_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.colaboradores
  where auth_id = (select auth.uid()) limit 1
$$;

-- o usuário logado é admin do DP?
create or replace function app_private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and perfil = 'admin'
  )
$$;

-- o usuário logado é superior direto de <target>?
create or replace function app_private.manages(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores c
    where c.id = target
      and c.superior_id = (
        select id from public.colaboradores
        where auth_id = (select auth.uid()) limit 1
      )
  )
$$;

revoke all on function app_private.my_colaborador_id(), app_private.is_admin(), app_private.manages(uuid) from public;
grant execute on function app_private.my_colaborador_id(), app_private.is_admin(), app_private.manages(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 1) colaboradores  (tem senha/salario — dados sensíveis)
--    Leitura: própria linha + admin + equipe (superior direto).
--    Escrita: só admin (self-service do auth_id vai pela RPC link_my_auth).
-- ----------------------------------------------------------------------------
alter table public.colaboradores enable row level security;

drop policy if exists colaboradores_select on public.colaboradores;
create policy colaboradores_select on public.colaboradores
for select to authenticated
using (
  auth_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))   -- 1º login (auth_id ainda nulo)
  or app_private.is_admin()
  or superior_id = app_private.my_colaborador_id()
);

drop policy if exists colaboradores_admin_write on public.colaboradores;
create policy colaboradores_admin_write on public.colaboradores
for all to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

-- 1º login: vincula o auth_id à linha do colaborador pelo e-mail, sem dar
-- UPDATE de colaboradores para usuário comum (evita escalonar perfil/salario).
create or replace function public.link_my_auth()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.colaboradores
  set auth_id = (select auth.uid())
  where auth_id is null
    and lower(email) = lower((select auth.jwt() ->> 'email'));
end;
$$;
revoke all on function public.link_my_auth() from public;
grant execute on function public.link_my_auth() to authenticated;

-- ----------------------------------------------------------------------------
-- 2) ciclos_ausencia  (colaborador_id)
--    Usuário: os próprios.  Gestor: equipe.  Admin: tudo.
-- ----------------------------------------------------------------------------
alter table public.ciclos_ausencia enable row level security;

drop policy if exists ciclos_select on public.ciclos_ausencia;
create policy ciclos_select on public.ciclos_ausencia
for select to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.manages(colaborador_id)
  or app_private.is_admin()
);

drop policy if exists ciclos_insert on public.ciclos_ausencia;
create policy ciclos_insert on public.ciclos_ausencia
for insert to authenticated
with check ( colaborador_id = app_private.my_colaborador_id() or app_private.is_admin() );

-- gestor aprova/remarca os da equipe; usuário edita os próprios; admin tudo
drop policy if exists ciclos_update on public.ciclos_ausencia;
create policy ciclos_update on public.ciclos_ausencia
for update to authenticated
using ( colaborador_id = app_private.my_colaborador_id() or app_private.manages(colaborador_id) or app_private.is_admin() )
with check ( colaborador_id = app_private.my_colaborador_id() or app_private.manages(colaborador_id) or app_private.is_admin() );

-- ----------------------------------------------------------------------------
-- 3) solicitacoes_rh  (gestor_id criador, etapas com aprovador_id)
-- ----------------------------------------------------------------------------
alter table public.solicitacoes_rh enable row level security;

drop policy if exists solic_rh_select on public.solicitacoes_rh;
create policy solic_rh_select on public.solicitacoes_rh
for select to authenticated
using (
  gestor_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh_etapas e
             where e.solicitacao_id = id and e.aprovador_id = app_private.my_colaborador_id())
);

drop policy if exists solic_rh_insert on public.solicitacoes_rh;
create policy solic_rh_insert on public.solicitacoes_rh
for insert to authenticated
with check ( gestor_id = app_private.my_colaborador_id() or app_private.is_admin() );

drop policy if exists solic_rh_update on public.solicitacoes_rh;
create policy solic_rh_update on public.solicitacoes_rh
for update to authenticated
using (
  gestor_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh_etapas e
             where e.solicitacao_id = id and e.aprovador_id = app_private.my_colaborador_id())
)
with check (
  gestor_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh_etapas e
             where e.solicitacao_id = id and e.aprovador_id = app_private.my_colaborador_id())
);

-- ----------------------------------------------------------------------------
-- 4) solicitacoes_rh_etapas  (troca a policy permissiva anon_all_etapas)
--    Vê/decide quem participa da solicitação-pai (criador/aprovador) ou admin.
-- ----------------------------------------------------------------------------
drop policy if exists anon_all_etapas on public.solicitacoes_rh_etapas;
alter table public.solicitacoes_rh_etapas enable row level security;

drop policy if exists etapas_select on public.solicitacoes_rh_etapas;
create policy etapas_select on public.solicitacoes_rh_etapas
for select to authenticated
using (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

drop policy if exists etapas_write on public.solicitacoes_rh_etapas;
create policy etapas_write on public.solicitacoes_rh_etapas
for all to authenticated
using (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
)
with check (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

-- (idem para solicitacoes_rh_fluxos: troque anon_all_fluxos por leitura
--  'to authenticated' e escrita só is_admin(), conforme seu fluxo de cadastro.)

-- ----------------------------------------------------------------------------
-- 5) formularios_contratacao  (solicitacao_id -> herda do pai)
-- ----------------------------------------------------------------------------
alter table public.formularios_contratacao enable row level security;

drop policy if exists form_select on public.formularios_contratacao;
create policy form_select on public.formularios_contratacao
for select to authenticated
using (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

drop policy if exists form_write on public.formularios_contratacao;
create policy form_write on public.formularios_contratacao
for all to authenticated
using (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
)
with check (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

-- ----------------------------------------------------------------------------
-- 6) controle_ausencias_excel  (import legado, casa por e-mail)
-- ----------------------------------------------------------------------------
alter table public.controle_ausencias_excel enable row level security;

drop policy if exists controle_select on public.controle_ausencias_excel;
create policy controle_select on public.controle_ausencias_excel
for select to authenticated
using ( lower(email) = lower((select auth.jwt() ->> 'email')) or app_private.is_admin() );

drop policy if exists controle_admin_write on public.controle_ausencias_excel;
create policy controle_admin_write on public.controle_ausencias_excel
for all to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

-- ============================================================================
-- Depois de aplicar: rode get_advisors(security) de novo — os 5 erros
-- rls_disabled_in_public devem sumir. Valide login, dashboards e aprovações.
-- ============================================================================
