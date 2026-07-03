-- Migration: funcoes_e_alteracao_cargo_funcao (aplicada em 2026-06-12 no projeto bogsuuhrgvopzgcceoqz)
-- Tabela de funções oficiais (origem: planilha FUNÇÃO.xlsx) + funções criadas via "Outro" nas requisições.

create table if not exists public.funcoes (
  id uuid primary key default gen_random_uuid(),
  codigo int,
  nome text not null,
  origem text not null default 'planilha' check (origem in ('planilha', 'requisicao')),
  created_at timestamptz not null default now()
);

create unique index if not exists funcoes_nome_unico on public.funcoes (upper(nome));

-- Mesmo padrão de acesso das demais tabelas do App Dp (login custom, anon key).
alter table public.funcoes enable row level security;
create policy anon_all_funcoes on public.funcoes for all to anon, authenticated using (true) with check (true);

-- Campos propostos na requisição de Alteração (tipo aumento_salario).
alter table public.solicitacoes_rh add column if not exists funcao_proposta text;
alter table public.solicitacoes_rh add column if not exists cargo_proposto text;

-- Seed das 132 funções únicas da planilha: ver scripts/seed_funcoes.sql
-- (gerado por scripts/gerar_seed_funcoes.cjs a partir de scripts/funcoes_extraidas.json;
--  a planilha tem 135 linhas, 3 nomes duplicados mantêm a primeira ocorrência).
