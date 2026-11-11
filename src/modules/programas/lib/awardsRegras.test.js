import test from 'node:test';
import assert from 'node:assert/strict';
import { AWARDS_LIMITE_ARQUIVO, AWARDS_PERGUNTAS } from '../../../config/programas.js';
import {
  erroDoArquivo, erroDoVoto, faltandoNoProjeto, hojeEmBrasilia, podeInscrever, podeZerarPremiacao, rankingDaCategoria,
  situacaoInscricoes, tipoDoArquivo,
} from './awardsRegras.js';

const comum = { email: 'fulano.detal@phdengenharia.eng.br' };
const lucas = { email: 'Lucas.Ferraz@phdengenharia.eng.br' };

test('o dia vira em Brasília, não em UTC', () => {
  assert.equal(hojeEmBrasilia(new Date('2026-12-05T02:59:00Z')), '2026-12-04');
  assert.equal(hojeEmBrasilia(new Date('2026-12-05T03:00:00Z')), '2026-12-05');
});

test('as inscrições valem de 16/11 a 04/12, com os dois dias incluídos', () => {
  assert.equal(situacaoInscricoes('2026-11-15'), 'antes');
  assert.equal(situacaoInscricoes('2026-11-16'), 'abertas');
  assert.equal(situacaoInscricoes('2026-12-04'), 'abertas');
  assert.equal(situacaoInscricoes('2026-12-05'), 'encerradas');
});

test('fora do prazo, só quem avalia e os admins dos Programas cadastram', () => {
  assert.equal(podeInscrever(comum, {}, '2026-11-20'), true);
  assert.equal(podeInscrever(comum, {}, '2026-11-13'), false);
  assert.equal(podeInscrever(comum, { programas: 'comercial' }, '2026-12-05'), false);
  assert.equal(podeInscrever(lucas, {}, '2026-11-13'), true);
  assert.equal(podeInscrever(comum, { programas: 'admin' }, '2026-11-13'), true);
});

test('a categoria e as 8 perguntas são obrigatórias, em branco não conta', () => {
  assert.equal(faltandoNoProjeto({}).length, 1 + AWARDS_PERGUNTAS.length);
  const completo = Object.fromEntries(AWARDS_PERGUNTAS.map((p) => [p.campo, 'resposta']));
  assert.deepEqual(faltandoNoProjeto({ ...completo, categoria: 'operacao' }), []);
  assert.deepEqual(
    faltandoNoProjeto({ ...completo, impacto: '   ' }),
    ['a categoria', 'a pergunta 3'],
  );
});

test('o tipo sai da extensão, sem depender do navegador', () => {
  assert.equal(tipoDoArquivo('Apresentacao.final.PPTX'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(tipoDoArquivo('video.mov'), 'video/quicktime');
  assert.equal(tipoDoArquivo('programa.exe'), null);
  assert.equal(tipoDoArquivo('constructor'), null);
});

test('recusa formato fora da lista e arquivo acima de 100 MB', () => {
  assert.equal(erroDoArquivo({ name: 'a.pdf', size: AWARDS_LIMITE_ARQUIVO }), null);
  assert.match(erroDoArquivo({ name: 'a.pdf', size: AWARDS_LIMITE_ARQUIVO + 1 }), /100 MB/);
  assert.match(erroDoArquivo({ name: 'a.zip', size: 10 }), /formato não aceito/);
});

test('o voto precisa de 3 projetos diferentes, ou de tantos quantos forem os finalistas', () => {
  assert.equal(erroDoVoto(['a', 'b', 'c'], 6), null);
  assert.match(erroDoVoto(['a', 'b', ''], 6), /1º ao 3º/);
  assert.match(erroDoVoto(['a', 'a', 'b'], 6), /diferentes/);
  assert.equal(erroDoVoto(['a', 'b', ''], 2), null);
  assert.match(erroDoVoto(['', '', ''], 1), /1º lugar/);
});

test('o ranking marca só os empates que mexem no pódio', () => {
  const linha = (id, pontos, primeiro = 0, segundo = 0) => ({ projeto_id: id, pontos, primeiro, segundo, terceiro: 0 });
  const r = rankingDaCategoria([linha('d', 1), linha('a', 9, 3), linha('b', 5, 1), linha('c', 5, 0, 2), linha('e', 1)]);
  assert.deepEqual(r.map((l) => l.projeto_id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(r.map((l) => l.empate), [false, true, true, false, false]);

  const corte = rankingDaCategoria([linha('a', 9), linha('b', 6), linha('c', 4), linha('d', 4)]);
  assert.deepEqual(corte.map((l) => l.empate), [false, false, true, true]);

  assert.deepEqual(rankingDaCategoria([]), []);
});

test('a premiação só pode ser zerada antes de as inscrições abrirem', () => {
  assert.equal(podeZerarPremiacao('2026-11-15'), true);
  assert.equal(podeZerarPremiacao('2026-11-16'), false);
  assert.equal(podeZerarPremiacao('2026-12-18'), false);
});
