-- Migration: financeiro_solicitacoes (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Motor de aprovação do módulo Financeiro — tabelas NOVAS e isoladas, espelhando
-- o padrão das Requisições DP (solicitacoes_rh / _etapas / _fluxos), mas sem
-- reaproveitar as tabelas do DP. A LÓGICA (montar etapas, etapa atual, etc.)
-- será portada em código (config/aprovacaoFinanceiro.js).
--
-- Decisões (2026-07-15): cadeia CONFIGURÁVEL por solicitante (igual DP).
-- "Quem abre" e "quem executa" ficaram para decidir depois — por isso:
--   * INSERT liberado para o próprio solicitante (solicitante_id = meu id);
--   * etapas.aprovador_id é NULLABLE (execução pode ser um id fixo OU "qualquer
--     admin do Financeiro" = id nulo + financeiro_role='admin').
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper de RLS: o usuário logado é admin do Financeiro?
-- (app_private já existe, criado na RLS do DP.)
-- ----------------------------------------------------------------------------
create or replace function app_private.is_financeiro_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and financeiro_role = 'admin'
  )
$$;
revoke all on function app_private.is_financeiro_admin() from public;
grant execute on function app_private.is_financeiro_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- 1) Envelope da solicitação
-- ----------------------------------------------------------------------------
create table if not exists public.solicitacoes_financeiro (
  id uuid primary key default gen_random_uuid(),
  numero bigint,
  tipo text not null check (tipo in ('cartao_virtual', 'aumento_limite')),
  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'reprovada')),
  solicitante_id uuid not null references public.colaboradores(id),
  justificativa text,
  aceite_termos boolean not null default false,       -- checkbox "Li e estou de acordo"
  aceite_termos_em timestamptz,                        -- data/hora do aceite (usuário = solicitante_id)
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  concluida_em timestamptz
);

-- Numeração sequencial curta e estável (#1, #2, ...), como no DP.
create sequence if not exists public.solicitacoes_financeiro_numero_seq
  owned by public.solicitacoes_financeiro.numero;
alter table public.solicitacoes_financeiro
  alter column numero set default nextval('public.solicitacoes_financeiro_numero_seq');
alter table public.solicitacoes_financeiro alter column numero set not null;
create unique index if not exists solicitacoes_financeiro_numero_key
  on public.solicitacoes_financeiro (numero);

-- ----------------------------------------------------------------------------
-- 2) Etapas do fluxo (cadeia de aprovação + execução final)
-- ----------------------------------------------------------------------------
create table if not exists public.solicitacoes_financeiro_etapas (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes_financeiro(id) on delete cascade,
  ordem int not null,
  aprovador_id uuid references public.colaboradores(id),  -- nullable: execução "qualquer admin"
  papel text,
  tipo_etapa text not null check (tipo_etapa in ('aprovacao', 'execucao')),
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'auto_aprovada', 'reprovada', 'executada')),
  justificativa text,
  decidido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists solic_fin_etapas_solic_idx
  on public.solicitacoes_financeiro_etapas (solicitacao_id);

-- ----------------------------------------------------------------------------
-- 3) Fluxos configuráveis por solicitante e tipo (cadeia ordenada de aprovadores)
-- ----------------------------------------------------------------------------
create table if not exists public.solicitacoes_financeiro_fluxos (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.colaboradores(id),
  tipo text not null check (tipo in ('cartao_virtual', 'aumento_limite')),
  aprovadores uuid[] not null default '{}',   -- ordenado
  updated_at timestamptz not null default now(),
  unique (solicitante_id, tipo)
);

-- ============================================================================
-- RLS — mesma semântica do DP: participa quem é solicitante, admin do
-- Financeiro, ou aprovador em alguma etapa.
-- ============================================================================
alter table public.solicitacoes_financeiro enable row level security;
alter table public.solicitacoes_financeiro_etapas enable row level security;
alter table public.solicitacoes_financeiro_fluxos enable row level security;

-- ---- Envelope ----
drop policy if exists solic_fin_select on public.solicitacoes_financeiro;
create policy solic_fin_select on public.solicitacoes_financeiro
for select to authenticated
using (
  solicitante_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or exists (select 1 from public.solicitacoes_financeiro_etapas e
             where e.solicitacao_id = id and e.aprovador_id = app_private.my_colaborador_id())
);

drop policy if exists solic_fin_insert on public.solicitacoes_financeiro;
create policy solic_fin_insert on public.solicitacoes_financeiro
for insert to authenticated
with check ( solicitante_id = app_private.my_colaborador_id() or app_private.is_financeiro_admin() );

drop policy if exists solic_fin_update on public.solicitacoes_financeiro;
create policy solic_fin_update on public.solicitacoes_financeiro
for update to authenticated
using (
  solicitante_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or exists (select 1 from public.solicitacoes_financeiro_etapas e
             where e.solicitacao_id = id and e.aprovador_id = app_private.my_colaborador_id())
)
with check (
  solicitante_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or exists (select 1 from public.solicitacoes_financeiro_etapas e
             where e.solicitacao_id = id and e.aprovador_id = app_private.my_colaborador_id())
);

-- ---- Etapas ----
drop policy if exists solic_fin_etapas_select on public.solicitacoes_financeiro_etapas;
create policy solic_fin_etapas_select on public.solicitacoes_financeiro_etapas
for select to authenticated
using (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or exists (select 1 from public.solicitacoes_financeiro s
             where s.id = solicitacao_id and s.solicitante_id = app_private.my_colaborador_id())
);

drop policy if exists solic_fin_etapas_write on public.solicitacoes_financeiro_etapas;
create policy solic_fin_etapas_write on public.solicitacoes_financeiro_etapas
for all to authenticated
using (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or exists (select 1 from public.solicitacoes_financeiro s
             where s.id = solicitacao_id and s.solicitante_id = app_private.my_colaborador_id())
)
with check (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_financeiro_admin()
  or exists (select 1 from public.solicitacoes_financeiro s
             where s.id = solicitacao_id and s.solicitante_id = app_private.my_colaborador_id())
);

-- ---- Fluxos ----
-- Leitura: o próprio solicitante (p/ saber se está configurado) e admin do Financeiro.
-- Escrita: só admin do Financeiro.
drop policy if exists solic_fin_fluxos_select on public.solicitacoes_financeiro_fluxos;
create policy solic_fin_fluxos_select on public.solicitacoes_financeiro_fluxos
for select to authenticated
using ( solicitante_id = app_private.my_colaborador_id() or app_private.is_financeiro_admin() );

drop policy if exists solic_fin_fluxos_write on public.solicitacoes_financeiro_fluxos;
create policy solic_fin_fluxos_write on public.solicitacoes_financeiro_fluxos
for all to authenticated
using ( app_private.is_financeiro_admin() )
with check ( app_private.is_financeiro_admin() );
