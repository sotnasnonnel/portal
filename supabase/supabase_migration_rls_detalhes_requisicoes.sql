-- Migration: rls_detalhes_requisicoes (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Fecha a exposição das tabelas de DETALHE das requisições DP.
--
-- Problema: `ajudas_custo`, `mapeamentos` e `vagas` tinham uma única policy
-- `anon_all_*` — `FOR ALL TO authenticated, anon USING (true)`. Ou seja:
-- qualquer pessoa com a chave anon (que é pública e vai no bundle do front,
-- por design) podia LER, ALTERAR e APAGAR todos os registros SEM ESTAR LOGADA.
-- Confirmado na prática: 26 mapeamentos, 27 ajudas de custo e 19 vagas
-- respondiam sem sessão, incluindo `mapeamentos.salario_base`.
--
-- `formularios_contratacao` (a quarta tabela de detalhe) NÃO tinha o problema —
-- já usava policies restritivas. Esta migração copia exatamente aquele desenho
-- para as outras três, para não inventar regra nova:
--   LER    -> admin, RH/DP, o solicitante (gestor da requisição) e quem aprova
--             na cadeia (ModalRespostas precisa disso).
--   ESCREVER-> admin e o solicitante. É quem de fato escreve: a criação
--             (useRequisicaoForm.criarComDetalhe, que grava gestor_id = user.id)
--             e o reenvio (responderRequisicao). Nenhum outro caminho no código
--             insere/atualiza essas tabelas.
--
-- `anon` deixa de ter policy — sem policy aplicável, o acesso é negado, sem
-- precisar mexer nos grants.
--
-- DELETE em cascata (solicitacoes_rh -> detalhe) continua funcionando: as 3 FKs
-- são ON DELETE CASCADE e cascata não passa pela RLS do filho.
--
-- Validado antes de aplicar, em transação revertida, com 6 papéis reais:
--   solicitante  lê + altera | aprovador lê, não altera | DP lê, não altera
--   admin        lê + altera | alheio não vê            | anon não vê
-- ============================================================================

-- ---- ajudas_custo ----------------------------------------------------------
drop policy if exists anon_all_ajudas_custo on public.ajudas_custo;

create policy ajudas_custo_select on public.ajudas_custo
for select to authenticated
using (
  app_private.is_admin()
  or app_private.is_rh_dp()
  or app_private.is_aprovador_da_solic(solicitacao_id)
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

create policy ajudas_custo_write on public.ajudas_custo
for all to authenticated
using (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
)
with check (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

-- ---- mapeamentos -----------------------------------------------------------
drop policy if exists anon_all_mapeamentos on public.mapeamentos;

create policy mapeamentos_select on public.mapeamentos
for select to authenticated
using (
  app_private.is_admin()
  or app_private.is_rh_dp()
  or app_private.is_aprovador_da_solic(solicitacao_id)
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

create policy mapeamentos_write on public.mapeamentos
for all to authenticated
using (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
)
with check (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

-- ---- vagas -----------------------------------------------------------------
drop policy if exists anon_all_vagas on public.vagas;

create policy vagas_select on public.vagas
for select to authenticated
using (
  app_private.is_admin()
  or app_private.is_rh_dp()
  or app_private.is_aprovador_da_solic(solicitacao_id)
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

create policy vagas_write on public.vagas
for all to authenticated
using (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
)
with check (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
);

-- ============================================================================
-- Conferir depois de aplicar (sem login, com a chave anon, deve vir vazio):
--   curl "$URL/rest/v1/mapeamentos?select=id" -H "apikey: $ANON" -> []
-- Reverter (volta a expor tudo — só em emergência):
--   drop policy ajudas_custo_select on public.ajudas_custo; (idem write e demais)
--   create policy anon_all_ajudas_custo on public.ajudas_custo for all using (true);
-- ============================================================================
