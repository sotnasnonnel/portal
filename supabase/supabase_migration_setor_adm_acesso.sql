-- Migration: setor_adm_acesso (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Quem entra em Frota e Alojamentos (card "Administrativo" da Home).
--
-- APLICAR PRIMEIRO, antes de supabase_migration_frota.sql e
-- supabase_migration_alojamentos.sql: as policies deles chamam estes helpers.
--
-- Enquanto os módulos estão em lançamento restrito, só as duas pessoas abaixo
-- passam, mesmo que outras tenham administrativo_role. A lista repete
-- SETOR_ADM_LIBERADOS (src/config/setorAdm.js) DE PROPÓSITO: aquela só controla o
-- que a tela mostra, e quem protege CNH, custos e moradores é esta. Mesmo molde
-- de app_private.pode_fechamento_pj().
--
-- Na lista, quem tem qualquer papel no Atendimento também administra estes dois
-- módulos (excluir cadastro-mestre, mudar configurações). Lennon é 'atendente' no
-- Atendimento e isso não muda lá: o poder extra vale só aqui.
--
-- PARA ABRIR AO TIME: troque o corpo das duas funções por
-- app_private.is_adm_time() e app_private.is_adm_admin(), e ponha
-- SETOR_ADM_EM_BREVE = false. As policies não precisam mudar.
--
-- PRÉ-REQUISITO: supabase_migration_administrativo.sql (cria is_adm_time e
-- is_adm_admin).
-- ============================================================================

create or replace function app_private.setor_adm_liberado()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
    'marcus.guimaraes@phdengenharia.eng.br',
    'lennon.santos@phdengenharia.eng.br'
  )
$$;

create or replace function app_private.setor_adm_time()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.setor_adm_liberado() and app_private.is_adm_time()
$$;

create or replace function app_private.setor_adm_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.setor_adm_liberado() and app_private.is_adm_time()
$$;

revoke all on function app_private.setor_adm_liberado() from public;
revoke all on function app_private.setor_adm_time() from public;
revoke all on function app_private.setor_adm_admin() from public;
revoke execute on function app_private.setor_adm_liberado() from anon;
revoke execute on function app_private.setor_adm_time() from anon;
revoke execute on function app_private.setor_adm_admin() from anon;
grant execute on function app_private.setor_adm_liberado() to authenticated;
grant execute on function app_private.setor_adm_time() to authenticated;
grant execute on function app_private.setor_adm_admin() to authenticated;
