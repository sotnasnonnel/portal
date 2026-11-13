import test from 'node:test';
import assert from 'node:assert/strict';
import { AWARDS_LIMITE_ARQUIVO, AWARDS_LIMITE_VIDEO, AWARDS_PERGUNTAS } from '../../../config/programas.js';
import {
  erroDoArquivo, erroDoVideo, erroDoVoto, faltandoNoProjeto, hojeEmBrasilia, podeInscrever, podeReiniciarPremiacao, rankingDaCategoria,
  notaDaComissao, notaDaVotacao, notaFinal,
  ordemDaRevelacao, podioCompleto,
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
  const r = rankingDaCategoria([linha('d', 1), linha('a', 9, 3), linha('b', 5, 1), linha('c', 5, 0, 2), linha('e', 1)], {}, []);
  assert.deepEqual(r.map((l) => l.projeto_id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(r.map((l) => l.empate), [false, true, true, false, false]);

  const corte = rankingDaCategoria([linha('a', 9), linha('b', 6), linha('c', 4), linha('d', 4)], {}, []);
  assert.deepEqual(corte.map((l) => l.empate), [false, false, true, true]);

  assert.deepEqual(rankingDaCategoria([], {}, []), []);
});

test('a premiação só pode ser reiniciada antes de as inscrições abrirem', () => {
  assert.equal(podeReiniciarPremiacao('2026-11-15'), true);
  assert.equal(podeReiniciarPremiacao('2026-11-16'), false);
  assert.equal(podeReiniciarPremiacao('2026-12-18'), false);
});

test('o pódio só está completo com todas as posições de cada categoria', () => {
  assert.equal(podioCompleto({ operacao: ['a', 'b', 'c'], backoffice: ['d', 'e'] }, { operacao: 6, backoffice: 2 }), true);
  assert.equal(podioCompleto({ operacao: ['a', 'b'], backoffice: ['d', 'e'] }, { operacao: 6, backoffice: 2 }), false);
  assert.equal(podioCompleto({ operacao: ['a', 'b', 'c'] }, { operacao: 4, backoffice: 0 }), true);
  assert.equal(podioCompleto({}, { operacao: 0, backoffice: 0 }), false);
});

test('a cerimônia vai categoria por categoria, do 3º para o 1º', () => {
  const ordem = ordemDaRevelacao({ operacao: ['a', 'b', 'c'], backoffice: ['d', 'e'] }, ['operacao', 'backoffice']);
  assert.deepEqual(ordem, [
    { categoria: 'operacao', posicoes: [3, 2, 1] },
    { categoria: 'backoffice', posicoes: [2, 1] },
  ]);
  assert.deepEqual(ordemDaRevelacao({ backoffice: ['d'] }, ['operacao', 'backoffice']), [{ categoria: 'backoffice', posicoes: [1] }]);
});

test('o vídeo é obrigatório, só aceita vídeo e vai até 300 MB', () => {
  const completo = { categoria: 'operacao', ...Object.fromEntries(AWARDS_PERGUNTAS.map((p) => [p.campo, 'x'])) };
  assert.deepEqual(faltandoNoProjeto(completo, false), ['o vídeo']);
  assert.deepEqual(faltandoNoProjeto(completo, true), []);
  assert.equal(erroDoVideo({ name: 'obra.MOV', size: AWARDS_LIMITE_VIDEO }), null);
  assert.match(erroDoVideo({ name: 'obra.mp4', size: AWARDS_LIMITE_VIDEO + 1 }), /300 MB/);
  assert.match(erroDoVideo({ name: 'obra.pptx', size: 10 }), /envie um vídeo/);
});

test('a nota da votação vai de 0 a 100, proporcional ao mais votado', () => {
  assert.equal(notaDaVotacao(12, 12), 100);
  assert.equal(notaDaVotacao(6, 12), 50);
  assert.equal(notaDaVotacao(0, 0), 0);
});

test('a comissão é a média dos critérios, com peso, vezes 10; sem todas as notas, não há nota', () => {
  const criterios = [{ chave: 'a', label: 'A' }, { chave: 'b', label: 'B', peso: 3 }];
  assert.equal(notaDaComissao({ a: 8, b: 4 }, criterios), 50);
  assert.equal(notaDaComissao({ a: 8 }, criterios), null);
  assert.equal(notaDaComissao({ a: 8 }, []), null);
});

test('a nota final é metade votação, metade comissão; sem critérios, só a votação', () => {
  const criterios = [{ chave: 'a', label: 'A' }];
  assert.equal(notaFinal(100, 50, criterios), 75);
  assert.equal(notaFinal(100, null, criterios), null);
  assert.equal(notaFinal(80, null, []), 80);
});

test('com a comissão, a ordem segue a nota final e o empate é nela', () => {
  const criterios = [{ chave: 'a', label: 'A' }];
  const linha = (id, pontos) => ({ projeto_id: id, pontos, primeiro: 0, segundo: 0, terceiro: 0 });
  // b e c: 50*0.5 + 100*0.5 = 75 · a: 100*0.5 + 20*0.5 = 60 · d: sem nota da comissão.
  // O mais votado (a) perde para quem a comissão avaliou melhor: é o efeito do 50/50.
  const r = rankingDaCategoria(
    [linha('a', 10), linha('b', 5), linha('c', 5), linha('d', 10)],
    { a: { a: 2 }, b: { a: 10 }, c: { a: 10 } },
    criterios,
  );
  assert.deepEqual(r.map((l) => l.projeto_id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(r.map((l) => l.empate), [true, true, false, false]);
  assert.equal(r[0].final, 75);
  assert.equal(r[2].final, 60);
  assert.equal(r[3].final, null);
});
