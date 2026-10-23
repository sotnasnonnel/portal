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

// Sustos do Halloween: a temporada vai de 20 a 30 de outubro (era só o dia 30;
// o usuário pediu em 19/10/2026 que começasse no dia seguinte). A data não é
// dita em lugar nenhum da tela: a graça é não saber quando vem.
const SUSTOS_DE = 20;
const SUSTOS_ATE = 30;
export const diaDeSustos = () => {
  const h = new Date();
  return h.getMonth() === 9 && h.getDate() >= SUSTOS_DE && h.getDate() <= SUSTOS_ATE;
};

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

// Títulos por grupo, como a vitrine mostra: [id, nome, frase]. A frase é a
// descrição da insígnia: aparece na placa grande e na dica ao passar o mouse
// na mini. Nome e frase iguais aos do banco (pontos_itens.nome/descricao);
// os quatro grupos novos vieram do usuário em 23/10/2026
// (supabase_migration_pontos_titulos_novos.sql).
export const GRUPOS_TITULO = [
  {
    nome: 'Clássicos da PHD',
    titulos: [
      ['t-botina', 'Botina suja', 'Se a botina está limpa, não foi pra obra.'],
      ['t-home', 'Home office', 'Câmera desligada, produtividade ligada.'],
      ['t-crono', 'Mestre do cronograma', 'O Gantt obedece, a equipe agradece.'],
      ['t-cafe', 'Movido a café', 'Primeiro o café, depois o cronograma.'],
      ['t-monster', 'Movido a Monster', 'Uma lata e o dia rende o dobro.'],
      ['t-equino', 'Equino', 'Trabalha que nem um cavalo, e nem reclama.'],
      ['t-excel', 'Rei do Excel', 'PROCV no café da manhã.'],
      ['t-ia', 'IA trabalhando', 'Pode deixar que a IA faz. Ele só revisa.'],
      ['t-presente', 'Sempre presente', 'Falta? Só se for de café.'],
      ['t-livre', 'Título personalizado', ''],
    ],
  },
  {
    nome: 'Engenharia, planejamento e gestão',
    titulos: [
      ['t-domador', 'Domador de cronogramas', 'Faz até o caminho crítico obedecer.'],
      ['t-caminho-critico', 'Senhor do caminho crítico', 'Uma atividade atrasou? Ele já sabe.'],
      ['t-pull-planning', 'Mestre do Pull Planning', 'Puxa o plano e a responsabilidade.'],
      ['t-restricoes', 'Caçador de restrições', 'Nenhuma pendência passa despercebida.'],
      ['t-linha-base', 'Guardião da linha de base', 'A LB é sagrada.'],
      ['t-replan', 'Rei do replan', 'Replanejar é uma arte.'],
      ['t-power-bi', 'Mago do Power BI', 'Transforma dados em decisões.'],
      ['t-curva-s', 'Senhor das curvas S', 'Previsto, realizado e uma dose de desespero.'],
      ['t-ppc', 'Fiscal do PPC', 'Prometeu? Agora tem que cumprir.'],
      ['t-monte-carlo', 'Oráculo do Monte Carlo', 'Prevendo atrasos antes de acontecerem.'],
    ],
  },
  {
    nome: 'Humor corporativo e cotidiano da PHD',
    titulos: [
      ['t-clt-premium', 'CLT premium', 'Trabalha como dono, recebe como funcionário.'],
      ['t-reuniao', 'Só mais uma reunião', 'A agenda é seu habitat natural.'],
      ['t-teams', 'Sobrevivente do Teams', 'Essa reunião poderia ser um e-mail.'],
      ['t-incendios', 'Apagador de incêndios', 'Resolve problemas que nem criou.'],
      ['t-deixa-comigo', 'Deixa comigo', 'Aceita a missão antes de saber o tamanho.'],
      ['t-cafe-desespero', 'Café com desespero', 'Movido a cafeína e prazo apertado.'],
      ['t-sextou', 'Sextou? Ainda não!', 'O cronograma não conhece finais de semana.'],
      ['t-ultimo', 'Último a sair', 'A luz apaga, mas ele continua.'],
      ['t-diretoria', 'Modo diretoria', 'Uma apresentação e três perguntas difíceis.'],
      ['t-ctrl-cv', 'Ctrl+C, Ctrl+V', 'Produtividade em sua forma mais pura.'],
    ],
  },
  {
    nome: 'Campo, obras e engenharia raiz',
    titulos: [
      ['t-raiz', 'Engenheiro raiz', 'Capacete na cabeça e poeira na alma.'],
      ['t-botina-ouro', 'Botina de ouro', 'Onde tem obra, tem pegada.'],
      ['t-churrasqueira', 'Fiscal de churrasqueira', 'De olho até no ponto da solda.'],
      ['t-rdo', 'Senhor do RDO', 'Se não registrou, não aconteceu.'],
      ['t-desvios', 'Caçador de desvios', 'Encontra problemas até onde não existem.'],
      ['t-capacete', 'Capacete amassado', 'Experiência que não se aprende em sala.'],
      ['t-prancheta', 'Dono da prancheta', 'Nada passa sem sua conferência.'],
      ['t-parada', 'Guerreiro da parada', '45 dias que parecem 450.'],
    ],
  },
  {
    nome: 'Personalidade e comportamento',
    titulos: [
      ['t-resolvedor', 'O resolvedor', 'Problema dado, problema resolvido.'],
      ['t-caos', 'Embaixador do caos', 'Mantém a calma quando tudo desanda.'],
      ['t-lenda', 'Lenda da PHD', 'Todo mundo já ouviu falar.'],
      ['t-memes', 'Mestre dos memes', 'O humor também faz parte da entrega.'],
      ['t-prazo', 'Inimigo do prazo', 'Sempre correndo contra o relógio.'],
      ['t-multitarefas', 'Multitarefas', 'Dez demandas, duas mãos e um café.'],
      ['t-excelencia', 'Excelência em pessoa', 'Entrega resultado sem perder a parceria.'],
      ['t-fora-curva', 'Fora da curva', 'Não segue a média. Supera.'],
    ],
  },
];

const TODOS_TITULOS = GRUPOS_TITULO.flatMap((g) => g.titulos.map(([id, nome, frase]) => ({ id, nome, frase, grupo: g.nome })));

// Nome e frase de cada título, para quem só tem o id (outras pessoas).
export const NOME_TITULO = Object.fromEntries(TODOS_TITULOS.map((t) => [t.id, t.nome]));
export const FRASE_TITULO = Object.fromEntries(TODOS_TITULOS.filter((t) => t.frase).map((t) => [t.id, t.frase]));
export const GRUPO_TITULO = Object.fromEntries(TODOS_TITULOS.map((t) => [t.id, t.grupo]));

// Como ganhar pontos (texto da tela; a regra está no banco, em
// supabase_migration_pontos_volta.sql e supabase_migration_pontos_feed.sql).
export const COMO_GANHAR = [
  { o: 'Entrar no portal', d: '1 vez por dia', p: 10 },
  { o: 'Marcar como você está', d: 'no "Como você está hoje?" da Home', p: 5 },
  { o: 'Contar o motivo', d: 'o comentário no humor do dia', p: 5 },
  { o: 'Deixar recado de aniversário', d: '1 por aniversariante, no dia', p: 10 },
  { o: 'Postar no feed', d: 'o primeiro post do dia', p: 25 },
  { o: '5 dias úteis seguidos', d: 'entrando no portal', p: 25 },
];
