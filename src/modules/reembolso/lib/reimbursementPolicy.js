// Regras de negócio do reembolso (valores permitidos, itens proibidos) e o
// cálculo automático da data de pagamento a partir da data de aprovação.
// Centralizado aqui para que solicitante (formulário), gestor (aprovação) e o
// PDF usem exatamente os mesmos valores.

export const POLICY = {
  // Limites por refeição (R$)
  alimentacao: [
    { label: "Almoço", value: 40 },
    { label: "Jantar", value: 40 },
    { label: "Café da manhã", value: 20 },
  ],
  // Teto de alimentação por DIA: as três refeições somadas (40 + 40 + 20).
  // Sem ele, três almoços no mesmo dia passavam, porque cada um cabia no teto
  // da refeição.
  get alimentacaoDia() {
    return this.alimentacao.reduce((s, it) => s + it.value, 0);
  },
  // Hospedagem: teto POR DIÁRIA (R$). É um limite separado do da alimentação.
  hospedagem: 285,
  // Diária cheia = o que um dia de viagem completo pode custar: a alimentação
  // do dia MAIS a hospedagem. Só de exibição — quem trava são os dois tetos
  // acima, cada um no seu grupo de itens.
  get diariaMaxima() {
    return this.alimentacaoDia + this.hospedagem;
  },
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

// Limite por refeição, casado pela descrição do item (acento-insensível).
// Café da manhã tem teto menor (R$20); almoço e jantar, R$40. As chaves
// cobrem tanto a categoria que a IA atribui (ALMOÇO, JANTA, CAFÉ, COMIDA)
// quanto palavras comuns nas descrições dos itens.
const FOOD_LIMITS = [
  { keys: ["CAFE DA MANHA", "CAFE MANHA", "CAFE"], label: "Café da manhã", limit: 20 },
  { keys: ["ALMOCO"], label: "Almoço", limit: 40 },
  { keys: ["JANTAR", "JANTA", "JANTAR"], label: "Jantar", limit: 40 },
  // refeição genérica (a IA usa "COMIDA"; também pega lanche/restaurante)
  { keys: ["COMIDA", "REFEICAO", "RESTAURANTE", "LANCHE"], label: "Refeição", limit: 30 },
];

function normalize(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toUpperCase();
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
    for (const f of FORBIDDEN_KEYWORDS) {
      if (f.keys.some((k) => d.includes(k))) {
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
// (ex.: UBER, HOSPEDAGEM, BEBIDA LACTE).
export function foodLimitFor(text) {
  const d = normalize(text);
  for (const f of FOOD_LIMITS) {
    if (f.keys.some((k) => d.includes(k))) return { label: f.label, limit: f.limit };
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
function mealOfGroup(group) {
  // 1. categoria da nota tem prioridade
  for (const it of group) {
    const info = foodLimitFor(it.meal_category);
    if (info) return info;
  }
  // 2. fallback pela descrição dos itens (menor teto encontrado)
  let meal = null;
  for (const it of group) {
    const info = foodLimitFor(it.description);
    if (info && (!meal || info.limit < meal.limit)) meal = info;
  }
  return meal;
}

// Palavras que identificam HOSPEDAGEM, pela categoria que a IA atribuiu à nota
// ou pela descrição do item.
const LODGING_KEYS = ["HOSPEDAGEM", "HOTEL", "POUSADA", "AIRBNB", "HOSTEL", "DIARIA"];

export function isLodging(text) {
  const d = normalize(text);
  return !!d && LODGING_KEYS.some((k) => d.includes(k));
}

// Agrupa itens por NOTA. Item sem nota vira um grupo próprio (uma linha = um
// gasto). Compartilhado pelas duas avaliações (alimentação e hospedagem).
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

const somaGrupo = (grupo) =>
  grupo.reduce((s, it) => s + Number(it.value || 0) * (Number(it.qty || 1) || 1), 0);

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
    const meal = mealOfGroup(group.items);
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
    if (dia) porDia.set(dia, (porDia.get(dia) || 0) + liberado);

    if (total > limit) {
      const count = group.items.length;
      exceeded.push({
        label: meal.label,
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
  // nos R$ 100 diários (almoço + jantar + café).
  for (const [dia, liberadoNoDia] of porDia) {
    if (liberadoNoDia <= POLICY.alimentacaoDia + 0.001) continue;
    const excedeDia = liberadoNoDia - POLICY.alimentacaoDia;
    allowed -= excedeDia;
    exceeded.push({
      kind: "alimentacao",
      label: "Alimentação do dia",
      description: `Alimentação em ${formatarDia(dia)}`,
      meals: 1,
      value: liberadoNoDia,
      limit: POLICY.alimentacaoDia,
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
 * Hospedagem acima do teto por diária (POLICY.hospedagem).
 *
 * Contado por NOTA, não por dia: a nota do hotel cobre várias diárias e traz a
 * quantidade — o limite é R$ 285 × diárias. Fosse por dia, uma nota de 3 noites
 * lançada num dia só apareceria como excedente que não existe.
 */
export function evaluateLodgingOverage(items) {
  let spent = 0;
  let allowed = 0;
  const exceeded = [];

  for (const group of groupByNote(items)) {
    const ehHospedagem = group.items.some(
      (it) => isLodging(it.meal_category) || isLodging(it.description)
    );
    if (!ehHospedagem) continue;

    const total = somaGrupo(group.items);
    const diarias = Math.max(
      1,
      group.items.reduce((s, it) => s + (Number(it.qty || 1) || 1), 0)
    );
    const limit = POLICY.hospedagem * diarias;

    spent += total;
    allowed += Math.min(total, limit);
    if (total > limit) {
      exceeded.push({
        kind: "hospedagem",
        label: "Hospedagem",
        description: group.items[0].description || "Hospedagem",
        meals: diarias,
        value: total,
        limit,
        over: total - limit,
      });
    }
  }

  const over = spent - allowed;
  return { hasOverage: over > 0.001, spent, allowed, over, exceeded };
}

/**
 * Alimentação + hospedagem numa conta só — é o que o formulário mostra e o que
 * o gestor desconta ao aprovar. Os dois tetos são independentes: um dia inteiro
 * de viagem pode chegar a R$ 100 de alimentação MAIS R$ 285 de hospedagem.
 */
export function evaluatePolicyOverage(items) {
  const food = evaluateFoodOverage(items);
  const lodging = evaluateLodgingOverage(items);
  const over = food.over + lodging.over;
  return {
    hasOverage: over > 0.001,
    spent: food.spent + lodging.spent,
    allowed: food.allowed + lodging.allowed,
    over,
    exceeded: [
      ...food.exceeded.map((e) => ({ kind: "alimentacao", ...e })),
      ...lodging.exceeded,
    ],
    food,
    lodging,
  };
}

// Data de pagamento calculada a partir da data de APROVAÇÃO:
//   • aprovado entre os dias 1 e 5  -> paga dia 15 do mesmo mês
//   • aprovado entre os dias 6 e 20 -> paga dia 1º do mês seguinte
//   • aprovado entre os dias 21 e 31 -> paga dia 15 do mês seguinte
// Retorna string "YYYY-MM-DD" (data local), ou null se a entrada for inválida.
export function computePaymentDate(approvalIso) {
  const base = approvalIso ? new Date(approvalIso) : new Date();
  if (Number.isNaN(base.getTime())) return null;

  const day = base.getDate();
  let payMonth = base.getMonth(); // 0-based
  let payDay;

  if (day <= 5) {
    payDay = 15; // mesmo mês
  } else if (day <= 20) {
    payDay = 1;
    payMonth += 1; // dia 1º do mês seguinte
  } else {
    payDay = 15;
    payMonth += 1; // dia 15 do mês seguinte
  }

  // O construtor normaliza o estouro de mês (ex.: dezembro -> janeiro).
  const d = new Date(base.getFullYear(), payMonth, payDay);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
