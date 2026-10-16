// Lojinha PHD: o que a tela precisa saber de cada item. Nome, descrição,
// categoria e mês vêm do banco (pontos_itens); aqui fica o visual, pelo id do
// item. O CSS de cada visual está em src/styles/pontos.css, com a classe
// derivada do id (pts-m-ouro, pts-ins-t-botina, data-pts-tema="natal"...).
// Tudo sai por pontos; o preço vem em pontos_itens.custo.

export const CATEGORIAS = [
  { id: 'moldura', nome: 'Molduras', sub: 'Em volta da sua foto, em todo o portal.' },
  { id: 'titulo', nome: 'Títulos', sub: 'Uma insígnia abaixo do seu nome.' },
  { id: 'tema', nome: 'Temas do mês', sub: 'O portal inteiro com a cara da data. Cada tema vale só no mês dele.' },
  { id: 'mural', nome: 'Recados', sub: 'Enfeites para os recados que você deixa no mural de aniversário.' },
];

export const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Selo em cima da foto. "topo" fica sobre a cabeça, como um chapéu; "canto"
// fica fora do círculo, no alto à direita. Nenhum cobre o rosto.
export const SELO_MOLDURA = {
  'm-capacete': { img: 'capacete', pos: 'topo' },
  'm-coroa': { img: 'coroa', pos: 'topo' },
  'm-fogo': { img: 'fogo', pos: 'canto' },
  'm-natal': { img: 'arvore', pos: 'canto' },
  'm-rosa': { img: 'lacoRosa', pos: 'canto' },
  'm-azul': { img: 'bigode', pos: 'canto' },
};

/** Classes de uma moldura para somar à bolinha da pessoa. */
export function classeMoldura(id) {
  return id ? `pts-ring pts-${id}` : '';
}

// Mês de cada tema (1 a 12). Fora do mês o tema não vale, nem para quem já o
// escolheu: o portal volta ao visual padrão sozinho.
const MES_TEMA = { 'th-halloween': 10, 'th-outubro-rosa': 10, 'th-novembro-azul': 11, 'th-natal': 12 };
const mesAtual = () => new Date().getMonth() + 1;
export const temaNoMes = (id) => !!id && MES_TEMA[id] === mesAtual();

// Sustos do Halloween: só no dia 30 de outubro (pedido do usuário).
export const diaDeSustos = () => { const h = new Date(); return h.getMonth() === 9 && h.getDate() === 30; };

/** "th-outubro-rosa" -> "outubro-rosa": o valor de data-pts-tema no <html>. */
export function chaveTema(id) {
  return id ? id.replace(/^th-/, '') : '';
}

// O visual normal do portal, de graça. Não existe no banco: escolhê-lo é
// tirar o tema do mês que estiver em uso.
export const TEMA_PADRAO = {
  id: 'th-padrao', categoria: 'tema', nome: 'Padrão PHD', descricao: 'O visual de sempre do portal. De graça.', custo: 0,
};

// Amostra de cada tema na vitrine: menu, destaque, fundo e o enfeite.
export const AMOSTRA_TEMA = {
  'th-padrao': ['#ffffff', '#c35e1e', '#f8fafc'],
  'th-halloween': ['#0f0c13', '#e3a344', '#0c0a0f', 'abobora'],
  'th-outubro-rosa': ['#7a1c4b', '#ec4f95', '#fff1f7', 'lacoRosa'],
  'th-novembro-azul': ['#0e2f5c', '#2b7fd9', '#eef5fd', 'bigode'],
  'th-natal': ['#0f3b2a', '#c0392b', '#fbf7f0', 'arvore'],
};

// Ícones que a pessoa escolhe para o recado de aniversário (até 3). O id é o
// que o banco guarda (parabens_recados.icones); img é a chave em IMG.
export const ICONES_PARABENS = [
  { id: 'festa', img: 'festa', nome: 'Festa' },
  { id: 'bolo', img: 'bolo', nome: 'Bolo' },
  { id: 'balao', img: 'balao', nome: 'Balão' },
  { id: 'presente', img: 'presente', nome: 'Presente' },
  { id: 'confete', img: 'confete', nome: 'Confete' },
  { id: 'rosto-festa', img: 'rostoFesta', nome: 'Carinha de festa' },
  { id: 'brinde', img: 'brinde', nome: 'Brinde' },
  { id: 'coracao', img: 'coracao', nome: 'Coração' },
  { id: 'palmas', img: 'palmas', nome: 'Palmas' },
  { id: 'brilho', img: 'brilho', nome: 'Brilho' },
];
export const MAX_ICONES = 3;

/** Classes do recado para os enfeites que QUEM ESCREVEU usa. */
export function classesRecado(mural = []) {
  const m = mural || [];
  return [
    m.includes('mu-papel') && 'pts-rec-papel',
    m.includes('mu-cartao') && 'pts-rec-cartao',
    m.includes('mu-mao') && 'pts-rec-mao',
  ].filter(Boolean).join(' ');
}

// Nome de cada título, para quem só tem o id (outras pessoas).
export const NOME_TITULO = {
  't-botina': 'Botina suja',
  't-home': 'Home office',
  't-crono': 'Mestre do cronograma',
  't-cafe': 'Movido a café',
  't-excel': 'Rei do Excel',
  't-ia': 'IA trabalhando',
  't-presente': 'Sempre presente',
  't-livre': 'Título personalizado',
};

// Como ganhar pontos (texto da tela; a regra está no banco, em
// supabase_migration_pontos_volta.sql).
export const COMO_GANHAR = [
  { o: 'Entrar no portal', d: '1 vez por dia', p: 10 },
  { o: 'Marcar como você está', d: 'no "Como você está hoje?" da Home', p: 5 },
  { o: 'Contar o motivo', d: 'o comentário no humor do dia', p: 5 },
  { o: 'Deixar recado de aniversário', d: '1 por aniversariante, no dia', p: 10 },
  { o: '5 dias úteis seguidos', d: 'entrando no portal', p: 25 },
];
