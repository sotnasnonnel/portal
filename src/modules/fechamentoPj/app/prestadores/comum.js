import { normalizar, digitos, round2, somar } from '../../lib/formato';
import { envelopesDoPrestador, gravarEnvelopes } from '../../lib/dados';
import { indexar, loteCalculo } from '../../lib/lote';

// Utilidades das telas de prestadores. Fora dos .jsx para não quebrar o fast refresh.

export const ROTA_PJ = '/admin/fechamento-pj';
export const ROTA_PRESTADORES = `${ROTA_PJ}/prestadores`;
export const ROTA_FOLHA = ROTA_PJ;
export const ROTA_CONFIGURACOES = `${ROTA_PJ}/configuracoes`;

export const EMPRESAS = [
  ['PHD ASSESSORIA', 'PHD Assessoria'],
  ['PHD ENGENHARIA', 'PHD Engenharia'],
];

// Data de hoje no fuso do navegador (toISOString daria o dia seguinte à noite).
export function hojeIso(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function rateiosDoPrestador(rateios, prestadorId) {
  return (rateios || []).filter((r) => r.prestador_id === prestadorId);
}

// Total do rateio e centros sem código RM (sem de-para em Configurações).
export function situacaoRateio(itens, centrosMapa) {
  const total = round2(somar(itens, 'percentual'));
  const semRm = itens.filter((r) => !centrosMapa?.[r.cod_ct]).map((r) => r.cod_ct);
  return {
    total,
    vazio: !itens.length,
    fecha100: itens.length > 0 && Math.abs(total - 100) <= 0.01,
    semRm,
  };
}

export const temDadosBancarios = (p) => Boolean(String(p?.pix || '').trim()
  || (String(p?.banco || '').trim() && String(p?.agencia || '').trim() && String(p?.conta || '').trim()));

export const temPlanoMedico = (p) => Boolean(p?.beneficios?.medico?.ativo);

export function textoDeBusca(p) {
  const texto = normalizar([p.codigo, p.nome, p.email, p.email_pessoal, p.cpf, p.cnpj, p.razao_social, p.funcao, p.secao_nome, p.secao_codigo]
    .filter(Boolean).join(' '));
  return `${texto} ${digitos(p.cpf)} ${digitos(p.cnpj)}`;
}

export function casaBusca(p, busca) {
  const b = normalizar(busca);
  if (!b) return true;
  const alvo = textoDeBusca(p);
  const soDigitos = digitos(busca);
  // "123.456" digitado com máscara também encontra o CPF gravado sem máscara (e vice-versa).
  return alvo.includes(b) || (soDigitos.length >= 3 && /^[\d.\-/\s]+$/.test(busca) && alvo.includes(soDigitos));
}

// Junta dependentes pelo nome normalizado. O que chega vence campo a campo.
export function mesclarDependentes(existentes = [], novos = []) {
  const mapa = new Map((existentes || []).map((d) => [normalizar(d.nome), d]));
  (novos || []).forEach((d) => {
    const k = normalizar(d.nome);
    const limpo = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null && v !== undefined && v !== ''));
    mapa.set(k, { ...(mapa.get(k) || {}), ...limpo });
  });
  return [...mapa.values()];
}

/**
 * Recalcula o envelope do prestador numa competência (aberta) e grava.
 * Devolve false quando o prestador não tem envelope nela.
 */
export async function recalcularEnvelopeDoPrestador({
  prestador, competencia, config, rateios, encerramentos, centrosMapa, origem,
}) {
  const envelopes = await envelopesDoPrestador(prestador.id);
  const envelope = envelopes.find((e) => e.competencia === competencia);
  if (!envelope) return false;
  const indice = indexar({
    prestadores: [prestador],
    rateios: rateiosDoPrestador(rateios, prestador.id),
    encerramentos: (encerramentos || []).filter((e) => e.prestador_id === prestador.id),
  });
  const payloads = loteCalculo({ envelopes: [envelope], indice, config, competencia, centros: centrosMapa, origem });
  await gravarEnvelopes(competencia, payloads);
  return true;
}
