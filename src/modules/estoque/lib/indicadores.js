// Agregações do dashboard. Puras: recebem as listas já carregadas e devolvem os
// dados no formato que o Recharts consome. Sem React e sem Supabase.
//
// Toda função que depende de "hoje" recebe a data de fora (`ref`) — assim o
// teste é determinístico e o gráfico não muda de resultado à meia-noite.

import { rotuloVariante, EM_ALERTA } from './catalogo.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Chave e rótulo do mês de uma data ISO, sem depender de locale do runtime. */
export function mesDe(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
  };
}

/** Os últimos N meses até `ref`, do mais antigo para o mais novo. */
export function janelaDeMeses(ref, meses = 12) {
  const base = new Date(ref);
  const saida = [];
  for (let i = meses - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    saida.push(mesDe(d));
  }
  return saida;
}

export function resumoPosicao(posicao) {
  const ativos = (posicao || []).filter((v) => v.ativo !== false);
  return {
    skus: ativos.length,
    pecas: ativos.reduce((s, v) => s + (Number(v.saldo) || 0), 0),
    semEstoque: ativos.filter((v) => v.situacao === 'sem_estoque').length,
    abaixoMinimo: ativos.filter((v) => v.situacao === 'abaixo_minimo').length,
    emAlerta: ativos.filter((v) => EM_ALERTA.has(v.situacao)).length,
    valorTotal: ativos.reduce((s, v) => s + (Number(v.valor_total) || 0), 0),
    // Custo em branco é a regra nos EPIs; sem isto o valor total parece baixo
    // sem explicação.
    semCusto: ativos.filter((v) => v.custo_unitario === null || v.custo_unitario === undefined).length,
  };
}

/**
 * O que repor primeiro. Ordena pelo DÉFICIT (mínimo − saldo), não pelo saldo:
 * um item com mínimo 20 e saldo 3 é mais urgente que outro zerado cujo mínimo
 * é 1. Item sem mínimo cadastrado e zerado entra com déficit 1, senão sumiria
 * da lista justamente quando acabou.
 */
export function topDeficit(posicao, n = 10) {
  return (posicao || [])
    .filter((v) => v.ativo !== false && EM_ALERTA.has(v.situacao))
    .map((v) => ({
      name: rotuloVariante(v),
      saldo: Number(v.saldo) || 0,
      minimo: Number(v.estoque_minimo) || 0,
      deficit: Math.max(1, (Number(v.estoque_minimo) || 0) - (Number(v.saldo) || 0)),
    }))
    .sort((a, b) => b.deficit - a.deficit || a.saldo - b.saldo)
    .slice(0, n);
}

const ehSaida = (m) => m.tipo === 'saida';
const pecas = (m) => Math.abs(Number(m.quantidade) || 0);

/** Consumo por mês, separado por categoria — a curva que mostra sazonalidade. */
export function consumoMensal(movimentos, ref, meses = 12) {
  const janela = janelaDeMeses(ref, meses);
  const porMes = new Map(janela.map((m) => [m.chave, { name: m.rotulo, epi: 0, uniforme: 0 }]));
  for (const m of movimentos || []) {
    if (!ehSaida(m)) continue;
    const mes = mesDe(m.criado_em);
    const alvo = mes && porMes.get(mes.chave);
    if (!alvo) continue;
    const cat = m.variante?.categoria === 'uniforme' ? 'uniforme' : 'epi';
    alvo[cat] += pecas(m);
  }
  return janela.map((m) => porMes.get(m.chave));
}

/** Entrada x saída por mês, para ver se o estoque está crescendo ou drenando. */
export function entradaSaidaMensal(movimentos, ref, meses = 12) {
  const janela = janelaDeMeses(ref, meses);
  const porMes = new Map(janela.map((m) => [m.chave, { name: m.rotulo, entrada: 0, saida: 0 }]));
  for (const m of movimentos || []) {
    if (m.tipo === 'ajuste') continue;   // ajuste não é giro, é correção
    const mes = mesDe(m.criado_em);
    const alvo = mes && porMes.get(mes.chave);
    if (!alvo) continue;
    alvo[m.tipo === 'entrada' ? 'entrada' : 'saida'] += pecas(m);
  }
  return janela.map((m) => porMes.get(m.chave));
}

const ranking = (movimentos, chave, n) => {
  const soma = new Map();
  for (const m of movimentos || []) {
    if (!ehSaida(m)) continue;
    const k = chave(m);
    if (!k) continue;
    soma.set(k, (soma.get(k) || 0) + pecas(m));
  }
  return [...soma.entries()]
    .map(([name, qtd]) => ({ name, qtd }))
    .sort((a, b) => b.qtd - a.qtd || a.name.localeCompare(b.name))
    .slice(0, n);
};

/** Itens que mais saem — o que precisa de contrato de reposição. */
export const topConsumidos = (movimentos, n = 10) =>
  ranking(movimentos, (m) => rotuloVariante(m.variante), n);

/** Entregas por pessoa — é a aba DISPENSAÇÃO da planilha, reproduzida. */
export const entregasPorColaborador = (movimentos, n = 15) =>
  ranking(movimentos, (m) => m.colaboradorNome, n);

/** Valor imobilizado por categoria. Só entra quem tem custo cadastrado. */
export function valorPorCategoria(posicao) {
  const soma = new Map([['EPIs', 0], ['Uniformes', 0]]);
  for (const v of posicao || []) {
    if (v.ativo === false || !v.custo_unitario) continue;
    const k = v.categoria === 'uniforme' ? 'Uniformes' : 'EPIs';
    soma.set(k, soma.get(k) + (Number(v.valor_total) || 0));
  }
  return [...soma.entries()]
    .map(([name, valor]) => ({ name, valor }))
    .filter((x) => x.valor > 0);
}
