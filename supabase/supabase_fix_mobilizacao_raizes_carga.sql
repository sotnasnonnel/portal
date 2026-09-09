-- Correção: etapas RAIZ que a carga deixa pendentes sem serem gargalo
-- ============================================================================
-- RODAR SEMPRE DEPOIS DE supabase_import_mobilizacao_2026.sql. Não é correção
-- de uma vez: é o par obrigatório da carga, porque o problema volta a cada
-- recarga da planilha. Aplicado em 08/09/2026 e de novo em 09/09/2026.
--
-- O PROBLEMA
--
-- A carga só marca uma etapa como concluída quando a planilha tem DATA REAL na
-- coluna dela. Três etapas do catálogo não têm coluna com data confiável, e por
-- isso nascem `pendente` com `data_prevista` no passado — vermelhas para
-- sempre, e impedindo o processo de chegar a "finalizado":
--
--   assinatura_contrato    a planilha muitas vezes não datou
--   abertura_chamado       idem
--   integracao_no_cliente  a planilha NÃO TEM coluna para ela. A etapa entrou
--                          no catálogo depois, pela tela de Catálogo, e o
--                          gerador não tem de onde tirar a data.
--
-- Em 09/09/2026 isso deixava 118 etapas vermelhas e ZERO processos finalizados
-- de 129 carregados — um quadro que dizia que nada tinha terminado no ano.
--
-- POR QUE SE SABE QUE É ARTEFATO, E NÃO ATRASO REAL
--
-- Todas as linhas corrigidas têm um passo POSTERIOR do mesmo processo já
-- concluído. Não existe dossiê enviado com contrato por assinar, nem crachá
-- liberado sem integração. Se o passo seguinte aconteceu, o anterior aconteceu.
--
-- O RECORTE é estreito: só etapa RAIZ (sem `depende_de`), só processo vindo da
-- PLANILHA, só processo não cancelado, só quando `tocada_no_portal is false`, e
-- só com a evidência acima. Etapa raiz de processo que de fato parou no começo
-- não é tocada.
-- ============================================================================

begin;

-- (A) Raízes do INÍCIO do fluxo.
--
-- A data-base do processo É o marco delas, então `data_prevista = data_base` é
-- a data certa. Exato para "Abertura de chamado" (a data-base é a abertura);
-- aproximação de efeito nulo para "Assinatura de contrato", porque deixa
-- dias_atraso = 0 — não infla nem penaliza o indicador de prazo.
update public.mobilizacao_etapas e
   set status = 'concluida', data_real = e.data_prevista
  from public.mobilizacao_processos p
 where p.id = e.processo_id and p.origem = 'planilha' and p.status <> 'cancelado'
   and e.codigo in ('assinatura_contrato', 'abertura_chamado')
   and e.depende_de is null
   and e.status not in ('concluida', 'dispensada')
   and e.tocada_no_portal is false
   and e.data_prevista is not null
   and exists (
     select 1 from public.mobilizacao_etapas d
      where d.processo_id = e.processo_id and d.ordem > e.ordem and d.status = 'concluida'
   );

-- (B) "Integração no cliente" — regra DIFERENTE, de propósito.
--
-- Ela acontece no FIM, logo antes da liberação do crachá. Datá-la pela
-- data-base (como em A) diria que a integração ocorreu no primeiro dia do
-- processo, o que é falso e apareceria como um "concluído no prazo" mentiroso.
-- A data honesta é a do crachá: o crachá só sai DEPOIS da integração, então
-- essa data é um limite superior real, não um chute.
--
-- Sem crachá concluído, a etapa fica pendente — aí é desconhecido de verdade.
update public.mobilizacao_etapas e
   set status = 'concluida', data_real = c.data_real
  from public.mobilizacao_processos p,
       public.mobilizacao_etapas c
 where p.id = e.processo_id and p.origem = 'planilha' and p.status <> 'cancelado'
   and c.processo_id = e.processo_id
   and c.codigo = 'liberacao_cracha' and c.status = 'concluida' and c.data_real is not null
   and e.codigo = 'integracao_no_cliente'
   and e.status not in ('concluida', 'dispensada')
   and e.tocada_no_portal is false;

commit;

-- O gatilho de recálculo roda a cada UPDATE de status, então progresso, prazo e
-- o status do processo já saem ajustados.

-- Confira: em 09/09/2026 isto levou 129 processos de
--   0 finalizados / 112 em andamento  para  78 finalizados / 34 em andamento.
select status, count(*) from public.mobilizacao_processos group by 1 order by 1;

-- ============================================================================
-- COMO PARAR DE PRECISAR DESTE ARQUIVO
--
-- Para "Integração no cliente": criar a coluna DATA REAL dela na planilha e
-- mapeá-la em docs/gerar_carga_mobilizacao.cjs (lista `etapas` da aba
-- MOB.PESSOAS). Aí a carga traz a data verdadeira e o bloco (B) vira inócuo.
--
-- Para as duas raízes: preencher as colunas DATA REAL correspondentes nas
-- linhas em que estão vazias. O bloco (A) então não encontra nada para corrigir.
--
-- Enquanto isso não acontece, este arquivo roda logo depois da carga, sempre.
-- ============================================================================
