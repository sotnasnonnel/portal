-- ============================================================================
-- Requisições (DP) — Modalidade de Contratação no Mapeamento + múltiplos anexos
-- ----------------------------------------------------------------------------
-- 1) O Mapeamento passa a ter o mesmo dropdown "Modalidade de Contratação" da
--    Nova Vaga (config MODALIDADES_CONTRATACAO em src/config/novaVaga.js).
-- 2) Nova Vaga e Mapeamento passam a aceitar VÁRIOS anexos. Guardamos um array
--    jsonb `anexos` = [{ path, nome }]. As colunas antigas anexo_path/anexo_nome
--    ficam para os registros já existentes (leitores caem nelas quando anexos=[]).
-- Aditivo e idempotente.
-- ============================================================================

alter table public.mapeamentos add column if not exists modalidade_contratacao text;

alter table public.mapeamentos add column if not exists anexos jsonb not null default '[]'::jsonb;
alter table public.vagas add column if not exists anexos jsonb not null default '[]'::jsonb;
