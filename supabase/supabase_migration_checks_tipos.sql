-- Migration: solicitacoes_rh_checks_tipos_e_reprovada (aplicada em 2026-06-12 no projeto bogsuuhrgvopzgcceoqz)
-- Bug encontrado em verificação E2E: os CHECKs de solicitacoes_rh estavam desatualizados.
-- 1) tipo_check não incluía os tipos novos (mapeamento, ajuda_custo, nova_vaga) — envio falhava com 23514;
-- 2) status_check não incluía 'reprovada', usado pelo app ao reprovar QUALQUER requisição (bug latente desde sempre).

alter table public.solicitacoes_rh drop constraint if exists solicitacoes_rh_tipo_check;
alter table public.solicitacoes_rh add constraint solicitacoes_rh_tipo_check
  check (tipo = any (array['desligamento', 'aumento_salario', 'formulario_contratacao', 'mapeamento', 'ajuda_custo', 'nova_vaga']));

alter table public.solicitacoes_rh drop constraint if exists solicitacoes_rh_status_check;
alter table public.solicitacoes_rh add constraint solicitacoes_rh_status_check
  check (status = any (array['pendente', 'concluida', 'reprovada']));
