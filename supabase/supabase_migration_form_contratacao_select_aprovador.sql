-- Migration: form_contratacao_select_aprovador (aplicada em 2026-07-09 no projeto bogsuuhrgvopzgcceoqz)

-- Bug: aprovadores da cadeia não viam as respostas do Formulário de Contratação
-- ("Ver respostas" vazio). A form_select só permitia admin, criador e RH/DP —
-- faltava is_aprovador_da_solic, presente em solic_rh_select e etapas_select.
-- As demais tabelas de detalhe (vagas, mapeamentos, ajudas_custo) têm policy
-- aberta e não apresentam a falha.
drop policy if exists form_select on public.formularios_contratacao;
create policy form_select on public.formularios_contratacao
for select to authenticated
using (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
  or app_private.is_aprovador_da_solic(solicitacao_id)
  or app_private.is_rh_dp()
);
