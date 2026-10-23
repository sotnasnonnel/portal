import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparComentarios, cursorDe, ehModeradorFeed, juntarPaginas, tempoRelativo, validarPost, FOTOS_MAX,
  precisaAceitarTermos, TERMOS_FEED,
} from './feed.js';

test('termo do feed: pede aceite na primeira vez e quando a versão muda', () => {
  assert.equal(precisaAceitarTermos(null), true);
  assert.equal(precisaAceitarTermos({ versao: null, em: null }), true);
  assert.equal(precisaAceitarTermos({ versao: TERMOS_FEED.versao, em: '2026-10-23T12:00:00Z' }), false);
  assert.equal(precisaAceitarTermos({ versao: 'antiga', em: '2026-10-23T12:00:00Z' }), true);
});

test('post vazio, texto longo e fotos demais não passam', () => {
  assert.equal(validarPost({ texto: '  ' }).length, 1);
  assert.deepEqual(validarPost({ texto: 'oi' }), []);
  assert.deepEqual(validarPost({ fotos: [{ type: 'image/jpeg' }] }), []);
  assert.equal(validarPost({ texto: 'x'.repeat(3001) }).length, 1);
  assert.equal(validarPost({ texto: 'oi', fotos: Array(FOTOS_MAX + 1).fill({ type: 'image/png' }) }).length, 1);
  assert.equal(validarPost({ fotos: [{ type: 'application/pdf' }] }).length, 1);
});

test('cursor ignora os fixados', () => {
  const posts = [
    { id: 'f', fixado: true, criado_em: '2026-10-01T00:00:00Z' },
    { id: 'a', fixado: false, criado_em: '2026-10-20T10:00:00Z' },
    { id: 'b', fixado: false, criado_em: '2026-10-19T10:00:00Z' },
  ];
  assert.deepEqual(cursorDe(posts), { em: '2026-10-19T10:00:00Z', id: 'b' });
  assert.equal(cursorDe([{ id: 'f', fixado: true }]), null);
});

test('juntar páginas não repete post', () => {
  assert.deepEqual(juntarPaginas([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]).map((p) => p.id), [1, 2, 3]);
});

test('comentários: um nível, respostas sob o pai, órfã sobe', () => {
  const lista = [
    { id: 'r1', pai_id: 'c1', criado_em: '2026-10-20T10:02:00Z' },
    { id: 'c1', pai_id: null, criado_em: '2026-10-20T10:00:00Z' },
    { id: 'c2', pai_id: null, criado_em: '2026-10-20T10:01:00Z' },
    { id: 'r9', pai_id: 'sumiu', criado_em: '2026-10-20T10:03:00Z' },
  ];
  const arv = agruparComentarios(lista);
  assert.deepEqual(arv.map((c) => c.id), ['c1', 'c2', 'r9']);
  assert.deepEqual(arv[0].respostas.map((c) => c.id), ['r1']);
});

test('tempo relativo', () => {
  const agora = new Date('2026-10-20T12:00:00Z');
  assert.equal(tempoRelativo('2026-10-20T11:59:30Z', agora), 'agora');
  assert.equal(tempoRelativo('2026-10-20T11:55:00Z', agora), 'há 5 min');
  assert.equal(tempoRelativo('2026-10-20T09:00:00Z', agora), 'há 3 h');
  assert.equal(tempoRelativo('2026-10-19T09:00:00Z', agora), 'ontem');
  assert.equal(tempoRelativo('2026-10-16T09:00:00Z', agora), 'há 4 dias');
});

test('moderação: admin e super admin', () => {
  assert.equal(ehModeradorFeed({ perfil: 'admin' }), true);
  assert.equal(ehModeradorFeed({ perfil: 'gestor', email: 'lennon.santos@phdengenharia.eng.br' }), true);
  assert.equal(ehModeradorFeed({ perfil: 'gestor' }), false);
});

test('links no texto viram pedaços clicáveis', async () => {
  const { pedacosComLinks } = await import('./feed.js');
  assert.deepEqual(pedacosComLinks('veja https://phd.com.br/a.'), [
    { texto: 'veja ' }, { link: 'https://phd.com.br/a', href: 'https://phd.com.br/a' }, { texto: '.' },
  ]);
  assert.deepEqual(pedacosComLinks('(www.phd.com.br)'), [
    { texto: '(' }, { link: 'www.phd.com.br', href: 'https://www.phd.com.br' }, { texto: ')' },
  ]);
  assert.deepEqual(pedacosComLinks('https://pt.wikipedia.org/wiki/X_(y)')[0].link, 'https://pt.wikipedia.org/wiki/X_(y)');
  assert.deepEqual(pedacosComLinks('sem link'), [{ texto: 'sem link' }]);
  assert.equal(pedacosComLinks('javascript:alert(1)').some((p) => p.link), false);
});

test('marcação: perceber o @, nome curto e realce no texto', async () => {
  const { buscaMencao, nomeMencao, mencoesNoTexto, pedacosDoTexto } = await import('./feed.js');
  assert.deepEqual(buscaMencao('oi @lu'), { inicio: 3, termo: 'lu' });
  assert.deepEqual(buscaMencao('@'), { inicio: 0, termo: '' });
  assert.deepEqual(buscaMencao('oi @lucas fe'), { inicio: 3, termo: 'lucas fe' });
  assert.equal(buscaMencao('email@phd.com'), null);
  assert.equal(buscaMencao('oi lucas'), null);
  assert.equal(nomeMencao('LUCAS FERRAZ GONCALVES'), 'Lucas Goncalves');
  const m = [{ id: 'a', nome: 'Lucas Goncalves' }, { id: 'b', nome: 'Ana Souza' }];
  assert.deepEqual(mencoesNoTexto('valeu @Lucas Goncalves!', m).map((x) => x.id), ['a']);
  assert.deepEqual(pedacosDoTexto('valeu @Lucas Goncalves, veja www.phd.com', m), [
    { texto: 'valeu ' }, { mencao: 'Lucas Goncalves', id: 'a' }, { texto: ', veja ' },
    { link: 'www.phd.com', href: 'https://www.phd.com' },
  ]);
});

test('lista do @: filtro sem acento e destaque', async () => {
  const { filtrarPessoas, partesDestaque } = await import('./feed.js');
  const dir = [
    { id: 1, nome: 'ANA SOUZA' }, { id: 2, nome: 'JOÃO LUCAS' }, { id: 3, nome: 'LUCAS FERRAZ' }, { id: 4, nome: 'PAULUCASSI' },
  ];
  assert.deepEqual(filtrarPessoas(dir, 'luc').map((p) => p.id), [2, 3, 4]);
  assert.deepEqual(filtrarPessoas(dir, 'joao').map((p) => p.id), [2]);
  assert.equal(filtrarPessoas(dir, '').length, 4);
  assert.deepEqual(partesDestaque('João Lucas', 'joa'), ['', 'Joã', 'o Lucas']);
  assert.deepEqual(partesDestaque('Ana', 'x'), ['Ana', '', '']);
});
