-- Migração: Fluxos de aprovação configuráveis (App Dp - Gestão de Pessoas)
-- ----------------------------------------------------------------------------
-- O admin passa a montar a cadeia de aprovação POR solicitante, POR tipo e
-- (no desligamento) POR iniciativa. Esta tabela guarda o "molde" da cadeia.
-- As etapas reais continuam sendo fotografadas em solicitacoes_rh_etapas na
-- criação da solicitação (mudar o molde depois não afeta solicitações em
-- andamento).
--
-- MODELO SIMPLIFICADO (decidido com o usuário):
--   * Aprovadores: escolhidos só entre gestores/admin (quem tem tela de aprovar).
--   * Execução final: SEMPRE o admin (APROVADORES.admin), acrescentada
--     automaticamente pelo código — NÃO é configurável aqui (por isso não há
--     coluna executor_id).
--
-- Convenções importantes (alinhadas com o código):
--   * iniciativa: NUNCA NULL.
--       - 'aumento_salario'        -> iniciativa = ''      (sentinela)
--       - 'desligamento'           -> 'empresa' | 'empregado'
--     (NOT NULL + sentinela '' permite UNIQUE composta normal e upsert via
--      onConflict, que o PostgREST não suporta sobre índice de expressão.)
--   * aprovadores: array JSON ORDENADO de colaborador_id (uuid em texto,
--     lowercase). A ordem do array = a ordem das etapas de aprovação.

create table if not exists public.solicitacoes_rh_fluxos (
  id              uuid primary key default gen_random_uuid(),
  solicitante_id  uuid not null references public.colaboradores(id) on delete cascade,
  tipo            text not null check (tipo in ('aumento_salario', 'desligamento')),
  iniciativa      text not null default '' check (iniciativa in ('', 'empresa', 'empregado')),
  aprovadores     jsonb not null default '[]'::jsonb check (jsonb_typeof(aprovadores) = 'array'),
  updated_at      timestamptz default now(),
  created_at      timestamptz default now(),
  constraint uniq_fluxo unique (solicitante_id, tipo, iniciativa)
);

-- A UNIQUE composta já indexa por solicitante_id (coluna líder), então não é
-- preciso índice extra só de solicitante_id.

-- Acesso via chave anônima (mesmo padrão das demais tabelas do app).
grant all on public.solicitacoes_rh_fluxos to anon, authenticated;

-- RLS habilitado + policy liberando acesso (o app usa chave anônima + filtro
-- no cliente, mesmo modelo das outras tabelas).
alter table public.solicitacoes_rh_fluxos enable row level security;
drop policy if exists "anon_all_fluxos" on public.solicitacoes_rh_fluxos;
create policy "anon_all_fluxos" on public.solicitacoes_rh_fluxos
  for all to anon, authenticated using (true) with check (true);
