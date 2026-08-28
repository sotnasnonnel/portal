-- Migração: Remarcação de férias (App Dp - Gestão de Pessoas)
-- Adiciona à tabela ciclos_ausencia os campos da proposta de remarcação.
-- As datas originais (ausencia_agendada_inicio/fim) permanecem intactas enquanto
-- a remarcação está pendente; ao aprovar, a proposta é aplicada e estes campos
-- são limpos; ao reprovar, a proposta é descartada e as datas originais mantidas.

alter table public.ciclos_ausencia
  add column if not exists remarcacao_inicio_proposto date,
  add column if not exists remarcacao_fim_proposto   date,
  add column if not exists justificativa_remarcacao  text;

-- Direito real de dias por período aquisitivo (importado da planilha de controle).
-- O sistema passa a calcular o saldo como (dias_direito - dias agendados) em vez de
-- assumir 21 fixos, para o saldo bater exatamente com a planilha. Fica NULL para
-- períodos/pessoas sem dado na planilha (nesses casos o sistema cai no padrão de 21).
alter table public.ciclos_ausencia
  add column if not exists dias_direito numeric;

-- ===== Fluxo de aprovação multi-etapas das Solicitações DP =====
-- Iniciativa do desligamento (NULL para retirada de dividendos / prestação de serviço).
alter table public.solicitacoes_rh
  add column if not exists iniciativa text; -- 'empresa' | 'empregado'

-- Uma linha por etapa do fluxo de cada solicitação (linha do tempo / aprovações).
create table if not exists public.solicitacoes_rh_etapas (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes_rh(id) on delete cascade,
  ordem          int,
  aprovador_id   uuid references public.colaboradores(id),
  papel          text,
  tipo_etapa     text not null default 'aprovacao', -- aprovacao | execucao | ciencia
  status         text not null default 'pendente',  -- pendente | aprovada | auto_aprovada | reprovada | executada | ciencia
  justificativa  text,
  decidido_em    timestamptz,
  created_at     timestamptz default now()
);

create index if not exists idx_etapas_solicitacao on public.solicitacoes_rh_etapas(solicitacao_id);
create index if not exists idx_etapas_aprovador   on public.solicitacoes_rh_etapas(aprovador_id);

-- Acesso via chave anônima (mesmo padrão das demais tabelas do app).
grant all on public.solicitacoes_rh_etapas to anon, authenticated;

-- A tabela nasce com RLS habilitado e sem policy, o que bloqueia leitura/escrita
-- via chave anônima. Libera acesso total (o app usa chave anônima + filtro no cliente,
-- mesmo modelo das outras tabelas).
alter table public.solicitacoes_rh_etapas enable row level security;
drop policy if exists "anon_all_etapas" on public.solicitacoes_rh_etapas;
create policy "anon_all_etapas" on public.solicitacoes_rh_etapas
  for all to anon, authenticated using (true) with check (true);
1