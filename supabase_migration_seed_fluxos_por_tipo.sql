-- ============================================================================
-- Seed: um fluxo de aprovação por tipo, a partir do fluxo geral atual
-- (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Para cada gestor que já tem o fluxo geral (tipo='aumento_salario', iniciativa=''),
-- cria os fluxos dos outros 4 tipos copiando a mesma cadeia, e o de 'mapeamento'
-- com Lucas Ferraz (mantém o comportamento de hoje). Idempotente: DO NOTHING.
-- ('aumento_salario' já É o fluxo geral, não precisa de cópia.)
--
-- Pré-requisito: a check constraint de `tipo` só permitia ('aumento_salario',
-- 'desligamento'); é ampliada para os 6 tipos configuráveis.
-- ============================================================================

alter table public.solicitacoes_rh_fluxos drop constraint if exists solicitacoes_rh_fluxos_tipo_check;
alter table public.solicitacoes_rh_fluxos add constraint solicitacoes_rh_fluxos_tipo_check
  check (tipo = any (array[
    'aumento_salario', 'desligamento', 'formulario_contratacao',
    'ajuda_custo', 'nova_vaga', 'mapeamento'
  ]));

insert into public.solicitacoes_rh_fluxos (solicitante_id, tipo, iniciativa, aprovadores)
select g.solicitante_id, t.tipo, '', g.aprovadores
from public.solicitacoes_rh_fluxos g
cross join (values ('desligamento'), ('formulario_contratacao'), ('ajuda_custo'), ('nova_vaga')) as t(tipo)
where g.tipo = 'aumento_salario' and g.iniciativa = ''
on conflict (solicitante_id, tipo, iniciativa) do nothing;

insert into public.solicitacoes_rh_fluxos (solicitante_id, tipo, iniciativa, aprovadores)
select g.solicitante_id, 'mapeamento', '', '["554ec9c1-c4fb-4b5a-b4a6-040c835acca5"]'::jsonb
from public.solicitacoes_rh_fluxos g
where g.tipo = 'aumento_salario' and g.iniciativa = ''
on conflict (solicitante_id, tipo, iniciativa) do nothing;
