/**
 * Contas do PLR — as mesmas fórmulas da aba SETORES da plr.xlsx.
 *
 * O banco guarda meta, resultado, peso e a regra; o resto sai daqui:
 *   % da meta   = resultado / meta                       (coluna "Resultado %")
 *   aderência   = pela regra do indicador                (coluna "Aderência")
 *   contribuição = aderência × peso                      (coluna "Resultado")
 *   total do setor = soma das contribuições              (linha "Total")
 *
 * Diferença de propósito em relação à planilha: lá o Total de alguns setores
 * somava só parte das linhas (Financeiro, Comercial e PMO). Aqui o total é
 * sempre a soma de TODAS — os pesos de cada setor fecham 100% justamente
 * porque todas as linhas contam.
 */

export const UNIDADES = {
  percentual: { rotulo: '%', campo: '%' },
  reais_mi: { rotulo: 'R$ milhões', campo: 'R$ mi' },
  dias: { rotulo: 'Dias', campo: 'dias' },
  numero: { rotulo: 'Número', campo: '' },
};

export const REGRAS = {
  proporcional: {
    rotulo: 'Proporcional',
    descricao: 'De 95% a 100% da meta: proporcional. De 90% a 94,99%: 50%. Abaixo de 90%: zero.',
  },
  teto: {
    rotulo: 'Até a meta',
    descricao: 'Até 100% da meta: 100%. Acima de 100%: zero.',
  },
};

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

// Corta o ruído do ponto flutuante antes de comparar com as faixas: 0,9025 /
// 0,95 dá 0,9499999999999 em vez de 0,95, e cairia na faixa de baixo.
const arred = (v) => Math.round(v * 1e9) / 1e9;

/** resultado / meta, ou null se ainda não há resultado. */
export function percentualDaMeta(ind) {
  const meta = num(ind?.meta);
  const resultado = num(ind?.resultado);
  if (resultado === null || !meta || Number.isNaN(resultado)) return null;
  return arred(resultado / meta);
}

/**
 * Aderência do indicador, de 0 a 1 (ou null sem resultado).
 *   'proporcional': a partir de 95% vale o próprio %, com teto em 100%; de 90%
 *                   a 94,99% vale 50%; abaixo, zero.
 *   'teto':         até 100% da meta vale 100%; acima, zero. É a dos custos
 *                   e dos prazos, em que ficar abaixo da meta é o bom.
 */
export function aderencia(ind) {
  const r = percentualDaMeta(ind);
  if (r === null) return null;
  if (ind.regra === 'teto') return r > 1 ? 0 : 1;
  if (r >= 0.95) return Math.min(r, 1);
  if (r >= 0.9) return 0.5;
  return 0;
}

/** Quanto o indicador põe no total do setor (aderência × peso). */
export function contribuicao(ind) {
  const a = aderencia(ind);
  return a === null ? null : arred(a * Number(ind.peso || 0));
}

/**
 * Situação da aderência para a cor da célula: 'ok' (95% ou mais), 'parcial'
 * (os 50% da faixa intermediária), 'zero' e 'pendente' (sem resultado).
 */
export function situacao(ind) {
  const a = aderencia(ind);
  if (a === null) return 'pendente';
  if (a >= 0.95) return 'ok';
  if (a > 0) return 'parcial';
  return 'zero';
}

/**
 * Resumo do setor: total (soma das contribuições, sem resultado conta zero),
 * soma dos pesos, se os pesos fecham 100% e quantos indicadores ainda estão
 * sem resultado.
 */
export function resumoSetor(indicadores = []) {
  let total = 0;
  let somaPesos = 0;
  let pendentes = 0;
  for (const ind of indicadores) {
    somaPesos += Number(ind.peso || 0);
    const c = contribuicao(ind);
    if (c === null) pendentes += 1;
    else total += c;
  }
  total = arred(total);
  somaPesos = arred(somaPesos);
  return { total, somaPesos, pesosFecham: Math.abs(somaPesos - 1) < 1e-6, pendentes };
}

// ---- Exibição -----------------------------------------------------------------

const fmt = (casas) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas });
const FMT2 = fmt(2);

/** Valor de meta/resultado na unidade do indicador ("90%", "R$ 9,49 mi"). */
export function formatarValor(valor, unidade) {
  const v = num(valor);
  if (v === null || Number.isNaN(v)) return '—';
  switch (unidade) {
    case 'percentual': return `${FMT2.format(v * 100)}%`;
    case 'reais_mi': return `R$ ${FMT2.format(v)} mi`;
    case 'dias': return `${FMT2.format(v)} ${v === 1 ? 'dia' : 'dias'}`;
    default: return FMT2.format(v);
  }
}

/**
 * Fração como porcentagem. Duas casas, como a planilha (o PMO dá 79,98%, e
 * arredondar para 80% mostraria um número que ninguém calculou); o peso usa 0.
 */
export function formatarPct(fracao, casas = 2) {
  const v = num(fracao);
  if (v === null || Number.isNaN(v)) return '—';
  return `${(casas === 2 ? FMT2 : fmt(casas)).format(v * 100)}%`;
}

/**
 * O que impede salvar a edição de um setor, uma frase por problema. Recebe as
 * linhas como estão nos campos (texto) e devolve [] quando está tudo certo.
 */
export function problemasDaEdicao(linhas = []) {
  const problemas = [];
  linhas.forEach((l, i) => {
    const n = `Linha ${i + 1}`;
    if (!String(l.nome ?? '').trim()) problemas.push(`${n}: indicador sem nome.`);
    const meta = deCampo(l.meta, l.unidade);
    if (meta === null || Number.isNaN(meta) || meta === 0) {
      problemas.push(`${n}: a meta precisa ser um número diferente de zero.`);
    }
    if (Number.isNaN(deCampo(l.resultado, l.unidade))) {
      problemas.push(`${n}: o resultado não é um número (deixe vazio se ainda não há).`);
    }
    const peso = deCampo(l.peso, 'percentual');
    if (peso === null || Number.isNaN(peso) || peso < 0 || peso > 1) {
      problemas.push(`${n}: o peso precisa ficar entre 0 e 100%.`);
    }
  });
  return problemas;
}

// ---- Campos da tela de edição --------------------------------------------------
// O campo mostra o número como a pessoa pensa nele: percentual em pontos (90,
// e não 0,9), reais em milhões. O banco guarda como a planilha (fração).

/** Valor do banco → texto do campo. Peso usa a unidade 'percentual'. */
export function paraCampo(valor, unidade) {
  const v = num(valor);
  if (v === null || Number.isNaN(v)) return '';
  const exibido = unidade === 'percentual' ? v * 100 : v;
  return String(Number(exibido.toFixed(6))).replace('.', ',');
}

/**
 * Texto do campo → valor do banco. '' vira null; texto que não é número vira
 * NaN (quem chama decide se pode ficar vazio). Aceita vírgula ou ponto como
 * decimal; com os dois, o ponto é separador de milhar ("1.234,5").
 */
export function deCampo(texto, unidade) {
  const t = String(texto ?? '').trim().replace(/\s|%/g, '');
  if (!t) return null;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return NaN;
  const v = Number(normal);
  return unidade === 'percentual' ? Number((v / 100).toFixed(10)) : v;
}
