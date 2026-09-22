// Leitura da pasta documental do prestador: classifica os arquivos pelo nome e
// extrai os dados de dentro do texto dos PDFs. Nada aqui toca no navegador —
// quem entrega o texto é lib/pdfTexto.js, e o ZIP é aberto por lib/zip.js.

import { dataIso, digitos } from './formato.js';

// ── Classificação ────────────────────────────────────────────────────────────

// A ordem importa: o primeiro padrão que casar vence. "RG e CPF" é RG, e o
// CTPS vem antes do contrato para o nome "CTPSContratosDigitais" não confundir.
const TIPOS = [
  ['CTPS', /ctps|carteira de trabalho/i],
  ['Contrato', /contrato\s*pj|contrato de presta|d4sign/i],
  ['Contrato social', /contrato\s*social/i],
  ['Dados bancários', /conta\s*banc|dados\s*banc|comprovante\s*banc/i],
  ['Cartão CNPJ', /cart[ãa]o\s*cnpj|comprovante de inscri|(^|[^a-z])cnpj([^a-z]|$)/i],
  ['Comprovante de endereço', /comprovante\s*de\s*(resid|endere)|comprovante\s*de\s*moradia/i],
  ['Certidão de nascimento', /certid[ãa]o\s*de\s*nascimento/i],
  ['Certidão de casamento', /certid[ãa]o\s*de\s*casamento|uni[ãa]o\s*est[áa]vel/i],
  ['RG', /(^|[^a-z])rg([^a-z]|$)|identidade/i],
  ['CNH', /(^|[^a-z])cnh([^a-z]|$)|habilita/i],
  ['CPF', /(^|[^a-z])cpf([^a-z]|$)/i],
  ['Título de eleitor', /eleitoral|t[íi]tulo de eleitor/i],
  ['Reservista', /reservista|alistamento/i],
  ['Diploma', /diploma|gradua|especializa|certificado de conclus/i],
  ['Conselho de classe', /crea|cau|conselho regional/i],
  ['ASO', /(^|[^a-z])aso([^a-z]|$)|atestado.*sa[úu]de/i],
  ['Vacinação', /vacina/i],
];

/** Tipo do documento a partir do nome do arquivo; 'Outros' quando nada casa. */
export function classificar(caminho) {
  const nome = String(caminho || '').split('/').pop() || '';
  const achado = TIPOS.find(([, re]) => re.test(nome));
  return achado ? achado[0] : 'Outros';
}

const EXTENSAO_IMAGEM = /\.(jpe?g|png|tiff?|bmp|heic)$/i;

// ── Padrões soltos ───────────────────────────────────────────────────────────

const RE_CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
const RE_CPF = /\d{3}\.\d{3}\.\d{3}-\d{2}/;
const RE_CEP = /\d{2}\.?\d{3}-?\d{3}/;
const RE_DATA = /\d{2}\/\d{2}\/\d{4}/;

const limpar = (v) => String(v || '').replace(/\s+/g, ' ').trim();

/** Texto entre um rótulo e o rótulo seguinte (layouts de formulário da Receita). */
function entre(texto, rotulo, proximos = []) {
  const fim = proximos.length ? `(?=${proximos.join('|')}|$)` : '$';
  const re = new RegExp(`${rotulo}\\s*(.*?)\\s*${fim}`, 'i');
  return limpar(re.exec(texto)?.[1] || '');
}

// ── Datas por extenso (certidões de cartório) ────────────────────────────────

const UNIDADES = {
  um: 1, primeiro: 1, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const DEZENAS = { vinte: 20, trinta: 30 };
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
  'outubro', 'novembro', 'dezembro'];

const semAcento = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** 'vinte e cinco' -> 25; 'seis' -> 6. Devolve null quando não reconhece. */
function numeroExtenso(frase) {
  const partes = semAcento(frase).split(/\s+e\s+|\s+/).filter(Boolean);
  let total = 0;
  let achou = false;
  partes.forEach((p) => {
    if (DEZENAS[p] !== undefined) { total += DEZENAS[p]; achou = true; }
    else if (UNIDADES[p] !== undefined) { total += UNIDADES[p]; achou = true; }
  });
  return achou ? total : null;
}

/**
 * 'Seis de agosto de dois mil e vinte e cinco' -> '2025-08-06'.
 * É a fonte mais confiável da certidão: os campos Dia/Mês/Ano saem embaralhados
 * na extração porque o cartório imprime rótulo e valor em colunas separadas.
 */
export function dataPorExtenso(frase) {
  const t = semAcento(frase);
  const m = new RegExp(`([a-z ]+?)\\s+de\\s+(${MESES.join('|')})\\s+de\\s+dois mil\\b(.*)$`).exec(t);
  if (!m) return null;
  const dia = numeroExtenso(m[1].split(/\s+/).slice(-3).join(' '));
  const mes = MESES.indexOf(m[2]) + 1;
  // O ano continua enquanto as palavras forem número ('e vinte e cinco'); a
  // primeira palavra estranha encerra — depois dela vem o resto da certidão.
  let resto = 0;
  for (const p of m[3].split(/\s+/).filter(Boolean)) {
    if (p === 'e') continue;
    const n = DEZENAS[p] ?? UNIDADES[p];
    if (n === undefined) break;
    resto += n;
  }
  if (!dia || !mes) return null;
  const ano = 2000 + resto;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// ── Extratores por tipo de documento ─────────────────────────────────────────

const ROTULOS_CNPJ = ['LOGRADOURO', 'N[ÚU]MERO', 'COMPLEMENTO', 'CEP', 'BAIRRO/DISTRITO', 'MUNIC[ÍI]PIO',
  'UF', 'ENDERE[ÇC]O ELETR[ÔO]NICO', 'TELEFONE', 'ENTE FEDERATIVO', 'SITUA[ÇC][ÃA]O CADASTRAL'];

/** Cartão CNPJ da Receita: razão social, CNPJ e o endereço da sede. */
export function lerCartaoCnpj(texto) {
  const t = limpar(texto);
  if (!/CADASTRO NACIONAL DA PESSOA JUR[ÍI]DICA/i.test(t)) return null;
  const proximos = (a) => ROTULOS_CNPJ.slice(ROTULOS_CNPJ.indexOf(a) + 1);
  // O bloco de endereço começa em LOGRADOURO. Sem esse corte, 'NÚMERO' casaria
  // com o 'NÚMERO DE INSCRIÇÃO' lá do topo do comprovante.
  const bloco = t.slice(Math.max(0, t.search(/LOGRADOURO/i)));
  const cep = entre(bloco, 'CEP', proximos('CEP'));
  return {
    cnpj: digitos(RE_CNPJ.exec(t)?.[0] || ''),
    razao_social: entre(t, 'NOME EMPRESARIAL', ['T[ÍI]TULO DO ESTABELECIMENTO', 'PORTE']),
    logradouro: entre(bloco, 'LOGRADOURO', proximos('LOGRADOURO')),
    numero: entre(bloco, 'N[ÚU]MERO', proximos('N[ÚU]MERO')),
    complemento: entre(bloco, 'COMPLEMENTO', proximos('COMPLEMENTO')),
    cep: digitos(RE_CEP.exec(cep)?.[0] || ''),
    bairro: entre(bloco, 'BAIRRO/DISTRITO', proximos('BAIRRO/DISTRITO')),
    municipio: entre(bloco, 'MUNIC[ÍI]PIO', proximos('MUNIC[ÍI]PIO')),
    uf: entre(bloco, 'UF', proximos('UF')).slice(0, 2).toUpperCase(),
    data_abertura: dataIso(entre(t, 'DATA DE ABERTURA', ['NOME EMPRESARIAL'])),
  };
}

/** Comprovante de CPF da Receita: nome, CPF e nascimento do titular. */
export function lerCpf(texto) {
  const t = limpar(texto);
  if (!/Cadastro de Pessoa F[íi]sica|CPF/i.test(t)) return null;
  const nome = entre(t, 'Nome', ['Nascimento', 'REGULAR', 'Situa[çc][ãa]o']);
  const nascimento = entre(t, 'Nascimento', ['REGULAR', 'Situa[çc][ãa]o', 'Este documento']);
  const cpf = digitos(/CPF\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i.exec(t)?.[1] || RE_CPF.exec(t)?.[0] || '');
  if (!cpf && !nome) return null;
  return { cpf, nome: nome || '', data_nascimento: dataIso(RE_DATA.exec(nascimento)?.[0] || '') };
}

/**
 * Contrato PJ: a data de início vem da cláusula de vigência ("contados a partir
 * de DD/MM/AAAA"). A assinatura só entra quando não há vigência declarada —
 * é a mesma prioridade que o Fechamento usa para a admissão.
 */
export function lerContrato(texto) {
  const t = limpar(texto);
  if (!/CONTRATO DE PRESTA[ÇC][ÃA]O|CONTRATANTE/i.test(t)) return null;
  const vigencia = /contados?\s+[àa]?\s*partir\s+d[eo]\s+(\d{2}\/\d{2}\/\d{4})/i.exec(t)?.[1]
    || /vig[êe]ncia[^.]{0,80}?a\s+partir\s+de\s+(\d{2}\/\d{2}\/\d{4})/i.exec(t)?.[1]
    || '';
  const assinatura = /assinad[oa]\s+(?:eletronicamente\s+)?(?:em\s+)?(\d{2}\/\d{2}\/\d{4})/i.exec(t)?.[1] || '';
  const valor = /valor\s+fixo\s+de\s+R\$\s*([\d.]+,\d{2})/i.exec(t)?.[1]
    || /contrapresta[çc][ãa]o[^.]{0,120}?R\$\s*([\d.]+,\d{2})/i.exec(t)?.[1]
    || '';
  // A CONTRATADA é a empresa do prestador; a CONTRATANTE é sempre a PHD.
  const trecho = t.slice(t.search(/B\)/) >= 0 ? t.search(/B\)/) : 0);
  const contratada = /B\)\s*(.+?)\s*(?:empres[áa]ri|pessoa jur[íi]dica|,\s*inscrit)/i.exec(t)?.[1] || '';
  return {
    data_inicio: dataIso(vigencia) || null,
    origem_data: vigencia ? 'Vigência do contrato' : (assinatura ? 'Data de assinatura' : ''),
    data_assinatura: dataIso(assinatura) || null,
    valor_mensal: valor ? Number(valor.replace(/\./g, '').replace(',', '.')) : null,
    razao_social: limpar(contratada),
    cnpj: digitos(RE_CNPJ.exec(trecho)?.[0] || ''),
    email: (/[\w.+-]+@[\w-]+\.[\w.]+/.exec(trecho)?.[0] || '').toLowerCase(),
  };
}

/**
 * Conta de consumo usada como comprovante de endereço. A linha da ligação vem
 * como 'RUA X,00016 - BAIRRO MUNICIPIO - UF - BRASIL - CEP 00000-000': bairro e
 * município não têm separador entre si, então só sai daqui o que é inequívoco —
 * logradouro, número, UF e CEP. Bairro e município ficam para o cartão CNPJ ou
 * para a mão, porque chutar onde a pessoa mora é pior do que deixar em branco.
 */
export function lerComprovanteEndereco(texto) {
  const t = limpar(texto);
  const m = /([A-ZÀ-Ú][A-ZÀ-Ú\s.]{4,}?),\s*0*(\d+)\s*-\s*[^-]+-\s*([A-Z]{2})\s*-\s*BRASIL\s*-\s*(?:CEP\s*)?(\d{2}\.?\d{3}-?\d{3})/.exec(t);
  if (!m) return null;
  return {
    logradouro: limpar(m[1]),
    numero: String(Number(m[2])),
    uf: m[3],
    cep: digitos(m[4]),
  };
}

/**
 * Certidão de nascimento: devolve o registrado e os dois genitores. O parentesco
 * com o prestador é decidido depois, comparando os genitores com o titular.
 */
export function lerCertidaoNascimento(texto) {
  const t = limpar(texto);
  if (!/CERTID[ÃA]O DE NASCIMENTO/i.test(t)) return null;
  const nome = entre(t, 'Nome', ['Matr[íi]cula', 'N[úu]mero do CPF']);
  const nascimento = dataPorExtenso(entre(t, 'Data de nascimento', ['Dia', 'Hor[áa]rio']));
  const sexo = /(Masculino|Feminino)/i.exec(t)?.[1] || '';
  // O cartório imprime rótulo e valor em colunas, então o trecho do genitor sai
  // grudado no município ("Anderson Nonato dos Santos Município de nascimento
  // Canavieiras"). Serve para procurar o titular dentro dele, não para virar nome.
  const genitores = [...t.matchAll(/Genitor\(a\)\s+(.{0,90}?)(?=\s*(?:Av[ôóo]|respectivo|Data de registro|Genitor|$))/g)]
    .map((m) => limpar(m[1]).replace(/Munic[íi]pio de nascimento.*$/i, '').trim())
    .filter(Boolean);
  return {
    nome: limpar(nome),
    cpf: digitos(/N[úu]mero do CPF\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i.exec(t)?.[1] || ''),
    nascimento,
    sexo: sexo ? sexo[0].toUpperCase() + sexo.slice(1).toLowerCase() : '',
    genitores: [...new Set(genitores)],
  };
}

// ── Montagem da conferência ──────────────────────────────────────────────────

const chave = (v) => semAcento(v).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

/** Nome do prestador: a pasta raiz do ZIP, que é como a pasta chega do RH. */
export function nomeDaPasta(caminhos, nomeArquivo) {
  const raiz = caminhos.map((c) => c.split('/')[0]).find((c) => c && !/\.[a-z]{2,5}$/i.test(c));
  return limpar(raiz || String(nomeArquivo || '').replace(/\.zip$/i, ''));
}

const PARENTESCO_ARQUIVO = [
  [/filh[oa]/i, 'Filho(a)'],
  [/c[ôo]njug|conjug|esposa|esposo|companheir/i, 'Cônjuge'],
  [/uni[ãa]o\s*est[áa]vel/i, 'Cônjuge'],
];

/** Nome do dependente escrito no nome do arquivo, depois do tipo do documento. */
function nomeNoArquivo(nome) {
  const semExtensao = nome.replace(/\.[a-z]{2,5}$/i, '');
  const depois = /(?:-|–|_)\s*([^-–_]+?)\s*(?:$|_|-\s*(?:frente|verso|filha?|digital))/i.exec(
    semExtensao.replace(/^[\d.\-\s]*/, '').replace(/^(certid[ãa]o de nascimento|rg e cpf|rg|cpf|uni[ãa]o est[áa]vel)/i, ''),
  );
  const bruto = limpar(depois?.[1] || '');
  // Descarta o que claramente não é nome de pessoa.
  if (!bruto || bruto.length < 3 || /frente|verso|digital|conjug/i.test(bruto)) return '';
  return bruto.split(/\s+x\s+/i).pop().trim();
}

const CAMPOS_ROTULO = {
  nome: 'Nome', cpf: 'CPF', data_nascimento: 'Nascimento', razao_social: 'Razão social', cnpj: 'CNPJ',
  cep: 'CEP', logradouro: 'Logradouro', numero: 'Número', complemento: 'Complemento', bairro: 'Bairro',
  municipio: 'Município', uf: 'UF', data_inicio: 'Início do contrato', valor_mensal: 'Valor mensal',
  email_pessoal: 'E-mail',
};

/**
 * Junta tudo: recebe [{ caminho, texto }] e devolve a conferência que a tela
 * mostra. Cada campo carrega de qual documento veio — sem isso ninguém confere.
 */
export function analisarPasta(arquivos, nomeArquivo) {
  const documentos = arquivos.map((a) => {
    const nome = a.caminho.split('/').pop() || a.caminho;
    const tipo = classificar(a.caminho);
    const texto = limpar(a.texto);
    return {
      nome,
      tipo,
      texto,
      // Sem texto o arquivo é imagem escaneada: entra na contagem, não nos campos.
      status: texto.length > 40 ? 'Lido' : (EXTENSAO_IMAGEM.test(nome) ? 'Imagem' : 'Digitalização'),
    };
  });

  const doTipo = (tipo) => documentos.filter((d) => d.tipo === tipo);
  const primeiroLido = (tipo) => doTipo(tipo).find((d) => d.status === 'Lido');

  const perfil = {};
  const campos = [];
  const avisos = [];
  const registrar = (dados, fonte, confianca = 'Alta') => {
    Object.entries(dados || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '' || !(k in CAMPOS_ROTULO)) return;
      if (perfil[k] !== undefined && perfil[k] !== '') return; // o primeiro documento a trazer o campo manda
      perfil[k] = v;
      campos.push({ campo: k, rotulo: CAMPOS_ROTULO[k], valor: v, fonte, confianca });
    });
  };

  const cpfDoc = primeiroLido('CPF');
  if (cpfDoc) registrar(lerCpf(cpfDoc.texto), cpfDoc.nome);

  const contratoDoc = primeiroLido('Contrato');
  const contrato = contratoDoc ? lerContrato(contratoDoc.texto) : null;
  if (contrato) {
    registrar({ data_inicio: contrato.data_inicio, valor_mensal: contrato.valor_mensal }, contratoDoc.nome);
    registrar({ razao_social: contrato.razao_social, cnpj: contrato.cnpj, email_pessoal: contrato.email }, contratoDoc.nome, 'Média');
  }

  const cnpjDoc = primeiroLido('Cartão CNPJ');
  if (cnpjDoc) registrar(lerCartaoCnpj(cnpjDoc.texto), cnpjDoc.nome);

  const enderecoDoc = primeiroLido('Comprovante de endereço');
  const endereco = enderecoDoc ? lerComprovanteEndereco(enderecoDoc.texto) : null;
  if (endereco) registrar(endereco, enderecoDoc.nome);

  const nomePrestador = perfil.nome || nomeDaPasta(arquivos.map((a) => a.caminho), nomeArquivo);
  const chaveTitular = chave(nomePrestador);

  // Dependentes: primeiro os que a certidão entrega lidos, depois os que só
  // existem como digitalização e ficam com o nome do arquivo.
  const dependentes = [];
  const jaTem = (nome) => dependentes.some((d) => chave(d.nome) === chave(nome));

  doTipo('Certidão de nascimento').forEach((d) => {
    const lida = d.status === 'Lido' ? lerCertidaoNascimento(d.texto) : null;
    if (lida?.nome) {
      // Titular citado como genitor = filiação confirmada pela própria certidão.
      const filhoDoTitular = chaveTitular && lida.genitores.some((g) => chave(g).includes(chaveTitular));
      dependentes.push({
        nome: lida.nome,
        cpf: lida.cpf,
        nascimento: lida.nascimento,
        sexo: lida.sexo,
        parentesco: lida.sexo === 'Feminino' ? 'Filha' : 'Filho',
        fonte: d.nome,
        situacao: filhoDoTitular ? 'Dados localizados' : 'Confirmar parentesco',
      });
      return;
    }
    const nome = nomeNoArquivo(d.nome);
    if (nome && !jaTem(nome)) {
      dependentes.push({
        nome, cpf: '', nascimento: null, sexo: '',
        parentesco: /filh/i.test(d.nome) ? 'Filho(a)' : '',
        fonte: `${d.nome} (nome do arquivo)`, situacao: 'Revisar — documento digitalizado',
      });
    }
  });

  [...doTipo('Certidão de casamento'), ...doTipo('RG')].forEach((d) => {
    const parentesco = PARENTESCO_ARQUIVO.find(([re]) => re.test(d.nome))?.[1];
    if (!parentesco) return;
    const nome = nomeNoArquivo(d.nome);
    if (!nome || jaTem(nome) || chave(nome) === chaveTitular) return;
    dependentes.push({
      nome, cpf: '', nascimento: null, sexo: '', parentesco,
      fonte: `${d.nome} (nome do arquivo)`, situacao: 'Revisar — documento digitalizado',
    });
  });

  // ── Validação cadastral: os cinco pontos que travam a confirmação ──────────
  const temDoc = (tipo) => doTipo(tipo).length > 0;
  const validacoes = [
    { rotulo: 'Identificação do prestador', ok: Boolean(perfil.cpf || nomePrestador),
      detalhe: perfil.cpf ? `CPF ${perfil.cpf} lido do documento` : 'Sem CPF: só o nome da pasta foi identificado' },
    { rotulo: 'Empresa contratada', ok: Boolean(perfil.cnpj && perfil.razao_social),
      detalhe: perfil.cnpj ? `${perfil.razao_social} • ${perfil.cnpj}` : 'Cartão CNPJ não lido' },
    { rotulo: 'Contrato e vigência', ok: Boolean(perfil.data_inicio && temDoc('Contrato')),
      detalhe: perfil.data_inicio ? `Início em ${perfil.data_inicio} (${contrato?.origem_data})` : 'Cláusula de vigência não localizada' },
    { rotulo: 'Endereço residencial', ok: Boolean(temDoc('Comprovante de endereço') && (perfil.cep || perfil.logradouro)),
      detalhe: perfil.cep ? `CEP ${perfil.cep}` : 'Comprovante de endereço ausente ou ilegível' },
    { rotulo: 'Dados bancários', ok: temDoc('Dados bancários') && doTipo('Dados bancários').some((d) => d.status === 'Lido'),
      detalhe: temDoc('Dados bancários') ? 'Documento presente, mas digitalizado: preencha banco, agência e conta à mão' : 'Nenhum comprovante bancário na pasta' },
  ];

  validacoes.filter((v) => !v.ok).forEach((v) => avisos.push(`${v.rotulo}: ${v.detalhe}.`));
  const digitalizados = documentos.filter((d) => d.status !== 'Lido').length;
  if (digitalizados) {
    avisos.push(`${digitalizados} arquivo(s) sem camada de texto (digitalização). Os dados deles não entram automaticamente.`);
  }
  dependentes.filter((d) => d.situacao !== 'Dados localizados').forEach((d) => {
    avisos.push(`Dependente ${d.nome}: ${d.situacao.toLowerCase()}.`);
  });

  // Identificação e contrato são o mínimo para gravar; o resto vira aviso.
  const podeConfirmar = validacoes[0].ok && validacoes[2].ok;

  return {
    arquivo: nomeArquivo,
    nome: nomePrestador,
    perfil,
    campos,
    dependentes,
    documentos: documentos.map(({ texto, ...d }) => d), // eslint-disable-line no-unused-vars
    validacoes,
    avisos,
    podeConfirmar,
  };
}

/** Diferenças entre o que foi lido e o cadastro atual, para a tela de conferência. */
export function diferencas(perfil, prestador) {
  if (!prestador) return [];
  return Object.entries(perfil)
    .filter(([campo, novo]) => {
      if (!(campo in CAMPOS_ROTULO) || novo === '' || novo === null) return false;
      const atual = prestador[campo];
      if (atual === null || atual === undefined || atual === '') return true;
      return String(atual) !== String(novo);
    })
    .map(([campo, novo]) => ({
      campo,
      rotulo: CAMPOS_ROTULO[campo],
      atual: prestador[campo] ?? '',
      novo,
    }));
}
