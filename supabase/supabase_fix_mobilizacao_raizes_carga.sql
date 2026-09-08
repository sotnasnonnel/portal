-- Correção: etapas RAIZ que a carga deixou pendentes e que a matriz mostra
-- vermelhas sem serem gargalo.
-- ============================================================================
-- APLICADO em produção em 08/09/2026. Corrigiu 38 etapas raiz, e o gatilho de
-- recálculo fechou junto os processos que dependiam só delas: "em andamento"
-- caiu de 43 para 17, e todos os 95 finalizados estão com 11/11 ou 8/8 passos.
-- Fica aqui versionado porque a próxima recarga da planilha pode reintroduzir o
-- mesmo artefato — se isso acontecer, é só rodar de novo (é idempotente).
--
-- O QUE ACONTECEU
--
-- A carga da planilha só marca uma etapa como concluída quando a linha tem
-- DATA REAL naquela coluna. Nas etapas RAIZ — "Assinatura de contrato" e
-- "Abertura de chamado" — muitas linhas de 2026 não têm essa data preenchida,
-- porque na planilha o time registrava o marco de outras formas.
--
-- Resultado: a etapa ficou `pendente` com `data_prevista = data_base` (uma data
-- que já passou), então `dias_atraso > 0` e ela aparece VERMELHA para sempre.
--
-- POR QUE SE SABE QUE É ARTEFATO, E NÃO ATRASO REAL
--
--   select ... where raiz vencida
--     and exists (passo POSTERIOR do mesmo processo já concluído)
--
-- devolveu 38 de 38 — cem por cento. Não existe processo com o dossiê enviado e
-- o contrato por assinar; se o passo seguinte foi concluído, o anterior
-- aconteceu. Sem esta correção, a primeira coisa que a reunião de torre vê no
-- Mapa são duas colunas quase inteiras de vermelho que não significam nada, e o
-- rodapé "Vencidas" aponta o passo errado como gargalo.
--
-- O RECORTE é estreito de propósito: só etapa RAIZ (sem `depende_de`), só de
-- processo vindo da PLANILHA, só de processo NÃO cancelado, e só quando um passo
-- posterior já está concluído. Etapa raiz genuinamente pendente — processo que
-- de fato parou no começo — não é tocada.
--
-- Cancelado fica de fora porque não aparece no Mapa: a correção existe para
-- tirar vermelho falso da tela, e reescrever histórico de processo cancelado não
-- ganharia nada. São 4 linhas na conferência de 08/09/2026 (42 total, 38 úteis).
-- ============================================================================

begin;

-- Confira ANTES o que vai mudar (deve dar 38 no estado atual):
select count(*) as etapas_a_corrigir
  from public.mobilizacao_etapas e
  join public.mobilizacao_processos p on p.id = e.processo_id
 where p.origem = 'planilha'
   and e.depende_de is null
   and p.status <> 'cancelado'
   and e.status not in ('concluida', 'dispensada')
   and e.tocada_no_portal is false
   and exists (
     select 1 from public.mobilizacao_etapas d
      where d.processo_id = e.processo_id and d.ordem > e.ordem and d.status = 'concluida'
   );

update public.mobilizacao_etapas e
   set status = 'concluida',
       -- A data-base é o que a planilha usava como marco da etapa raiz, e para
       -- "Abertura de chamado" ela É a data de abertura — nesse caso não há
       -- aproximação nenhuma. Para "Assinatura de contrato" é aproximação, e o
       -- efeito é dias_atraso = 0: não infla nem penaliza o indicador de prazo.
       data_real = e.data_prevista
  from public.mobilizacao_processos p
 where p.id = e.processo_id
   and p.origem = 'planilha'
   and e.depende_de is null
   and p.status <> 'cancelado'
   and e.status not in ('concluida', 'dispensada')
   -- Nunca sobrescreve o que alguém já ajustou pelo portal.
   and e.tocada_no_portal is false
   and e.data_prevista is not null
   and exists (
     select 1 from public.mobilizacao_etapas d
      where d.processo_id = e.processo_id and d.ordem > e.ordem and d.status = 'concluida'
   );

commit;

-- O gatilho de recálculo roda sozinho a cada UPDATE de status, então o
-- progresso ("4 de 11") e o prazo do processo já saem ajustados.

-- Confira DEPOIS: as duas colunas devem sair do topo do ranking de travadas.
select e.codigo, e.titulo,
       count(*) filter (where e.status not in ('concluida','dispensada') and e.dias_atraso > 0) as ainda_vencidas
  from public.mobilizacao_etapas e
  join public.mobilizacao_processos p on p.id = e.processo_id
 where p.status = 'em_andamento' and e.depende_de is null
 group by 1, 2 order by 3 desc;

-- ============================================================================
-- O QUE ISTO ASSUME
--
--   * "Passo posterior concluído implica passo raiz aconteceu." Verdadeiro para
--     estes três fluxos; não seria para um fluxo com ramos independentes de
--     verdade, então não generalize esta correção para outros casos.
--
--   * A data de conclusão da raiz é a data-base do processo. Exato para
--     "Abertura de chamado"; aproximado para "Assinatura de contrato", onde a
--     planilha não guardou a data. A alternativa seria deixar a etapa pendente
--     e conviver com o vermelho falso.
--
-- SE PREFERIR NÃO APROXIMAR: a outra saída é preencher a coluna DATA REAL
-- dessas etapas na planilha e rodar `node docs/gerar_carga_mobilizacao.cjs`
-- seguido do import — a recarga corrige sem inventar data nenhuma, porque
-- `tocada_no_portal` continua false nessas linhas.
-- ============================================================================
