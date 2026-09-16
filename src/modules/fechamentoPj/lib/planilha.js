import {
  normalizar, paraNumero, digitos, round2, somar, celulaParaIso, competenciaParaIso, codigoRmCentroCusto,
} from './formato.js';

// Leitura das planilhas do Fechamento PJ. Recebe o workbook já aberto como
// [{ nome, linhas: any[][] }] — quem abre o arquivo é lerArquivoXlsx() (camada
// de tela, SheetJS). Assim o parser é puro e testável.
//
// Planilhas suportadas (as mesmas do protótipo):
//   * Líquido PJ NF (aba EMISSÃO NF)       -> input da folha
//   * Organograma (Nome Completo/COD CT/Alocação, + COD CT/CCCOD)  -> rateio
//   * Conferência Bradesco (3 arquivos)    -> benefícios e dependentes

const texto = (v) => String(v ?? '').trim();

const acharColuna = (cabecalho, nomes) => cabecalho.findIndex((c) => nomes.includes(c));

function acharCabecalho(linhas, teste, limite = 30) {
  for (let i = 0; i < Math.min(linhas.length, limite); i += 1) {
    const cab = (linhas[i] || []).map(normalizar);
    if (teste(cab)) return { indice: i, cabecalho: cab };
  }
  return null;
}

// Célula de período: 'MM/AAAA', data 'DD/MM/AAAA' ou serial -> 'AAAA-MM-01'.
function periodoParaCompetencia(v) {
  const s = texto(v);
  const direto = competenciaParaIso(s);
  if (direto) return direto;
  const iso = celulaParaIso(typeof v === 'number' ? v : s);
  return iso ? `${iso.slice(0, 7)}-01` : null;
}

// ---------------------------------------------------------------------------
// Input da folha (Líquido PJ NF)
// ---------------------------------------------------------------------------

export const COLUNAS_DESCONTO = [
  { campo: 'plano_saude', codigo: '2001', descricao: 'PLANO DE SAÚDE / DEPENDENTES', nomes: ['PLANO DE SAUDE DEPENDENTE', 'PLANO MEDICO'] },
  { campo: 'copart_titular', codigo: '2002', descricao: 'COPARTICIPAÇÃO TITULAR / DEPENDENTES', nomes: ['COPARTICIPACAO TITULAR'] },
  { campo: 'copart_dependente', codigo: '2002', descricao: 'COPARTICIPAÇÃO TITULAR / DEPENDENTES', nomes: ['COPARTICIPACAO DEPENDENTE'] },
  { campo: 'odonto_titular', codigo: '2003', descricao: 'PLANO ODONTOLÓGICO', nomes: ['PLANO ODONTOLOGICO TITULAR'] },
  { campo: 'odonto_dependente', codigo: '2003', descricao: 'PLANO ODONTOLÓGICO', nomes: ['PLANO ODONTOLOGICO DEPENDENTE'] },
  { campo: 'previdencia', codigo: '2004', descricao: 'PREVIDÊNCIA PRIVADA', nomes: ['PREVIDENCIA PRIVADA'] },
  { campo: 'outros', codigo: '2100', descricao: 'OUTROS DESCONTOS CONTRATUAIS', nomes: ['DESCONTO DIVERSOS', 'OUTROS DESCONTOS'] },
];

const COLUNAS_FOLHA = {
  nome: ['NOME COMPLETO', 'PRESTADOR'],
  empresa: ['TOMADOR DE SERVICO', 'EMPRESA'],
  periodo: ['PERIODO', 'COMPETENCIA'],
  bruto: ['VALOR BRUTO', 'VALOR CONTRATUAL'],
  liquido: ['VALOR LIQUIDO PARA EMISSAO DA NOTA FISCAL', 'VALOR LIQUIDO'],
  descontos_total: ['TOTAL DESCONTOS'],
  email: ['EMAIL', 'E-MAIL'],
  razao_social: ['RAZAO SOCIAL'],
  cpf: ['CPF'],
  funcao: ['FUNCAO', 'CARGO'],
  banco: ['BANCO'],
  banco_codigo: ['CODIGO BANCO', 'CODIGO DO BANCO'],
  agencia: ['AGENCIA'],
  conta: ['CONTA'],
};

export function lerFolha(abas) {
  const temDesconto = (cab) => cab.includes('NOME COMPLETO')
    && (cab.includes('TOTAL DESCONTOS') || cab.some((c) => c.includes('PLANO DE SAUDE') || c.includes('COPARTICIPACAO')));

  const aba = abas.find((a) => normalizar(a.nome) === 'EMISSAO NF')
    || abas.find((a) => acharCabecalho(a.linhas, temDesconto));
  if (!aba) throw new Error('Não encontrei a aba EMISSÃO NF nem outra aba com Nome Completo e colunas de desconto.');

  const cab = acharCabecalho(aba.linhas, temDesconto);
  if (!cab) throw new Error(`A aba ${aba.nome} precisa ter Nome Completo e pelo menos uma coluna de desconto.`);

  const col = Object.fromEntries(Object.entries(COLUNAS_FOLHA).map(([k, nomes]) => [k, acharColuna(cab.cabecalho, nomes)]));
  // A planilha real tem duas colunas CNPJ; a do prestador é a última.
  col.cnpj = cab.cabecalho.lastIndexOf('CNPJ');
  const colDesc = COLUNAS_DESCONTO.map((d) => ({ ...d, indice: acharColuna(cab.cabecalho, d.nomes) }));

  const pegar = (linha, i) => (i >= 0 ? texto(linha[i]) : '');
  const linhas = aba.linhas.slice(cab.indice + 1).map((linha, n) => {
    const nome = pegar(linha, col.nome);
    if (!nome) return null;
    const descontos = Object.fromEntries(colDesc.map((d) => [d.campo, d.indice >= 0 ? round2(paraNumero(linha[d.indice])) : 0]));
    const somaColunas = round2(Object.values(descontos).reduce((s, v) => s + v, 0));
    const bruto = round2(paraNumero(col.bruto >= 0 ? linha[col.bruto] : 0));
    const total = col.descontos_total >= 0 ? round2(paraNumero(linha[col.descontos_total])) : somaColunas;
    return {
      linha: cab.indice + n + 2,
      nome,
      empresa: pegar(linha, col.empresa),
      competencia: col.periodo >= 0 ? periodoParaCompetencia(linha[col.periodo]) : null,
      bruto,
      descontos_total: total,
      soma_colunas: somaColunas,
      liquido: col.liquido >= 0 ? round2(paraNumero(linha[col.liquido])) : round2(bruto - total),
      descontos,
      email: pegar(linha, col.email),
      razao_social: pegar(linha, col.razao_social),
      cnpj: pegar(linha, col.cnpj),
      cpf: pegar(linha, col.cpf),
      funcao: pegar(linha, col.funcao),
      banco: pegar(linha, col.banco),
      banco_codigo: pegar(linha, col.banco_codigo),
      agencia: pegar(linha, col.agencia),
      conta: pegar(linha, col.conta),
    };
  }).filter(Boolean);

  if (!linhas.length) throw new Error('Nenhum prestador encontrado abaixo do cabeçalho.');
  return {
    aba: aba.nome,
    competencia: linhas.map((l) => l.competencia).find(Boolean) || null,
    linhas,
    bruto: somar(linhas, 'bruto'),
    descontos: somar(linhas, 'descontos_total'),
    liquido: somar(linhas, 'liquido'),
  };
}

// Eventos de desconto de uma linha. Colunas do mesmo código somam num evento
// só (coparticipação titular + dependente = 2002). A diferença para o TOTAL
// DESCONTOS NÃO é empurrada para 2100 em silêncio, como fazia o protótipo:
// ela vira divergência na conferência (descontos_planilha).
export function eventosDeDesconto(linha, origem) {
  const porCodigo = new Map();
  COLUNAS_DESCONTO.forEach((d) => {
    const valor = Number(linha.descontos?.[d.campo]) || 0;
    if (Math.abs(valor) <= 0.009) return;
    const atual = porCodigo.get(d.codigo) || { codigo: d.codigo, descricao: d.descricao, valor: 0 };
    atual.valor = round2(atual.valor + valor);
    porCodigo.set(d.codigo, atual);
  });
  return [...porCodigo.values()].filter((e) => e.valor > 0.009).map((e, i) => ({
    codigo: e.codigo, descricao: e.descricao, natureza: 'desconto', referencia: 0,
    valor: e.valor, valor_original: e.valor, forcado: false, origem, ordem: 10 + i,
  }));
}

// Os valores crus que a conferência precisa (vão para pj_envelopes.planilha).
export const resumoPlanilha = (linha, arquivo) => ({
  arquivo,
  linha: linha.linha,
  bruto: linha.bruto,
  descontos_total: linha.descontos_total,
  soma_colunas: linha.soma_colunas,
  liquido: linha.liquido,
});

/**
 * Casa uma linha da planilha com o cadastro.
 * 1º CNPJ ou CPF (dígitos); 2º nome normalizado. Um prestador só casa com UMA
 * linha — a segunda linha com o mesmo documento/nome volta como conflito, em
 * vez de sobrescrever a primeira em silêncio.
 */
export function casarLinhas(linhas, prestadores) {
  const porCnpj = new Map();
  const porCpf = new Map();
  const porNome = new Map();
  prestadores.forEach((p) => {
    if (digitos(p.cnpj).length === 14) porCnpj.set(digitos(p.cnpj), p);
    if (digitos(p.cpf).length === 11) porCpf.set(digitos(p.cpf), p);
    porNome.set(normalizar(p.nome), p);
  });

  const usados = new Map();
  const resultado = linhas.map((linha) => {
    let prestador = null;
    let criterio = null;
    if (digitos(linha.cnpj).length === 14 && porCnpj.has(digitos(linha.cnpj))) {
      prestador = porCnpj.get(digitos(linha.cnpj)); criterio = 'CNPJ';
    } else if (digitos(linha.cpf).length === 11 && porCpf.has(digitos(linha.cpf))) {
      prestador = porCpf.get(digitos(linha.cpf)); criterio = 'CPF';
    } else if (porNome.has(normalizar(linha.nome))) {
      prestador = porNome.get(normalizar(linha.nome)); criterio = 'Nome';
    }
    if (prestador && usados.has(prestador.id)) {
      return { linha, prestador: null, criterio: null, conflito: `Mesmo prestador da linha ${usados.get(prestador.id)}` };
    }
    if (prestador) usados.set(prestador.id, linha.linha);
    return { linha, prestador, criterio, conflito: null };
  });
  return resultado;
}

// ---------------------------------------------------------------------------
// Organograma -> rateio + de-para de centro de custo
// ---------------------------------------------------------------------------

export function lerOrganograma(abas, arquivo = 'organograma.xlsx') {
  let rateio = null;
  for (const aba of abas) {
    const cab = acharCabecalho(aba.linhas, (c) => c.includes('NOME COMPLETO') && c.includes('COD CT') && c.includes('ALOCACAO'));
    if (cab) { rateio = { aba, cab }; break; }
  }
  if (!rateio) throw new Error('Não encontrei uma aba com as colunas Nome Completo, COD CT e Alocação.');

  const { cabecalho, indice } = rateio.cab;
  const iNome = cabecalho.indexOf('NOME COMPLETO');
  const iCc = cabecalho.indexOf('COD CT');
  const iAloc = cabecalho.indexOf('ALOCACAO');
  const iRm = cabecalho.indexOf('CCCOD');

  const centros = new Map();
  const linhas = rateio.aba.linhas.slice(indice + 1).map((l) => ({
    nome: texto(l[iNome]),
    cod_ct: texto(l[iCc]),
    alocacao: paraNumero(String(l[iAloc] ?? '').replace(',', '.')),
    codigo_rm: iRm >= 0 ? codigoRmCentroCusto(l[iRm]) : '',
  })).filter((l) => l.nome && l.cod_ct && Number.isFinite(l.alocacao) && l.alocacao > 0);

  // O código RM pode vir na própria aba de rateio ou numa aba só de centros
  // de custo (COD CT + CCCOD) — o organograma 08/2026 tem as duas formas.
  for (const aba of abas) {
    const cab = acharCabecalho(aba.linhas, (c) => c.includes('COD CT') && c.includes('CCCOD'));
    if (!cab) continue;
    const a = cab.cabecalho.indexOf('COD CT');
    const b = cab.cabecalho.indexOf('CCCOD');
    aba.linhas.slice(cab.indice + 1).forEach((l) => {
      const cc = texto(l[a]);
      if (!cc) return;
      const rm = codigoRmCentroCusto(l[b]);
      if (rm || !centros.has(cc)) centros.set(cc, { cod_ct: cc, codigo_rm: rm || null, origem: `${arquivo} • ${aba.nome}` });
    });
  }
  linhas.forEach((l) => {
    if (l.codigo_rm) centros.set(l.cod_ct, { cod_ct: l.cod_ct, codigo_rm: l.codigo_rm, origem: `${arquivo} • CCCOD` });
    else if (!centros.has(l.cod_ct)) centros.set(l.cod_ct, { cod_ct: l.cod_ct, codigo_rm: null, origem: arquivo });
  });

  return { aba: rateio.aba.nome, linhas, centros: [...centros.values()] };
}

// Agrupa as linhas por pessoa e normaliza a alocação para somar 100%.
export function rateiosPorNome(linhas) {
  const grupos = new Map();
  linhas.forEach((l) => {
    const k = normalizar(l.nome);
    if (!grupos.has(k)) grupos.set(k, { nome: l.nome, itens: new Map() });
    const g = grupos.get(k);
    // Mesmo centro repetido na planilha: soma.
    g.itens.set(l.cod_ct, (g.itens.get(l.cod_ct) || 0) + l.alocacao);
  });
  return [...grupos.values()].map((g) => {
    const soma = [...g.itens.values()].reduce((s, v) => s + v, 0) || 1;
    const itens = [...g.itens.entries()].map(([cod_ct, alocacao]) => ({
      cod_ct, alocacao_organograma: alocacao, percentual: Number(((alocacao / soma) * 100).toFixed(6)),
    }));
    return { nome: g.nome, chave: normalizar(g.nome), itens };
  });
}

// Sugestão de correspondência por tokens (nome com grafia diferente).
export function nomeParecido(a, b) {
  const ta = new Set(normalizar(a).split(' ').filter((t) => t.length > 2));
  const tb = new Set(normalizar(b).split(' ').filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  let comum = 0;
  ta.forEach((t) => { if (tb.has(t)) comum += 1; });
  return comum / Math.max(ta.size, tb.size);
}

export function sugerirPrestador(nome, prestadores, minimo = 0.6) {
  let melhor = null;
  prestadores.forEach((p) => {
    const s = nomeParecido(nome, p.nome);
    if (s >= minimo && (!melhor || s > melhor.score)) melhor = { prestador: p, score: s };
  });
  return melhor;
}

// ---------------------------------------------------------------------------
// Conferência Bradesco (Líquido PJ + Conferência do plano + Base de Ativos)
// ---------------------------------------------------------------------------

export function lerBradesco({ liquido, conferencia, baseAtivos }) {
  const folha = lerFolha(liquido);
  const nomesFolha = new Set(folha.linhas.map((l) => normalizar(l.nome)));

  const abaConf = conferencia.find((a) => ['CONSILIDADA PLANILHA FOPAG', 'CONSOLIDADA PLANILHA FOPAG'].includes(normalizar(a.nome)))
    || conferencia.find((a) => acharCabecalho(a.linhas, (c) => c.includes('TITULAR') && c.includes('TITULARIDADE')));
  if (!abaConf) throw new Error('Não encontrei a aba Consolidada Planilha Fopag na planilha de conferência.');
  const cabConf = acharCabecalho(abaConf.linhas, (c) => c.includes('TITULAR') && c.includes('TITULARIDADE')
    && (c.includes('DEPENDENTE') || c.includes('NOME SEGURADO')));
  if (!cabConf) throw new Error('A aba de conferência precisa das colunas Titular, Dependente e Titularidade.');

  let abaBase = null;
  let cabBase = null;
  for (const a of baseAtivos) {
    const c = acharCabecalho(a.linhas, (h) => h.includes('NOME') && h.includes('TITULARIDADE') && h.includes('CERTIFICADO') && h.includes('CPF'));
    if (c) { abaBase = a; cabBase = c; break; }
  }
  if (!abaBase) throw new Error('A Base de Ativos Bradesco precisa das colunas Nome, Titularidade, Certificado e CPF.');

  const hb = cabBase.cabecalho;
  const b = {
    nome: acharColuna(hb, ['NOME', 'NOME COMPLETO']),
    titularidade: acharColuna(hb, ['TITULARIDADE', 'TIPO DE BENEFICIARIO']),
    certificado: acharColuna(hb, ['CERTIFICADO']),
    cpf: acharColuna(hb, ['CPF']),
    cartao: acharColuna(hb, ['CARTAO', 'NUMERO DO CARTAO']),
    plano: acharColuna(hb, ['PLANO', 'NOME DO PLANO']),
    nascimento: acharColuna(hb, ['DATA DE NASCIMENTO', 'NASCIMENTO', 'DATA NASCIMENTO']),
  };
  const ativos = abaBase.linhas.slice(cabBase.indice + 1).map((l) => ({
    nome: texto(l[b.nome]),
    titularidade: normalizar(l[b.titularidade]),
    certificado: texto(l[b.certificado]),
    cpf: texto(l[b.cpf]),
    cartao: b.cartao >= 0 ? texto(l[b.cartao]) : '',
    plano: b.plano >= 0 ? texto(l[b.plano]) : '',
    nascimento: b.nascimento >= 0 ? celulaParaIso(l[b.nascimento]) : null,
  })).filter((x) => x.nome);
  const ativoPorNome = new Map(ativos.map((x) => [normalizar(x.nome), x]));
  // Certificado do dependente = certificado do titular com outro sufixo; o
  // titular do certificado é quem tem TITULAR na titularidade.
  const titularDoCertificado = new Map(ativos.filter((x) => x.titularidade.includes('TITULAR'))
    .map((x) => [x.certificado.split('/')[0], x.nome]));

  const hc = cabConf.cabecalho;
  const c = {
    titular: acharColuna(hc, ['TITULAR']),
    dependente: acharColuna(hc, ['DEPENDENTE', 'NOME SEGURADO']),
    titularidade: acharColuna(hc, ['TITULARIDADE']),
    situacao: acharColuna(hc, ['STATUS']),
    valor: acharColuna(hc, ['VALOR', 'MENSALIDADE']),
  };

  const vidas = [];
  abaConf.linhas.slice(cabConf.indice + 1).forEach((l) => {
    const titular = texto(l[c.titular]);
    if (!titular || !nomesFolha.has(normalizar(titular))) return;
    const ehDependente = normalizar(l[c.titularidade]).includes('DEPENDENTE');
    const pessoa = ehDependente ? texto(l[c.dependente]) : titular;
    const ativo = ativoPorNome.get(normalizar(pessoa));
    const titularBase = ativo ? titularDoCertificado.get(ativo.certificado.split('/')[0]) : null;
    let conferenciaVida = 'Não localizado na base ativa';
    if (ativo) conferenciaVida = !ehDependente || normalizar(titularBase) === normalizar(titular) ? 'Dados localizados' : 'Vínculo divergente';
    vidas.push({
      titular,
      tipo: ehDependente ? 'Dependente' : 'Titular',
      nome: pessoa,
      valor: c.valor >= 0 ? round2(paraNumero(l[c.valor])) : 0,
      situacao: (c.situacao >= 0 && texto(l[c.situacao])) || 'Ativo',
      plano: ativo?.plano || 'Plano Médico Bradesco',
      cpf: ativo?.cpf || '',
      nascimento: ativo?.nascimento || null,
      certificado: ativo?.certificado || '',
      conferencia: conferenciaVida,
    });
  });

  const porTitular = new Map();
  vidas.forEach((v) => {
    const k = normalizar(v.titular);
    if (!porTitular.has(k)) porTitular.set(k, []);
    porTitular.get(k).push(v);
  });

  return {
    folha,
    vidas,
    porTitular,
    colunaNascimento: b.nascimento >= 0,
    totais: {
      prestadores: folha.linhas.length,
      comPlano: porTitular.size,
      semPlano: Math.max(0, folha.linhas.length - porTitular.size),
      dependentesConciliados: vidas.filter((v) => v.tipo === 'Dependente' && v.conferencia === 'Dados localizados').length,
      dependentesPendentes: vidas.filter((v) => v.tipo === 'Dependente' && v.conferencia !== 'Dados localizados').length,
      conflitos: vidas.filter((v) => v.conferencia === 'Vínculo divergente').length,
    },
  };
}

// Benefício médico + dependentes para gravar no cadastro a partir das vidas.
export function beneficioDasVidas(vidas, fonte, hojeIso = new Date().toISOString().slice(0, 10)) {
  const ativas = vidas.filter((v) => !normalizar(v.situacao).includes('INATIV'));
  if (!ativas.length) return null;
  const dependentes = [];
  const vistos = new Set();
  ativas.filter((v) => v.tipo === 'Dependente').forEach((v) => {
    const k = normalizar(v.nome);
    if (vistos.has(k)) return;
    vistos.add(k);
    dependentes.push({
      nome: v.nome, cpf: v.cpf, nascimento: v.nascimento, situacao: v.conferencia, fonte, beneficio: 'Plano Médico',
    });
  });
  return {
    medico: {
      ativo: true,
      plano: ativas.find((v) => v.plano)?.plano || 'Plano Médico Bradesco',
      valor: somar(ativas, 'valor'),
      vidas: ativas.length,
      fonte,
      atualizadoEm: hojeIso,
    },
    dependentes,
  };
}
