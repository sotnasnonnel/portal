// Passo a passo VIVO na tela (components/Tour): escurece tudo, recorta um
// buraco em volta do elemento onde clicar e explica num balão. Aqui ficam os
// dados de cada tutorial e as contas puras do motor, sem React nem DOM
// (testável com `node --test`).
//
// O alvo de cada passo é um atributo na tela: `data-tour="<alvo>"`. Quem muda
// o desenho de uma tela com tutorial precisa manter o atributo no lugar, senão
// o passo cai no balão centralizado (obrigatório) ou é pulado (opcional).
//
// Esquema de um passo:
//   id        único no tutorial
//   rota      pathname do HashRouter onde o passo vive ('/home', '/feed')
//   alvo      valor do data-tour
//   titulo, texto
//   acao      'clique': sem "Próximo"; anda quando a pessoa clica no destaque
//   opcional  o alvo pode não existir (feed sem post): some sozinho
//   livre     não bloqueia a tela em volta e escurece menos (dentro do modal
//             de publicar, onde a lista do "@" e os emojis abrem fora do buraco)
//   seSumir   o alvo existia e sumiu (fecharam o modal): volta para este passo
import { COMO_GANHAR } from './pontos.js';

export const TUTORIAL_FEED = 'feed';

// Os pontos do post vêm da mesma lista do "Como ganhar pontos" (como em
// BoasVindasFeed e config/novidades.js): se o valor mudar na loja, o
// tutorial acompanha. Sem o item, a frase dos pontos sai.
const PONTOS_POST = COMO_GANHAR.find((g) => g.o === 'Postar no feed')?.p;

export const TUTORIAIS = {
  [TUTORIAL_FEED]: {
    nome: 'Tutorial do Feed',
    passos: [
      {
        id: 'home-feed', rota: '/home', alvo: 'home-feed', acao: 'clique',
        titulo: 'O Feed PHD mora aqui',
        texto: 'Este ícone abre o feed da empresa. Quando chegar post novo, um número aparece em cima dele. Clique para entrar.',
      },
      {
        // Opcional: num feed ainda sem post não há o que curtir.
        id: 'feed-post', rota: '/feed', alvo: 'post-acoes', opcional: true,
        titulo: 'Curta e comente',
        texto: 'O coração curte o post e o balão abre os comentários, onde dá para responder também. Nos três pontinhos do canto ficam o Denunciar e, nos seus posts, Editar e Apagar.',
      },
      {
        id: 'feed-regras', rota: '/feed', alvo: 'feed-regras',
        titulo: 'Regras sempre à mão',
        texto: 'As regras de convivência que você aceitou ficam neste ícone, para consultar quando quiser.',
      },
      {
        id: 'feed-chamada', rota: '/feed', alvo: 'feed-chamada', acao: 'clique',
        titulo: 'Agora é a sua vez',
        texto: 'Clique em “Sobre o que você quer falar?” para abrir a caixa de publicação.',
      },
      // Daqui para baixo o alvo mora no modal de publicar: fechou o modal, o
      // tutorial volta para a chamada que o abre.
      {
        id: 'post-texto', rota: '/feed', alvo: 'post-texto', livre: true, seSumir: 'feed-chamada',
        titulo: 'Escreva o seu post',
        texto: 'Conte o que está acontecendo na obra, no projeto ou na sua vida. Digite @ e o começo de um nome para marcar um colega: ele recebe o aviso no sino.',
      },
      {
        id: 'post-ferramentas', rota: '/feed', alvo: 'post-ferramentas', livre: true, seSumir: 'feed-chamada',
        titulo: 'Fotos, vídeo e emojis',
        texto: 'Anexe até 5 arquivos — fotos e um vídeo (até 50 MB e 3 min) — e escolha emojis aqui. Foto e vídeo de obra, só com EPI e sem situação de risco.',
      },
      {
        id: 'post-publicar', rota: '/feed', alvo: 'post-publicar', acao: 'clique', livre: true, seSumir: 'feed-chamada',
        titulo: 'Publique',
        texto: `Quando terminar, clique em Publicar. O post vai para a empresa toda com o seu nome e foto.${PONTOS_POST ? ` O primeiro post do dia vale +${PONTOS_POST} pontos.` : ''}`,
      },
    ],
  },
};

// ---- Navegação entre passos -------------------------------------------------

/** Os passos de um tutorial ([] se o id não existe). */
export const passosDe = (tourId) => TUTORIAIS[tourId]?.passos ?? [];

/** Posição do passo no tutorial, ou -1. */
export const indicePasso = (tourId, passoId) => passosDe(tourId).findIndex((p) => p.id === passoId);

/** O passo pelo id, ou null. */
export const passoDe = (tourId, passoId) => passosDe(tourId).find((p) => p.id === passoId) ?? null;

/** Id do passo seguinte, ou null no último (o tutorial acaba). */
export function proximoPasso(tourId, passoId) {
  const lista = passosDe(tourId);
  const i = lista.findIndex((p) => p.id === passoId);
  return i >= 0 && i < lista.length - 1 ? lista[i + 1].id : null;
}

/**
 * Para onde o "Voltar" leva, ou null quando não há volta. Só volta dentro da
 * mesma rota (voltar para a Home seria desfazer a navegação) e nunca para um
 * passo de clique: o clique já aconteceu (o modal está aberto, a página
 * mudou), e repetir o pedido não faria sentido. Passos que o motor pulou
 * sozinhos (opcional sem alvo) ficam de fora: voltar para eles só os faria
 * pular de novo.
 */
export function passoAnterior(tourId, passoId, pulados = []) {
  const lista = passosDe(tourId);
  const i = lista.findIndex((p) => p.id === passoId);
  if (i <= 0) return null;
  for (let j = i - 1; j >= 0; j -= 1) {
    const p = lista[j];
    if (pulados.includes(p.id)) continue;
    if (p.rota !== lista[i].rota || p.acao === 'clique') return null;
    return p.id;
  }
  return null;
}

/**
 * Os passos de clique que um clique pode concluir agora: o atual (se for de
 * clique) e os de clique MAIS ADIANTE na mesma rota. Assim, quem publica
 * direto do passo "Escreva o seu post", sem passar pelo "Próximo", conclui o
 * passo do Publicar em vez de cair de volta na chamada quando o modal fecha.
 */
export function cliquesAdiante(tourId, passoId) {
  const lista = passosDe(tourId);
  const i = lista.findIndex((p) => p.id === passoId);
  if (i < 0) return [];
  const rota = lista[i].rota;
  return lista.slice(i).filter((p) => p.acao === 'clique' && p.rota === rota).map((p) => p.id);
}

/**
 * "3 de 7", contado a partir do passo onde o tutorial começou: quem entra
 * pelo botão de ajuda do feed (começa no 2º passo) vê "1 de 6". Se um
 * `seSumir` levar para antes do começo, a conta passa a valer dali. Os
 * opcionais que o motor pulou (`pulados`) saem da conta: a pessoa nunca os viu.
 */
export function contagemPasso(tourId, passoId, inicioId = passoId, pulados = []) {
  const todos = passosDe(tourId);
  const i = todos.findIndex((p) => p.id === passoId);
  if (i < 0) return { atual: 0, total: 0 };
  const inicio = Math.min(Math.max(0, todos.findIndex((p) => p.id === inicioId)), i);
  const conta = todos.slice(inicio).filter((p) => p.id === passoId || !pulados.includes(p.id));
  return { atual: conta.findIndex((p) => p.id === passoId) + 1, total: conta.length };
}

/** Linha pequena do topo do balão: "Tutorial do Feed · 3 de 7". */
export function rotuloContagem(tourId, passoId, inicioId, pulados = []) {
  const { atual, total } = contagemPasso(tourId, passoId, inicioId, pulados);
  const nome = TUTORIAIS[tourId]?.nome ?? 'Tutorial';
  return total > 0 ? `${nome} · ${atual} de ${total}` : nome;
}

/**
 * O que fazer com o passo na rota atual:
 *   'mostrar'  a rota é a do passo
 *   'esperar'  ainda na rota de onde o passo começou (o clique na Home
 *              acabou de mandar para o /feed, que é carregado sob demanda)
 *   'encerrar' foi para uma terceira rota, ou saiu da rota do passo depois de
 *              ter chegado nela
 * `origem` é o pathname de quando o passo começou; `chegou`, se a rota do
 * passo já bateu alguma vez desde então.
 */
export function decidirRota({ rota, origem, chegou = false, pathname }) {
  if (pathname === rota) return 'mostrar';
  if (chegou) return 'encerrar';
  return pathname === origem ? 'esperar' : 'encerrar';
}

/** Erros de desenho de um tutorial ([] = ok). Os testes passam todos por aqui. */
export function validarTutorial(t) {
  const erros = [];
  if (!t || typeof t !== 'object') return ['tutorial vazio'];
  if (!String(t.nome || '').trim()) erros.push('tutorial sem nome');
  const passos = Array.isArray(t.passos) ? t.passos : [];
  if (passos.length === 0) erros.push('tutorial sem passos');
  const vistos = new Set();
  passos.forEach((p, i) => {
    const quem = p?.id ? `passo "${p.id}"` : `passo ${i + 1}`;
    if (!p?.id) erros.push(`${quem}: sem id`);
    else if (vistos.has(p.id)) erros.push(`${quem}: id repetido`);
    else vistos.add(p.id);
    if (!String(p?.rota || '').startsWith('/')) erros.push(`${quem}: rota deve começar com "/"`);
    if (!String(p?.alvo || '').trim()) erros.push(`${quem}: sem alvo`);
    if (!String(p?.titulo || '').trim()) erros.push(`${quem}: sem título`);
    if (!String(p?.texto || '').trim()) erros.push(`${quem}: sem texto`);
    if (p?.acao !== undefined && p.acao !== 'clique') erros.push(`${quem}: ação desconhecida "${p.acao}"`);
    if (p?.seSumir !== undefined) {
      const j = passos.findIndex((q) => q?.id === p.seSumir);
      if (j < 0) erros.push(`${quem}: seSumir aponta para "${p.seSumir}", que não existe`);
      else if (j >= i) erros.push(`${quem}: seSumir precisa voltar para um passo anterior`);
      else if (passos[j].acao !== 'clique') erros.push(`${quem}: seSumir precisa voltar para um passo de clique (é ele que reabre o alvo)`);
    }
  });
  return erros;
}

// ---- Geometria do desenho ---------------------------------------------------
// Retângulos no formato do getBoundingClientRect: { top, left, width, height }.
// `tela` e `balao` são { largura, altura }.

const prender = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

/** O buraco: o alvo com uma folga em volta, para o anel não encostar nele. */
export const retanguloBuraco = (alvo, folga = 8) => ({
  top: alvo.top - folga,
  left: alvo.left - folga,
  width: alvo.width + folga * 2,
  height: alvo.height + folga * 2,
});

/**
 * As quatro faixas em volta do buraco que engolem cliques nos passos que não
 * são livres (cima, baixo, esquerda, direita), presas à tela. Faixa sem área
 * vem com largura ou altura 0.
 */
export function faixasEmVolta(buraco, tela) {
  const topo = prender(buraco.top, 0, tela.altura);
  const base = prender(buraco.top + buraco.height, topo, tela.altura);
  const esq = prender(buraco.left, 0, tela.largura);
  const dir = prender(buraco.left + buraco.width, esq, tela.largura);
  return [
    { top: 0, left: 0, width: tela.largura, height: topo },
    { top: base, left: 0, width: tela.largura, height: tela.altura - base },
    { top: topo, left: 0, width: esq, height: base - topo },
    { top: topo, left: dir, width: tela.largura - dir, height: base - topo },
  ];
}

const LADOS = ['baixo', 'cima', 'direita', 'esquerda'];
const PONTA = 18; // a seta não encosta no canto arredondado do balão

const sobreposicao = (a, b) => {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
};

/**
 * Onde o balão fica: abaixo do alvo se couber, senão acima, senão ao lado.
 * Sempre dentro da tela, com `margem` de folga. Devolve { top, left, lado,
 * seta }: `seta` é { x } (balão em cima/embaixo) ou { y } (ao lado), em px a
 * partir do canto do balão, apontando para o centro do alvo; null quando o
 * balão não encosta no alvo (a pessoa rolou e o alvo saiu da tela, ou nada
 * coube).
 *
 * `evitar` (opcional) é um retângulo que o balão deve cobrir o mínimo
 * possível: nos passos livres, o modal de publicar que a pessoa está usando.
 * Aí entram também as posições coladas no próprio modal (sem seta: o anel
 * pulsando já mostra o alvo), e ganha a que menos cobre o modal; no empate,
 * a ordem de sempre.
 */
export function posicionarBalao({ alvo, balao, tela, margem = 16, distancia = 14, evitar = null }) {
  const { largura: w, altura: h } = balao;
  const maxLeft = tela.largura - margem - w;
  const maxTop = tela.altura - margem - h;
  const cx = alvo.left + alvo.width / 2;
  const cy = alvo.top + alvo.height / 2;

  // O balão colado em `ref` do `lado` pedido, ou null se não cabe ali.
  const colado = (ref, lado, comSeta) => {
    const base = ref.top + ref.height;
    const dir = ref.left + ref.width;
    if (lado === 'baixo' || lado === 'cima') {
      if (lado === 'baixo' ? tela.altura - margem - (base + distancia) < h : ref.top - distancia - margem < h) return null;
      const ideal = lado === 'baixo' ? base + distancia : ref.top - distancia - h;
      const top = prender(ideal, margem, maxTop);
      const left = prender(cx - w / 2, margem, maxLeft);
      // Preso na borda (o alvo saiu da tela): a seta apontaria para o nada.
      const encosta = comSeta && top === ideal && cx >= 0 && cx <= tela.largura;
      return { top, left, lado, seta: encosta ? { x: prender(cx - left, PONTA, w - PONTA) } : null };
    }
    if (lado === 'direita' ? tela.largura - margem - (dir + distancia) < w : ref.left - distancia - margem < w) return null;
    const top = prender(cy - h / 2, margem, maxTop);
    const left = lado === 'direita' ? dir + distancia : ref.left - distancia - w;
    const encosta = comSeta && cy >= 0 && cy <= tela.altura;
    return { top, left, lado, seta: encosta ? { y: prender(cy - top, PONTA, h - PONTA) } : null };
  };

  const candidatos = [
    ...LADOS.map((l) => colado(alvo, l, true)),
    ...(evitar ? LADOS.map((l) => colado(evitar, l, false)) : []),
  ].filter(Boolean);

  if (candidatos.length) {
    if (!evitar) return candidatos[0];
    const cobre = (c) => sobreposicao({ top: c.top, left: c.left, width: w, height: h }, evitar);
    return candidatos.reduce((melhor, c) => (cobre(c) < cobre(melhor) ? c : melhor));
  }
  // Não coube em lado nenhum (alvo enorme numa tela pequena): o balão vai
  // para a ponta da tela com mais espaço livre, por cima do que precisar.
  const top = tela.altura - (alvo.top + alvo.height) >= alvo.top ? prender(maxTop, margem, maxTop) : margem;
  return { top, left: prender(cx - w / 2, margem, maxLeft), lado: null, seta: null };
}
