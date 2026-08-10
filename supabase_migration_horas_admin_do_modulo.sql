-- ============================================================================
-- "Admin do módulo" no Controle de Horas — horas_role = 'admin'
--
-- Até aqui, ver/administrar TODAS as equipes do Horas só era possível com
-- perfil='admin' na Gestão de Pessoas — o que abre junto o DP inteiro,
-- o /portal-admin e as RLS dos outros módulos. Não existia um "vê tudo"
-- restrito a este módulo.
--
-- Esta migração estende a ELEVAÇÃO já existente (colaboradores.horas_role,
-- ver supabase_migration_horas_role_elevacao.sql) com um quarto valor:
--   usuario     -> aponta e vê o próprio tempo
--   coordenador -> vê/administra a subárvore abaixo dele
--   gestor      -> vê/administra a subárvore abaixo dele
--   admin       -> NOVO: vê/administra o módulo INTEIRO (todas as pessoas,
--                  todas as áreas, todos os projetos) — e SÓ o módulo.
--
-- O que 'admin' NÃO dá: nada fora do Controle de Horas. modules.dp continua
-- olhando só `perfil`, o /portal-admin continua no super-admin, e o painel de
-- Horas Extras do DP continua em app_private.is_horas_extras_dp() (rh_dp),
-- que esta migração não toca.
--
-- Papel efetivo continua sendo o MAIOR entre o derivado do perfil e a
-- elevação — nunca rebaixa ninguém. Para a UI, 'admin' se apresenta como
-- 'gestor' (o vocabulário de telas/menus segue com 3 papéis); quem separa é
-- app_private.is_horas_admin().
--
-- Idempotente. Reverter uma pessoa: horas_role = 'usuario'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Vocabulário da coluna
-- ----------------------------------------------------------------------------
alter table public.colaboradores drop constraint if exists colaboradores_horas_role_check;
alter table public.colaboradores add constraint colaboradores_horas_role_check
  check (horas_role = any (array['usuario'::text, 'coordenador'::text, 'gestor'::text, 'admin'::text]));

-- ----------------------------------------------------------------------------
-- 2) Quem é "admin do Horas"
-- ----------------------------------------------------------------------------
-- O admin do portal e o super-admin continuam entrando por aqui, então todo
-- ponto que antes checava is_admin() or is_portal_super_admin() pode passar a
-- chamar só esta função.
create or replace function app_private.is_horas_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_admin()
      or app_private.is_portal_super_admin()
      or exists (
        select 1 from public.colaboradores c
        where c.auth_id = (select auth.uid()) and c.horas_role = 'admin'
      )
$$;

-- Nome legado mantido pelas policies antigas (horas_gerencias_write,
-- horas_set_gerencia) — agora é o mesmo conceito.
create or replace function app_private.is_horas_diretoria()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_horas_admin()
$$;

-- ----------------------------------------------------------------------------
-- 3) Papel de UI: 'admin' entra como 'gestor' (rank 3), sem rebaixar ninguém
-- ----------------------------------------------------------------------------
create or replace function app_private.my_horas_role()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when app_private.is_portal_super_admin() then 'gestor'
    else coalesce(
      (select (array['usuario','coordenador','gestor'])[
         greatest(
           case when c.perfil in ('admin','gestor') then 3
                when c.perfil = 'coordenador'        then 2
                else 1 end,
           case when c.horas_role in ('gestor', 'admin') then 3
                when c.horas_role = 'coordenador'       then 2
                else 1 end
         )
       ]
       from public.colaboradores c
       where c.auth_id = (select auth.uid())
       limit 1),
      'usuario')
  end
$$;

-- ----------------------------------------------------------------------------
-- 4) Apontamentos — o admin do módulo vê/edita/apaga tudo
-- ----------------------------------------------------------------------------
-- INSERT fica de fora de propósito: apontar continua sendo em nome próprio
-- (nenhuma tela apoia lançar hora por outra pessoa).
drop policy if exists horas_apont_select on public.horas_apontamentos;
create policy horas_apont_select on public.horas_apontamentos
for select to authenticated
using (
  app_private.is_horas_admin()
  or colaborador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

drop policy if exists horas_apont_update on public.horas_apontamentos;
create policy horas_apont_update on public.horas_apontamentos
for update to authenticated
using (
  app_private.is_horas_admin()
  or colaborador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
)
with check (
  app_private.is_horas_admin()
  or colaborador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

drop policy if exists horas_apont_delete on public.horas_apontamentos;
create policy horas_apont_delete on public.horas_apontamentos
for delete to authenticated
using (
  app_private.is_horas_admin()
  or colaborador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

-- ----------------------------------------------------------------------------
-- 5) Configuração — projetos e atividades de QUALQUER área
-- ----------------------------------------------------------------------------
create or replace function app_private.pode_gerir_gerencia(p_gerencia uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_horas_admin()
      or exists (
        select 1 from public.horas_gerencias g
        where g.id = p_gerencia and g.gestor_id = app_private.my_colaborador_id()
      )
      or (
        app_private.my_horas_role() in ('gestor', 'coordenador')
        and p_gerencia is not null
        and p_gerencia = app_private.my_horas_gerencia()
      )
$$;

-- ----------------------------------------------------------------------------
-- 6) Equipe — a RPC devolve todo mundo para o admin do módulo
-- ----------------------------------------------------------------------------
create or replace function public.horas_colaboradores()
returns table(id uuid, nome text, funcao text, horas_role text, gerencia_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.funcao,
         case
           when c.perfil in ('admin', 'gestor') then 'gestor'
           when c.perfil = 'coordenador'        then 'coordenador'
           else 'usuario'
         end as horas_role,
         c.horas_gerencia_id
  from public.colaboradores c
  where c.ativo is distinct from false
    and (
      app_private.is_horas_admin()
      or c.id = app_private.my_colaborador_id()
      or c.id in (select app_private.descendentes(app_private.my_colaborador_id()))
    )
  order by c.nome
$$;

-- ----------------------------------------------------------------------------
-- 7) Apontar — projetos de todas as áreas para o admin do módulo
-- ----------------------------------------------------------------------------
-- Faltava até para o admin do portal: a RPC só subia a cadeia de gestores do
-- logado, então quem estava no meio da árvore não via os projetos das outras
-- equipes ao apontar. Agora o admin do módulo recebe as áreas todas.
create or replace function public.horas_gerencias_visiveis()
returns setof uuid
language sql stable security definer set search_path = '' as $$
  with recursive chain as (
    select c.id, c.superior_id, 0 as depth
    from public.colaboradores c
    where c.id = app_private.my_colaborador_id()
    union all
    select p.id, p.superior_id, ch.depth + 1
    from public.colaboradores p
    join chain ch on p.id = ch.superior_id
    where ch.depth < 60
  )
  select g.id from public.horas_gerencias g
  where app_private.is_horas_admin()
  union
  select g.id
  from public.horas_gerencias g
  where g.gestor_id in (select id from chain)
  union
  select c.horas_gerencia_id
  from public.colaboradores c
  where c.id = app_private.my_colaborador_id()
    and c.horas_gerencia_id is not null
$$;
