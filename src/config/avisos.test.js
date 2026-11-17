import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarAviso, blocoVazio, normalizarUrl, urlValida, tamanhoManchete, semMarcas,
  pedacosFormatados, blocosDoTexto, aplicarMarca, prefixarLinhas, arquivosDoAviso,
  recentesParaHome,
} from './avisos.js';

test('recentesParaHome: só os avisos das últimas duas semanas', () => {
  const agora = new Date('2026-11-17T12:00:00-03:00');
  const lista = [
    { id: 1, criado_em: '2026-11-16T09:00:00-03:00' },
    { id: 2, criado_em: '2026-11-03T12:00:00-03:00' }, // 14 dias certos: entra
    { id: 3, criado_em: '2026-11-03T11:59:00-03:00' }, // um minuto antes: sai
    { id: 4, criado_em: '2026-10-01T10:00:00-03:00' },
  ];
  assert.deepEqual(recentesParaHome(lista, agora).map((a) => a.id), [1, 2]);
  assert.deepEqual(recentesParaHome([], agora), []);
});

test('validarAviso: manchete obrigatória e foto quando o fundo é foto', () => {
  assert.match(validarAviso({ manchete: '  ' }), /manchete/);
  assert.equal(validarAviso({ manchete: 'Módulo liberado' }), '');
  assert.match(validarAviso({ manchete: 'x', fundo: 'foto' }), /foto do fundo/);
  assert.equal(validarAviso({ manchete: 'x', fundo: 'foto', foto: { path: 'a/b.webp' } }), '');
});

test('validarAviso: botão precisa de texto e de link', () => {
  const com = (b) => validarAviso({ manchete: 'x', blocos: [{ tipo: 'botao', ...b }] });
  assert.match(com({ rotulo: '', url: 'https://x' }), /texto ao botão/);
  assert.match(com({ rotulo: 'Abrir', url: '' }), /link do botão/);
  assert.equal(com({ rotulo: 'Abrir', url: 'portal.phd.com' }), '');
  // Botão sem nada é descartado, não trava.
  assert.equal(com({ rotulo: '', url: '' }), '');
});

test('blocoVazio: imagem e anexo só contam com arquivo', () => {
  assert.equal(blocoVazio({ tipo: 'texto', texto: '  ' }), true);
  assert.equal(blocoVazio({ tipo: 'imagem', path: '' }), true);
  assert.equal(blocoVazio({ tipo: 'imagem', arquivo: {} }), false);
  assert.equal(blocoVazio({ tipo: 'anexo', path: 'eu/a.pdf' }), false);
});

test('links: http(s) e caminho do portal passam; o resto ganha https', () => {
  assert.equal(urlValida('/feed'), true);
  assert.equal(urlValida('javascript:alert(1)'), false);
  assert.equal(normalizarUrl('www.phd.com'), 'https://www.phd.com');
  assert.equal(normalizarUrl('/feed'), '/feed');
  // "javascript:" vira um endereço https inofensivo, nunca um link executável.
  assert.ok(normalizarUrl('javascript:alert(1)').startsWith('https://'));
});

test('tamanhoManchete encolhe a manchete longa, sem contar as marcas', () => {
  assert.equal(tamanhoManchete('**Módulo Financeiro** liberado'), 'g');
  assert.equal(tamanhoManchete('x'.repeat(60)), 'm');
  assert.equal(tamanhoManchete('x'.repeat(120)), 'p');
  assert.equal(semMarcas('**a** _b_'), 'a b');
});

test('pedacosFormatados: negrito, itálico e link', () => {
  assert.deepEqual(pedacosFormatados('Módulo **Financeiro** _liberado_'), [
    { texto: 'Módulo ' }, { texto: 'Financeiro', negrito: true }, { texto: ' ' }, { texto: 'liberado', italico: true },
  ]);
  const comLink = pedacosFormatados('veja **www.phd.com**');
  assert.equal(comLink[1].href, 'https://www.phd.com');
  assert.equal(comLink[1].negrito, true);
});

test('pedacosFormatados: "_" no meio de palavra não vira itálico', () => {
  assert.deepEqual(pedacosFormatados('arquivo_final_v2'), [{ texto: 'arquivo_final_v2' }]);
});

test('blocosDoTexto: parágrafos, listas e subtítulo', () => {
  const r = blocosDoTexto('Boa tarde!\nComo anunciado:\n\n## Como acessar\n- Clique no botão\n- Entre\n1. um\n2. dois');
  assert.deepEqual(r, [
    { tipo: 'p', linhas: ['Boa tarde!', 'Como anunciado:'] },
    { tipo: 'h', texto: 'Como acessar' },
    { tipo: 'ul', itens: ['Clique no botão', 'Entre'] },
    { tipo: 'ol', itens: ['um', 'dois'] },
  ]);
});

test('aplicarMarca embrulha a seleção e mantém o trecho selecionado', () => {
  const r = aplicarMarca('Portal PHD', 7, 10, '**');
  assert.equal(r.texto, 'Portal **PHD**');
  assert.equal(r.texto.slice(r.ini, r.fim), 'PHD');
});

test('prefixarLinhas põe e tira lista; numerada conta as linhas', () => {
  const pos = prefixarLinhas('a\nb', 0, 3, '- ');
  assert.equal(pos.texto, '- a\n- b');
  assert.equal(prefixarLinhas(pos.texto, 0, pos.texto.length, '- ').texto, 'a\nb');
  assert.equal(prefixarLinhas('a\nb', 0, 3, '1. ').texto, '1. a\n2. b');
});

test('arquivosDoAviso junta a foto do fundo, as imagens e os anexos', () => {
  assert.deepEqual(arquivosDoAviso({
    foto_path: 'eu/f.webp',
    blocos: [{ tipo: 'texto', texto: 'x' }, { tipo: 'imagem', path: 'eu/i.webp' }, { tipo: 'anexo', path: 'eu/a.pdf' }],
  }), ['eu/f.webp', 'eu/i.webp', 'eu/a.pdf']);
});
