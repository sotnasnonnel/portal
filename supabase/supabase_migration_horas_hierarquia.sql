-- ============================================================================
-- Controle de Horas — papéis e visibilidade pela HIERARQUIA da Gestão de Pessoas
-- ----------------------------------------------------------------------------
-- Antes: o Horas tinha estrutura própria — colaboradores.horas_role
-- ('usuario'|'gerente'|'diretoria') + horas_gerencia_id, e a visibilidade dos
-- apontamentos era por GERÊNCIA.
--
-- Agora: o papel e a visibilidade DERIVAM da Gestão de Pessoas
-- (colaboradores.perfil + a árvore colaboradores.superior_id):
--   perfil 'admin'       -> gestor      (e is_admin() continua enxergando TUDO)
--   perfil 'gestor'      -> gestor
--   perfil 'coordenador' -> coordenador
--   demais / sem perfil  -> usuario
--
-- Visibilidade dos apontamentos: o PRÓPRIO + toda a SUBÁRVORE abaixo do logado
-- (mesma regra recursiva app_private.descendentes()/manages() do módulo de
-- Pessoas). Todo superior enxerga os apontamentos de quem está abaixo dele.
--
-- As GERÊNCIAS continuam existindo, agora só como CONTAINER de projetos e das
-- 3 atividades controladas (Fase do Projeto / Disciplina / Tipo de Esforço).
-- A coluna horas_gerencia_id é mantida apenas para saber quais projetos um
-- colaborador vê ao apontar. Nada é apagado — a migração é reversível.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Papel do Horas agora DERIVA do perfil (fonte única de verdade)
-- ----------------------------------------------------------------------------
create or replace function app_private.my_horas_role()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when app_private.is_portal_super_admin() then 'gestor'
    else coalesce(
      (select case
          when c.perfil in ('admin', 'gestor') then 'gestor'
          when c.perfil = 'coordenador'        then 'coordenador'
          else 'usuario'
        end
       from public.colaboradores c
       where c.auth_id = (select auth.uid())
       limit 1),
      'usuario')
  end
$$;

-- "Vê tudo" agora é só admin/super (o papel 'diretoria' deixou de existir).
-- Mantemos os nomes das funções por compatibilidade com as policies existentes.
create or replace function app_private.is_horas_diretoria()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_admin() or app_private.is_portal_super_admin()
$$;

create or replace function app_private.is_horas_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_admin() or app_private.is_portal_super_admin()
$$;

-- Configuração (projetos + atividades controladas): admin/super, gestor ou
-- coordenador. Como a gerência virou um container global, qualquer gestor/
-- coordenador pode manter os projetos/atividades. (p_gerencia mantido só para
-- não alterar a assinatura usada pelas policies.)
create or replace function app_private.pode_gerir_gerencia(p_gerencia uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_admin()
      or app_private.is_portal_super_admin()
      or app_private.my_horas_role() in ('gestor', 'coordenador')
$$;

-- ----------------------------------------------------------------------------
-- 2) Apontamentos — visibilidade/edição/exclusão pela subárvore
-- ----------------------------------------------------------------------------
-- Usamos `colaborador_id in (select descendentes(...))` (não a função manages()
-- por linha) para a subárvore ser calculada UMA vez por consulta (InitPlan).

drop policy if exists horas_apont_select on public.horas_apontamentos;
create policy horas_apont_select on public.horas_apontamentos
for select to authenticated
using (
  app_private.is_admin()
  or app_private.is_portal_super_admin()
  or colaborador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

-- Inserir continua sendo só em nome próprio.
drop policy if exists horas_apont_insert on public.horas_apontamentos;
create policy horas_apont_insert on public.horas_apontamentos
for insert to authenticated
with check (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_portal_super_admin()
);

drop policy if exists horas_apont_update on public.horas_apontamentos;
create policy horas_apont_update on public.horas_apontamentos
for update to authenticated
using (
  app_private.is_admin()
  or app_private.is_portal_super_admin()
  or colaborador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
)
with check (
  app_private.is_admin()
  or app_private.is_portal_super_admin()
  or colaborador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

drop policy if exists horas_apont_delete on public.horas_apontamentos;
create policy horas_apont_delete on public.horas_apontamentos
for delete to authenticated
using (
  app_private.is_admin()
  or app_private.is_portal_super_admin()
  or colaborador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

-- ----------------------------------------------------------------------------
-- 3) RPC da equipe do Horas — agora pela hierarquia (não mais por gerência)
-- ----------------------------------------------------------------------------
-- horas_role devolvido é o DERIVADO do perfil (para a UI). Escopo:
--   admin/super -> todos ativos;  gestor/coordenador -> a própria subárvore;
--   usuario     -> só ele mesmo.
drop function if exists public.horas_colaboradores();
create function public.horas_colaboradores()
returns table (id uuid, nome text, funcao text, horas_role text, gerencia_id uuid)
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
      app_private.is_admin()
      or app_private.is_portal_super_admin()
      or c.id = app_private.my_colaborador_id()
      or c.id in (select app_private.descendentes(app_private.my_colaborador_id()))
    )
  order by c.nome
$$;
revoke all on function public.horas_colaboradores() from public;
revoke execute on function public.horas_colaboradores() from anon;
grant execute on function public.horas_colaboradores() to authenticated;
