-- ============================================================================
-- Módulo Controle de Horas (estilo Clockify) — Portal PHD  (banco compartilhado)
-- ----------------------------------------------------------------------------
-- Time tracker por usuário: cada colaborador registra suas horas contra
-- PROJETOS. Adaptado à estrutura atual do portal:
--   * Pessoas vêm de `colaboradores` (colaborador_id) — sem recadastro.
--   * Admin do módulo = admin do portal (app_private.is_admin() / super-admin) —
--     sem tabela de papéis nem tela de concessão.
--   * Módulo aberto a todos os usuários logados (membro por padrão).
--
-- Papéis efetivos (derivados, no front):
--   admin  -> gerencia projetos e vê o tempo de TODOS
--   membro -> registra e vê o PRÓPRIO tempo
--
-- Reaproveita os helpers já existentes em app_private:
--   my_colaborador_id() · is_admin() · is_portal_super_admin()
--
-- ATENÇÃO: rode primeiro numa BRANCH do Supabase e valide login + módulo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Tabelas
-- ----------------------------------------------------------------------------

-- Projetos: lista única da empresa (workspace Clockify). Admin gerencia.
create table if not exists public.horas_projetos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cliente    text,                         -- opcional (nome do cliente)
  cor        text not null default '#C44A28',
  arquivado  boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists horas_projetos_ativo_idx on public.horas_projetos (arquivado, nome);

-- Apontamentos (time entries) de cada colaborador contra um projeto.
create table if not exists public.horas_apontamentos (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  projeto_id     uuid references public.horas_projetos(id) on delete set null,
  descricao      text,
  inicio         timestamptz not null,
  fim            timestamptz not null,
  -- duração calculada pelo banco (coluna gerada): impossível gravar inconsistente.
  duracao_ms     bigint generated always as ((extract(epoch from (fim - inicio)) * 1000)::bigint) stored,
  criado_em      timestamptz not null default now(),
  constraint horas_apont_fim_maior check (fim > inicio)
);
create index if not exists horas_apont_colab_idx on public.horas_apontamentos (colaborador_id, inicio desc);
create index if not exists horas_apont_projeto_idx on public.horas_apontamentos (projeto_id, inicio desc);

-- Cronômetro em andamento persistido no banco (1 por colaborador) — segue em
-- qualquer dispositivo. Vira uma linha em horas_apontamentos ao encerrar.
create table if not exists public.horas_timer_ativo (
  colaborador_id uuid primary key references public.colaboradores(id) on delete cascade,
  projeto_id     uuid references public.horas_projetos(id) on delete set null,
  descricao      text,
  inicio         timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 1) RLS
-- ----------------------------------------------------------------------------

-- horas_projetos: qualquer logado LÊ (precisa escolher ao apontar).
-- Escrita (criar/editar/arquivar): só admin do portal / super-admin.
alter table public.horas_projetos enable row level security;

drop policy if exists horas_projetos_select on public.horas_projetos;
create policy horas_projetos_select on public.horas_projetos
for select to authenticated
using ( true );

drop policy if exists horas_projetos_write on public.horas_projetos;
create policy horas_projetos_write on public.horas_projetos
for all to authenticated
using (app_private.is_admin() or app_private.is_portal_super_admin())
with check (app_private.is_admin() or app_private.is_portal_super_admin());

-- horas_apontamentos:
--   Leitura: os próprios; admin/super-admin veem todos.
--   Escrita: os próprios; admin/super-admin também.
alter table public.horas_apontamentos enable row level security;

drop policy if exists horas_apont_select on public.horas_apontamentos;
create policy horas_apont_select on public.horas_apontamentos
for select to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or app_private.is_portal_super_admin()
);

drop policy if exists horas_apont_insert on public.horas_apontamentos;
create policy horas_apont_insert on public.horas_apontamentos
for insert to authenticated
with check (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or app_private.is_portal_super_admin()
);

drop policy if exists horas_apont_update on public.horas_apontamentos;
create policy horas_apont_update on public.horas_apontamentos
for update to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or app_private.is_portal_super_admin()
)
with check (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or app_private.is_portal_super_admin()
);

drop policy if exists horas_apont_delete on public.horas_apontamentos;
create policy horas_apont_delete on public.horas_apontamentos
for delete to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or app_private.is_portal_super_admin()
);

-- horas_timer_ativo: cada um gerencia o próprio timer (super-admin também).
alter table public.horas_timer_ativo enable row level security;

drop policy if exists horas_timer_rw on public.horas_timer_ativo;
create policy horas_timer_rw on public.horas_timer_ativo
for all to authenticated
using (colaborador_id = app_private.my_colaborador_id() or app_private.is_portal_super_admin())
with check (colaborador_id = app_private.my_colaborador_id() or app_private.is_portal_super_admin());

-- ----------------------------------------------------------------------------
-- 2) Seed de projetos de exemplo (ajuste/arquive depois na tela Projetos).
-- ----------------------------------------------------------------------------
insert into public.horas_projetos (nome, cliente, cor)
select * from (values
  ('Projeto Hidrelétrica', 'Cliente A', '#C44A28'),
  ('Projeto Subestação',   'Cliente A', '#26405d'),
  ('Manutenção Preventiva', null,       '#00a49a'),
  ('Interno / Administrativo', null,    '#64748b')
) as v(nome, cliente, cor)
where not exists (select 1 from public.horas_projetos);

-- ============================================================================
-- Depois de aplicar: rode get_advisors(security) — não deve haver
-- rls_disabled_in_public para as tabelas horas_*. Valide login + Apontar.
--
-- Admin do módulo = quem tem perfil 'admin' em colaboradores (ou o super-admin
-- do portal). Não há concessão extra: os admins do portal já gerenciam projetos
-- e veem o tempo de todos.
-- ============================================================================
