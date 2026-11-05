-- Migration: PLR, o super admin pode ver como gestor ou usuário (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (05/11/2026): pôr o próprio login como "Usuário (só o próprio)"
-- em Gerenciar acessos e ver a tela como ela fica, em vez de continuar como admin.
--
-- Até aqui o super admin era admin antes de qualquer papel. Agora, se ele escolheu
-- 'gestor' ou 'usuario' para si, vale o que ele escolheu; com 'admin' ou sem papel,
-- continua admin. O caminho de volta não depende disto: Gerenciar acessos e o
-- trigger de plr_role usam app_private.is_portal_super_admin(), e não o papel.
--
-- 'gestor' para quem não está em plr_setor_gestores vê só a própria linha, como
-- para qualquer outra pessoa.
--
-- Pré-requisito: supabase_migration_plr_papeis.sql.
-- ============================================================================

create or replace function app_private.plr_papel()
 returns text language sql stable security definer set search_path to ''
as $$
  with eu as (
    select (select c.plr_role from public.colaboradores c where c.id = app_private.plr_eu()) as papel
  )
  select case
    when eu.papel in ('gestor', 'usuario') then null
    when eu.papel = 'admin' or app_private.is_portal_super_admin() then 'admin'
  end
  from eu
$$;
