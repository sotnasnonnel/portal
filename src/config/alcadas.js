// ===== Motor de Alçadas — Documento de Alçadas e Aprovações (Parte 3) =====
//
// Lógica PURA (sem Supabase, sem React) que responde a uma única pergunta:
//   dada uma classificação (tabela + valor + modificadores + gatilhos),
//   QUEM precisa aprovar?
//
// A resposta vem em PAPÉIS simbólicos (CEO, COO, GERENTE_EXECUTIVO, ...), não
// em ids de colaborador. Quem traduz papel -> pessoa é services/resolverPapeis.js,
// porque alguns papéis dependem da cadeia do solicitante (superior direto,
// gerente executivo da cadeia, diretor da área) e outros são pessoas fixas.
//
// Separar as duas coisas é o que permite testar as REGRAS sem banco e trocar
// as PESSOAS sem tocar nas regras.
//
// Convenção de faixas: `ate` é o teto INCLUSIVO do nível (R$ 2.000,00 cai no
// nível 1; R$ 2.000,01 cai no nível 2). O último nível tem `ate: Infinity`.

// ---------------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------------

/**
 * Papéis simbólicos usados pelas tabelas de alçada.
 * - DINÂMICOS (dependem do solicitante): GERENTE, GERENTE_EXECUTIVO, DIRETOR_AREA
 * - FIXOS (pessoa específica): CEO, COO, DIRETOR_COMERCIAL, GERENTE_FINANCEIRO
 * - GRUPOS (qualquer um do grupo): FINANCEIRO, RH, JURIDICO, CONSELHO
 */
export const PAPEIS = {
  GERENTE: 'GERENTE',                       // superior direto do solicitante
  GERENTE_EXECUTIVO: 'GERENTE_EXECUTIVO',   // 1º gerente executivo subindo a cadeia
  DIRETOR_AREA: 'DIRETOR_AREA',             // 1º diretor subindo a cadeia
  CEO: 'CEO',                               // Pedro Nery
  COO: 'COO',                               // Pedro Morais (Diretor de Operações)
  DIRETOR_COMERCIAL: 'DIRETOR_COMERCIAL',   // Henrique
  GERENTE_FINANCEIRO: 'GERENTE_FINANCEIRO', // Daniela Sebrian
  FINANCEIRO: 'FINANCEIRO',                 // time do Financeiro (financeiro_role='admin')
  RH: 'RH',                                 // Gente & Cultura
  JURIDICO: 'JURIDICO',                     // parecer de cláusula atípica
  CONSELHO: 'CONSELHO',                     // Conselho / Sócios
};

export const PAPEL_LABEL = {
  GERENTE: 'Gerente (superior direto)',
  GERENTE_EXECUTIVO: 'Gerente Executivo',
  DIRETOR_AREA: 'Diretor da área',
  CEO: 'CEO',
  COO: 'COO (Diretor de Operações)',
  DIRETOR_COMERCIAL: 'Diretor Comercial',
  GERENTE_FINANCEIRO: 'Gerente Financeiro',
  FINANCEIRO: 'Financeiro',
  RH: 'Gente & Cultura',
  JURIDICO: 'Jurídico',
  CONSELHO: 'Conselho / Sócios',
};

const P = PAPEIS;

// ---------------------------------------------------------------------------
// §6, pilar 1 — Classificação obrigatória
// ---------------------------------------------------------------------------

/**
 * Categoria (natureza) do lançamento. Junto com `valor` e `dentro_orcamento`,
 * forma a classificação sem a qual nenhum lançamento pode entrar.
 */
export const CATEGORIAS = [
  { valor: 'opex_operacao', label: 'OPEX — Operação' },
  { valor: 'opex_administrativo', label: 'OPEX — Administrativo' },
  { valor: 'capex', label: 'CAPEX — Investimento' },
  { valor: 'ga', label: 'G&A — Despesa administrativa' },
  { valor: 'ti_software', label: 'TI / Software / Assinaturas' },
  { valor: 'viagem', label: 'Viagem e deslocamento' },
  { valor: 'marketing', label: 'Marketing e comercial' },
  { valor: 'gente_cultura', label: 'Gente & Cultura' },
  { valor: 'servico_terceiro', label: 'Serviço de terceiros' },
  { valor: 'tributos', label: 'Tributos e taxas' },
  { valor: 'outros', label: 'Outros' },
];

export const categoriaLabel = (v) => CATEGORIAS.find((c) => c.valor === v)?.label || v || '—';

// ---------------------------------------------------------------------------
// Tabelas de alçada (§2, §3, §4 e §1 do documento)
// ---------------------------------------------------------------------------

/**
 * §2.1 — Compras e Despesas (OPEX dentro do orçamento).
 * É a tabela BASE: Contratos (§3.1) reaproveita as mesmas faixas, mudando só
 * como o valor é calculado (pontual = total; recorrente = mensal × 12).
 */
export const TABELA_COMPRAS = [
  { nivel: 1, ate: 2000, papeis: [P.GERENTE], rotulo: 'Gerente / Gerente Executivo' },
  { nivel: 2, ate: 5000, papeis: [P.GERENTE_EXECUTIVO], rotulo: 'Gerente Executivo' },
  { nivel: 3, ate: 20000, papeis: [P.COO, P.GERENTE_FINANCEIRO], rotulo: 'Dupla obrigatória: COO + Gerente Financeiro' },
  { nivel: 4, ate: 50000, papeis: [P.CEO], rotulo: 'CEO' },
  { nivel: 5, ate: Infinity, papeis: [P.CONSELHO], rotulo: 'Conselho / Sócios' },
];

/**
 * §4.1 — Pagamentos NÃO orçados. Pagamento já aprovado e orçado não entra
 * aqui: o Financeiro executa sem nova aprovação (ver `avaliarPagamento`).
 */
export const TABELA_PAGAMENTOS = [
  { nivel: 1, ate: 5000, papeis: [P.GERENTE_EXECUTIVO, P.FINANCEIRO], rotulo: 'Gerente Executivo + Financeiro' },
  { nivel: 2, ate: 20000, papeis: [P.COO, P.FINANCEIRO], rotulo: 'COO + Financeiro' },
  { nivel: 3, ate: Infinity, papeis: [P.CEO], rotulo: 'CEO' },
];

/**
 * §1 — Alçada Comercial, origem HUNTER (quem originou a venda).
 *
 * ⚠️ FAIXA ASSUMIDA: o documento salta de "até R$ 1.000.000" para "acima de
 * R$ 2.000.000", deixando a faixa 1M–2M sem regra. Adotamos a leitura
 * CONSERVADORA (mais controle): tudo acima de R$ 1.000.000 já exige o nível 2.
 * A alternativa (deixar 1M–2M no nível 1) permitiria uma proposta de R$ 1,5 mi
 * aprovada por uma pessoa só — o oposto da premissa Hunter/Farmer. Confirmar
 * com a diretoria e ajustar só este `ate` se for o caso.
 */
export const TABELA_COMERCIAL_HUNTER = [
  { nivel: 1, ate: 1000000, papeis: [P.COO], rotulo: 'Contribuição (Morais)' },
  { nivel: 2, ate: 3000000, papeis: [P.DIRETOR_COMERCIAL, P.COO], rotulo: 'Henrique + Morais' },
  { nivel: 3, ate: Infinity, papeis: [P.CEO], rotulo: 'Nery' },
];

/** §1 — Alçada Comercial, origem FARMER (quem gere o cliente). */
export const TABELA_COMERCIAL_FARMER = [
  { nivel: 1, ate: 1000000, papeis: [P.DIRETOR_COMERCIAL, P.GERENTE_EXECUTIVO], rotulo: 'Contribuição (Henrique + Gerente Executivo)' },
  { nivel: 2, ate: 3000000, papeis: [P.COO, P.DIRETOR_COMERCIAL], rotulo: 'Morais + Henrique' },
  { nivel: 3, ate: Infinity, papeis: [P.CEO], rotulo: 'Nery' },
];

export const TABELAS = {
  compras: TABELA_COMPRAS,
  contratos: TABELA_COMPRAS,   // §3.1: mesmas faixas, valor enquadrado diferente
  pagamentos: TABELA_PAGAMENTOS,
  comercial_hunter: TABELA_COMERCIAL_HUNTER,
  comercial_farmer: TABELA_COMERCIAL_FARMER,
};

// ---------------------------------------------------------------------------
// Modificadores (+1 nível)
// ---------------------------------------------------------------------------

/**
 * Modificadores que elevam a alçada em +1 nível.
 * `aplicaEm` limita o modificador às tabelas onde o documento o prevê.
 */
export const MODIFICADORES = {
  fora_orcamento: {
    label: 'Fora do orçamento aprovado',
    degraus: 1,
    aplicaEm: ['compras', 'contratos'],
    fonte: '§2.1 — modificador-base',
  },
  prazo_maior_12m: {
    label: 'Prazo do contrato superior a 12 meses',
    degraus: 1,
    aplicaEm: ['contratos'],
    fonte: '§3.2',
  },
  multa_rescisoria_relevante: {
    label: 'Multa rescisória relevante',
    degraus: 1,
    aplicaEm: ['contratos'],
    fonte: '§3.2',
  },
};

/**
 * Gatilhos que NÃO somam degraus: forçam um nível mínimo ou acrescentam
 * aprovadores/pareceres independentemente do valor.
 */
export const GATILHOS = {
  capex_relevante: {
    label: 'CAPEX relevante',
    nivelMinimo: 5,
    aplicaEm: ['compras', 'contratos'],
    fonte: '§2.1 — última faixa',
  },
  clausula_atipica: {
    label: 'Cláusula atípica (exclusividade, garantia ou indenização)',
    parecer: PAPEIS.JURIDICO,
    aplicaEm: ['contratos'],
    fonte: '§3.3',
  },
  aplicacao_relevante: {
    label: 'Aplicação / movimentação relevante',
    papeis: [PAPEIS.FINANCEIRO, PAPEIS.CEO],
    aplicaEm: ['pagamentos'],
    fonte: '§4.1',
  },
  distribuicao_lucros: {
    label: 'Distribuição de lucros / dividendos',
    papeis: [PAPEIS.CONSELHO],
    aplicaEm: ['pagamentos'],
    fonte: '§4.1',
  },
  mc_ll_abaixo_piso: {
    label: 'MC/LL abaixo do piso',
    // Hunter e Farmer têm composições DIFERENTES (Daniela não participa no Farmer).
    papeisPorTabela: {
      comercial_hunter: [PAPEIS.CEO, PAPEIS.DIRETOR_COMERCIAL, PAPEIS.GERENTE_FINANCEIRO],
      comercial_farmer: [PAPEIS.CEO, PAPEIS.COO],
    },
    aplicaEm: ['comercial_hunter', 'comercial_farmer'],
    fonte: '§1 — matriz comercial',
  },
  desconto_fora_tabela: {
    label: 'Desconto fora da tabela / pagamento atípico / imposto / G&A',
    papeis: [PAPEIS.GERENTE_FINANCEIRO],
    aplicaEm: ['comercial_hunter', 'comercial_farmer'],
    fonte: '§1 — matriz comercial',
  },
  lta_estrategico: {
    label: 'Longo prazo / LTA estratégico',
    papeis: [PAPEIS.CEO],
    aplicaEm: ['comercial_hunter', 'comercial_farmer'],
    fonte: '§1 — matriz comercial',
  },
};

// ---------------------------------------------------------------------------
// Núcleo do motor
// ---------------------------------------------------------------------------

const nivelDe = (tabela, valor) => {
  const v = Number(valor) || 0;
  return (tabela.find((f) => v <= f.ate) || tabela[tabela.length - 1]).nivel;
};

const faixaDe = (tabela, nivel) => tabela.find((f) => f.nivel === nivel) || tabela[tabela.length - 1];

/**
 * §3.1 — valor usado para enquadrar um CONTRATO na tabela de faixas.
 * - pontual: valor total do contrato;
 * - recorrente (mensal): anualizado, valor mensal × 12.
 * Retorna { valor, base } — `base` explica o cálculo na trilha de auditoria.
 */
export function valorEnquadramentoContrato({ tipoContrato, valor, valorMensal }) {
  if (tipoContrato === 'recorrente') {
    const mensal = Number(valorMensal ?? valor) || 0;
    return { valor: mensal * 12, base: `Recorrente anualizado: ${mensal} × 12` };
  }
  return { valor: Number(valor) || 0, base: 'Contrato pontual: valor total' };
}

/**
 * Avalia a alçada de um lançamento.
 *
 * @param {object} entrada
 * @param {string} entrada.tabela         chave de TABELAS ('compras' | 'contratos' | ...)
 * @param {number} entrada.valor          valor JÁ enquadrado (use valorEnquadramentoContrato antes, em contratos)
 * @param {string[]} [entrada.modificadores]  chaves de MODIFICADORES (somam +1 nível cada)
 * @param {string[]} [entrada.gatilhos]       chaves de GATILHOS (nível mínimo / papéis extras / parecer)
 *
 * @returns {object} decisão completa, pronta para virar etapas e trilha de auditoria.
 */
export function avaliarAlcada({ tabela, valor, modificadores = [], gatilhos = [] }) {
  const def = TABELAS[tabela];
  if (!def) throw new Error(`Tabela de alçada desconhecida: ${tabela}`);

  const nivelBase = nivelDe(def, valor);
  const topo = def[def.length - 1].nivel;

  // --- modificadores: cada um vale +1 nível e eles SE ACUMULAM ---
  // O documento define cada modificador isoladamente como "+1 nível" e não diz
  // o que acontece quando dois incidem juntos (ex.: contrato fora do orçamento
  // E com prazo > 12 meses). Acumular é a leitura conservadora e coerente com a
  // premissa de governança do documento — o teto é o último nível da tabela.
  const modsAplicados = modificadores
    .filter((m) => MODIFICADORES[m]?.aplicaEm.includes(tabela))
    .map((m) => ({ chave: m, ...MODIFICADORES[m] }));
  const degraus = modsAplicados.reduce((s, m) => s + m.degraus, 0);

  // --- gatilhos ---
  const gatAplicados = gatilhos
    .filter((g) => GATILHOS[g]?.aplicaEm.includes(tabela))
    .map((g) => ({ chave: g, ...GATILHOS[g] }));

  const pisoGatilho = Math.max(0, ...gatAplicados.map((g) => g.nivelMinimo || 0));
  const nivelFinal = Math.min(topo, Math.max(nivelBase + degraus, pisoGatilho));

  // --- papéis exigidos: nível final + papéis extras dos gatilhos, sem duplicar ---
  const papeis = [...faixaDe(def, nivelFinal).papeis];
  for (const g of gatAplicados) {
    const extras = g.papeisPorTabela?.[tabela] || g.papeis || [];
    for (const p of extras) if (!papeis.includes(p)) papeis.push(p);
  }

  // --- pareceres bloqueantes (hoje só o Jurídico, §3.3) ---
  const pareceres = gatAplicados.filter((g) => g.parecer).map((g) => g.parecer);

  // --- trilha de auditoria / alerta à diretoria (§6, itens 4 e 5) ---
  const excecoes = [
    ...modsAplicados.map((m) => `${m.label} (+${m.degraus} nível — ${m.fonte})`),
    ...gatAplicados.map((g) => `${g.label} (${g.fonte})`),
  ];

  return {
    tabela,
    valorAvaliado: Number(valor) || 0,
    nivelBase,
    nivelFinal,
    degrausAplicados: nivelFinal - nivelBase,
    rotuloNivel: faixaDe(def, nivelFinal).rotulo,
    papeis,
    pareceres,
    modificadores: modsAplicados.map((m) => m.chave),
    gatilhos: gatAplicados.map((g) => g.chave),
    excecoes,
    // §5 do documento: fora do orçamento e desvio de margem alertam a diretoria.
    alertaDiretoria: excecoes.length > 0,
  };
}

/**
 * §4.1 — Pagamentos têm uma regra de entrada própria: se o pagamento já foi
 * aprovado e está orçado, o Financeiro executa SEM nova aprovação. Só o não
 * orçado entra na tabela de faixas.
 */
export function avaliarPagamento({ valor, orcado, gatilhos = [] }) {
  if (orcado && gatilhos.length === 0) {
    return {
      tabela: 'pagamentos',
      valorAvaliado: Number(valor) || 0,
      nivelBase: 0,
      nivelFinal: 0,
      degrausAplicados: 0,
      rotuloNivel: 'Financeiro executa (já aprovado e orçado)',
      papeis: [],
      pareceres: [],
      modificadores: [],
      gatilhos: [],
      excecoes: [],
      alertaDiretoria: false,
    };
  }
  const r = avaliarAlcada({ tabela: 'pagamentos', valor, gatilhos });
  if (!orcado) {
    r.excecoes = ['Pagamento não orçado (§4.1)', ...r.excecoes];
    r.alertaDiretoria = true;
  }
  return r;
}

// ---------------------------------------------------------------------------
// §5 — Administrativo / Gente & Cultura
// ---------------------------------------------------------------------------

/**
 * A matriz de G&C não é por valor, e sim por SITUAÇÃO. Casos:
 *  - contratacao_dentro_headcount → Gerente + RH
 *  - vaga_nova_fora_quadro        → Diretor da área + Financeiro
 *  - lideranca                    → CEO (backoffice) | COO (operação)
 *  - desligamento_lideranca       → CEO (backoffice) | COO (operação)
 *
 * §5.3 — Trava Headcount: qualquer assunto de ALTA LIDERANÇA (contratação,
 * alteração ou desligamento) exige aprovação obrigatória da Diretoria (Nery),
 * acrescentada por cima do caso.
 */
export const CASOS_GENTE_CULTURA = {
  contratacao_dentro_headcount: {
    label: 'Contratação dentro do headcount (vaga já existente)',
    papeis: [P.GERENTE, P.RH],
    fonte: '§5.1',
  },
  vaga_nova_fora_quadro: {
    label: 'Vaga nova fora do quadro (G&A)',
    papeis: [P.DIRETOR_AREA, P.FINANCEIRO],
    fonte: '§5.1',
  },
  lideranca: {
    label: 'Liderança — contratação ou alteração',
    papeisPorArea: { backoffice: [P.CEO], operacao: [P.COO] },
    fonte: '§5.1',
  },
  desligamento_lideranca: {
    label: 'Desligamento de liderança',
    papeisPorArea: { backoffice: [P.CEO], operacao: [P.COO] },
    fonte: '§5.2',
  },
};

// ---------------------------------------------------------------------------
// Classificação de liderança (§5.1, §5.2 e §5.3)
// ---------------------------------------------------------------------------

const semAcento = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().trim();

/**
 * O documento fala em "liderança" e "alta liderança" sem definir os cargos.
 * Estas listas são a tradução para o cadastro real (coluna `colaboradores.funcao`)
 * e ficam exportadas justamente para serem ajustadas sem caçar `if` no código.
 *
 * ALTA_LIDERANCA é checada PRIMEIRO: "GERENTE EXECUTIVO" também casa com
 * "GERENTE", e a ordem errada rebaixaria um gerente executivo a liderança comum.
 */
export const CARGOS_ALTA_LIDERANCA = ['CEO', 'DIRETOR', 'GERENTE EXECUTIVO'];
export const CARGOS_LIDERANCA = ['GERENTE', 'HEAD', 'COORDENADOR'];

/** @returns {'alta_lideranca'|'lideranca'|'nenhuma'} */
export function classificarLideranca(funcao) {
  const f = semAcento(funcao);
  if (!f) return 'nenhuma';
  if (CARGOS_ALTA_LIDERANCA.some((c) => f.includes(c))) return 'alta_lideranca';
  if (CARGOS_LIDERANCA.some((c) => f.includes(c))) return 'lideranca';
  return 'nenhuma';
}

const PESO_LIDERANCA = { nenhuma: 0, lideranca: 1, alta_lideranca: 2 };

/**
 * Entre dois cargos, devolve o mais sênior.
 * Usado na Alteração de Cargo/Função: promover alguém PARA liderança precisa
 * passar pela alçada tanto quanto alterar quem já é liderança — olhar só o
 * cargo atual deixaria a promoção escapar.
 */
export function funcaoMaisSenior(a, b) {
  return PESO_LIDERANCA[classificarLideranca(b)] > PESO_LIDERANCA[classificarLideranca(a)] ? b : a;
}

/**
 * Traduz um tipo de requisição do DP + o cargo envolvido no caso do §5.
 *
 * @param {string} tipoDp   tipo em solicitacoes_rh
 * @param {string} funcao   cargo do alvo (colaborador existente ou vaga proposta)
 * @param {boolean} [foraDoQuadro]  Nova Vaga fora do headcount aprovado
 * @returns {{caso: string, altaLideranca: boolean}|null} null = tipo sem regra de alçada
 */
export function casoGenteCultura(tipoDp, funcao, foraDoQuadro = false) {
  const nivel = classificarLideranca(funcao);
  const alta = nivel === 'alta_lideranca';
  const ehLider = nivel !== 'nenhuma';

  switch (tipoDp) {
    case 'desligamento':
      // Desligar quem não é liderança não tem alçada própria no documento —
      // segue só a cadeia configurada do gestor.
      return ehLider ? { caso: 'desligamento_lideranca', altaLideranca: alta } : null;

    case 'aumento_salario':   // Alteração de Cargo / Função
    case 'formulario_contratacao':
      if (ehLider) return { caso: 'lideranca', altaLideranca: alta };
      return tipoDp === 'formulario_contratacao'
        ? { caso: 'contratacao_dentro_headcount', altaLideranca: false }
        : null;

    case 'nova_vaga':
      if (foraDoQuadro) return { caso: 'vaga_nova_fora_quadro', altaLideranca: alta };
      return ehLider
        ? { caso: 'lideranca', altaLideranca: alta }
        : { caso: 'contratacao_dentro_headcount', altaLideranca: false };

    default:
      return null;   // ajuda_custo, mapeamento: sem regra no documento
  }
}

/**
 * @param {object} entrada
 * @param {string} entrada.caso        chave de CASOS_GENTE_CULTURA
 * @param {string} [entrada.area]      'backoffice' | 'operacao' (para os casos de liderança)
 * @param {boolean} [entrada.altaLideranca]  aciona a Trava Headcount (§5.3)
 */
export function avaliarGenteCultura({ caso, area, altaLideranca = false }) {
  const def = CASOS_GENTE_CULTURA[caso];
  if (!def) throw new Error(`Caso de Gente & Cultura desconhecido: ${caso}`);

  const papeis = [...(def.papeisPorArea ? (def.papeisPorArea[area] || []) : def.papeis)];
  const excecoes = [];

  // Trava Headcount: Nery é obrigatório e vem por ÚLTIMO (decisão final).
  if (altaLideranca) {
    const i = papeis.indexOf(P.CEO);
    if (i !== -1) papeis.splice(i, 1);
    papeis.push(P.CEO);
    excecoes.push('Trava Headcount — alta liderança exige aprovação da Diretoria (§5.3)');
  }

  return {
    tabela: 'gente_cultura',
    caso,
    area: area || null,
    rotuloNivel: def.label,
    papeis,
    pareceres: [],
    modificadores: [],
    gatilhos: altaLideranca ? ['trava_headcount'] : [],
    excecoes,
    alertaDiretoria: altaLideranca,
  };
}
