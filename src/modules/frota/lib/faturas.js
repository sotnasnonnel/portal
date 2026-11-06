// Faturas de veículos (v2 do protótipo docs/ref/"HTML Gestão de Frota PHD v2.html").
// Regras puras, sem React e sem Supabase: roda sob `node --test`. Campos com os
// nomes das colunas de frota_faturas.
import {
  daysUntil, isNum, norm, groupSum, todayISO,
} from './regras.js';

export const FAT_STATUS = ['Aguardando conferência', 'Conferida', 'Divergência', 'Paga', 'Cancelada'];
export const FAT_TIPOS = ['Locação mensal', 'GPS / telemetria', 'Km excedente', 'Multa', 'Avaria', 'Frete', 'Outros'];
export const FAT_FORMAS = ['Boleto', 'PIX', 'Transferência', 'Cartão corporativo', 'Débito em fatura'];
/** Status que registram conferência (o gatilho do banco grava quem e quando). */
export const FAT_CONFERENCIA = ['Conferida', 'Divergência', 'Paga'];

export const FILTROS_FATURAS = {
  q: '', comp: '', mesVenc: '', de: '', ate: '', status: '', locadora: '', placa: '', venc: '',
};

export const fatTone = (s) => ({
  'Aguardando conferência': 'info', Conferida: 'ok', Divergência: 'crit', Paga: 'neutral', Cancelada: 'neutral',
}[s] || 'neutral');
export const fatAberta = (f) => !['Paga', 'Cancelada'].includes(f.status);

const dataBR = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');

/** Situação do vencimento. lvl 2 = vencida, 1 = vence em até 7 dias. */
export function fatVenc(f) {
  if (f.status === 'Paga') return { tone: 'ok', label: f.data_pagamento ? `Paga em ${dataBR(f.data_pagamento)}` : 'Paga', lvl: 0 };
  if (f.status === 'Cancelada') return { tone: 'neutral', label: 'Cancelada', lvl: 0 };
  const d = daysUntil(f.vencimento);
  if (d == null) return { tone: 'neutral', label: 'Sem vencimento', lvl: 0 };
  if (d < 0) return { tone: 'crit', label: `Vencida há ${-d} d`, lvl: 2 };
  if (d === 0) return { tone: 'warn', label: 'Vence hoje', lvl: 1 };
  if (d <= 7) return { tone: 'warn', label: `Vence em ${d} d`, lvl: 1 };
  return { tone: 'neutral', label: `Vence em ${d} d`, lvl: 0 };
}

export const fatVencida = (f) => fatAberta(f) && fatVenc(f).lvl === 2;

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

/** Fatura menos previsto, em centavos arredondados; null sem os dois valores. */
export const fatDif = (f) => (isNum(f.valor) && isNum(f.valor_previsto)
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
  if (!['placa', 'competencia', 'tipo'].includes(campo)) return { textos, sugestao: sugestaoAnterior };
  const out = { ...textos };
  if (campo === 'placa') {
    const herdado = dadosDoVeiculo(out.placa, out.competencia, dados);
    if (herdado) Object.assign(out, herdado);
  }
  const pv = previstoDe(out.placa, out.competencia, out.tipo, dados);
  let sugestao = sugestaoAnterior;
  if (!out.valor_previsto || out.valor_previsto === sugestaoAnterior) {
    out.valor_previsto = pv != null ? fmt(pv) : '';
    sugestao = out.valor_previsto;
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
  return { vals: out };
}

/** Filtro da tela. `f` tem a forma de FILTROS_FATURAS. */
export function filtrarFaturas(lista, f) {
  const q = norm(f.q);
  return lista.filter((x) => {
    if (f.comp && x.competencia !== f.comp) return false;
    if (f.mesVenc && !String(x.vencimento || '').startsWith(f.mesVenc)) return false;
    if (f.de && !(x.vencimento && x.vencimento >= f.de)) return false;
    if (f.ate && !(x.vencimento && x.vencimento <= f.ate)) return false;
    if (f.status && x.status !== f.status) return false;
    if (f.locadora && x.locadora !== f.locadora) return false;
    if (f.placa && x.placa !== f.placa) return false;
    if (f.venc) {
      const d = daysUntil(x.vencimento);
      if (f.venc === 'vencidas' && !(fatAberta(x) && d != null && d < 0)) return false;
      if (f.venc === '7d' && !(fatAberta(x) && d != null && d >= 0 && d <= 7)) return false;
      if (f.venc === 'sem' && x.vencimento) return false;
    }
    if (q && !norm([x.placa, x.numero_fatura, x.condutor, x.locadora, x.ct, x.contrato, x.tipo, x.obs, x.obs_conferencia].join(' ')).includes(q)) return false;
    return true;
  });
}

/** Em aberto primeiro, do vencimento mais próximo; depois as fechadas, das mais recentes. */
export function ordenarFaturas(lista) {
  return [...lista].sort((a, b) => {
    const oa = fatAberta(a) ? 0 : 1;
    const ob = fatAberta(b) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const va = a.vencimento || '9999';
    const vb = b.vencimento || '9999';
    return oa === 0 ? va.localeCompare(vb) : vb.localeCompare(va);
  });
}

/** Agenda de pagamentos: as faturas em aberto somadas por dia de vencimento. */
export const agendaDePagamentos = (lista, limite = 10) => groupSum(
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
    vencidas: ab.filter((x) => fatVenc(x).lvl === 2),
    proximas: ab.filter((x) => fatVenc(x).lvl === 1),
    semVencimento: ab.filter((x) => !x.vencimento),
  };
}
