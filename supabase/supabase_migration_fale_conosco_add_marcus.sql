-- ============================================================================
-- Fale conosco: adiciona marcus.guimaraes como atendente
-- (projeto bogsuuhrgvopzgcceoqz — rodar no SQL Editor, como postgres)
--
-- Espelha a lista em src/config/suporte.js (ATENDENTES_SUPORTE). A proteção
-- real é esta função, usada nas policies de fale_conosco — mexer só no
-- arquivo do front dá uma tela que abre e não lê nada.
-- ============================================================================

create or replace function app_private.is_suporte()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
    'lennon.santos@phdengenharia.eng.br',
    'andre.guimaraes@phdengenharia.eng.br',
    'marcus.guimaraes@phdengenharia.eng.br'
  )
$$;

notify pgrst, 'reload schema';
