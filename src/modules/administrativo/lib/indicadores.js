import { ehEncerrado } from './statusChamado.js';

/**
 * Indicadores do Administrativo.
 *
 * Lógica pura — sem Supabase, sem React — para poder ser testada. A tela só
 * desenha o que sai daqui.
 *
 * O que este arquivo consegue medir depende do que a RLS entrega a quem está
 * olhando: o time do Adm vê a empresa toda, e quem só abre chamado vê os
 * próprios. Os números são sempre "do que eu enxergo", nunca uma verdade
 * global — a tela precisa dizer isso.
 */

const ABERTOS = new Set(['aguardando_aprovacao', 'aberto', 'em_atendimento', 'aguardando_solicitante']);

export const estaAberto = (c) => ABERTOS.has(c?.status);
export const estaEncerrado = (c) => ehEncerrado(c?.status);

/** Data em instante comparável, tolerando nulo. */
const t = (iso) => (iso ? new Date(iso).getTime() : null);

/**
 * Fechou dentro do prazo?
 *
 * @returns {boolean|null} null quando não dá para dizer — chamado sem prazo
 *   definido, ou ainda aberto. Contar "sem prazo" como cumprido inflaria o
 *   indicador justamente onde falta configuração.
 */
export function fechouNoPrazo(c) {
  if (c?.status !== 'fechado') return null;
  const fim = t(c.fechado_em);
  const prazo = t(c.sla_vence_em);
  if (!fim || !prazo) return null;
  return fim <= prazo;
}

/**
 * Está vencido AGORA? Só faz sentido para chamado ainda em jogo: um fechado
 * com atraso já é contado pelo indicador de SLA, e somar os dois contaria o
 * mesmo problema duas vezes.
 */
export function estaAtrasado(c, agora = Date.now()) {
  if (!estaAberto(c)) return false;
  const prazo = t(c?.sla_vence_em);
  return prazo !== null && prazo < agora;
}

/** Agrupa e ordena do maior para o menor, com desempate estável pelo nome. */
function contarPor(chamados, chave) {
  const mapa = new Map();
  for (const c of chamados) {
    const k = chave(c);
    if (!k) continue;
    mapa.set(k, (mapa.get(k) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => (b.total - a.total) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Painel completo.
 *
 * @param chamados [{ status, classe, servico, criado_em, fechado_em, sla_vence_em }]
 * @returns {{
 *   total, abertos, encerrados (fechado + reprovado + cancelado),
 *   atendidos (só os de fato atendidos), reprovados, atrasados,
 *   sla: { medidos: number, noPrazo: number, fora: number, semPrazo: number, pct: number|null },
 *   abertosPorClasse: Array<{nome, total}>,
 *   abertosPorStatus: Array<{nome, total}>,
 *   porServico: Array<{nome, abertos, encerrados, total}>
 * }}
 */
export function resumoIndicadores(chamados = [], agora = Date.now()) {
  const abertos = chamados.filter(estaAberto);
  const encerrados = chamados.filter(estaEncerrado);
  // Só o que foi de fato atendido entra na conta de SLA: reprovado nunca teve
  // atendimento, então julgá-lo por prazo não diria nada.
  const atendidos = chamados.filter((c) => c.status === 'fechado');

  // SLA: só entram os que dá para julgar. `semPrazo` fica visível de propósito,
  // para a lacuna de configuração não sumir dentro de uma porcentagem bonita.
  let noPrazo = 0;
  let fora = 0;
  let semPrazo = 0;
  for (const c of atendidos) {
    const v = fechouNoPrazo(c);
    if (v === null) semPrazo += 1;
    else if (v) noPrazo += 1;
    else fora += 1;
  }
  const medidos = noPrazo + fora;

  return {
    total: chamados.length,
    abertos: abertos.length,
    // "Fechados" para quem lê o painel = tudo que acabou, reprovado incluído.
    encerrados: encerrados.length,
    atendidos: atendidos.length,
    reprovados: chamados.filter((c) => c.status === 'reprovado').length,
    atrasados: chamados.filter((c) => estaAtrasado(c, agora)).length,
    sla: {
      medidos,
      noPrazo,
      fora,
      semPrazo,
      // Média de nada não é zero — zero significaria "nenhum cumpriu".
      pct: medidos ? Math.round((noPrazo / medidos) * 100) : null,
    },
    abertosPorClasse: contarPor(abertos, (c) => c.classeLabel || c.classe),
    abertosPorStatus: contarPor(abertos, (c) => c.status),
    porServico: agruparPorServico(chamados),
  };
}

/** Serviço a serviço: quanto entrou, quanto saiu e quanto ainda está em pé. */
function agruparPorServico(chamados) {
  const mapa = new Map();
  for (const c of chamados) {
    const nome = c.servicoLabel || `${c.classe}/${c.servico}`;
    if (!mapa.has(nome)) mapa.set(nome, { nome, abertos: 0, encerrados: 0, total: 0 });
    const linha = mapa.get(nome);
    linha.total += 1;
    if (estaAberto(c)) linha.abertos += 1;
    if (estaEncerrado(c)) linha.encerrados += 1;
  }
  return [...mapa.values()].sort((a, b) => (b.total - a.total)
    || a.nome.localeCompare(b.nome, 'pt-BR'));
}
