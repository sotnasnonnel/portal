// Regras de negócio do reembolso (valores permitidos, itens proibidos) e o
// cálculo automático da data de pagamento a partir da data de aprovação.
// Centralizado aqui para que solicitante (formulário), gestor (aprovação) e o
// PDF usem exatamente os mesmos valores.

/**
 * Regras de valor no ar desde a tabela por LOCAL (2026-09-01). Ficaram
 * desligadas enquanto a tabela não fechou — voltaram com os valores abaixo.
 */
export const REGRAS_VALOR_ATIVAS = true;

/**
 * Tabela de alimentação por REGIÃO. O teto de cada refeição depende de onde a
 * despesa aconteceu, e o local vem da própria nota: a IA extrai `local` no
 * formato "ESTABELECIMENTO, CIDADE - UF" e `regiaoDoLocal()` traduz isso para
 * uma destas faixas.
 *
 * `id` é interno (usado no cálculo); `label` é o que aparece na tela.
 */
export const REGIOES_ALIMENTACAO = [
  { id: "bh", label: "Belo Horizonte — MG", cafe: 20, almoco: 40, jantar: 40 },
  { id: "brasil", label: "Demais cidades do Brasil", cafe: 30, almoco: 50, jantar: 50 },
  { id: "intl", label: "México / Guatemala", cafe: 40, almoco: 80, jantar: 80 },
];

/**
 * Faixa usada quando a nota não diz onde foi (local em branco, ou cidade que
 * não bate com nenhuma regra). É a linha "demais cidades do Brasil" — a linha
 * genérica da tabela. Belo Horizonte só vale quando está escrito na nota:
 * assumir BH por omissão apertaria o teto de quem não tem culpa de a nota vir
 * sem cidade.
 */
export const REGIAO_PADRAO = "brasil";

export const POLICY = {
  // Tetos de alimentação por região (tabela acima)
  regioes: REGIOES_ALIMENTACAO,
  regiaoPadrao: REGIAO_PADRAO,
  // Itens que não podem ser reembolsados
  naoPermitido: [
    "Bebidas alcoólicas",
    "Cigarros",
    "Vestuário",
    "Brinquedos",
    "Abastecimento",
    "Compra de passagens",
    "Manutenção de veículos",
    "Acessórios ou qualquer outro item que não caracterize alimentação",
  ],
};

/**
 * Refeição reconhecida pela descrição do item ou pela categoria da nota
 * (acento-insensível). O TETO não está aqui: ele sai da tabela por região,
 * pelo campo `campo` de cada refeição (REGIOES_ALIMENTACAO).
 *
 * A refeição genérica ("COMIDA", que é o que a IA usa quando não dá para dizer
 * se foi almoço ou jantar) usa o teto do café da manhã — o menor da região —
 * para não afrouxar o limite quando a nota não diz qual refeição foi.
 */
const FOOD_LIMITS = [
  { keys: ["CAFE DA MANHA", "CAFE MANHA", "CAFE"], label: "Café da manhã", campo: "cafe" },
  { keys: ["ALMOCO"], label: "Almoço", campo: "almoco" },
  { keys: ["JANTAR", "JANTA"], label: "Jantar", campo: "jantar" },
  { keys: ["COMIDA", "REFEICAO", "RESTAURANTE", "LANCHE"], label: "Refeição", campo: "cafe" },
];

function normalize(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toUpperCase();
}

// =========================== Região da despesa ===========================

// Cidades/estados que caem em cada faixa da tabela. Só Belo Horizonte tem o
// teto menor, então a lista de "bh" é curta e literal: BH e as grafias que
// aparecem em cupom ("BELO HORIZONTE - MG", "BELO HORIZONTE/MG", "BH - MG").
const REGIAO_KEYS = {
  bh: ["BELO HORIZONTE"],
  intl: [
    "MEXICO", "GUATEMALA", "CDMX", "CIUDAD DE MEXICO", "CANCUN", "MONTERREY",
    "GUADALAJARA", "PUEBLA", "QUERETARO", "ANTIGUA GUATEMALA", "QUETZALTENANGO",
    "ESCUINTLA", "MIXCO",
  ],
};

// "BH" só vale como palavra isolada (senão casaria dentro de qualquer nome).
const BH_SIGLA = /(?:^|[^A-Z])BH(?:[^A-Z]|$)/;

/**
 * Faixa da tabela a partir do texto do local da nota ("PADARIA X, BELO
 * HORIZONTE - MG"). Sem local reconhecível, devolve a faixa padrão.
 */
export function regiaoDoLocal(local) {
  const d = normalize(local);
  if (!d) return REGIAO_PADRAO;
  if (REGIAO_KEYS.intl.some((k) => d.includes(k))) return "intl";
  if (REGIAO_KEYS.bh.some((k) => d.includes(k)) || BH_SIGLA.test(d)) return "bh";
  return REGIAO_PADRAO;
}

/** Linha da tabela de alimentação de uma região (cai no padrão se não achar). */
export function regraDaRegiao(regiaoId) {
  return (
    REGIOES_ALIMENTACAO.find((r) => r.id === regiaoId) ||
    REGIOES_ALIMENTACAO.find((r) => r.id === REGIAO_PADRAO)
  );
}

/** Teto de alimentação do DIA na região: as três refeições somadas. */
export function alimentacaoDia(regiaoId) {
  const r = regraDaRegiao(regiaoId);
  return r.cafe + r.almoco + r.jantar;
}

// ============================ Itens proibidos ============================

// Combustível NÃO é bebida. Fica antes da checagem de item proibido porque a
// nota do posto usa as mesmas palavras de bebida ("álcool") e nomes de produto
// que embutem chaves da lista ("Gasolina Original", "Etanol Original", da
// Ipiranga, carregam "GIN" dentro de "ORIGINAL").
const COMBUSTIVEL_KEYS = [
  "GASOLINA", "ETANOL", "ALCOOL", "DIESEL", "GNV", "ARLA", "COMBUSTIVEL",
  "ABASTECIMENTO", "QUEROSENE",
];

function ehCombustivel(desc) {
  return COMBUSTIVEL_KEYS.some((k) => desc.includes(k));
}

/**
 * Casa a palavra-chave só no COMEÇO de uma palavra, deixando continuar depois
 * (CERVEJA pega CERVEJAS; VINHO pega VINHOS).
 *
 * Antes era `includes` solto, e uma chave curta casava no meio de outra
 * palavra: "GIN" dentro de "GASOLINA ORIGINAL" fazia todo abastecimento
 * aparecer como bebida alcoólica.
 */
function temPalavra(desc, key) {
  const k = key.trim();
  if (!k) return false;
  const i = desc.indexOf(k);
  if (i < 0) return false;
  // início do texto ou logo depois de um caractere que não é letra/número
  for (let pos = i; pos >= 0; pos = desc.indexOf(k, pos + 1)) {
    const antes = pos === 0 ? "" : desc[pos - 1];
    if (!antes || !/[A-Z0-9]/.test(antes)) return true;
  }
  return false;
}

// Itens que não podem ser reembolsados, detectados por palavra-chave na
// descrição (acento-insensível). As chaves cobrem termos genéricos e algumas
// marcas comuns. Mantidas conservadoras para evitar falso positivo.
const FORBIDDEN_KEYWORDS = [
  {
    label: "Bebida alcoólica",
    keys: [
      "CERVEJA", "CERV ", "CHOPP", "CHOPE", "VINHO", "VODKA", "WHISKY", "WHISKEY",
      "CACHACA", "GIN", "LICOR", "ESPUMANTE", "CAIPIRINHA", "CAIPIROSKA", "TEQUILA",
      "CONHAQUE", "APERITIVO", "COQUETEL", "VERMUTE", "SAKE", "ABSINTO",
      "HEINEKEN", "BRAHMA", "SKOL", "BUDWEISER", "STELLA", "AMSTEL", "SPATEN",
      "EISENBAHN", "BOHEMIA", "ANTARCTICA", "ITAIPAVA", "PETRA", "DEVASSA",
    ],
  },
  { label: "Cigarro / tabaco", keys: ["CIGARRO", "TABACO", "CHARUTO", "CIGARRILHA", "ISQUEIRO"] },
  { label: "Vestuário", keys: ["VESTUARIO", "CAMISA", "CAMISETA", "CALCA", "BLUSA", "TENIS", "SAPATO", "JAQUETA", "CALCADO", "CUECA", "VESTIDO"] },
  { label: "Brinquedo", keys: ["BRINQUEDO", "BONECA", "BONECO", "PELUCIA"] },
];

// Procura itens proibidos nas descrições. Retorna a lista com o motivo
// (categoria proibida) e o valor de cada item sinalizado.
export function detectForbiddenItems(items) {
  const found = [];
  for (const it of items ?? []) {
    const d = normalize(it.description);
    if (!d) continue;
    if (ehCombustivel(d)) continue; // abastecimento não é bebida/vestuário
    for (const f of FORBIDDEN_KEYWORDS) {
      if (f.keys.some((k) => temPalavra(d, k))) {
        found.push({
          label: f.label,
          description: it.description,
          value: Number(it.value || 0) * (Number(it.qty || 1) || 1),
        });
        break; // um item conta uma única vez
      }
    }
  }
  return { hasForbidden: found.length > 0, items: found };
}

// Retorna { label, limit } da refeição correspondente ao texto (descrição do
// item ou categoria da nota), ou null quando não é uma refeição com limite
// (ex.: UBER, HOSPEDAGEM, BEBIDA LACTE). O teto sai da região da despesa.
export function foodLimitFor(text, regiaoId = REGIAO_PADRAO) {
  const d = normalize(text);
  const regra = regraDaRegiao(regiaoId);
  for (const f of FOOD_LIMITS) {
    if (f.keys.some((k) => d.includes(k))) {
      return { label: f.label, limit: regra[f.campo] };
    }
  }
  return null;
}

// Identifica a refeição de um grupo de itens da MESMA nota. Uma nota fiscal de
// alimentação costuma ter vários itens no cupom (cafés, pães, bebidas) que, no
// conjunto, formam uma única refeição.
// Prioridade: a categoria que a IA atribuiu à nota classifica a refeição
// inteira (ex.: "CAFÉ" mantém o teto de R$20 mesmo que um item diga "COMIDA").
// Sem categoria (ex.: itens digitados à mão), cai na descrição dos itens —
// nesse caso usa o MENOR teto encontrado, para não afrouxar o limite.
function mealOfGroup(group, regiaoId) {
  // 1. categoria da nota tem prioridade
  for (const it of group) {
    const info = foodLimitFor(it.meal_category, regiaoId);
    if (info) return info;
  }
  // 2. fallback pela descrição dos itens (menor teto encontrado)
  let meal = null;
  for (const it of group) {
    const info = foodLimitFor(it.description, regiaoId);
    if (info && (!meal || info.limit < meal.limit)) meal = info;
  }
  return meal;
}

// Região de um grupo de itens: o local é da NOTA, então basta o primeiro item
// que tenha o campo preenchido.
function regiaoDoGrupo(group) {
  const comLocal = group.find((it) => it.local);
  return regiaoDoLocal(comLocal?.local);
}

// Palavras que identificam HOSPEDAGEM. O reembolso NÃO tem mais teto de
// diária — hospedagem passou a ser tratada em outra plataforma —, mas a
// palavra continua reconhecida para que uma nota de hotel não seja confundida
// com refeição e caia no teto de alimentação.
const LODGING_KEYS = ["HOSPEDAGEM", "HOTEL", "POUSADA", "AIRBNB", "HOSTEL", "DIARIA"];

export function isLodging(text) {
  const d = normalize(text);
  return !!d && LODGING_KEYS.some((k) => d.includes(k));
}

// Agrupa itens por NOTA. Item sem nota vira um grupo próprio (uma linha = um
// gasto).
function groupByNote(items) {
  const groups = new Map();
  let soloId = 0;
  for (const it of items ?? []) {
    const noteKey = it.nf_ref ?? it.nf_image_id ?? null;
    const key = noteKey ?? `__solo-${soloId++}`;
    if (!groups.has(key)) groups.set(key, { isNote: noteKey != null, items: [] });
    groups.get(key).items.push(it);
  }
  return [...groups.values()];
}

// Avalia uma lista de itens e calcula o quanto a alimentação passou do limite.
// O limite (almoço/jantar R$40, café R$20) é POR REFEIÇÃO, não por linha do
// cupom: itens da mesma nota são somados e comparados ao limite uma única vez.
// Itens digitados à mão (sem nota) contam como uma refeição cada.
//   spent   -> total gasto em refeições de alimentação
//   allowed -> total que deveria ficar (cada refeição limitada ao teto)
//   over    -> excedente (spent - allowed)
export function evaluateFoodOverage(items) {
  // Agrupa itens da mesma nota (mesma refeição). Itens sem nota viram grupos
  // individuais (uma linha = uma refeição).
  const groups = groupByNote(items);

  let spent = 0;
  let allowed = 0;
  const exceeded = [];
  // Alimentação liberada por dia, para aplicar o teto diário depois dos tetos
  // por refeição. Sem data (item digitado sem preencher), fica de fora: não dá
  // para atribuir a um dia.
  const porDia = new Map();

  for (const group of groups) {
    const regiaoId = regiaoDoGrupo(group.items);
    const meal = mealOfGroup(group.items, regiaoId);
    if (!meal) continue; // grupo não é refeição (ex.: estacionamento, hospedagem)

    // total da refeição: soma todos os itens da nota (a bebida acompanha o café)
    const total = group.items.reduce(
      (s, it) => s + Number(it.value || 0) * (Number(it.qty || 1) || 1),
      0
    );
    // nº de refeições: uma nota = 1; item à mão pode repetir pela quantidade
    const meals = group.isNote ? 1 : Number(group.items[0].qty || 1) || 1;
    const limit = meal.limit * meals;

    const liberado = Math.min(total, limit);
    spent += total;
    allowed += liberado;

    const dia = group.items.find((it) => it.item_date)?.item_date || null;
    if (dia) {
      // Num dia com refeições de regiões diferentes (viagem começando em BH e
      // terminando fora, p.ex.) vale o maior teto do dia: o dia mudou de faixa
      // junto com a pessoa, e o teto menor puniria a metade que não era dele.
      const atual = porDia.get(dia) || { total: 0, regiaoId };
      porDia.set(dia, {
        total: atual.total + liberado,
        regiaoId:
          alimentacaoDia(regiaoId) > alimentacaoDia(atual.regiaoId) ? regiaoId : atual.regiaoId,
      });
    }

    if (total > limit) {
      const count = group.items.length;
      exceeded.push({
        label: meal.label,
        regiao: regraDaRegiao(regiaoId).label,
        description:
          group.isNote && count > 1
            ? `${meal.label} (${count} itens da nota)`
            : group.items[0].description || meal.label,
        meals,
        value: total,
        limit,
        over: total - limit,
      });
    }
  }

  // Teto do DIA: o que sobreviveu aos tetos por refeição ainda precisa caber
  // no diário da região (almoço + jantar + café).
  for (const [dia, { total: liberadoNoDia, regiaoId }] of porDia) {
    const tetoDia = alimentacaoDia(regiaoId);
    if (liberadoNoDia <= tetoDia + 0.001) continue;
    const excedeDia = liberadoNoDia - tetoDia;
    allowed -= excedeDia;
    exceeded.push({
      kind: "alimentacao",
      label: "Alimentação do dia",
      regiao: regraDaRegiao(regiaoId).label,
      description: `Alimentação em ${formatarDia(dia)}`,
      meals: 1,
      value: liberadoNoDia,
      limit: tetoDia,
      over: excedeDia,
    });
  }

  const over = spent - allowed;
  return { hasOverage: over > 0.001, spent, allowed, over, exceeded };
}

// dd/mm — só para o texto do aviso; a data já vem como "YYYY-MM-DD".
function formatarDia(iso) {
  const [, m, d] = String(iso).slice(0, 10).split("-");
  return m && d ? `${d}/${m}` : String(iso);
}

/**
 * O excedente que o formulário mostra e que o gestor desconta ao aprovar.
 *
 * Hoje é só alimentação: o teto de hospedagem saiu do reembolso (passou a ser
 * tratado em outra plataforma). A função continua existindo como a porta única
 * do cálculo — se outro teto voltar, entra aqui, e nenhuma tela precisa mudar.
 */
export function evaluatePolicyOverage(items) {
  const food = evaluateFoodOverage(items);
  return {
    hasOverage: food.hasOverage,
    spent: food.spent,
    allowed: food.allowed,
    over: food.over,
    exceeded: food.exceeded.map((e) => ({ kind: "alimentacao", ...e })),
    food,
  };
}

// Data de pagamento calculada a partir da data de APROVAÇÃO.
//
// Regra PROVISÓRIA do lançamento (2026-09-01), que substituiu a de 5/20/21:
//   • aprovado entre os dias 1 e 10  -> paga dia 16 do mesmo mês
//   • aprovado entre os dias 11 e 25 -> paga dia 1º do mês seguinte
//   • aprovado do dia 26 em diante   -> paga dia 16 do mês seguinte
//
// A terceira faixa não veio escrita: é a continuação das duas primeiras, que
// alternam entre os dois pagamentos do mês (dia 1º e dia 16). Confirmar com o
// Financeiro — se estiver errada, é esta linha que muda.
//
// Retorna string "YYYY-MM-DD" (data local), ou null se a entrada for inválida.
export function computePaymentDate(approvalIso) {
  const base = approvalIso ? new Date(approvalIso) : new Date();
  if (Number.isNaN(base.getTime())) return null;

  const day = base.getDate();
  let payMonth = base.getMonth(); // 0-based
  let payDay;

  if (day <= 10) {
    payDay = 16; // mesmo mês
  } else if (day <= 25) {
    payDay = 1;
    payMonth += 1; // dia 1º do mês seguinte
  } else {
    payDay = 16;
    payMonth += 1; // dia 16 do mês seguinte
  }

  // O construtor normaliza o estouro de mês (ex.: dezembro -> janeiro).
  const d = new Date(base.getFullYear(), payMonth, payDay);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
