-- Migration: Transporte como motivo de Ajuda de Custo na Contratação
-- (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido da Ana Claudia (05/10/2026): a pergunta 14 do Formulário de
-- Contratação ganha "Transporte", com valor próprio, no mesmo padrão de
-- supabase_migration_contratacao_ajuda_custo_multipla.sql.
--
-- APLICAR ANTES DO DEPLOY DO FRONT: o formulário novo grava a coluna em todo
-- envio (null quando o motivo não está marcado), e sem ela o insert falha.
--
-- Para derrubar (só depois de voltar o front):
--     alter table public.formularios_contratacao drop column valor_ajuda_custo_transporte;
-- ============================================================================

alter table public.formularios_contratacao
  add column if not exists valor_ajuda_custo_transporte numeric;

comment on column public.formularios_contratacao.valor_ajuda_custo_transporte is
  'Valor da ajuda de custo de transporte (R$), quando "Transporte" está em motivos_ajuda_custo.';

notify pgrst, 'reload schema';
