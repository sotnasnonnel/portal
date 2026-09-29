import test from 'node:test';
import assert from 'node:assert/strict';
import { descreverAusencia, ausenteNoDia, diaLocalIso } from './ausenciaColaborador.js';

test('descreve o período com o nome do módulo de origem', () => {
  assert.equal(
    descreverAusencia({ tipo: 'folga_campo', data_inicio: '2026-10-12', data_fim: '2026-10-14' }),
    'Folga de Campo de 12/10/2026 a 14/10/2026',
  );
  assert.equal(
    descreverAusencia({ tipo: 'ausencia_programada', data_inicio: '2026-12-10', data_fim: '2026-12-21' }),
    'Ausência Programada de 10/12/2026 a 21/12/2026',
  );
});

test('um dia só vira "em", sem repetir a data', () => {
  assert.equal(
    descreverAusencia({ tipo: 'folga_campo', data_inicio: '2026-10-12', data_fim: '2026-10-12' }),
    'Folga de Campo em 12/10/2026',
  );
});

test('ausente no dia considera as duas pontas do período', () => {
  const lista = [{ data_inicio: '2026-10-12', data_fim: '2026-10-14' }];
  assert.equal(ausenteNoDia(lista, '2026-10-12'), true);
  assert.equal(ausenteNoDia(lista, '2026-10-14'), true);
  assert.equal(ausenteNoDia(lista, '2026-10-15'), false);
  assert.equal(ausenteNoDia([], '2026-10-12'), false);
});

test('dia local não escorrega para o dia anterior', () => {
  assert.equal(diaLocalIso(new Date(2026, 9, 12, 0, 30)), '2026-10-12');
});
