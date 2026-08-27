-- Realinha as solicitações do Financeiro AINDA ABERTAS à nova alçada
-- ---------------------------------------------------------------------------
-- A alçada e o fluxo do Financeiro passaram a ser os mesmos do Administrativo:
-- cabeça da cadeia (exceção cadastrada em Fluxos ou escada do organograma) e,
-- depois dela, a faixa de valor da TABELA_ADMINISTRATIVO (até R$ 5.000 nenhum
-- papel; R$ 5.000–20.000 COO + Gerente Financeiro; acima disso soma o CEO).
--
-- As solicitações abertas antes disso ficaram com a cadeia da regra antiga
-- (tabela de Compras), que mandava para gente que a nova regra não escolheria.
-- Este script só toca em quem está PENDENTE — concluída/reprovada é histórico.
--
-- Em 27/08/2026 havia UMA pendente:
--   #20 · Cartão Virtual · R$ 1.000 · André Luiz Costa Guimarães
--     antes:  Pedro Nery (CEO) → Financeiro (execução)
--     agora:  Pedro Morais (superior direto no organograma) → Financeiro
--   O valor cai no nível 1, que não exige papel de faixa nenhum. Nenhuma etapa
--   havia sido decidida, então nada de decisão se perde.
--
--   A exceção cadastrada em Fluxos para o André (que apontava para a Daniela)
--   foi REMOVIDA a pedido: ele passa a seguir o organograma, como todo mundo.

begin;

delete from solicitacoes_financeiro_etapas
 where solicitacao_id = 'a2f49427-ed38-419e-bbc2-5b3faa5f951c';

delete from solicitacoes_financeiro_fluxos
 where solicitante_id = '057a1ee2-8280-4bec-91ac-388175f2f070';

insert into solicitacoes_financeiro_etapas
  (solicitacao_id, ordem, aprovador_id, papel, tipo_etapa, status)
values
  ('a2f49427-ed38-419e-bbc2-5b3faa5f951c', 1,
   '62275900-e9be-4800-a490-1dc63eb03f9e', 'PEDRO HENRIQUE BRAGA DE MORAIS', 'aprovacao', 'pendente'),
  ('a2f49427-ed38-419e-bbc2-5b3faa5f951c', 2,
   null, 'Financeiro (execução)', 'execucao', 'pendente');

-- Carimbo de alçada do registro (estava sem nada: é anterior ao motor).
update solicitacoes_financeiro
   set alcada_tabela = 'administrativo',
       alcada_nivel_base = 1,
       alcada_nivel_final = 1,
       alcada_modificadores = '{}',
       alcada_gatilhos = '{}',
       alcada_excecoes = '{}'
 where id = 'a2f49427-ed38-419e-bbc2-5b3faa5f951c';

commit;
