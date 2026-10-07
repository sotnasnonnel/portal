-- Migration: Fale conosco travado (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- 07/10/2026: canal pausado. O cadeado no botão (FALE_CONOSCO_TRAVADO em
-- src/config/suporte.js) só vale depois do deploy e para quem recarregar a
-- página; esta policy barra o envio na hora, para todo mundo, inclusive quem
-- está com a tela antiga aberta. Quem atende (is_suporte) continua podendo.
--
-- Não depende do front. Para reabrir o canal, rode o bloco "Para derrubar".
-- ============================================================================

drop policy if exists fale_conosco_insert on public.fale_conosco;
create policy fale_conosco_insert on public.fale_conosco for insert
  with check (autor_id = app_private.my_colaborador_id() and app_private.is_suporte());

-- Para derrubar (reabrir o canal):
-- drop policy if exists fale_conosco_insert on public.fale_conosco;
-- create policy fale_conosco_insert on public.fale_conosco for insert
--   with check (autor_id = app_private.my_colaborador_id());
