import { round2, somar, normalizar, partesCompetencia, proximaCompetencia, competenciaRotulo, CC_RM_REGEX } from './formato.js';
import { TAMANHO_L, TAMANHO_U, CONSTANTES_L, CONSTANTES_U } from './layoutRm.js';

// Pagamento PJ no TOTVS RM: rateio do líquido por centro de custo, status do
// cadastro de fornecedor, TXT fixo (L + U), Excel de conferência e CSV.
//
// "Linha de pagamento" é o formato comum que as exportações consomem:
//   { seq, empresa, nome, razaoSocial, cnpj, codigoRm, bruto, liquido,
//     nf, documento, rateio: [{ codCt, codigoRm, percentual }] }
// Quem monta a partir do banco é montarLinhasPagamento().

export const RM_PADRAO = {
  coligada: '1', filial: '1', tipoDocumento: '29', tipoDocumentoDesc: 'PIX', serie: '@@@',
  natureza: '2.03.04.13', naturezaDesc: 'Profissionais PJ', contaCaixa: '001', contaCaixaDesc: 'ITAÚ',
  dadosBancarios: '2', dadosBancariosDesc: 'PIX CNPJ', diaEmissao: 28,
};

export const ccValido = (cc) => CC_RM_REGEX.test(String(cc ?? '').trim());

// ---------------------------------------------------------------------------
// Fornecedor
// ---------------------------------------------------------------------------

export function statusFornecedor(f) {
  if (!f) return 'PENDENTE';
  const base = Boolean(f.codigo_rm && f.razao_social && f.cnpj);
  const bancoOk = (f.bancos || []).some((b) => b.ativo !== false && b.formaPagamento && b.favorecidoDoc && (b.pixChave || b.conta));
  if (base && bancoOk) return 'PRONTO';
  if (base) return 'CADASTRO RM';
  return 'PENDENTE';
}

// ---------------------------------------------------------------------------
// Linhas de pagamento
// ---------------------------------------------------------------------------

/**
 * Junta envelope + prestador + fornecedor + rateio.
 * Competência fechada usa o cadastro e o rateio congelados no envelope.
 */
export function montarLinhasPagamento({ envelopes, prestadores, fornecedores, rateios, centros }) {
  const prestadorPorId = new Map(prestadores.map((p) => [p.id, p]));
  const fornPorPrestador = new Map(fornecedores.filter((f) => f.prestador_id).map((f) => [f.prestador_id, f]));
  const fornPorCnpj = new Map(fornecedores.filter((f) => f.cnpj).map((f) => [String(f.cnpj).replace(/\D/g, ''), f]));
  const rateioPorPrestador = new Map();
  rateios.forEach((r) => {
    if (!rateioPorPrestador.has(r.prestador_id)) rateioPorPrestador.set(r.prestador_id, []);
    rateioPorPrestador.get(r.prestador_id).push(r);
  });

  return envelopes
    .map((env) => {
      const p = prestadorPorId.get(env.prestador_id) || {};
      const cad = env.cadastro || {};
      const f = fornPorPrestador.get(env.prestador_id) || fornPorCnpj.get(String(cad.cnpj || p.cnpj || '').replace(/\D/g, ''));
      const rateio = Array.isArray(env.rateio) && env.cadastro
        ? env.rateio
        : (rateioPorPrestador.get(env.prestador_id) || []).map((r) => ({
          codCt: r.cod_ct, codigoRm: centros[r.cod_ct] || (ccValido(r.cod_ct) ? r.cod_ct : null), percentual: Number(r.percentual),
        }));
      return {
        envelopeId: env.id,
        prestadorId: env.prestador_id,
        codigo: cad.codigo || p.codigo,
        empresa: cad.empresa || p.empresa || '',
        nome: cad.nome || p.nome || '',
        razaoSocial: f?.razao_social || cad.razaoSocial || p.razao_social || '',
        cnpj: f?.cnpj || cad.cnpj || p.cnpj || '',
        codigoRm: f?.codigo_rm || '',
        statusFornecedor: statusFornecedor(f),
        bruto: Number(env.bruto) || 0,
        descontos: Number(env.descontos) || 0,
        liquido: round2(Number(env.bruto) - Number(env.descontos)),
        nf: env.nf_numero || '',
        documento: env.rm_documento || '',
        rateio,
      };
    })
    .sort((a, b) => normalizar(a.nome).localeCompare(normalizar(b.nome)))
    .map((l, i) => ({ ...l, seq: i + 1 }));
}

/**
 * Distribui o líquido pelos centros. Percentuais são renormalizados para somar
 * 100 e a última linha leva o resto do arredondamento — a soma dos U fecha
 * exatamente com o L.
 */
export function ratearLiquido(linha) {
  const itens = (linha.rateio || []).filter((r) => r && (r.codCt || r.codigoRm) && Number(r.percentual) > 0);
  if (!itens.length) return [];
  const soma = itens.reduce((s, r) => s + Number(r.percentual), 0);
  let usado = 0;
  return itens.map((r, i) => {
    const pct = (Number(r.percentual) / soma) * 100;
    const valor = i === itens.length - 1 ? round2(linha.liquido - usado) : round2((linha.liquido * pct) / 100);
    usado = round2(usado + valor);
    const origem = String(r.codCt || r.codigoRm || '').trim();
    return { origem, cc: String(r.codigoRm || '').trim() || origem, pct: Number(pct.toFixed(6)), valor };
  });
}

export const prontoParaTxt = (linha) => {
  const a = ratearLiquido(linha);
  return Boolean(linha.codigoRm) && a.length > 0 && a.every((x) => ccValido(x.cc));
};

export function datasPadrao(competencia, diaEmissao = 28) {
  const p = partesCompetencia(competencia);
  const n = partesCompetencia(proximaCompetencia(competencia));
  const dd = String(diaEmissao).padStart(2, '0');
  return {
    emissao: `${dd}${p.mm}${p.aa}`,
    vencimento: `01${n.mm}${n.aa}`,
    baixa: `01${n.mm}${n.aa}`,
    emissaoIso: `${p.aaaa}-${p.mm}-${dd}`,
    vencimentoIso: `${n.aaaa}-${n.mm}-01`,
    baixaIso: `${n.aaaa}-${n.mm}-01`,
  };
}

// PJ{MM}{AA}-{NNN}, numerado dentro da lista de prontos (como no RM hoje).
export function documentoAutomatico(linha, indice, competencia) {
  if (linha.documento) return linha.documento;
  const p = partesCompetencia(competencia);
  return `PJ${p.mm}${p.aa}-${String(indice + 1).padStart(3, '0')}`;
}

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

export const historicoTxt = (linha, competencia) =>
  `Pagamento de servicos - PJ ${competenciaRotulo(competencia)} - ${semAcento(linha.nome)}`;

export const historicoExcel = (linha) => `Pagamento de serviços - NF ${String(linha.nf || '').trim() || '[PREENCHER]'}`;

// ---------------------------------------------------------------------------
// TXT fixo
// ---------------------------------------------------------------------------

function base(tamanho, constantes) {
  const chars = Array(tamanho).fill(' ');
  constantes.forEach(([pos, txt]) => { for (let i = 0; i < txt.length; i += 1) chars[pos + i] = txt[i]; });
  return chars.join('');
}

export function colocar(linha, pos, tam, valor, alinhamento = 'esquerda', preenchimento = ' ') {
  let v = String(valor ?? '');
  if (v.length > tam) v = v.slice(0, tam);
  v = alinhamento === 'direita' ? v.padStart(tam, preenchimento) : v.padEnd(tam, preenchimento);
  return linha.slice(0, pos) + v + linha.slice(pos + tam);
}

const numeroFixo = (valor, casas, tam) => String(Math.round((Number(valor) || 0) * 10 ** casas)).padStart(tam, '0');

/**
 * Linhas do TXT. L: valor com 4 casas implícitas; U: 2 casas — é o que está no
 * arquivo real exportado do RM que originou o layout.
 */
export function gerarTxt({ linhas, competencia, rm = RM_PADRAO }) {
  const prontos = linhas.filter(prontoParaTxt);
  const datas = datasPadrao(competencia, rm.diaEmissao);
  const p = partesCompetencia(competencia);
  const token = `${p.mm}${p.mm}${p.aa}`;
  const coligada = String(rm.coligada || '1').padStart(4, '0');
  const saida = [];

  prontos.forEach((linha, i) => {
    const fornecedor = String(linha.codigoRm).replace(/\D/g, '').padStart(7, '0').slice(-7);
    let L = base(TAMANHO_L, CONSTANTES_L);
    L = colocar(L, 4, 11, coligada + fornecedor);
    L = colocar(L, 33, 2, String(rm.tipoDocumento).padStart(2, '0'), 'direita', '0');
    L = colocar(L, 43, 40, documentoAutomatico(linha, i, competencia));
    L = colocar(L, 283, 6, datas.vencimento);
    L = colocar(L, 289, 6, datas.emissao);
    L = colocar(L, 301, 6, datas.baixa);
    L = colocar(L, 468, 18, numeroFixo(linha.liquido, 4, 18), 'direita', '0');
    L = colocar(L, 1566, 6, token);
    L = colocar(L, 1581, 3, rm.serie);
    L = colocar(L, 1589, 255, historicoTxt(linha, competencia));
    saida.push(L);

    ratearLiquido(linha).forEach((a) => {
      let U = base(TAMANHO_U, CONSTANTES_U);
      U = colocar(U, 1, 16, coligada + a.cc);
      U = colocar(U, 30, 18, numeroFixo(a.valor, 2, 18), 'direita', '0');
      U = colocar(U, 303, 12, (`00${rm.natureza}`).slice(-12));
      saida.push(U);
    });
  });

  return {
    conteudo: saida.length ? `${saida.join('\r\n')}\r\n` : '',
    prontos: prontos.length,
    pendentes: linhas.length - prontos.length,
    total: round2(somar(prontos, 'liquido')),
  };
}

// Windows-1252 de verdade (o protótipo declarava cp1252 e gravava UTF-8).
const CP1252_EXTRA = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
export function paraCp1252(texto) {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) bytes[i] = c;
    else bytes[i] = CP1252_EXTRA[c] ?? 0x3f;
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Excel de conferência (7 abas) — devolve as abas como matrizes; quem grava é
// a tela (SheetJS).
// ---------------------------------------------------------------------------

export function dadosConferencia({ linhas, competencia, rm = RM_PADRAO, fornecedores = [] }) {
  const comp = competenciaRotulo(competencia);
  const d = datasPadrao(competencia, rm.diaEmissao);
  const dt = (iso) => new Date(`${iso}T12:00:00`);
  const entrada = [];
  const rateio = [];
  const input = [];
  const pend = [];

  linhas.forEach((l, i) => {
    const allocs = ratearLiquido(l);
    const h = historicoExcel(l);
    const sup = l.codigoRm ? 'OK' : 'PENDENTE';
    const doc = l.nf && l.documento ? 'OK' : 'PENDENTE';
    const ccOk = allocs.length > 0 && allocs.every((a) => ccValido(a.cc));
    entrada.push([i + 1, l.empresa, l.nome, l.razaoSocial, l.cnpj, l.codigoRm, l.bruto, l.liquido, l.nf, l.documento,
      Number(rm.filial), Number(rm.tipoDocumento), rm.tipoDocumentoDesc, dt(d.emissaoIso), dt(d.vencimentoIso), dt(d.baixaIso),
      rm.serie, rm.contaCaixa, rm.contaCaixaDesc, Number(rm.dadosBancarios), rm.dadosBancariosDesc, rm.natureza, rm.naturezaDesc,
      h, sup, doc, sup === 'OK' && doc === 'OK' && ccOk ? 'PRONTO' : 'PENDENTE']);
    input.push(['L', Number(rm.coligada || 1), i + 1, h, comp, dt(d.emissaoIso), dt(d.vencimentoIso), dt(d.baixaIso),
      Number(rm.tipoDocumento), l.documento, l.codigoRm, l.liquido, '', '', '', rm.serie, rm.contaCaixa, Number(rm.dadosBancarios),
      sup === 'OK' && doc === 'OK' ? 'OK' : 'PENDENTE']);
    allocs.forEach((a) => {
      rateio.push([i + 1, l.nome, l.codigoRm, l.liquido, a.origem, a.cc, a.pct / 100, a.valor, rm.natureza, h, ccValido(a.cc) ? 'OK' : 'PENDENTE']);
      input.push(['U', Number(rm.coligada || 1), i + 1, h, comp, dt(d.emissaoIso), dt(d.vencimentoIso), dt(d.baixaIso),
        Number(rm.tipoDocumento), l.documento, l.codigoRm, a.valor, rm.natureza, a.origem, a.cc, rm.serie, rm.contaCaixa,
        Number(rm.dadosBancarios), ccValido(a.cc) ? 'OK' : 'PENDENTE']);
    });
    if (!l.codigoRm) pend.push(['Fornecedor RM', l.nome, l.razaoSocial, l.cnpj, 'Código do Cliente/Fornecedor não localizado no cadastro TOTVS RM', 'Preencher o código RM em Fechamento PJ > Fornecedores TOTVS']);
    if (!ccOk) pend.push(['Rateio', l.nome, l.razaoSocial, l.cnpj, 'Centro de custo/rateio sem código RM válido', 'Conferir o rateio do prestador e o de-para de centros de custo']);
  });
  const dataBrCurta = (iso) => iso.split('-').reverse().join('/');
  pend.push(['', '', '', '', '', '']);
  pend.push(['Documento', 'TODOS OS PJ', '', '', 'Nº NF e Nº Documento RM devem ser conferidos antes da geração do TXT.', 'Preencher/validar os documentos antes de gerar o TXT.']);
  pend.push(['Datas', 'TODOS OS PJ', '', '', `As datas ${dataBrCurta(d.emissaoIso)} e ${dataBrCurta(d.vencimentoIso)} foram carregadas como padrão da competência.`, 'Alterar o parâmetro caso a data efetiva seja diferente.']);
  pend.push(['Rateio', `Base ${comp}`, '', '', 'Rateio conforme alocação vigente e códigos de centro de custo cadastrados.', 'Conferir alterações excepcionais antes da importação.']);

  const totalLiquido = somar(linhas, 'liquido');
  const totalRateio = somar(rateio.map((r) => r[7]));
  const porEmpresa = (nome) => somar(linhas.filter((l) => normalizar(l.empresa).includes(nome)), 'liquido');
  const fornOk = linhas.filter((l) => l.codigoRm).length;
  const ccPend = linhas.filter((l) => { const a = ratearLiquido(l); return !a.length || !a.every((x) => ccValido(x.cc)); }).length;

  return {
    titulo: comp,
    datas: d,
    abas: [
      {
        nome: 'Parametros_RM', titulo: 'PARÂMETROS DO LAYOUT — PAGAMENTO PJ / TOTVS RM',
        cabecalho: ['Parâmetro', 'Valor', 'Descrição', 'Origem'], larguras: [29, 24, 48, 28],
        linhas: [
          ['Competência', comp, 'Competência do fechamento PJ', 'Portal PHD — Fechamento PJ'],
          ['Pagar/Receber', 'Pagar', 'Lançamento a pagar', 'Configuração RM'],
          ['Filial', Number(rm.filial), 'Filial do lançamento', 'Configuração RM'],
          ['Tipo Documento', Number(rm.tipoDocumento), rm.tipoDocumentoDesc, 'Configuração RM'],
          ['Série Documento', rm.serie, 'Série utilizada no RM', 'Configuração RM'],
          ['Natureza Orçamentária', rm.natureza, rm.naturezaDesc, 'Configuração RM'],
          ['Conta/Caixa', rm.contaCaixa, rm.contaCaixaDesc, 'Configuração RM'],
          ['Dados Bancários', Number(rm.dadosBancarios), rm.dadosBancariosDesc, 'Configuração RM'],
          ['Moeda', 'R$', 'Real', 'Configuração RM'],
          ['Data Emissão padrão', dt(d.emissaoIso), 'Editável por lançamento', 'Competência'],
          ['Data Vencimento padrão', dt(d.vencimentoIso), 'Editável por lançamento', 'Competência'],
          ['Data Prev. Baixa padrão', dt(d.baixaIso), 'Editável por lançamento', 'Competência'],
          ['Histórico padrão', 'Pagamento de serviços - NF [Nº NF]', 'Substituir [Nº NF] pelo número real da nota', 'Padrão de importação'],
          ['Regra de valor', 'Valor Líquido para emissão da nota fiscal', 'Valor Original do lançamento', 'Fechamento PJ'],
          ['Regra de rateio', 'Rateio conforme alocação do mês', 'Distribui o valor líquido pelos CCs', 'Cadastro/Rateio'],
        ],
      },
      {
        nome: 'Fornecedores_RM', titulo: 'CADASTRO DE FORNECEDORES RM — BASE INFORMADA',
        cabecalho: ['Código RM', 'Razão Social', 'Chave Normalizada', 'Status'], larguras: [16, 55, 48, 18],
        linhas: fornecedores.filter((f) => f.codigo_rm).map((f) => [String(f.codigo_rm).padStart(7, '0'),
          f.razao_social || f.nome_fantasia || '', normalizar(f.razao_social || f.nome_fantasia || ''), 'CADASTRADO']),
      },
      {
        nome: 'Entrada_PJ', titulo: `BASE DE ENTRADA — PAGAMENTO PJ ${comp} | PREPARAÇÃO PARA TXT TOTVS RM`,
        cabecalho: ['Seq.', 'Empresa', 'Colaborador', 'Razão Social', 'CNPJ', 'Cód. Fornecedor RM', 'Valor Bruto', 'Valor Líquido NF', 'Nº NF', 'Nº Documento RM', 'Filial', 'Tipo Doc.', 'Descrição Doc.', 'Emissão', 'Vencimento', 'Prev. Baixa', 'Série', 'Conta/Caixa', 'Banco/Caixa', 'Dados Bancários', 'Descrição Banco', 'Natureza', 'Descrição Natureza', 'Histórico', 'Status Fornecedor', 'Status Documento', 'Status Geral'],
        larguras: [7, 18, 33, 42, 20, 18, 15, 17, 15, 18, 8, 10, 13, 12, 12, 12, 9, 13, 15, 15, 17, 16, 20, 42, 18, 18, 16],
        moeda: [6, 7], data: [13, 14, 15], linhas: entrada,
      },
      {
        nome: 'Rateio_PJ', titulo: `RATEIO POR CENTRO DE CUSTO — PAGAMENTO PJ ${comp}`,
        cabecalho: ['Seq.', 'Colaborador', 'Cód. Fornecedor RM', 'Valor Lançamento', 'CC Origem', 'Código RM', '% Rateio', 'Valor Rateado', 'Natureza', 'Histórico', 'Status CC'],
        larguras: [7, 33, 18, 17, 22, 18, 12, 17, 16, 42, 14], moeda: [3, 7], pct: [6], linhas: rateio,
      },
      {
        nome: 'Input_TOTVS', titulo: 'BASE L/U PARA GERAÇÃO DO TXT — PAGAMENTO PJ',
        cabecalho: ['TIPO', 'COLIGADA', 'SEQ. L', 'HISTÓRICO', 'COMPETÊNCIA', 'EMISSÃO', 'VENCIMENTO', 'PREV. BAIXA', 'TIPO DOC', 'Nº DOCUMENTO', 'FORNECEDOR RM', 'VALOR', 'NATUREZA', 'CC ORIGEM', 'CÓDIGO RM', 'SÉRIE', 'CONTA/CAIXA', 'DADOS BANCÁRIOS', 'STATUS'],
        larguras: [8, 10, 9, 42, 14, 12, 12, 12, 10, 18, 18, 17, 16, 22, 18, 9, 13, 17, 14], moeda: [11], data: [5, 6, 7], linhas: input,
      },
      {
        nome: 'Pendencias', titulo: 'PENDÊNCIAS PARA FECHAR O TXT PJ',
        cabecalho: ['Tipo', 'Colaborador', 'Razão Social', 'CNPJ', 'Pendência', 'Ação'], larguras: [18, 32, 42, 20, 54, 55], linhas: pend,
      },
      {
        nome: 'Resumo', titulo: `LAYOUT PAGAMENTO PJ — TOTVS RM | COMPETÊNCIA ${comp}`,
        cabecalho: ['Indicador', 'Valor', '', 'Controle', 'Status'], larguras: [36, 20, 4, 34, 24], moedaCelulas: [[1, 1], [2, 1], [3, 1], [5, 1], [6, 1]],
        linhas: [
          ['Quantidade PJ', linhas.length, '', 'Fornecedor RM localizados', fornOk],
          ['Total líquido para NF', totalLiquido, '', 'Fornecedores pendentes', linhas.length - fornOk],
          ['PHD Assessoria', porEmpresa('PHD ASSESSORIA'), '', 'Centros de custo pendentes', ccPend],
          ['PHD Engenharia', porEmpresa('PHD ENGENHARIA'), '', 'Tipo documento', `${rm.tipoDocumento} - ${rm.tipoDocumentoDesc}`],
          ['Linhas de rateio', rateio.length, '', 'Natureza', rm.natureza],
          ['Total rateio', totalRateio, '', 'Conta/Caixa', `${rm.contaCaixa} - ${rm.contaCaixaDesc}`],
          ['Diferença L x U', round2(totalLiquido - totalRateio), '', 'Dados bancários', `${rm.dadosBancarios} - ${rm.dadosBancariosDesc}`],
          ['', '', '', '', ''],
          ['USO DO ARQUIVO', '', '', '', ''],
          ['1. Preencha Nº NF e Nº Documento RM na aba Entrada_PJ.', '', '', '', ''],
          ['2. Resolva os fornecedores marcados como PENDENTE; não invente código RM.', '', '', '', ''],
          [`3. Confira as datas. O modelo usa emissão ${dataBrCurta(d.emissaoIso)} e vencimento/baixa ${dataBrCurta(d.vencimentoIso)}.`, '', '', '', ''],
          [`4. A aba Rateio_PJ distribui o valor líquido por centro de custo com Natureza ${rm.natureza}.`, '', '', '', ''],
          ['5. A aba Input_TOTVS é a base final L/U para posterior geração do TXT fixo.', '', '', '', ''],
        ],
      },
    ],
  };
}

const BOM = String.fromCharCode(0xfeff);

export function csvPagamento({ linhas, rm = RM_PADRAO }) {
  const cab = ['Seq', 'Colaborador', 'Razão Social', 'CNPJ', 'Código Fornecedor RM', 'Valor Bruto', 'Valor Líquido NF', 'Nº NF', 'Nº Documento RM', 'Filial', 'Tipo Documento', 'Série', 'Conta/Caixa', 'Dados Bancários', 'Natureza', 'Rateio', 'Status Fornecedor', 'Status Documento'];
  const corpo = linhas.map((l) => [l.seq, l.nome, l.razaoSocial, l.cnpj, l.codigoRm, l.bruto.toFixed(2), l.liquido.toFixed(2), l.nf, l.documento,
    rm.filial, `${rm.tipoDocumento} - ${rm.tipoDocumentoDesc}`, rm.serie, `${rm.contaCaixa} - ${rm.contaCaixaDesc}`,
    `${rm.dadosBancarios} - ${rm.dadosBancariosDesc}`, rm.natureza,
    ratearLiquido(l).map((a) => `${a.cc} ${a.pct.toFixed(2)}%`).join(' | '), l.statusFornecedor, l.nf && l.documento ? 'OK' : 'PENDENTE']);
  const aspas = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return `${BOM}${[cab, ...corpo].map((r) => r.map(aspas).join(';')).join('\r\n')}`;
}
