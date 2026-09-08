-- ============================================================================
-- Administrativo — escolher o centro de custo do chamado
--
-- O CC é preenchido sozinho, com a gerência do aprovador, e fica travado:
-- digitado à mão, cada um escrevia de um jeito e nenhum relatório por CC
-- fechava.
--
-- Mas há quem precise destinar o gasto a outra área — compra feita por uma
-- equipe para outra. Estas pessoas passam a escolher o CC numa lista fechada
-- (as gerências), que é o meio-termo entre travar e voltar ao texto livre.
--
-- Capacidade própria, como administrativo_reatribui: nenhum papel separa esse
-- grupo, e lista de e-mails no código divergiria do banco.
--
-- Já aplicada em 04/09/2026.
-- ============================================================================

alter table public.colaboradores
  add column if not exists administrativo_escolhe_cc boolean not null default false;

comment on column public.colaboradores.administrativo_escolhe_cc is
  'Pode trocar o centro de custo do chamado, escolhendo entre as gerencias. '
  'Sem isso o campo vem preenchido com a gerencia do aprovador e fica travado.';

update public.colaboradores
   set administrativo_escolhe_cc = true
 where email = 'maicon.morais@phdengenharia.eng.br';

notify pgrst, 'reload schema';
