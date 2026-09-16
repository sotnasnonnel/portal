import { calcularEnvelope, EVENTO_BRUTO } from './calculo.js';
import { eventosDeDesconto, resumoPlanilha } from './planilha.js';
import { maiusculo, digitos } from './formato.js';

// Operações de lote do mês: recalcular envelopes e aplicar o input da planilha.
// Puras: recebem tudo que precisam e devolvem os payloads de
// pj_gravar_envelopes. Quem grava é a página, via dados.gravarEnvelopes.

export function indexar({ prestadores = [], rateios = [], encerramentos = [] }) {
  const prestadorPorId = new Map(prestadores.map((p) => [p.id, p]));
  const rateiosPorPrestador = new Map();
  rateios.forEach((r) => {
    if (!rateiosPorPrestador.has(r.prestador_id)) rateiosPorPrestador.set(r.prestador_id, []);
    rateiosPorPrestador.get(r.prestador_id).push(r);
  });
  const encerramentoPorPrestador = new Map(
    encerramentos.filter((e) => e.status !== 'cancelado').map((e) => [e.prestador_id, e]),
  );
  return { prestadorPorId, rateiosPorPrestador, encerramentoPorPrestador };
}

const eventosDoEnvelope = (env) => (env.eventos || []).map((e) => ({ ...e, valor: Number(e.valor), referencia: Number(e.referencia) }));

/**
 * Recalcula envelopes. `ids` limita a quais (null = todos).
 * `pendentes` = só os que nunca foram calculados.
 */
export function loteCalculo({
  envelopes, indice, config, competencia, centros, origem, ids = null, pendentes = false,
}) {
  return envelopes
    .filter((env) => (!ids || ids.includes(env.id)) && (!pendentes || !env.calculado_em))
    .map((env) => {
      const prestador = indice.prestadorPorId.get(env.prestador_id);
      if (!prestador) return null;
      return calcularEnvelope({
        envelope: env,
        eventos: eventosDoEnvelope(env),
        prestador,
        config,
        competencia,
        encerramento: indice.encerramentoPorPrestador.get(env.prestador_id) || null,
        rateios: indice.rateiosPorPrestador.get(env.prestador_id) || [],
        centros,
        origem,
      }).payload;
    })
    .filter(Boolean);
}

// Campos do cadastro que o input COMPLETO atualiza (quando a planilha traz valor).
export function atualizacaoCadastral(prestador, linha) {
  const patch = {};
  const setar = (campo, valor, transformar = (v) => v) => {
    const v = String(valor ?? '').trim();
    if (v && transformar(v) !== prestador[campo]) patch[campo] = transformar(v);
  };
  setar('razao_social', linha.razao_social, maiusculo);
  setar('cnpj', linha.cnpj);
  setar('cpf', linha.cpf);
  setar('email', linha.email);
  setar('funcao', linha.funcao, maiusculo);
  setar('banco', linha.banco);
  setar('banco_codigo', linha.banco_codigo);
  setar('agencia', linha.agencia);
  setar('conta', linha.conta);
  if (linha.bruto > 0 && Math.abs(Number(prestador.valor_mensal) - linha.bruto) > 0.009) patch.valor_mensal = linha.bruto;
  return patch;
}

// Prestador novo a partir de uma linha sem correspondência.
export function prestadorDaLinha(linha, { competencia, empresaPadrao }) {
  const empresa = /ENGENHARIA/i.test(linha.empresa || '') ? 'PHD ENGENHARIA' : (empresaPadrao || 'PHD ASSESSORIA');
  return {
    nome: maiusculo(linha.nome),
    empresa,
    email: linha.email || null,
    situacao: 'ativo',
    cadastro_origem: 'planilha',
    razao_social: linha.razao_social ? maiusculo(linha.razao_social) : null,
    cnpj: digitos(linha.cnpj).length === 14 ? linha.cnpj : null,
    cpf: digitos(linha.cpf).length === 11 ? linha.cpf : null,
    funcao: linha.funcao ? maiusculo(linha.funcao) : 'PRESTADOR PJ - NOVA ADMISSÃO',
    data_inicio: competencia,
    valor_mensal: linha.bruto || 0,
    banco: linha.banco || null,
    banco_codigo: linha.banco_codigo || null,
    agencia: linha.agencia || null,
    conta: linha.conta || null,
  };
}

/**
 * Envelopes do input da planilha.
 *
 * modo 'descontos': mantém os proventos do envelope (valor contratual) e troca
 *   só os descontos. Sem proporcional novo.
 * modo 'completo': 1000 = bruto da planilha (valor contratual atualizado no
 *   cadastro antes desta chamada), descontos da planilha, proporcional aplicado.
 *
 * `casados`: [{ linha, prestador }] — prestador já com id (os novos já foram
 * inseridos e incluídos no mês pela página).
 */
export function loteInput({
  casados, envelopes, indice, config, competencia, centros, modo, arquivo,
}) {
  const envPorPrestador = new Map(envelopes.map((e) => [e.prestador_id, e]));
  const origemEvento = `${arquivo} • EMISSÃO NF`;

  return casados.map(({ linha, prestador, novo }) => {
    const env = envPorPrestador.get(prestador.id) || { prestador_id: prestador.id, eventos: [], resolucoes: [] };
    const descontos = eventosDeDesconto(linha, origemEvento);
    let eventos;
    if (modo === 'descontos') {
      const proventos = eventosDoEnvelope(env).filter((e) => e.natureza === 'provento');
      eventos = [
        ...(proventos.length ? proventos : [{
          codigo: EVENTO_BRUTO, descricao: 'VALOR BRUTO CONTRATUAL', natureza: 'provento', referencia: 30,
          valor: Number(prestador.valor_mensal) || 0, valor_original: Number(prestador.valor_mensal) || 0, origem: 'Cadastro contratual', ordem: 0,
        }]),
        ...descontos,
      ];
    } else {
      const outrosProventos = eventosDoEnvelope(env).filter((e) => e.natureza === 'provento' && e.codigo !== EVENTO_BRUTO);
      eventos = [
        {
          codigo: EVENTO_BRUTO, descricao: 'VALOR BRUTO CONTRATUAL', natureza: 'provento', referencia: 30,
          valor: linha.bruto, valor_original: linha.bruto, origem: origemEvento, ordem: 0,
        },
        ...outrosProventos,
        ...descontos,
      ];
    }

    let origem = modo === 'descontos'
      ? 'Input de descontos da planilha — valor contratual preservado'
      : 'Cálculo automático após input completo da planilha';
    if (novo) origem = 'Nova admissão criada pelo input da planilha';

    const { payload } = calcularEnvelope({
      // Nova planilha = resoluções antigas não valem mais (as chaves mudariam de qualquer jeito).
      envelope: { ...env, planilha: resumoPlanilha(linha, arquivo), resolucoes: [] },
      eventos,
      prestador,
      config,
      competencia,
      encerramento: indice.encerramentoPorPrestador.get(prestador.id) || null,
      rateios: indice.rateiosPorPrestador.get(prestador.id) || [],
      centros,
      origem,
    });
    return { ...payload, planilha: resumoPlanilha(linha, arquivo), resolucoes: [] };
  });
}
