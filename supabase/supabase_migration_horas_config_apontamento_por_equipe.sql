-- ============================================================================
-- Gestão de Horas — "Config. do Apontamento" liberada POR EQUIPE
-- ----------------------------------------------------------------------------
-- Até aqui, só a lista central (app_private.pode_configurar_horas) escrevia em
-- horas_campos_apontamento, e em qualquer equipe. Agora dá para liberar uma
-- pessoa em equipes específicas, sem torná-la configuradora central: ela não
-- edita as outras equipes nem ganha "Acesso a Projetos" (horas_projeto_acesso
-- continua só com pode_configurar_horas).
--
-- Liberação de hoje:
--   Icaro Bahia -> Equipe BRUNO ALBERTO AZEVEDO
--
-- Espelho de UI: CONFIG_APONTAMENTO_POR_EQUIPE em src/modules/horas/lib/roles.js.
-- Mudar a lista é mudar nos dois lugares.
--
-- Pode ser aplicado antes do front: sem o deploy, a pessoa só não vê a tela.
-- Aditivo e idempotente.
-- ============================================================================

create or replace function app_private.pode_configurar_campos_equipe(p_gerencia uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.pode_configurar_horas()
      or (lower(coalesce((select auth.jwt() ->> 'email'), '')), p_gerencia) in (
           values
             ('icaro.bahia@phdengenharia.eng.br', 'a905f944-a9e7-42e4-8302-c015752e714a'::uuid)  -- Equipe BRUNO ALBERTO AZEVEDO
         )
$$;
revoke all on function app_private.pode_configurar_campos_equipe(uuid) from public;
grant execute on function app_private.pode_configurar_campos_equipe(uuid) to authenticated;

-- USING protege a linha que já existe; WITH CHECK impede de mover um campo para
-- outra equipe (ou criar nela).
drop policy if exists horas_campos_write on public.horas_campos_apontamento;
create policy horas_campos_write on public.horas_campos_apontamento
for all to authenticated
using (app_private.pode_configurar_campos_equipe(gerencia_id))
with check (app_private.pode_configurar_campos_equipe(gerencia_id));

-- ============================================================================
-- Reverter:
--   drop policy horas_campos_write on public.horas_campos_apontamento;
--   create policy horas_campos_write on public.horas_campos_apontamento
--   for all to authenticated
--   using (app_private.pode_configurar_horas())
--   with check (app_private.pode_configurar_horas());
--   drop function app_private.pode_configurar_campos_equipe(uuid);
-- ============================================================================
