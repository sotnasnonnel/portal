/**
 * Resumo mensal das mobilizações — pedido da Edijane (30/09/2026), no molde da
 * planilha que o time mantinha: por mês, Pessoas e Empresas separadas, com a
 * quantidade, o tempo de cada uma e a média, em dias úteis.
 *
 * O MÊS de uma mobilização é o da conclusão real (`concluido_real`): é quando
 * ela foi "realizada". Só entram as finalizadas — cancelada não mobilizou
 * ninguém, e a em andamento ainda não tem tempo total.
 *
 * O tempo é o mesmo da lista de processos (tempoProcesso.js: dias úteis, as
 * duas pontas contadas), e a média usa a mesma regra de arredondamento dos
 * indicadores (para cima). Duas contas diferentes para o mesmo número fariam o
 * resumo e a lista discordarem.
 *
 * Lógica pura, testável com `node --test`.
 */

import { tempoTotalDias, tempoMedioDias } from './tempoProcesso.js';

/** Os dois grupos do resumo. Desmobilização fica de fora: o pedido é de mobilizações. */
export const GRUPOS_RESUMO = [
  { fluxo: 'mobilizacao_pessoa', titulo: 'Mobilização de pessoas' },
  { fluxo: 'mobilizacao_empresa', titulo: 'Mobilização de empresas' },
];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 'AAAA-MM' -> 'setembro de 2026'. */
export function rotuloMes(chave) {
  const [a, m] = String(chave).split('-').map(Number);
  return a && m ? `${MESES[m - 1]} de ${a}` : String(chave);
}

const mesDe = (p) => String(p.concluido_real || '').slice(0, 7);

export const realizada = (p) => p?.status === 'finalizado' && !!p.concluido_real;

/** Meses com alguma mobilização realizada, do mais recente para o mais antigo. */
export function mesesComDados(processos = []) {
  const grupos = new Set(GRUPOS_RESUMO.map((g) => g.fluxo));
  return [...new Set(processos.filter((p) => realizada(p) && grupos.has(p.fluxo)).map(mesDe))]
    .sort().reverse();
}

/**
 * As mobilizações de um fluxo realizadas no mês, com o tempo de cada uma, a
 * quantidade e a média. Ordem: a que levou mais tempo primeiro — é a que o
 * time vai querer explicar.
 */
export function resumoDoMes(processos = [], fluxo, mes) {
  const doMes = processos.filter((p) => p.fluxo === fluxo && realizada(p) && mesDe(p) === mes);
  const itens = doMes
    .map((p) => ({ ...p, dias: tempoTotalDias(p) }))
    .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  return { itens, quantidade: itens.length, media: tempoMedioDias(doMes).media };
}

/** A evolução: uma linha por mês, com quantidade e média de cada grupo. */
export function evolucaoMensal(processos = []) {
  return mesesComDados(processos).map((mes) => ({
    mes,
    grupos: GRUPOS_RESUMO.map((g) => {
      const r = resumoDoMes(processos, g.fluxo, mes);
      return { fluxo: g.fluxo, quantidade: r.quantidade, media: r.media };
    }),
  }));
}
