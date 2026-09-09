-- Projeto backoffice_phd (dvvqgoxqawyhycakppps) — NÃO é o projeto do portal.
-- ============================================================================
-- OBSOLETO desde 2026-09-09 — NÃO RODE ESTE ARQUIVO.
--
-- O pentest de 2026-09-08 no backoffice fechou o acesso anônimo às tabelas
-- organograma_* (migration 177 de lá), e a migration 181 abriu no lugar um
-- recorte curado: as views `portal_organograma_*` (obra, colaborador,
-- alocacao, gerente, obra_lideranca, meses), só com as colunas que o portal
-- usa e só com SELECT para `anon`. O portal já aponta para elas.
--
-- Rodar este arquivo hoje reabriria as TABELAS inteiras ao anônimo — todas as
-- colunas, inclusive tipo_fopag, tipo_sede e cccod — desfazendo a correção.
-- Mantido apenas como registro do que existia antes.
--
-- Precisa de uma coluna que as views não expõem? Peça a migration no repo
-- app-phd (supabase/migrations/), não rode grant na tabela.
-- ============================================================================
-- [histórico] Consertava "permission denied for view organograma_meses" na tela
-- Gestão de Pessoas → Organograma.
--
-- O portal lê este projeto pelo cliente `supabaseBackoffice`, que usa a chave
-- ANÔNIMA e não persiste sessão (services/supabaseBackoffice.js): o login do
-- portal é do OUTRO projeto Supabase, então daqui todo mundo chega como `anon`.
-- A view `organograma_meses` não tem grant para esse papel — o `select` volta
-- negado antes mesmo de qualquer policy ser avaliada.
--
-- As duas tabelas de baixo entram junto porque a tela lê as três: a de meses
-- para montar o seletor e as outras duas para a tabela de alocação.
--
-- ATENÇÃO ao que isto significa: a chave anônima viaja no bundle do navegador,
-- então liberar para `anon` é liberar para quem tiver a chave. É a mesma
-- exposição que a tela já tem hoje para `organograma_alocacao` (a policy antiga
-- `public ALL USING(true)`, registrada como dívida em
-- docs/superpowers/specs/2026-07-01-consulta-organograma-design.md).
-- Se o organograma não puder ser público, o caminho é outro: servir esses dados
-- por uma função no projeto do portal, onde a pessoa está autenticada.
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select on public.organograma_meses       to anon, authenticated;
grant select on public.organograma_alocacao    to anon, authenticated;
grant select on public.organograma_colaborador to anon, authenticated;

-- Só leitura: a tela é de consulta, e a dívida de RLS conhecida deste projeto é
-- justamente a escrita liberada. Nada aqui amplia isso.
revoke insert, update, delete on public.organograma_alocacao    from anon;
revoke insert, update, delete on public.organograma_colaborador from anon;

notify pgrst, 'reload schema';
