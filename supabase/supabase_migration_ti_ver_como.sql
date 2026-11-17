-- Migration: ti_ver_como (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- "Ver como" do portal (src/config/verComo.js): o super admin vê o portal como
-- outra pessoa, mas a sessão do banco continua sendo a dele. No módulo TI isso
-- mostraria os 301 ativos (ele é do time), e não o que a pessoa vê.
--
-- Esta função devolve os e-mails que UMA pessoa enxerga no TI (ela e a árvore
-- abaixo dela), a mesma regra de app_private.ti_emails_visiveis(), para o front
-- recortar a lista durante o ver como. Só responde ao super admin: para qualquer
-- outro devolve vazio, então não abre a árvore de ninguém.
--
-- PRÉ-REQUISITO: supabase_migration_ti_visibilidade.sql. Idempotente.
-- ============================================================================

create or replace function public.ti_emails_visiveis_de(p_colab uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select case when not app_private.is_portal_super_admin() then '{}'::text[] else (
    select coalesce(array_agg(distinct lower(c.email)), '{}')
      from public.colaboradores c
     where c.email is not null
       and (c.id = p_colab or c.id in (select app_private.descendentes(p_colab)))
  ) end
$$;
revoke all on function public.ti_emails_visiveis_de(uuid) from public;
revoke execute on function public.ti_emails_visiveis_de(uuid) from anon;
grant execute on function public.ti_emails_visiveis_de(uuid) to authenticated;

notify pgrst, 'reload schema';
