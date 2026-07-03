/**
 * Schema único da requisição de Ajuda de Custo.
 * Dirige render, validação e payload, no padrão do formulário de contratação:
 * `mostrar(form)` controla as seções condicionais por tipo marcado.
 * tipos: 'date' | 'number' | 'text' | 'textarea' | 'checkbox'
 * O colaborador e o anexo são tratados fora do schema.
 */
import { parseCurrency } from '../utils/currencyMask';

export const TIPOS_AJUDA = ['Alimentação', 'Mobilidade', 'Moradia'];

const tem = (tipo) => (f) => Array.isArray(f.tipos) && f.tipos.includes(tipo);

export const CAMPOS_AJUDA_CUSTO = [
  { id: 'data_inicio', n: 1, label: 'Data Início', tipo: 'date', obrigatorio: true },
  { id: 'data_final', n: 2, label: 'Data Final', tipo: 'date', obrigatorio: true },
  { id: 'tipos', n: 3, label: 'Tipo de Ajuda de Custo', tipo: 'checkbox', obrigatorio: true, opcoes: TIPOS_AJUDA },

  { id: 'alimentacao_valor', n: 4, label: 'Alimentação - Valor (R$)', tipo: 'moeda', obrigatorio: true, mostrar: tem('Alimentação') },
  { id: 'alimentacao_justificativa', n: 5, label: 'Alimentação - Justificativa', tipo: 'textarea', obrigatorio: true, mostrar: tem('Alimentação') },

  { id: 'mobilidade_valor', n: 6, label: 'Mobilidade - Valor (R$)', tipo: 'moeda', obrigatorio: true, mostrar: tem('Mobilidade') },
  { id: 'mobilidade_justificativa', n: 7, label: 'Mobilidade - Justificativa', tipo: 'textarea', obrigatorio: true, mostrar: tem('Mobilidade') },

  { id: 'moradia_valor', n: 8, label: 'Moradia - Valor (R$)', tipo: 'moeda', obrigatorio: true, mostrar: tem('Moradia') },
  { id: 'moradia_justificativa', n: 9, label: 'Moradia - Justificativa', tipo: 'textarea', obrigatorio: true, mostrar: tem('Moradia') },
];

export const camposVisiveisAjudaCusto = (form) =>
  CAMPOS_AJUDA_CUSTO.filter((c) => !c.mostrar || c.mostrar(form));

export function estadoInicialAjudaCusto() {
  const s = {};
  for (const c of CAMPOS_AJUDA_CUSTO) s[c.id] = c.tipo === 'checkbox' ? [] : '';
  return s;
}

/** Retorna os campos obrigatórios visíveis que estão vazios. */
export function validarAjudaCusto(form) {
  const faltando = [];
  for (const c of camposVisiveisAjudaCusto(form)) {
    if (!c.obrigatorio) continue;
    const v = form[c.id];
    const vazio = c.tipo === 'checkbox'
      ? !(Array.isArray(v) && v.length)
      : v == null || String(v).trim() === '';
    if (vazio) faltando.push(c);
  }
  return faltando;
}

/** Monta o payload p/ a tabela ajudas_custo; campos ocultos viram null. */
export function montarPayloadAjudaCusto(form) {
  const out = {};
  for (const c of CAMPOS_AJUDA_CUSTO) {
    const vis = !c.mostrar || c.mostrar(form);
    if (!vis) { out[c.id] = null; continue; }
    const v = form[c.id];
    if (c.tipo === 'moeda') out[c.id] = parseCurrency(v);
    else if (c.tipo === 'number') out[c.id] = v === '' || v == null ? null : (c.inteiro ? Math.trunc(Number(v)) : Number(v));
    else if (c.tipo === 'checkbox') out[c.id] = Array.isArray(v) ? v : [];
    else out[c.id] = v === '' || v == null ? null : String(v).trim();
  }
  return out;
}
