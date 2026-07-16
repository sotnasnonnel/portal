-- Migration: financeiro_cartao_campos (projeto bogsuuhrgvopzgcceoqz)
--
-- Ajustes do formulário de Cartão Virtual (os formulários dos dois tipos passam
-- a ser diferentes; o de Aumento de Limite ainda será redefinido):
--   * "Nome da despesa" vira "Descrição do cartão" — só o RÓTULO muda; a coluna
--     nome_despesa continua a mesma (serve aos dois tipos).
--   * Vigência: checkbox "cartão vitalício" (default false). Desmarcado => range
--     periodo_inicio/periodo_fim. Marcado => sem datas (a informação é irrelevante).
--     A coluna `periodo` (data única) permanece, usada pelo Aumento de Limite.
--   * CNAE vira "Aplicação" com MÚLTIPLA escolha => cnae (text) -> aplicacao (text[]).
--
-- Tabela sem linhas quando aplicada: conversão livre, sem backfill.

alter table public.solicitacoes_financeiro
  add column if not exists vitalicio boolean not null default false,
  add column if not exists periodo_inicio date,
  add column if not exists periodo_fim date;

alter table public.solicitacoes_financeiro drop column if exists cnae;
alter table public.solicitacoes_financeiro add column if not exists aplicacao text[];

-- Integridade da vigência. Escopada por tipo para não restringir o Aumento de
-- Limite, que usa data única. Verificado: vitalício sem datas passa; cartão sem
-- range é bloqueado; fim < início é bloqueado; aumento com data única passa.
alter table public.solicitacoes_financeiro
  drop constraint if exists solic_fin_vitalicio_datas_check;
alter table public.solicitacoes_financeiro
  add constraint solic_fin_vitalicio_datas_check check (
    (vitalicio and periodo_inicio is null and periodo_fim is null)
    or (
      not vitalicio and (
        tipo <> 'cartao_virtual'
        or (periodo_inicio is not null and periodo_fim is not null and periodo_fim >= periodo_inicio)
      )
    )
  );
