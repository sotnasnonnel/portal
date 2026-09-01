import { Boxes, Lightbulb, Rocket, Wrench } from 'lucide-react';

/**
 * Catálogo do módulo Programas — os programas internos da PHD.
 * Fonte: referencia/Módulo - Programas.xlsx (abas "Campo de Ideias" e "Alavanca").
 *
 * VOCABULÁRIO (a planilha usa "iniciativa" com dois sentidos; aqui eles têm
 * nomes distintos para o código não confundir):
 * - PROGRAMA  → Campo de Ideias | Alavanca PHD.
 * - FORMA     → dentro do Campo de Ideias, os dois cards: `ideia` (o que ainda
 *               não existe) e `iniciativa` (o que alguém já está construindo).
 *               É a coluna `tipo` da tabela programas_ideias.
 * - INDICAÇÃO → o registro da Alavanca. A planilha chama de "iniciativa"
 *               também, mas é outro objeto e outra tabela.
 *
 * "Tipo" da planilha (uso individual / coletivo / venda de produto) virou
 * CATEGORIA, porque `tipo` já é a forma. É por ela que o kanban se organiza.
 */

/**
 * Trava de lançamento, mesma mecânica do Administrativo (ADM_EM_BREVE).
 * Enquanto `true`, o módulo aparece como "Em breve" para a empresa: o card da
 * Home fica travado e a rota /programas devolve para lá.
 *
 * LANÇADO em 2026-08-28: aberto a todos os logados, como o Controle de Horas.
 * A lista abaixo deixa de valer com a trava desligada — fica porque é o que
 * volta a funcionar se alguém precisar fechar o módulo de novo.
 *
 * A lista é por e-mail, e não por papel, de propósito: o papel de comercial é
 * dado a mais gente, e isso não pode destravar o módulo sem querer.
 */
export const PROGRAMAS_EM_BREVE = false;

export const PROGRAMAS_LIBERADOS = [
  'marcus.guimaraes@phdengenharia.eng.br',
  'andre.guimaraes@phdengenharia.eng.br',
  'lennon.santos@phdengenharia.eng.br',
];

export const podeAcessarProgramas = (user) => !PROGRAMAS_EM_BREVE
  || PROGRAMAS_LIBERADOS.includes((user?.email || '').trim().toLowerCase());

/** Time comercial: único papel que avalia indicação da Alavanca. */
export const ehComercial = (modules) => modules?.programas === 'comercial' || modules?.programas === 'admin';
export const ehAdminProgramas = (modules) => modules?.programas === 'admin';

// ============================ Campo de Ideias ============================

export const FORMAS = [
  {
    slug: 'ideia',
    label: 'Ideia',
    icon: Lightbulb,
    desc: 'Algo que ainda não existe e você acha que a PHD deveria ter.',
    ajuda: 'Aberto a todos os colaboradores. Todos os campos são obrigatórios.',
  },
  {
    slug: 'iniciativa',
    label: 'Iniciativa',
    icon: Wrench,
    desc: 'Algo que você já está construindo — para uso próprio ou em projeto.',
    ajuda: 'Para o que já saiu do papel, sem passar pela equipe de Inovação. Link e observações são opcionais.',
  },
];

export const getForma = (slug) => FORMAS.find((f) => f.slug === slug);

/** Setores da iniciativa (seletor da planilha, na ordem em que ela lista). */
export const SETORES = [
  'ADM', 'RH', 'DP', 'MKT', 'Financeiro', 'Comercial', 'Contratos',
  'Excelência operacional', 'TI', 'Operação', 'Diretoria', 'Construtibilidade',
  'Outro',
];

/**
 * Cor de cada setor — a legenda de "cards coloridos para identificar os
 * setores" que a planilha pede no kanban (aba Campo de Ideias, B35).
 *
 * A cor é APOIO, nunca a informação sozinha: o nome do setor vem escrito no
 * rodapé de todo cartão e na legenda. Com 13 setores, alguns pares ficam
 * próximos demais para serem distinguidos só pelo tom — por isso o nome
 * escrito não é decoração, é o que garante a leitura.
 *
 * Tons gerados em OKLCH com luminosidade e croma controlados (validados par a
 * par com o validador de paletas): trocar um valor no olho quebra a separação.
 */
export const COR_SETOR = {
  ADM: '#865900',
  RH: '#08b0fc',
  DP: '#ba480c',
  MKT: '#00b0bf',
  Financeiro: '#9f2347',
  Comercial: '#00c7a3',
  Contratos: '#9f3c8a',
  'Excelência operacional': '#58ac48',
  TI: '#905dc6',
  Operação: '#aca70a',
  // Os dois últimos entraram depois: os tons foram escolhidos nas maiores
  // lacunas de matiz que sobraram (≈4° e ≈144°), não no olho.
  Diretoria: '#bf3527',
  Construtibilidade: '#14a34d',
  Outro: '#647ce5',
};

export const corDoSetor = (setor) => COR_SETOR[setor] || '#94a3b8';

/**
 * Categoria = o "Tipo" da planilha. São as três colunas do kanban do painel,
 * então a ordem aqui é a ordem do quadro.
 */
export const CATEGORIAS = [
  { valor: 'individual', label: 'Uso em atuação individual' },
  { valor: 'coletiva', label: 'Uso em atuação coletiva' },
  { valor: 'venda', label: 'Venda de produto' },
];

export const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.label]));

/** Situação: o ciclo de vida da iniciativa, na ordem em que avança. */
export const SITUACOES = [
  { valor: 'idealizado', label: 'Idealizado' },
  { valor: 'iniciado', label: 'Iniciado' },
  { valor: 'desenvolvimento', label: 'Em desenvolvimento' },
  { valor: 'concluido', label: 'Concluído' },
];

export const SITUACAO_LABEL = Object.fromEntries(SITUACOES.map((s) => [s.valor, s.label]));

// ==================== Iniciativas em uso (Inovação) ====================

/**
 * Status do pedido de uma iniciativa para uma obra, na ordem em que andam.
 * "Implantado" é o fim de verdade: aprovar é a decisão, implantar é a entrega —
 * juntar os dois esconderia a fila do que foi aprovado e ainda não rodou.
 */
export const STATUS_PEDIDO = [
  { valor: 'recebido', label: 'Recebido', tom: 'tom-neutro' },
  { valor: 'em_analise', label: 'Em análise', tom: 'tom-andamento' },
  { valor: 'aprovado', label: 'Aprovado', tom: 'tom-destaque' },
  { valor: 'implantado', label: 'Implantado', tom: 'tom-ok' },
  { valor: 'recusado', label: 'Recusado', tom: 'tom-recusado' },
];

export const STATUS_PEDIDO_LABEL = Object.fromEntries(STATUS_PEDIDO.map((s) => [s.valor, s.label]));
export const tomDoPedido = (valor) =>
  STATUS_PEDIDO.find((s) => s.valor === valor)?.tom || 'tom-neutro';

// ============================ Alavanca PHD ============================

/**
 * Status da indicação no funil do comercial. Os quatro cards do painel
 * ("elegível", "evoluída", "concluída") derivam daqui e da elegibilidade —
 * ver lib/indicadoresAlavanca.js, que é onde a contagem mora.
 */
export const STATUS_ALAVANCA = [
  { valor: 'em_analise', label: 'Em análise' },
  { valor: 'nao_elegivel', label: 'Não elegível' },
  { valor: 'em_evolucao', label: 'Em evolução' },
  { valor: 'concluida', label: 'Concluída' },
  // Encerrada é a oportunidade que NÃO FOI ADIANTE — cliente sem demanda, sem
  // retorno, já em processo de venda, ou que andou um tempo e parou. Diferente
  // de "não elegível", que é a checagem contra a base dizendo que a indicação
  // não valia desde o início. Como a não elegível, é saída do funil, não etapa
  // dele: por isso não conta como "evoluiu" (ver lib/indicadores.js).
  //
  // Chamava-se "cancelada", e o nome atrapalhava: sugeria alguém desistindo por
  // decisão, quando a maioria só parou. As duas viraram uma só em 2026-08-31
  // (supabase/supabase_migration_alavanca_encerrada.sql).
  { valor: 'encerrada', label: 'Encerrada' },
];

export const STATUS_ALAVANCA_LABEL = Object.fromEntries(STATUS_ALAVANCA.map((s) => [s.valor, s.label]));

export const ELEGIBILIDADE_LABEL = {
  pendente: 'Verificação pendente',
  em_analise: 'Depende do comercial',
  elegivel: 'Elegível',
  nao_elegivel: 'Não elegível',
};

/**
 * Premiação: 0,5% do valor do contrato, teto de R$ 10.000 (regra 6 do programa).
 * Fica aqui, e não na tela, porque a mesma conta aparece no formulário de
 * conclusão e no mapa de vencedores.
 */
export const PREMIO_PERCENTUAL = 0.005;
export const PREMIO_TETO = 10000;

export const calcularPremio = (valorContrato) => {
  const v = Number(valorContrato);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.min(v * PREMIO_PERCENTUAL, PREMIO_TETO);
};

// ============================ Programas (catálogo) ============================

export const PROGRAMAS = [
  {
    slug: 'ideias',
    label: 'Campo de Ideias',
    icon: Lightbulb,
    desc: 'Registre uma ideia nova ou cadastre o que você já está construindo.',
    href: '/programas/ideias',
    cta: 'Registrar',
  },
  {
    // Não é programa de participação como os outros dois: é consulta ao que a
    // empresa já tem. Entra no mesmo modal porque a pergunta de quem abre
    // "Programas" é a mesma — "o que existe por aqui?".
    slug: 'iniciativas',
    label: 'Iniciativas em uso',
    icon: Boxes,
    desc: 'Veja as soluções que a PHD já tem e em quais obras estão aplicadas.',
    href: '/programas/iniciativas',
    cta: 'Ver iniciativas',
  },
  {
    slug: 'alavanca',
    label: 'Alavanca PHD',
    icon: Rocket,
    desc: 'Indique uma oportunidade comercial e concorra à premiação do programa.',
    href: '/programas/alavanca',
    cta: 'Minhas indicações',
  },
];
