-- Migration: financeiro_campos_solicitacao (projeto bogsuuhrgvopzgcceoqz)
--
-- Campos compartilhados pelas solicitações do Financeiro (Cartão Virtual e
-- Aumento de Limite), no próprio envelope solicitacoes_financeiro.
alter table public.solicitacoes_financeiro
  add column if not exists nome_despesa text,
  add column if not exists centro_custo text,
  add column if not exists valor numeric,
  add column if not exists periodo date,
  add column if not exists cnae text,
  add column if not exists observacao text;
