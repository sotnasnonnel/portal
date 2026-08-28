-- Migration: financeiro_cartao_contato (projeto bogsuuhrgvopzgcceoqz)
--
-- Dados de contato do portador na solicitação de Cartão Virtual (envelope).
-- Nulos no Aumento de Limite (que referencia um cartão já existente).
alter table public.solicitacoes_financeiro
  add column if not exists nome_completo text,
  add column if not exists email text,
  add column if not exists telefone text;
