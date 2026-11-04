-- Migration: PLR, papel "só o próprio" (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (04/11/2026): liberar a aba do PLR para uma pessoa ver só a
-- própria linha, sem abrir para as ~130 pessoas. A chave plr_aberto_a_cada_um é
-- geral e continua desligada; este papel é a mesma visão, pessoa por pessoa.
--
-- plr_papel() devolve NULL para 'proprio' de propósito: quem chama trata "tem
-- papel" como "vê tudo" (plr_setores_visiveis, plr_pessoas_visiveis), então o
-- papel novo não ganha nada disso sem que cada uma precise mudar.
--
-- Pré-requisito: supabase_migration_plr_calculo.sql. Pode aplicar antes do deploy
-- do front; sem o front, a opção só não aparece em Gerenciar acessos.
-- ============================================================================

alter table public.colaboradores drop constraint if exists colaboradores_plr_role_check;
alter table public.colaboradores add constraint colaboradores_plr_role_check
  check (plr_role is null or plr_role = any (array['visualizador'::text, 'admin'::text, 'proprio'::text]));

create or replace function app_private.plr_papel()
 returns text language sql stable security definer set search_path to ''
as $$
  select case
    when app_private.is_portal_super_admin() then 'admin'
    else (select nullif(c.plr_role, 'proprio') from public.colaboradores c where c.id = app_private.plr_eu())
  end
$$;

-- A pessoa logada pode ver a própria linha: chave geral ligada ou papel 'proprio'.
create or replace function app_private.plr_ve_a_propria_linha()
 returns boolean language sql stable security definer set search_path to ''
as $$
  select app_private.plr_aberto_a_cada_um()
      or exists (select 1 from public.colaboradores c
                  where c.id = app_private.plr_eu() and c.plr_role = 'proprio')
$$;

revoke all on function app_private.plr_ve_a_propria_linha() from public;

create or replace function public.plr_acesso(p_ano integer)
 returns text language sql stable security definer set search_path to ''
as $$
  select coalesce(
    app_private.plr_papel(),
    case when exists (select 1 from app_private.plr_setores_visiveis(p_ano)) then 'setor' end,
    case when app_private.plr_ve_a_propria_linha()
          and exists (select 1 from public.plr_pessoas p
                       where p.ano = p_ano and p.colaborador_id = app_private.plr_eu())
         then 'proprio' end
  )
$$;

create or replace function public.plr_pessoas_visiveis(p_ano integer)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu uuid := app_private.plr_eu();
  v_ve_todos boolean := app_private.plr_papel() is not null;
begin
  if v_eu is null and not app_private.is_portal_super_admin() then
    raise exception 'Só colaboradores ativos veem o PLR.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'papel', public.plr_acesso(p_ano),
    've_todos', v_ve_todos,
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'nome', p.nome,
               'cod_ct', p.cod_ct,
               'setor_hub', p.setor_hub,
               'cargo_plr', p.cargo_plr,
               'salario', p.salario,
               'data_admissao', p.data_admissao,
               'hub_chave', p.hub_chave)
             order by p.nome)
        from public.plr_pessoas p
        left join public.colaboradores c on c.id = p.colaborador_id
       where p.ano = p_ano
         and c.ativo is distinct from false
         and (v_ve_todos
              or (app_private.plr_ve_a_propria_linha() and p.colaborador_id = v_eu))
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.plr_pessoas_visiveis(integer) from public, anon;
grant execute on function public.plr_pessoas_visiveis(integer) to authenticated;
