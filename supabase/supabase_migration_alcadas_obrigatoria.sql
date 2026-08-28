-- Migration: alcadas_obrigatoria (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- §6, pilar 1 — "Classificação obrigatória": nenhum lançamento entra sem
-- valor + categoria + indicação de dentro/fora do orçamento.
--
-- ⚠️ GATE DE ROLLOUT — aplique este arquivo SOMENTE depois de:
--   1. supabase_migration_alcadas.sql aplicada (cria as colunas);
--   2. o front com os campos de classificação PUBLICADO em produção
--      (FormCartaoVirtual / FormAumentoLimite enviando categoria e
--      dentro_orcamento);
--   3. confirmado que uma solicitação nova grava as duas colunas.
--
-- Aplicar antes disso barra a criação de solicitações no ar: o INSERT atual não
-- manda essas colunas e passaria a violar o CHECK.
--
-- NOT VALID: as solicitações já existentes (criadas antes das colunas) ficam
-- com categoria/dentro_orcamento nulos e continuam válidas — o CHECK só passa a
-- valer para INSERT/UPDATE novos. Para exigir também o histórico, preencha o
-- passado e rode o VALIDATE comentado no fim.
-- ============================================================================

alter table public.solicitacoes_financeiro
  drop constraint if exists solic_fin_classificacao_check;

alter table public.solicitacoes_financeiro
  add constraint solic_fin_classificacao_check
  check (categoria is not null and dentro_orcamento is not null and valor is not null)
  not valid;

comment on constraint solic_fin_classificacao_check on public.solicitacoes_financeiro is
  'Classificação obrigatória (§6 pilar 1): valor + categoria + dentro/fora do orçamento.';

-- Depois de classificar o histórico, para passar a exigir de todos:
--   update public.solicitacoes_financeiro
--      set categoria = 'nao_classificado', dentro_orcamento = true
--    where categoria is null or dentro_orcamento is null;
--   alter table public.solicitacoes_financeiro
--     validate constraint solic_fin_classificacao_check;