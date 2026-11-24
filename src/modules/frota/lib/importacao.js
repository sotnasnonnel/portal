// Relatórios das plataformas (v3 do protótipo): regras puras da importação de
// planilha para o controle mensal. Sem React e sem Supabase (roda sob
// `node --test`). A leitura do arquivo fica em planilhas.js; aqui entram só as
// linhas já lidas (matriz de células).
import { norm, placaDe, numDe } from './regras.js';

/** Plataforma de origem do relatório, por área. */
export const PLATAFORMAS = {
  combustivel: ['Ticket Log', 'Cartão combustível (outro)', 'Locadora', 'Outra'],
  quilometragem: ['Cobli', 'GPS / telemetria da locadora', 'Movida', 'Versa', 'Outra'],
};

/**
 * Campo do controle mensal (frota_mensal) que pode receber os valores, e como
 * juntar várias linhas da mesma placa: hodômetro fica com o maior; consumo, saldo
 * e km rodado somam. `t` é só o formato de tela (dinheiro ou inteiro).
 */
export const DESTINOS = {
  combustivel: [
    { campo: 'recarga_mes', l: 'Valor consumido no mês (R$)', agg: 'soma', t: 'money' },
    { campo: 'saldo_remanescente', l: 'Saldo remanescente do cartão (R$)', agg: 'soma', t: 'money' },
  ],
  quilometragem: [
    { campo: 'km_atual', l: 'Km atual (hodômetro)', agg: 'max', t: 'int' },
    { campo: 'km_rodado_inf', l: 'Km rodado no mês', agg: 'soma', t: 'int' },
  ],
};

/** Palavras procuradas no cabeçalho, na ordem: a primeira que bater decide. */
const PALAVRAS_VALOR = {
  combustivel: ['valor', 'total', 'r$', 'consumo', 'gasto', 'liquido'],
  quilometragem: ['hodometro', 'hodômetro', 'odometro', 'odômetro', 'km atual', 'km final', 'distancia', 'distância', 'km'],
};

const preenchida = (c) => String(c ?? '').trim() !== '';

/**
 * Relatórios da área com arquivo no bucket, do envio mais recente ao mais
 * antigo. Sem `comp`, de todos os meses. Registro sem arquivo (importação da
 * Cobli que não guardou o original) fica de fora.
 */
export function relatoriosDe(arquivos, area, comp) {
  return (arquivos || [])
    .filter((a) => a.area === area && a.arquivo?.path && (!comp || a.competencia === comp))
    .sort((a, b) => String(b.arquivo.enviado_em || '').localeCompare(String(a.arquivo.enviado_em || '')));
}

/**
 * Índice (0-based) da linha do cabeçalho: a primeira, entre as 20 primeiras,
 * com pelo menos 3 células preenchidas. Relatório de plataforma costuma trazer
 * título e período antes da tabela. Sem nenhuma assim, a linha 0.
 */
export function linhaDoCabecalho(linhas) {
  const lim = Math.min(20, linhas?.length || 0);
  for (let i = 0; i < lim; i += 1) {
    if ((linhas[i] || []).filter(preenchida).length >= 3) return i;
  }
  return 0;
}

/** Quantas colunas mostrar: a linha mais longa entre as 200 primeiras (mínimo 1). */
export function numeroDeColunas(linhas) {
  return Math.max(1, ...(linhas || []).slice(0, 200).map((l) => l?.length || 0));
}

/**
 * Palpite das colunas. Placa: a coluna com mais células reconhecidas como placa
 * nas 300 primeiras linhas do corpo. Valor: o primeiro cabeçalho (fora o da placa)
 * que contém a primeira palavra-chave da área que bater. -1 quando não acha.
 */
export function adivinharColunas(cab, corpo, area) {
  const amostra = (corpo || []).slice(0, 300);
  const ncol = Math.max(cab?.length || 0, ...amostra.map((l) => l?.length || 0));
  let colPlaca = -1;
  let melhor = 0;
  for (let c = 0; c < ncol; c += 1) {
    const n = amostra.filter((l) => placaDe(l?.[c])).length;
    if (n > melhor) {
      melhor = n;
      colPlaca = c;
    }
  }
  let colValor = -1;
  const titulos = (cab || []).map(norm);
  for (const palavra of PALAVRAS_VALOR[area] || []) {
    const k = norm(palavra);
    const i = titulos.findIndex((t, ix) => ix !== colPlaca && t.includes(k));
    if (i >= 0) {
      colValor = i;
      break;
    }
  }
  return { colPlaca, colValor };
}

/**
 * Junta o relatório por placa e casa com o lançamento da competência. Linha sem
 * placa reconhecível ou sem número no valor é ignorada. `agg` 'max' fica com o
 * maior valor da placa; qualquer outro soma. Devolve os itens em ordem de placa,
 * com `mensal` = o lançamento (ou null quando a placa não tem lançamento no mês).
 */
export function casarComMensal(corpo, colPlaca, colValor, agg, comp, mensal) {
  if (colPlaca < 0 || colValor < 0) return { itens: [], casados: 0, semLancamento: 0 };
  const porPlaca = new Map();
  (corpo || []).forEach((l) => {
    const placa = placaDe(l?.[colPlaca]);
    const v = numDe(l?.[colValor]);
    if (!placa || v == null) return;
    const atual = porPlaca.get(placa);
    if (atual == null) porPlaca.set(placa, v);
    else porPlaca.set(placa, agg === 'max' ? Math.max(atual, v) : atual + v);
  });

  const doMes = new Map();
  (mensal || []).forEach((m) => {
    const p = m.competencia === comp ? placaDe(m.placa) : '';
    if (p && !doMes.has(p)) doMes.set(p, m);
  });

  const itens = [...porPlaca.entries()]
    .map(([placa, v]) => ({ placa, valor: Math.round(v * 100) / 100, mensal: doMes.get(placa) || null }))
    .sort((a, b) => a.placa.localeCompare(b.placa));
  const casados = itens.filter((x) => x.mensal).length;
  return { itens, casados, semLancamento: itens.length - casados };
}
