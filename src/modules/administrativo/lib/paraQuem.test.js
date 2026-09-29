import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARA_MIM, PARA_OUTRA, perguntaParaQuem, colaboradorDoChamado, validarParaQuem,
} from './paraQuem.js';

test('mobilização usa o profissional e não pergunta de novo', () => {
  assert.equal(perguntaParaQuem('mobilizacao', 'mobilizacao'), false);
  assert.equal(
    colaboradorDoChamado({
      classe: 'mobilizacao', servico: 'mobilizacao',
      campos: { profissional_id: 'p1' }, solicitanteId: 'eu',
    }),
    'p1',
  );
});

test('serviço com pessoa no formulário usa a pessoa escolhida', () => {
  assert.equal(perguntaParaQuem('viagem-hospedagem', 'vagas-alojamento-phd'), false);
  assert.equal(
    colaboradorDoChamado({
      classe: 'viagem-hospedagem', servico: 'vagas-alojamento-phd',
      campos: { pessoa_id: 'p2' }, paraQuem: PARA_OUTRA, outraPessoaId: 'x', solicitanteId: 'eu',
    }),
    'p2',
  );
});

test('nos demais, "para mim" é o solicitante e "outra pessoa" é a escolhida', () => {
  const base = { classe: 'qualquer', servico: 'coisa', solicitanteId: 'eu' };
  assert.equal(perguntaParaQuem('qualquer', 'coisa'), true);
  assert.equal(colaboradorDoChamado({ ...base, paraQuem: PARA_MIM }), 'eu');
  assert.equal(colaboradorDoChamado({ ...base, paraQuem: PARA_OUTRA, outraPessoaId: 'p3' }), 'p3');
});

test('"outra pessoa" sem escolher ninguém não passa', () => {
  const base = { classe: 'qualquer', servico: 'coisa' };
  assert.equal(validarParaQuem({ ...base, paraQuem: PARA_OUTRA, outraPessoaId: '' }), 'Escolha para quem é o chamado.');
  assert.equal(validarParaQuem({ ...base, paraQuem: PARA_MIM }), '');
  assert.equal(validarParaQuem({ classe: 'mobilizacao', servico: 'mobilizacao', paraQuem: PARA_OUTRA }), '');
});
