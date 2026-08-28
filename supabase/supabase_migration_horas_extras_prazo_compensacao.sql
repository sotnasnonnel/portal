-- Migration: horas_extras_prazo_compensacao (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Prazo de COMPENSAÇÃO do banco de horas: quando o destino da hora extra é
-- 'banco', a data prevista de compensação tem de cair entre a DATA DA HORA EXTRA
-- e 180 dias depois dela.
--
-- Decisões (2026-07-31):
--  * O prazo conta da data da hora extra (leitura da CLT art. 59 §2), NÃO da
--    aprovação — uma aprovação tardia não estica o prazo legal.
--  * Vale para os dois caminhos que gravam destino: a aprovação do gestor
--    (Controle de Horas) e a alteração de destino do DP (Gestão de Pessoas).
--    Por isso a regra é uma CONSTRAINT, e não validação de tela.
--  * O limite espelha PRAZO_COMPENSACAO_DIAS em src/config/horasExtras.js, que
--    também alimenta o min/max dos inputs de data.
--
-- A tabela ainda não tem linhas, então a constraint entra validada sem backfill.
-- Se um dia houver dados anteriores à regra, trocar por NOT VALID + VALIDATE.
-- ============================================================================

alter table public.horas_extras_solicitacoes
  drop constraint if exists he_compensacao_prazo;

alter table public.horas_extras_solicitacoes
  add constraint he_compensacao_prazo check (
    compensacao_data is null
    or (
      compensacao_data >= data_he
      and compensacao_data <= data_he + 180
    )
  );

-- ============================================================================
-- Conferir depois de aplicar (as duas primeiras devem falhar, a terceira passar):
--   -- compensação antes da hora extra           -> viola
--   -- compensação 181 dias depois               -> viola
--   -- compensação no 180º dia                   -> aceita
-- Reverter:
--   alter table public.horas_extras_solicitacoes drop constraint he_compensacao_prazo;
-- ============================================================================
