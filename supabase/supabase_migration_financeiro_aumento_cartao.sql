-- Migration: financeiro_aumento_cartao_id (projeto bogsuuhrgvopzgcceoqz)
--
-- O Aumento de Limite passa a apontar para o CARTÃO que vai receber o aumento.
--
-- IMPORTANTE — não existe entidade "cartão" no portal: o cartão é gerado pelo
-- Financeiro no sistema do banco, fora daqui. Por convenção (decidida em
-- 2026-07-16), um "cartão" é a própria solicitação de Cartão Virtual já
-- CONCLUÍDA (executada) da pessoa — por isso a FK aponta para a mesma tabela.
-- A regra vive em src/modules/financeiro/app/solicitacoes/cartoes.js.
--
-- Semântica: no aumento, `valor` = NOVO LIMITE TOTAL do cartão (não o crédito
-- adicional). Logo, o limite vigente de um cartão = valor do último aumento
-- concluído dele, ou o valor original se nunca houve aumento.
--
-- O aumento copia (snapshot) descrição/CC/aplicação/vigência do cartão no envio,
-- para telas e e-mail seguirem lendo as colunas do próprio registro.
alter table public.solicitacoes_financeiro
  add column if not exists cartao_id uuid references public.solicitacoes_financeiro(id);

-- cartao_id só faz sentido no aumento de limite.
alter table public.solicitacoes_financeiro
  drop constraint if exists solic_fin_cartao_id_check;
alter table public.solicitacoes_financeiro
  add constraint solic_fin_cartao_id_check
  check (cartao_id is null or tipo = 'aumento_limite');

create index if not exists solic_fin_cartao_idx
  on public.solicitacoes_financeiro (cartao_id) where cartao_id is not null;
