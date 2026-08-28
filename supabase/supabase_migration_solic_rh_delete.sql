-- ============================================================================
-- Policy de DELETE em solicitacoes_rh (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Complementa supabase_migration_rls_dp.sql, que ligou RLS em solicitacoes_rh
-- com select/insert/update mas SEM delete. Sem policy de delete, o rollback de
-- criação (catch em criarComDetalhe/criarComFluxo de useRequisicaoForm.js, que
-- faz `delete from solicitacoes_rh`) era silenciosamente bloqueado pela RLS e
-- deixava um envelope órfão vazio ("criou mas não apareceu informação").
--
-- Escopo mínimo e seguro: o gestor só apaga o PRÓPRIO envelope ENQUANTO ele
-- estiver incompleto (sem nenhuma etapa). Toda requisição válida tem >=1 etapa
-- (a etapa final de execução do admin é sempre adicionada), logo esta policy
-- nunca permite apagar uma requisição real — só limpa o lixo do rollback.
-- Admin pode apagar qualquer requisição.
-- ============================================================================

drop policy if exists solic_rh_delete on public.solicitacoes_rh;
create policy solic_rh_delete on public.solicitacoes_rh
for delete to authenticated
using (
  app_private.is_admin()
  or (
    gestor_id = app_private.my_colaborador_id()
    and not exists (
      -- qualifica solicitacoes_rh.id: `id` cru resolveria para e.id (etapas têm id)
      select 1 from public.solicitacoes_rh_etapas e
      where e.solicitacao_id = solicitacoes_rh.id
    )
  )
);
