-- Migration: requisicoes_cancelamento (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Ajustes solicitados (Ana Costa):
--  - "Devolver para ajustes" foi REMOVIDO da interface (nada a fazer no banco;
--    o valor de status 'devolvida' permanece aceito por compatibilidade).
--  - Reprovação passa a avisar o solicitante por e-mail e ele pode responder;
--    isso não muda o schema (a reabertura da etapa reprovada usa a RLS que já
--    permite ao gestor-dono reescrever as próprias etapas).
--  - Admin (último da cadeia) ganha "Cancelar requisição" com justificativa:
--    novo status 'cancelada' + colunas de cancelamento.
--
-- A RLS não muda: `etapas_write` já permite is_admin escrever etapas e
-- `solic_rh_update` já permite is_admin/is_aprovador atualizar a requisição.
-- ============================================================================

alter table public.solicitacoes_rh drop constraint solicitacoes_rh_status_check;
alter table public.solicitacoes_rh add constraint solicitacoes_rh_status_check
  check (status in ('pendente', 'concluida', 'reprovada', 'devolvida', 'cancelada'));

alter table public.solicitacoes_rh
  add column if not exists cancelamento_motivo text,
  add column if not exists cancelamento_por    uuid references public.colaboradores(id),
  add column if not exists cancelamento_em      timestamptz;

comment on column public.solicitacoes_rh.cancelamento_motivo is
  'Motivo do cancelamento pelo Admin (justificativa obrigatória).';

-- Nota: a etapa cancelada guarda status = 'cancelada'. A tabela
-- solicitacoes_rh_etapas NÃO tem CHECK de status, então nenhum ajuste de
-- constraint é necessário lá.
