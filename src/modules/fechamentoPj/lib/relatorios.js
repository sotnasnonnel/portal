import { round2, somar, normalizar } from './formato.js';

// Relatórios do Fechamento PJ: Folha Analítica e Planilha Financeira.
// Recebem envelopes já com `eventos` e o prestador (ou o cadastro congelado).

/**
 * Eventos do relatório. Conciliação: se a soma dos eventos não bate com o
 * bruto/descontos do envelope (carga histórica só tem totais, por exemplo),
 * a diferença aparece como 1199 / 2100 de ajuste — o relatório nunca soma
 * diferente do envelope.
 */
export function eventosAnaliticos(envelope) {
  const eventos = (envelope.eventos || [])
    .filter((e) => Math.abs(Number(e.valor) || 0) > 0.0001)
    .sort((a, b) => (a.natureza === b.natureza ? (a.ordem ?? 0) - (b.ordem ?? 0) : a.natureza === 'provento' ? -1 : 1))
    .map((e) => ({ codigo: e.codigo, descricao: e.descricao, natureza: e.natureza, referencia: Number(e.referencia) || '', valor: round2(e.valor) }));

  const bruto = round2(envelope.bruto);
  const descontos = round2(envelope.descontos);
  if (!eventos.length && bruto) {
    eventos.push({ codigo: '1000', descricao: 'VALOR BRUTO CONTRATUAL', natureza: 'provento', referencia: 30, valor: bruto });
  }
  const difBruto = round2(bruto - somar(eventos.filter((e) => e.natureza === 'provento'), 'valor'));
  if (Math.abs(difBruto) >= 0.01) {
    eventos.push({ codigo: '1199', descricao: 'AJUSTE DE PROVENTOS DO FECHAMENTO', natureza: 'provento', referencia: '', valor: difBruto });
  }
  const difDesc = round2(descontos - somar(eventos.filter((e) => e.natureza === 'desconto'), 'valor'));
  if (Math.abs(difDesc) >= 0.01) {
    eventos.push({ codigo: '2100', descricao: 'OUTROS DESCONTOS / AJUSTES DO FECHAMENTO', natureza: 'desconto', referencia: '', valor: difDesc });
  }
  return eventos;
}

export function folhaAnalitica({ envelopes, prestadores }) {
  const porId = new Map(prestadores.map((p) => [p.id, p]));
  const pessoas = envelopes.map((env) => {
    const p = porId.get(env.prestador_id) || {};
    const cad = env.cadastro || {};
    const eventos = eventosAnaliticos(env);
    const proventos = somar(eventos.filter((e) => e.natureza === 'provento'), 'valor');
    const descontos = somar(eventos.filter((e) => e.natureza === 'desconto'), 'valor');
    return {
      envelopeId: env.id,
      codigo: cad.codigo || p.codigo || '',
      nome: cad.nome || p.nome || '',
      funcao: cad.funcao || p.funcao || 'Prestador PJ',
      razaoSocial: cad.razaoSocial || p.razao_social || '—',
      cnpj: cad.cnpj || p.cnpj || '—',
      cpf: cad.cpf || p.cpf || '—',
      inicio: cad.dataInicio || p.data_inicio || null,
      conferencia: env.conferencia,
      termo: env.termo,
      eventos,
      proventos,
      descontos,
      liquido: round2(proventos - descontos),
    };
  }).sort((a, b) => normalizar(a.nome).localeCompare(normalizar(b.nome)));

  const agregado = new Map();
  pessoas.forEach((p) => p.eventos.forEach((e) => {
    const k = `${e.codigo}|${e.descricao}|${e.natureza}`;
    const a = agregado.get(k) || { codigo: e.codigo, descricao: e.descricao, natureza: e.natureza, quantidade: 0, valor: 0 };
    a.quantidade += 1;
    a.valor = round2(a.valor + e.valor);
    agregado.set(k, a);
  }));
  const totalGeral = [...agregado.values()].sort((a, b) =>
    (a.natureza === b.natureza ? String(a.codigo).localeCompare(String(b.codigo)) : a.natureza === 'provento' ? -1 : 1));

  const proventos = somar(pessoas, 'proventos');
  const descontos = somar(pessoas, 'descontos');
  return { pessoas, totalGeral, totais: { prestadores: pessoas.length, proventos, descontos, liquido: round2(proventos - descontos) } };
}

export const semDadosBancarios = (p) => !String(p?.banco || '').trim() || normalizar(p?.banco) === 'NAO INFORMADO';

export function planilhaFinanceira({ envelopes, prestadores }) {
  const porId = new Map(prestadores.map((p) => [p.id, p]));
  return envelopes.map((env) => {
    const p = porId.get(env.prestador_id) || {};
    const cad = env.cadastro || {};
    return {
      prestadorId: env.prestador_id,
      nome: cad.nome || p.nome || '',
      liquido: round2(Number(env.bruto) - Number(env.descontos)),
      razaoSocial: cad.razaoSocial || p.razao_social || '',
      cnpj: cad.cnpj || p.cnpj || '',
      banco: p.banco || '',
      bancoCodigo: p.banco_codigo || '',
      agencia: p.agencia || '',
      conta: p.conta || '',
      pix: p.pix || '',
      contabilidade: p.contabilidade || '',
      semBanco: semDadosBancarios(p),
    };
  }).sort((a, b) => normalizar(a.nome).localeCompare(normalizar(b.nome)));
}
