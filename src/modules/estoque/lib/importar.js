// Leitura das planilhas de referencia/referencia_estoque/. Puro: recebe a matriz
// que o SheetJS devolve (`sheet_to_json(ws, { header: 1, raw: true, defval: '' })`)
// e devolve o plano de importação. Sem React, sem Supabase, sem SheetJS — roda
// sob `node --test` com fixtures dos cabeçalhos reais.
//
// `raw: true` NÃO é detalhe: com raw:false o SheetJS aplica o formato de exibição
// e devolve o CA 45021 como a string "45,021". Como o CA faz parte da chave da
// variante, isso gravaria um código inexistente; e no valor unitário a mesma
// formatação tornaria impossível saber se a vírgula é decimal (pt-BR) ou milhar
// (en-US). Lendo cru, número chega como número e a ambiguidade não existe.
// Por isso as funções abaixo aceitam tanto número quanto texto.
//
// As duas planilhas têm formatos diferentes e nenhum deles é uma tabela limpa:
//   EPIs      → DESCRIÇÃO | TAMANHO | CA | EPI'S USADOS | ESTOQUE ENTRADA |
//               ESTOQUE ATUAL | ESTOQUE MINIMO | ESTOQUE MÁXIMO | JAN..DEZ
//               (ESTOQUE ATUAL é fórmula: =usados+entrada-saídas do ano)
//   Uniformes → CÓDIGO | SETOR | DESCRIÇÃO | GÊNERO | TAMANHO | ESTOQUE |
//               ESTOQUE MINIMO | ESTOQUE MÁXIMO | STATUS | ... | VALOR UNITÁRIO
//               (com uma tabela dinâmica solta à direita, em OUTRAS linhas)
//
// Por isso o cabeçalho é procurado, não assumido numa linha fixa, e as colunas
// são casadas pelo NOME normalizado — posição de coluna muda a cada revisão da
// planilha, nome não.

import { normalizar, chaveVariante } from './catalogo.js';

/** Valor cru da célula (pode ser número, texto ou ''). */
const cel = (linha, i) => (i >= 0 ? linha?.[i] : undefined);

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Converte célula em número. Número passa direto (é o caminho normal com
 * raw:true). Texto ainda é tratado porque planilha remontada à mão traz "50,70"
 * — nesse caso a vírgula é decimal, convenção pt-BR.
 *
 * Devolve null (não 0) quando não há valor: em mínimo, máximo e custo, "em
 * branco" e "zero" são coisas diferentes.
 */
export function numero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = texto(v).replace(/\s/g, '');
  if (!s) return null;
  const limpo = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/**
 * CA, código e tamanho são IDENTIFICADORES, não grandezas: "45021" não é
 * quarenta e cinco mil. Vindo como número, imprime sem separador; vindo como
 * texto já formatado ("45,021" ou "45.021"), desfaz o agrupamento de milhar.
 */
export function codigoTexto(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  const s = texto(v);
  return /^\d{1,3}([.,]\d{3})+$/.test(s) ? s.replace(/[.,]/g, '') : s;
}

const inteiro = (v) => {
  const n = numero(v);
  return n === null ? null : Math.round(n);
};

const GENEROS = { masculino: 'masculino', feminino: 'feminino', unisex: 'unisex', unissex: 'unisex' };
const SETORES = { sede: 'sede', obra: 'obra', coordenacao: 'coordenacao' };

/**
 * CA que veio grudado no nome — "ABAFADOR DE CONCHA 3M (33835)". Só extrai
 * quando a coluna CA está vazia; se a planilha informou as duas coisas, a coluna
 * manda (é o campo que a pessoa preenche de propósito).
 */
export function separarCaDoNome(descricao, caColuna) {
  const desc = String(descricao ?? '').trim();
  if (caColuna) return { descricao: desc, ca: String(caColuna).trim() };
  const m = desc.match(/^(.*?)\s*[({]\s*(?:CA\s*)?(\d{3,7})\s*[)}]\s*$/i);
  return m ? { descricao: m[1].trim(), ca: m[2] } : { descricao: desc, ca: '' };
}

/** Índice de cada coluna pelo nome normalizado do cabeçalho. */
function mapaColunas(linhaCabecalho) {
  const mapa = new Map();
  (linhaCabecalho || []).forEach((c, i) => {
    const nome = normalizar(c);
    if (nome && !mapa.has(nome)) mapa.set(nome, i);
  });
  return mapa;
}

/** Primeira coluna cujo cabeçalho bate com um dos nomes aceitos. */
const acharCol = (mapa, nomes) => {
  for (const n of nomes) {
    const i = mapa.get(normalizar(n));
    if (i !== undefined) return i;
  }
  return -1;
};

const COLUNAS = {
  epi: {
    descricao: ['descricao', 'descrição'],
    tamanho: ['tamanho'],
    ca: ['ca'],
    saldo: ['estoque atual'],
    minimo: ['estoque minimo', 'estoque mínimo'],
    maximo: ['estoque maximo', 'estoque máximo'],
    custo: ['valor unitario', 'valor unitário'],
  },
  uniforme: {
    descricao: ['descricao', 'descrição'],
    tamanho: ['tamanho'],
    genero: ['genero', 'gênero'],
    setor: ['setor'],
    codigo: ['codigo', 'código'],
    saldo: ['estoque', 'estoque atual'],
    minimo: ['estoque minimo', 'estoque mínimo'],
    maximo: ['estoque maximo', 'estoque máximo'],
    custo: ['valor unitario', 'valor unitário'],
  },
};

/**
 * Lê a matriz e devolve { linhas, avisos, ignoradas }.
 *
 * Não lança para linha ruim: uma planilha de 90 linhas sempre tem lixo (totais,
 * linhas em branco, resíduo de fórmula) e abortar tudo por causa de uma faria a
 * importação ser impossível. O que não dá para ler vira aviso na pré-visualização.
 */
export function normalizarPlanilha(matriz, categoria) {
  const cols = COLUNAS[categoria];
  if (!cols) return { linhas: [], avisos: [`Categoria desconhecida: ${categoria}.`], ignoradas: 0 };

  const iCab = (matriz || []).findIndex((l) => mapaColunas(l).has('descricao'));
  if (iCab < 0) {
    return {
      linhas: [],
      avisos: ['Não encontrei a linha de cabeçalho (nenhuma coluna chamada "DESCRIÇÃO"). Confira se a aba escolhida é a da tabela de estoque.'],
      ignoradas: 0,
    };
  }

  const mapa = mapaColunas(matriz[iCab]);
  const idx = Object.fromEntries(
    Object.entries(cols).map(([campo, nomes]) => [campo, acharCol(mapa, nomes)]),
  );

  const avisos = [];
  if (idx.saldo < 0) {
    avisos.push('Não encontrei a coluna de saldo; as quantidades virão zeradas. Confira o cabeçalho da planilha.');
  }

  const linhas = [];
  let ignoradas = 0;

  for (let i = iCab + 1; i < (matriz || []).length; i += 1) {
    const l = matriz[i];
    const nLinha = i + 1;  // como aparece no Excel
    const bruta = texto(cel(l, idx.descricao));

    // Sem descrição não há item. Cobre a linha "TOTAL" do fim, as linhas em
    // branco que só carregam a fórmula do saldo e o rodapé da tabela dinâmica.
    if (!bruta || normalizar(bruta) === 'total') { ignoradas += 1; continue; }

    const { descricao, ca } = separarCaDoNome(bruta, codigoTexto(cel(l, idx.ca)));
    const generoBruto = normalizar(texto(cel(l, idx.genero)));
    const setorBruto = normalizar(texto(cel(l, idx.setor)));

    if (generoBruto && !GENEROS[generoBruto]) {
      avisos.push(`Linha ${nLinha}: gênero "${texto(cel(l, idx.genero))}" não reconhecido — ficou em branco.`);
    }
    if (setorBruto && !SETORES[setorBruto]) {
      avisos.push(`Linha ${nLinha}: setor "${texto(cel(l, idx.setor))}" não reconhecido — ficou em branco.`);
    }

    // Fórmula sem valor em cache (planilha salva por um editor que não calcula):
    // gravar 0 aqui seria inventar um saldo. Avisa e zera explicitamente.
    const saldoCru = cel(l, idx.saldo);
    let saldo = inteiro(saldoCru);
    if (saldo === null) {
      if (texto(saldoCru) !== '') {
        avisos.push(`Linha ${nLinha} (${descricao}): saldo "${texto(saldoCru)}" não é um número — importado como 0.`);
      }
      saldo = 0;
    }
    if (saldo < 0) {
      avisos.push(`Linha ${nLinha} (${descricao}): saldo negativo (${saldo}) — importado como 0.`);
      saldo = 0;
    }

    const linha = {
      categoria,
      descricao,
      // "-" é como a planilha escreve "não se aplica" na coluna de tamanho.
      tamanho: codigoTexto(cel(l, idx.tamanho)).replace(/^-$/, ''),
      ca,
      genero: GENEROS[generoBruto] || '',
      setor: SETORES[setorBruto] || '',
      codigo: codigoTexto(cel(l, idx.codigo)),
      estoque_minimo: inteiro(cel(l, idx.minimo)) ?? 0,
      estoque_maximo: inteiro(cel(l, idx.maximo)),
      custo_unitario: numero(cel(l, idx.custo)),
      saldo,
      linhaPlanilha: nLinha,
    };
    linha.chave = chaveVariante(linha);
    linhas.push(linha);
  }

  // Duplicata dentro do próprio arquivo: o índice único do banco recusaria a
  // segunda, e a pessoa veria um erro críptico no meio da gravação.
  const vistas = new Map();
  for (const l of linhas) {
    if (vistas.has(l.chave)) {
      avisos.push(`Linha ${l.linhaPlanilha} (${l.descricao}) repete a linha ${vistas.get(l.chave)} `
        + '— mesma descrição, tamanho, CA, gênero e setor. Só a última será considerada.');
    }
    vistas.set(l.chave, l.linhaPlanilha);
  }

  return { linhas, avisos, ignoradas };
}

/**
 * Compara o que a planilha traz com o que já existe e devolve o plano.
 *
 * Idempotente de propósito: importar o mesmo arquivo duas vezes não dobra o
 * saldo. Variante nova nasce com um movimento de ENTRADA (o saldo passa a ter
 * procedência, e estoque_conferencia fecha desde o dia 1); variante existente
 * com saldo diferente gera um AJUSTE, que é o que uma reconferência é.
 *
 * `posicao`: linhas da view estoque_posicao já carregadas.
 */
export function planejarImportacao(linhas, posicao) {
  const existentes = new Map(
    (posicao || []).map((p) => [chaveVariante(p), p]),
  );
  // Duplicata no arquivo: a última vence (é o que o aviso avisou).
  const porChave = new Map((linhas || []).map((l) => [l.chave, l]));

  const criar = [];
  const atualizar = [];
  const semMudanca = [];

  for (const l of porChave.values()) {
    const atual = existentes.get(l.chave);
    if (!atual) { criar.push(l); continue; }

    const delta = l.saldo - (Number(atual.saldo) || 0);
    const mudouCadastro = (Number(atual.estoque_minimo) || 0) !== l.estoque_minimo
      || (atual.estoque_maximo ?? null) !== (l.estoque_maximo ?? null)
      || (atual.custo_unitario === null || atual.custo_unitario === undefined
        ? null : Number(atual.custo_unitario)) !== l.custo_unitario;

    if (!delta && !mudouCadastro) { semMudanca.push({ ...l, variante_id: atual.id }); continue; }
    atualizar.push({ ...l, variante_id: atual.id, saldoAtual: Number(atual.saldo) || 0, delta, mudouCadastro });
  }

  return {
    criar,
    atualizar,
    semMudanca,
    resumo: {
      criar: criar.length,
      atualizar: atualizar.length,
      semMudanca: semMudanca.length,
      pecas: criar.reduce((s, l) => s + l.saldo, 0),
      ajustes: atualizar.filter((l) => l.delta !== 0).length,
    },
  };
}
