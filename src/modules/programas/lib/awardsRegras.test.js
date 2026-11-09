import test from 'node:test';
import assert from 'node:assert/strict';
import { AWARDS_LIMITE_ARQUIVO, AWARDS_PERGUNTAS } from '../../../config/programas.js';
import {
  erroDoArquivo, faltandoNoProjeto, hojeEmBrasilia, podeInscrever, situacaoInscricoes, tipoDoArquivo,
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
