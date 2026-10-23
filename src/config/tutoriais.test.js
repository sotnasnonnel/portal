import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TUTORIAIS, TUTORIAL_FEED, cliquesAdiante, contagemPasso, decidirRota, faixasEmVolta, indicePasso,
  passoAnterior, passoDe, posicionarBalao, proximoPasso, retanguloBuraco, rotuloContagem, validarTutorial,
} from './tutoriais.js';
import { COMO_GANHAR } from './pontos.js';

const passos = TUTORIAIS[TUTORIAL_FEED].passos;

test('tutoriais: todos passam na validação', () => {
  for (const [id, t] of Object.entries(TUTORIAIS)) {
    assert.deepEqual(validarTutorial(t), [], `tutorial "${id}"`);
  }
});

test('tutorial do feed: ids únicos, rotas com "/", alvo, título e texto em todo passo', () => {
  assert.equal(new Set(passos.map((p) => p.id)).size, passos.length);
  for (const p of passos) {
    assert.ok(p.rota.startsWith('/'), p.id);
    assert.ok(p.alvo && p.titulo && p.texto, p.id);
  }
});

test('tutorial do feed: seSumir volta para um passo de clique que vem antes', () => {
  const comVolta = passos.filter((p) => p.seSumir);
  assert.ok(comVolta.length > 0);
  for (const p of comVolta) {
    const alvo = passoDe(TUTORIAL_FEED, p.seSumir);
    assert.ok(alvo, `${p.id} -> ${p.seSumir}`);
    assert.equal(alvo.acao, 'clique');
    assert.ok(indicePasso(TUTORIAL_FEED, p.seSumir) < indicePasso(TUTORIAL_FEED, p.id));
  }
});

test('tutorial do feed: a ordem e o último passo é o Publicar', () => {
  assert.deepEqual(passos.map((p) => p.id), [
    'home-feed', 'feed-post', 'feed-regras', 'feed-chamada', 'post-texto', 'post-ferramentas', 'post-publicar',
  ]);
  assert.equal(proximoPasso(TUTORIAL_FEED, 'home-feed'), 'feed-post');
  assert.equal(proximoPasso(TUTORIAL_FEED, 'post-publicar'), null);
  assert.equal(proximoPasso(TUTORIAL_FEED, 'nao-existe'), null);
  assert.equal(proximoPasso('nao-existe', 'home-feed'), null);
});

test('tutorial do feed: o texto do Publicar traz os pontos da loja', () => {
  const pontos = COMO_GANHAR.find((g) => g.o === 'Postar no feed').p;
  assert.ok(passoDe(TUTORIAL_FEED, 'post-publicar').texto.includes(`+${pontos} pontos`));
});

test('validação: aponta os erros de desenho', () => {
  const ok = { id: 'a', rota: '/x', alvo: 'a', titulo: 'A', texto: 'a', acao: 'clique' };
  assert.deepEqual(validarTutorial({ nome: 'T', passos: [ok] }), []);
  assert.ok(validarTutorial(null).length > 0);
  assert.ok(validarTutorial({ nome: 'T', passos: [] }).length > 0);
  assert.ok(validarTutorial({ nome: '', passos: [ok] }).length > 0);
  const um = (extra) => validarTutorial({ nome: 'T', passos: [ok, { ...ok, id: 'b', acao: undefined, ...extra }] });
  assert.equal(um({ id: 'a' }).length, 1);              // id repetido
  assert.equal(um({ rota: 'x' }).length, 1);            // rota sem "/"
  assert.equal(um({ alvo: '' }).length, 1);
  assert.equal(um({ titulo: ' ' }).length, 1);
  assert.equal(um({ texto: '' }).length, 1);
  assert.equal(um({ acao: 'arrastar' }).length, 1);
  assert.equal(um({ seSumir: 'zzz' }).length, 1);       // não existe
  assert.equal(um({ seSumir: 'b' }).length, 1);         // não vem antes
  assert.deepEqual(um({ seSumir: 'a' }), []);
  const semClique = validarTutorial({ nome: 'T', passos: [{ ...ok, acao: undefined }, { ...ok, id: 'b', seSumir: 'a' }] });
  assert.equal(semClique.length, 1);                    // volta para passo que não é de clique
});

test('contagem: relativa ao passo onde o tutorial começou', () => {
  assert.deepEqual(contagemPasso(TUTORIAL_FEED, 'feed-regras', 'home-feed'), { atual: 3, total: 7 });
  assert.deepEqual(contagemPasso(TUTORIAL_FEED, 'feed-post', 'feed-post'), { atual: 1, total: 6 });
  assert.deepEqual(contagemPasso(TUTORIAL_FEED, 'post-publicar', 'feed-post'), { atual: 6, total: 6 });
  // seSumir para antes do começo: a conta passa a valer dali
  assert.deepEqual(contagemPasso(TUTORIAL_FEED, 'feed-chamada', 'post-texto'), { atual: 1, total: 4 });
  assert.equal(rotuloContagem(TUTORIAL_FEED, 'feed-regras', 'home-feed'), 'Tutorial do Feed · 3 de 7');
  assert.equal(rotuloContagem(TUTORIAL_FEED, 'feed-post', 'feed-post'), 'Tutorial do Feed · 1 de 6');
  // feed sem post: o opcional pulado sai da conta
  assert.deepEqual(contagemPasso(TUTORIAL_FEED, 'feed-regras', 'feed-post', ['feed-post']), { atual: 1, total: 5 });
  assert.deepEqual(contagemPasso(TUTORIAL_FEED, 'post-publicar', 'home-feed', ['feed-post']), { atual: 6, total: 6 });
});

test('voltar: só na mesma rota, nunca para passo de clique, pulando os pulados', () => {
  assert.equal(passoAnterior(TUTORIAL_FEED, 'home-feed'), null);
  assert.equal(passoAnterior(TUTORIAL_FEED, 'feed-post'), null);              // anterior é da Home
  assert.equal(passoAnterior(TUTORIAL_FEED, 'feed-regras'), 'feed-post');
  assert.equal(passoAnterior(TUTORIAL_FEED, 'feed-regras', ['feed-post']), null);
  assert.equal(passoAnterior(TUTORIAL_FEED, 'feed-chamada'), 'feed-regras');
  assert.equal(passoAnterior(TUTORIAL_FEED, 'post-texto'), null);             // anterior é de clique
  assert.equal(passoAnterior(TUTORIAL_FEED, 'post-ferramentas'), 'post-texto');
  assert.equal(passoAnterior(TUTORIAL_FEED, 'post-publicar'), 'post-ferramentas');
});

test('cliques adiante: o atual e os de clique mais à frente na mesma rota', () => {
  assert.deepEqual(cliquesAdiante(TUTORIAL_FEED, 'home-feed'), ['home-feed']);
  assert.deepEqual(cliquesAdiante(TUTORIAL_FEED, 'feed-post'), ['feed-chamada', 'post-publicar']);
  assert.deepEqual(cliquesAdiante(TUTORIAL_FEED, 'post-texto'), ['post-publicar']);
  assert.deepEqual(cliquesAdiante(TUTORIAL_FEED, 'post-publicar'), ['post-publicar']);
  assert.deepEqual(cliquesAdiante(TUTORIAL_FEED, 'nao-existe'), []);
});

test('rota: mostra, espera a navegação ou encerra', () => {
  // clicou no ícone da Home: o passo do feed espera o /feed carregar
  assert.equal(decidirRota({ rota: '/feed', origem: '/home', pathname: '/home' }), 'esperar');
  assert.equal(decidirRota({ rota: '/feed', origem: '/home', pathname: '/feed' }), 'mostrar');
  // foi para uma terceira rota
  assert.equal(decidirRota({ rota: '/feed', origem: '/home', pathname: '/aprovacoes' }), 'encerrar');
  // chegou no /feed e voltou para a Home
  assert.equal(decidirRota({ rota: '/feed', origem: '/home', chegou: true, pathname: '/home' }), 'encerrar');
  // passo da mesma rota de onde começou: saiu dela, encerra
  assert.equal(decidirRota({ rota: '/feed', origem: '/feed', chegou: true, pathname: '/home' }), 'encerrar');
});

test('buraco e faixas: a folga em volta e as quatro faixas presas à tela', () => {
  const b = retanguloBuraco({ top: 100, left: 50, width: 40, height: 20 }, 8);
  assert.deepEqual(b, { top: 92, left: 42, width: 56, height: 36 });
  const tela = { largura: 400, altura: 800 };
  const [cima, baixo, esq, dir] = faixasEmVolta(b, tela);
  assert.deepEqual(cima, { top: 0, left: 0, width: 400, height: 92 });
  assert.deepEqual(baixo, { top: 128, left: 0, width: 400, height: 672 });
  assert.deepEqual(esq, { top: 92, left: 0, width: 42, height: 36 });
  assert.deepEqual(dir, { top: 92, left: 98, width: 302, height: 36 });
  // buraco saindo pela esquerda e pelo alto: nada negativo
  const [c2, , e2] = faixasEmVolta({ top: -10, left: -10, width: 30, height: 30 }, tela);
  assert.equal(c2.height, 0);
  assert.equal(e2.width, 0);
});

test('balão: embaixo se couber, senão em cima, senão ao lado, sempre na tela', () => {
  const tela = { largura: 1280, altura: 800 };
  const balao = { largura: 340, altura: 200 };
  // ícone no alto da tela: embaixo, centrado, com a seta no centro do alvo
  const baixo = posicionarBalao({ alvo: { top: 20, left: 600, width: 40, height: 40 }, balao, tela });
  assert.equal(baixo.lado, 'baixo');
  assert.equal(baixo.top, 74);
  assert.equal(baixo.left, 450);
  assert.deepEqual(baixo.seta, { x: 170 });
  // no pé da tela: em cima
  const cima = posicionarBalao({ alvo: { top: 700, left: 600, width: 40, height: 40 }, balao, tela });
  assert.equal(cima.lado, 'cima');
  assert.equal(cima.top, 700 - 14 - 200);
  // alto demais para cima e para baixo: ao lado
  const lado = posicionarBalao({ alvo: { top: 200, left: 100, width: 200, height: 450 }, balao, tela });
  assert.equal(lado.lado, 'direita');
  assert.equal(lado.left, 314);
  assert.ok(lado.seta.y > 0);
  // canto direito: não passa da margem
  const canto = posicionarBalao({ alvo: { top: 20, left: 1250, width: 24, height: 24 }, balao, tela });
  assert.equal(canto.left, 1280 - 16 - 340);
  assert.equal(canto.seta.x, 340 - 18);
});

test('balão nos passos livres: cobre o mínimo do modal que a pessoa está usando', () => {
  const balao = { largura: 340, altura: 200 };
  // campo de texto no alto do modal, tela estreita: embaixo do campo cobriria
  // as ferramentas e o Publicar; vai para baixo do modal, sem seta
  const texto = posicionarBalao({
    alvo: { top: 120, left: 20, width: 560, height: 200 }, balao, tela: { largura: 600, altura: 900 },
    evitar: { top: 100, left: 20, width: 560, height: 400 },
  });
  assert.equal(texto.lado, 'baixo');
  assert.equal(texto.top, 514);
  assert.equal(texto.seta, null);
  // com espaço ao lado, o lado não cobre nada e mantém a seta
  const ferramentas = posicionarBalao({
    alvo: { top: 400, left: 400, width: 560, height: 40 }, balao, tela: { largura: 1440, altura: 900 },
    evitar: { top: 100, left: 400, width: 560, height: 400 },
  });
  assert.equal(ferramentas.lado, 'direita');
  assert.ok(ferramentas.seta.y > 0);
  // nada sem sobreposição: fica com o que cobre menos (em cima do campo,
  // tapando só a borda do cabeçalho)
  const apertado = posicionarBalao({
    alvo: { top: 262, left: 349, width: 576, height: 208 }, balao: { largura: 340, altura: 208 },
    tela: { largura: 1280, altura: 800 }, evitar: { top: 233, left: 357, width: 560, height: 335 },
  });
  assert.equal(apertado.lado, 'cima');
  assert.equal(apertado.top, 40);
});

test('balão: celular de 390px e alvo enorme ou fora da tela', () => {
  const tela = { largura: 390, altura: 844 };
  const balao = { largura: 340, altura: 220 };
  const r = posicionarBalao({ alvo: { top: 120, left: 16, width: 358, height: 200 }, balao, tela });
  assert.equal(r.lado, 'baixo');
  assert.ok(r.left >= 16 && r.left + 340 <= 390 - 16);
  // não cabe em lugar nenhum: vai para a ponta com mais espaço, sem seta
  const enorme = posicionarBalao({ alvo: { top: 100, left: 0, width: 390, height: 600 }, balao, tela });
  assert.equal(enorme.lado, null);
  assert.equal(enorme.seta, null);
  assert.ok(enorme.top >= 16 && enorme.top + 220 <= 844 - 16);
  // a pessoa rolou e o alvo saiu por cima: balão preso na tela, sem seta
  const fora = posicionarBalao({ alvo: { top: -300, left: 100, width: 40, height: 40 }, balao, tela });
  assert.equal(fora.top, 16);
  assert.equal(fora.seta, null);
});
