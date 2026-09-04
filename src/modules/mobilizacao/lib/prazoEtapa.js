/**
 * Projeção das datas previstas das etapas — para PREVISÃO na tela.
 *
 * A fonte da verdade é o banco (app_private.mob_recalcular): o quadro grava só
 * o status ao soltar o cartão, e o encadeamento tem que valer por qualquer
 * caminho — carga da planilha, correção manual, uma tela nova amanhã. Este
 * arquivo existe para o outro lado da moeda: responder "com 5 dias úteis, esse
 * passo cai em quando?" ANTES de gravar, na tela de catálogo e na de abertura.
 *
 * Os dois precisam concordar. Se divergirem, quem manda é o banco — e a
 * divergência aparece já na primeira etapa instanciada, que a tela mostra ao
 * lado da projeção.
 *
 * A REGRA, extraída das fórmulas da planilha:
 *
 *     prevista(etapa) = diasUteisApos(
 *         real(predecessor) ?? prevista(predecessor),
 *         sla(etapa)
 *     )
 *
 * Ou seja: a etapa já nasce com prazo projetado, e ele se reajusta sozinho
 * quando a anterior conclui de fato. Etapa raiz parte da data-base do processo.
 *
 * Lógica pura, testável.
 */
import { diasUteisApos, diasEntre, hojeIso } from '../../../utils/diasUteis.js';
import { ehEncerrada } from './statusEtapa.js';

/**
 * @param {Array} etapas  [{ codigo, depende_de, sla_dias_uteis, data_real }]
 * @param {string|null} dataBase  'AAAA-MM-DD' de onde partem as raízes
 * @returns {Object<string, string|null>} código → data prevista
 */
export function projetarDatas(etapas = [], dataBase = null) {
  const porCodigo = new Map(etapas.map((e) => [e.codigo, e]));
  const previstas = {};

  for (const e of etapas) {
    previstas[e.codigo] = e.depende_de ? null : diasUteisApos(dataBase, e.sla_dias_uteis ?? 0);
  }

  // Itera até estabilizar, no máximo uma passada por etapa. O limite é o que
  // impede um ciclo que tenha escapado da validação de girar para sempre —
  // mesma defesa do laço em mob_recalcular().
  for (let passo = 0; passo < etapas.length; passo += 1) {
    let mudou = false;
    for (const e of etapas) {
      if (!e.depende_de) continue;
      const anterior = porCodigo.get(e.depende_de);
      const base = anterior ? (anterior.data_real || previstas[anterior.codigo]) : null;
      const nova = base ? diasUteisApos(base, e.sla_dias_uteis ?? 0) : null;
      if (nova !== previstas[e.codigo]) {
        previstas[e.codigo] = nova;
        mudou = true;
      }
    }
    if (!mudou) break;
  }

  return previstas;
}

/**
 * Dias de atraso, na mesma conta da planilha: enquanto não concluiu, o relógio
 * corre contra hoje. Negativo é adiantamento.
 *
 * Serve para recalcular na tela o que o banco já gravou em `dias_atraso` — útil
 * quando a página fica aberta virando o dia, e nos testes.
 */
export function diasAtraso(etapa, hoje = hojeIso()) {
  if (!etapa?.data_prevista) return null;
  if (etapa.status === 'dispensada') return null;
  return diasEntre(etapa.data_real || hoje, etapa.data_prevista);
}

/** Etapa ainda em jogo cujo prazo já passou. */
export const estaAtrasada = (etapa, hoje = hojeIso()) =>
  !ehEncerrada(etapa?.status) && Number(diasAtraso(etapa, hoje)) > 0;

/**
 * Prazo do PROCESSO: o maior prazo entre as etapas que ainda faltam.
 *
 * O maior, e não o menor: o processo só termina quando o último passo termina.
 * Mostrar o mais próximo daria um prazo que passa e o processo continua vivo,
 * o que faz o indicador parecer quebrado.
 */
export function prazoDoProcesso(etapas = []) {
  const abertas = etapas.filter((e) => !ehEncerrada(e.status) && e.data_prevista);
  if (!abertas.length) return null;
  return abertas.reduce((maior, e) => (e.data_prevista > maior ? e.data_prevista : maior), abertas[0].data_prevista);
}
