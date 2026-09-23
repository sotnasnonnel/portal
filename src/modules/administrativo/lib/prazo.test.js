import test from 'node:test';
import assert from 'node:assert/strict';
import { prazoAdiado } from './prazo.js';

test('sem início de prazo gravado, nada a explicar', () => {
  assert.equal(prazoAdiado({ criado_em: '2026-09-23T10:00:00Z' }), false);
  assert.equal(prazoAdiado({}), false);
});

test('prazo que começou junto com a fila não é adiado', () => {
  assert.equal(prazoAdiado({
    criado_em: '2026-09-23T10:00:00Z',
    sla_inicio_em: '2026-09-23T10:00:00Z',
  }), false);
});

// A diferença entre o relógio do banco e o de quem abriu é de segundos, e não
// pode virar "o responsável estava ausente".
test('segundos de diferença não contam como adiamento', () => {
  assert.equal(prazoAdiado({
    criado_em: '2026-09-23T10:00:00Z',
    sla_inicio_em: '2026-09-23T10:00:30Z',
  }), false);
});

test('responsável de férias: prazo começa na volta', () => {
  assert.equal(prazoAdiado({
    criado_em: '2026-09-23T10:00:00Z',
    sla_inicio_em: '2026-10-03T10:00:00Z',
  }), true);
});

// Chamado com alçada entra na fila quando a aprovação sai; é dessa data que a
// comparação parte, senão todo chamado aprovado dias depois pareceria adiado.
test('com alçada, a régua é a análise e não a criação', () => {
  const chamado = {
    criado_em: '2026-09-01T10:00:00Z',
    analise_em: '2026-09-23T10:00:00Z',
    sla_inicio_em: '2026-09-23T10:00:00Z',
  };
  assert.equal(prazoAdiado(chamado), false);
});
