-- ============================================================================
-- etapas_select: mostrar a cadeia completa do fluxo para todos que participam
-- (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Antes, a policy de SELECT de solicitacoes_rh_etapas deixava um aprovador ler
-- SÓ a própria etapa (aprovador_id = eu), então o FluxoTimeline ficava completo
-- apenas para o criador (gestor_id = eu). Agora qualquer aprovador da solicitação
-- lê TODAS as etapas dela, via o helper SECURITY DEFINER app_private.is_aprovador_da_solic
-- (sem recursão de RLS). A escrita (aprovar/reprovar) continua restrita pela etapas_write.
-- ============================================================================

drop policy if exists etapas_select on public.solicitacoes_rh_etapas;
create policy etapas_select on public.solicitacoes_rh_etapas
for select to authenticated
using (
  app_private.is_admin()
  or app_private.is_aprovador_da_solic(solicitacao_id)
  or exists (
    select 1 from public.solicitacoes_rh s
    where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id()
  )
);
