/**
 * Torre de controle: chamados do Administrativo e etapas de Mobilização num
 * quadro só.
 *
 * É o mesmo pessoal que toca os dois, e hoje precisa abrir duas telas para
 * saber o que está aberto e o que venceu. A torre responde isso de uma vez.
 *
 * A peça que faz a junção é `statusUnificado`: um vocabulário comum para onde
 * os dois mundos traduzem. Nem o Adm nem a Mobilização mudam os status deles
 * para a torre existir — traduzir custa uma função pura, e alinhar os dois
 * custaria migração nos dois módulos.
 *
 * Lógica pura, testável.
 */

export const COLUNAS_TORRE = [
  { chave: 'a_fazer', titulo: 'A fazer' },
  { chave: 'em_andamento', titulo: 'Em andamento' },
  { chave: 'aguardando', titulo: 'Aguardando terceiro' },
  { chave: 'concluido', titulo: 'Concluído' },
];

/**
 * Status do Administrativo → vocabulário da torre.
 *
 * "Aguardando aprovação" e "aguardando solicitante" caem juntos em
 * `aguardando`: dos dois lados a bola está com outra pessoa, e é isso que quem
 * olha a torre precisa saber. Reprovado e cancelado entram em `concluido` pela
 * mesma razão do Adm: para quem pediu, um pedido negado está tão acabado
 * quanto um atendido.
 */
const TORRE_ADM = {
  aguardando_aprovacao: 'aguardando',
  aberto: 'a_fazer',
  em_atendimento: 'em_andamento',
  aguardando_solicitante: 'aguardando',
  fechado: 'concluido',
  reprovado: 'concluido',
  cancelado: 'concluido',
};

/** Status da Mobilização → vocabulário da torre. */
const TORRE_MOB = {
  pendente: 'a_fazer',
  em_andamento: 'em_andamento',
  concluida: 'concluido',
  dispensada: 'concluido',
};

/**
 * @returns {string|null} null quando o status não tem tradução. Nunca um chute:
 *   um status novo aparecendo como "a fazer" faria a torre mentir em silêncio.
 *   O teste deste arquivo cobre TODOS os status dos dois módulos, então um
 *   status novo quebra o teste antes de chegar na tela.
 */
export function statusUnificado(origem, status) {
  if (origem === 'adm') return TORRE_ADM[status] || null;
  if (origem === 'mobilizacao') return TORRE_MOB[status] || null;
  return null;
}

export function agruparTorre(itens = []) {
  const traduzidos = itens.map((i) => ({ ...i, coluna: statusUnificado(i.origem, i.status) }));
  return COLUNAS_TORRE.map((col) => ({
    ...col,
    itens: traduzidos.filter((i) => i.coluna === col.chave),
  }));
}

/** Para onde o cartão leva. A torre é só leitura; agir é no módulo de origem. */
export function linkDoItem(item) {
  if (item?.origem === 'adm') return `/administrativo/chamado/${item.id}`;
  if (item?.origem === 'mobilizacao') return `/mobilizacao/processo/${item.processo_id}`;
  return null;
}

export const ROTULO_ORIGEM = { adm: 'Chamado', mobilizacao: 'Mobilização' };

/**
 * Filtros da torre. Mesma convenção do resto do portal: vazio é "todos".
 */
/**
 * Rotulo de quem nao tem responsavel de contrato conhecido.
 *
 * Existe como OPCAO do filtro, e nao como linha escondida: sao poucos itens
 * (chamado sem centro de custo preenchido, processo cujo gerente a planilha nao
 * registrou), e some-los da tela faria as contas do quadro nao fecharem com as
 * do resto do portal. Aparecendo, viram uma lista curta de coisa a arrumar.
 */
export const SEM_RESPONSAVEL = '(nao identificado)';

export const responsavelDoItem = (i) => i?.responsavel_contrato || SEM_RESPONSAVEL;

export function filtrarTorre(itens = [], f = {}) {
  return itens.filter((i) => {
    if (f.origem && i.origem !== f.origem) return false;
    if (f.responsavelId === 'sem' && i.responsavel_id) return false;
    if (f.responsavelId && f.responsavelId !== 'sem' && i.responsavel_id !== f.responsavelId) return false;
    // Filtra pelo NOME do responsavel pelo contrato, e nao mais pelo centro de
    // custo cru. O CC nunca funcionou como filtro porque cada lado guarda um
    // formato: o Adm escrevia "Equipe LUCAS FERRAZ GONCALVES" e a Mobilizacao
    // "ATNI-CT01", entao escolher uma pessoa trazia metade do trabalho dela.
    // O de-para (torre_responsavel_de_para) resolve os dois para o mesmo nome.
    if (f.responsavel && responsavelDoItem(i) !== f.responsavel) return false;
    if (f.atrasados && !estaVencido(i)) return false;
    return true;
  });
}

/**
 * Vencido na torre.
 *
 * Os dois lados guardam prazo de formas diferentes — o Adm em `timestamptz`, a
 * Mobilização em `date` — e a view já normaliza para data pura. A comparação é
 * feita como TEXTO, não como Date: 'AAAA-MM-DD' ordena igual cronologicamente,
 * e converter para Date reintroduziria o erro de fuso que faria um prazo de
 * hoje aparecer vencido desde as 21h de ontem.
 */
export function estaVencido(item, hoje) {
  if (!item?.prazo) return false;
  if (statusUnificado(item.origem, item.status) === 'concluido') return false;
  const ref = hoje || new Date().toISOString().slice(0, 10);
  return String(item.prazo).slice(0, 10) < ref;
}

export function opcoesDaTorre(itens = []) {
  const responsaveis = new Map();
  const contratos = new Set();
  for (const i of itens) {
    if (i.responsavel_id) responsaveis.set(i.responsavel_id, i.responsavelNome || 'Sem nome');
    contratos.add(responsavelDoItem(i));
  }

  // "(nao identificado)" vai para o FIM, sempre. Ordenado junto com os nomes ele
  // cairia no meio da lista pelo parentese, e quem procura uma pessoa tropecaria
  // nele antes de achar quem procura.
  const nomes = [...contratos].filter((c) => c !== SEM_RESPONSAVEL)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (contratos.has(SEM_RESPONSAVEL)) nomes.push(SEM_RESPONSAVEL);

  return {
    responsaveis: [...responsaveis].map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    responsaveisContrato: nomes,
  };
}
