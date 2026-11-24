// Faturas de veículos (v2 e v3 do protótipo docs/ref/"HTML Gestão de Frota PHD v3.html").
// Regras puras, sem React e sem Supabase: roda sob `node --test`. Campos com os
// nomes das colunas de frota_faturas.
import {
  compPrev, compNext, daysUntil, isNum, lastComp, norm, groupSum, todayISO,
} from './regras.js';

/** 'Prevista' (v3): gerada pelo dia de vencimento do contrato, antes da fatura chegar. */
export const FAT_STATUS = ['Prevista', 'Aguardando conferência', 'Conferida', 'Divergência', 'Paga', 'Cancelada'];
export const FAT_TIPOS = ['Locação mensal', 'GPS / telemetria', 'Km excedente', 'Multa', 'Avaria', 'Frete', 'Outros'];
export const FAT_FORMAS = ['Boleto', 'PIX', 'Transferência', 'Cartão corporativo', 'Débito em fatura'];
/** Status que registram conferência (o gatilho do banco grava quem e quando). */
export const FAT_CONFERENCIA = ['Conferida', 'Divergência', 'Paga'];

/**
 * Filtros da tela. `mes` + `base`: o mês da tela, por vencimento ('venc') ou por
 * referência ('ref'); vazio = todos os meses. Abre no mês atual (v3).
 */
export const FILTROS_FATURAS = {
  q: '', mes: todayISO().slice(0, 7), base: 'venc', de: '', ate: '', status: '', locadora: '', placa: '', venc: '', ord: 'asc',
};
/** O que "Limpar filtros" não mexe: o mês, a base e a ordem. */
export const FILTROS_FATURAS_FIXOS = ['mes', 'base', 'ord'];

export const fatTone = (s) => ({
  Prevista: 'neutral', 'Aguardando conferência': 'info', Conferida: 'ok', Divergência: 'crit', Paga: 'ok', Cancelada: 'neutral',
}[s] || 'neutral');
export const fatAberta = (f) => !['Paga', 'Cancelada'].includes(f.status);

const dataBR = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');

/**
 * Situação do vencimento (escala da v3). lvl 3 = vencida; 2 = vence hoje, amanhã
 * ou em 2 dias (prioridade de pagamento); 1 = vence em 3 a 7 dias; 0 = o resto.
 * `d` = dias até o vencimento.
 */
export function fatVenc(f) {
  if (f.status === 'Paga') return { tone: 'ok', label: f.data_pagamento ? `Paga em ${dataBR(f.data_pagamento)}` : 'Paga', lvl: 0, d: null };
  if (f.status === 'Cancelada') return { tone: 'neutral', label: 'Cancelada', lvl: 0, d: null };
  const d = daysUntil(f.vencimento);
  if (d == null) return { tone: 'neutral', label: 'Sem vencimento', lvl: 0, d };
  if (d < 0) return { tone: 'crit', label: `Vencida há ${-d} d`, lvl: 3, d };
  if (d === 0) return { tone: 'crit', label: 'Vence hoje', lvl: 2, d };
  if (d === 1) return { tone: 'crit', label: 'Vence amanhã', lvl: 2, d };
  if (d === 2) return { tone: 'crit', label: 'Vence em 2 dias', lvl: 2, d };
  if (d <= 7) return { tone: 'warn', label: `Vence em ${d} dias`, lvl: 1, d };
  return { tone: 'neutral', label: `Vence em ${d} dias`, lvl: 0, d };
}

export const fatVencida = (f) => fatAberta(f) && fatVenc(f).lvl === 3;
/** Contador do menu: vencidas e as que vencem em até 2 dias. */
export const fatUrgente = (f) => fatAberta(f) && fatVenc(f).lvl >= 2;

/** Data de vencimento do mês para um dia do contrato: dia 31 em fevereiro vira o último dia. */
export function dueDateFor(mes, dia) {
  if (!mes || !isNum(dia)) return '';
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return `${mes}-${String(Math.min(Math.max(1, dia), ultimo)).padStart(2, '0')}`;
}

/**
 * Valor que se espera na fatura: o do controle mensal do veículo na competência
 * e, sem ele, o do cadastro. Multa, avaria e frete só existem no mensal; km
 * excedente e "Outros" não têm referência.
 */
export function previstoDe(placa, comp, tipo, dados) {
  if (!placa) return null;
  const m = comp ? dados.mensal.find((x) => x.competencia === comp && x.placa === placa) : null;
  const v = dados.veiculos.find((x) => x.placa === placa) || {};
  const pick = (mk, vk) => {
    if (m && isNum(m[mk])) return m[mk];
    return vk && isNum(v[vk]) ? v[vk] : null;
  };
  switch (tipo || 'Locação mensal') {
    case 'Locação mensal': return pick('custo_locacao', 'custo_mensal');
    case 'GPS / telemetria': return pick('gps_valor', 'gps_valor');
    case 'Multa': return pick('multas');
    case 'Avaria': return pick('avarias');
    case 'Frete': return pick('frete');
    default: return null;
  }
}

/** Fatura menos previsto, em centavos; null sem os dois valores ou se ainda é só previsão. */
export const fatDif = (f) => (f.status !== 'Prevista' && isNum(f.valor) && isNum(f.valor_previsto)
  ? Math.round((f.valor - f.valor_previsto) * 100) / 100
  : null);

/** A diferença que merece destaque: mais de 50 centavos para qualquer lado. */
export const difRelevante = (dif) => isNum(dif) && Math.abs(dif) > 0.5;

const CAMPOS_DO_VEICULO = ['locadora', 'contrato', 'condutor', 'ct', 'custo_resp'];

/** O que a fatura herda do veículo: o mensal da competência vence o cadastro. */
export function dadosDoVeiculo(placa, comp, dados) {
  const v = dados.veiculos.find((x) => x.placa === placa);
  if (!v) return null;
  const m = comp ? dados.mensal.find((x) => x.competencia === comp && x.placa === placa) : null;
  return Object.fromEntries(CAMPOS_DO_VEICULO.map((k) => [k, (m && m[k]) || v[k] || '']));
}

/** Veículos que aceitam fatura nova: ativos e com placa, em ordem de placa. */
export const veiculosParaFatura = (veiculos) => veiculos
  .filter((v) => v.status === 'Ativo' && v.placa)
  .sort((a, b) => a.placa.localeCompare(b.placa));

/**
 * Autopreenchimento do formulário (textos dos inputs). Trocar o veículo traz
 * locadora, contrato, condutor, CT e responsável; trocar veículo, competência ou
 * tipo recalcula o previsto, mas só se ele estiver vazio ou ainda for a sugestão
 * anterior: valor digitado à mão não é apagado.
 */
export function autoPreencher(textos, campo, dados, sugestaoAnterior, fmt) {
  const ant = typeof sugestaoAnterior === 'object' && sugestaoAnterior
    ? sugestaoAnterior
    : { previsto: sugestaoAnterior || '', venc: '' };
  if (!['placa', 'competencia', 'tipo'].includes(campo)) return { textos, sugestao: ant };
  const out = { ...textos };
  if (campo === 'placa') {
    const herdado = dadosDoVeiculo(out.placa, out.competencia, dados);
    if (herdado) Object.assign(out, herdado);
  }
  const sugestao = { ...ant };
  const pv = previstoDe(out.placa, out.competencia, out.tipo, dados);
  if (!out.valor_previsto || out.valor_previsto === ant.previsto) {
    out.valor_previsto = pv != null ? fmt(pv) : '';
    sugestao.previsto = out.valor_previsto;
  }
  // v3: o vencimento sai do dia de vencimento do contrato no mês de referência.
  // Mesma regra do previsto: só troca o vazio ou o que ele mesmo sugeriu.
  const v = dados.veiculos.find((x) => x.placa === out.placa);
  const venc = v && out.competencia ? dueDateFor(out.competencia, v.dia_vencimento_fatura) : '';
  if (venc && (!out.vencimento || out.vencimento === ant.venc)) {
    out.vencimento = venc;
    sugestao.venc = venc;
  }
  return { textos: out, sugestao };
}

/**
 * Valida e completa a fatura antes de gravar. Campo do veículo em branco vem do
 * cadastro; Paga sem data leva a de hoje (o banco faz o mesmo). Devolve
 * { erro, campo } quando não pode gravar.
 */
export function prepararFatura(vals, dados) {
  if (vals.status === 'Divergência' && !String(vals.obs_conferencia || '').trim()) {
    return { erro: 'Descreva a divergência em “Observação da conferência”.', campo: 'obs_conferencia' };
  }
  const out = { ...vals };
  const v = dados.veiculos.find((x) => x.placa === out.placa);
  if (v) CAMPOS_DO_VEICULO.forEach((k) => { if (!out[k] && v[k]) out[k] = v[k]; });
  if (out.status === 'Paga' && !out.data_pagamento) out.data_pagamento = todayISO();
  // A fatura prevista chegou: com número ou documento, vai para a conferência.
  if (out.status === 'Prevista' && (out.numero_fatura || (out.anexos || []).length)) out.status = 'Aguardando conferência';
  return { vals: out };
}

/** A fatura cai no mês da tela? Pela referência ou pelo vencimento. */
export const fatNoMes = (x, mes, base) => (!mes
  || (base === 'ref' ? x.competencia === mes : String(x.vencimento || '').startsWith(mes)));

/** Faturas do mês escolhido, antes dos outros filtros (contagem dos chips). */
export const faturasDoMes = (lista, f) => lista.filter((x) => fatNoMes(x, f.mes, f.base));

const NIVEL_DO_FILTRO = { vencidas: 3, '2d': 2, '7d': 1 };

/** Filtro da tela. `f` tem a forma de FILTROS_FATURAS. */
export function filtrarFaturas(lista, f) {
  const q = norm(f.q);
  return lista.filter((x) => {
    if (!fatNoMes(x, f.mes, f.base)) return false;
    if (f.de && !(x.vencimento && x.vencimento >= f.de)) return false;
    if (f.ate && !(x.vencimento && x.vencimento <= f.ate)) return false;
    if (f.status && x.status !== f.status) return false;
    if (f.locadora && x.locadora !== f.locadora) return false;
    if (f.placa && x.placa !== f.placa) return false;
    if (f.venc === 'sem' && x.vencimento) return false;
    if (NIVEL_DO_FILTRO[f.venc] && !(fatAberta(x) && fatVenc(x).lvl === NIVEL_DO_FILTRO[f.venc])) return false;
    if (q && !norm([x.placa, x.numero_fatura, x.condutor, x.locadora, x.ct, x.contrato, x.tipo, x.obs, x.obs_conferencia].join(' ')).includes(q)) return false;
    return true;
  });
}

/** Por vencimento, crescente ('asc') ou decrescente; sem vencimento no fim; empate pela placa. */
export function ordenarFaturas(lista, ord = 'asc') {
  const sinal = ord === 'desc' ? -1 : 1;
  return [...lista].sort((a, b) => {
    if (!a.vencimento !== !b.vencimento) return a.vencimento ? -1 : 1;
    const c = a.vencimento && b.vencimento ? sinal * a.vencimento.localeCompare(b.vencimento) : 0;
    return c || String(a.placa || '').localeCompare(String(b.placa || ''));
  });
}

/** Agenda de pagamentos: as faturas em aberto somadas por dia de vencimento. */
export const agendaDePagamentos = (lista, limite = 12) => groupSum(
  lista.filter((x) => fatAberta(x) && x.vencimento),
  (x) => x.vencimento,
  (x) => x.valor,
  99,
).sort((a, b) => a.l.localeCompare(b.l)).slice(0, limite);

/** Indicadores do topo da tela, sobre a lista já filtrada. */
export function resumoFaturas(rows) {
  const ab = rows.filter(fatAberta);
  return {
    aguardando: rows.filter((x) => x.status === 'Aguardando conferência'),
    divergencia: rows.filter((x) => x.status === 'Divergência'),
    pagas: rows.filter((x) => x.status === 'Paga'),
    vencidas: ab.filter((x) => fatVenc(x).lvl === 3),
    ate2: ab.filter((x) => fatVenc(x).lvl === 2),
    ate7: ab.filter((x) => fatVenc(x).lvl === 1),
    semVencimento: ab.filter((x) => !x.vencimento),
  };
}

/** Faixas da caixa "Vencimentos de faturas" do Painel, do vencimento mais próximo. */
export function faixasDeVencimento(faturas) {
  const ab = faturas.filter(fatAberta);
  const faixa = (lvl) => ab.filter((x) => fatVenc(x).lvl === lvl)
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
  const futuras = ab.filter((x) => x.vencimento && fatVenc(x).lvl === 0)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  return {
    vencidas: faixa(3),
    ate2: faixa(2),
    ate7: faixa(1),
    semVencimento: ab.filter((x) => !x.vencimento),
    proxima: futuras[0] || null,
  };
}

const OBS_PREVISTA = 'Fatura prevista gerada pelo dia de vencimento do contrato. Ao receber, informe nº e valor real e anexe a fatura.';

/**
 * "Gerar faturas" do mês (v3): uma fatura Prevista de locação mensal por veículo
 * ativo com dia de vencimento, que ainda não tenha fatura de locação vencendo no
 * mês. O valor sai do controle mensal do veículo (ou do cadastro) e, sem os dois,
 * do último mês lançado. `competencia` recebe o próprio mês (como no protótipo).
 */
export function gerarFaturasPrevistas(mes, dados) {
  const ativos = dados.veiculos.filter((v) => v.status === 'Ativo' && v.placa);
  const com = ativos.filter((v) => isNum(v.dia_vencimento_fatura));
  const sem = ativos.filter((v) => !isNum(v.dia_vencimento_fatura));
  const ja = new Set(dados.faturas
    .filter((f) => f.tipo === 'Locação mensal' && String(f.vencimento || '').startsWith(mes))
    .map((f) => f.placa));
  const ultimo = lastComp(dados.mensal);
  const todo = com.filter((v) => !ja.has(v.placa)).map((v) => {
    const pv = previstoDe(v.placa, mes, 'Locação mensal', dados) ?? previstoDe(v.placa, ultimo, 'Locação mensal', dados);
    return {
      placa: v.placa, competencia: mes, tipo: 'Locação mensal', vencimento: dueDateFor(mes, v.dia_vencimento_fatura),
      valor: pv, valor_previsto: pv, status: 'Prevista',
      locadora: v.locadora || null, contrato: v.contrato || null, condutor: v.condutor || null,
      ct: v.ct || null, custo_resp: v.custo_resp || null, obs: OBS_PREVISTA,
    };
  });
  return { todo, ja: com.filter((v) => ja.has(v.placa)).length, sem: sem.length };
}

/** O mês anterior/seguinte da barra de mês da tela de Faturas. */
export const mesVizinho = (mes, passo) => {
  const base = mes || todayISO().slice(0, 7);
  return passo < 0 ? compPrev(base) : compNext(base);
};
