import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resincronizarPendentes, APROVADORES } from './aprovacao.js';

const ADMIN = APROVADORES.admin;
const AGORA = '2026-07-01T00:00:00.000Z';

// Fake supabase: uma sol muda (S1) e uma não muda (S2 já bate com molde ['a']).
function fakeSupabase(calls) {
  const sols = [
    {
      id: 'S1',
      etapas: [
        { id: 'x1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'pendente' },
        { id: 'x2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
      ],
    },
    {
      id: 'S2',
      etapas: [
        { id: 'y1', ordem: 1, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente' },
        { id: 'y2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
      ],
    },
  ];
  return {
    from(table) {
      if (table === 'solicitacoes_rh') {
        const b = { select: () => b, eq: () => b, then: (res) => res({ data: sols, error: null }) };
        return b;
      }
      // solicitacoes_rh_etapas
      return {
        delete: () => ({ eq: () => ({ eq: () => { calls.push({ op: 'delete' }); return Promise.resolve({ error: null }); } }) }),
        insert: (rows) => { calls.push({ op: 'insert', rows }); return Promise.resolve({ error: null }); },
      };
    },
  };
}

test('atualiza só as requisições que mudaram e retorna a contagem', async () => {
  const calls = [];
  const nomes = { a: 'Ana', b: 'Bruno' };
  // molde ['b']: S1 (tinha 'a') muda; S2 (já 'b') fica igual.
  const n = await resincronizarPendentes(fakeSupabase(calls), {
    solicitanteId: 'g', tipo: 'aumento_salario', moldeIds: ['b'], nomePorId: nomes, agora: AGORA,
  });
  assert.equal(n, 1);
  const dels = calls.filter((c) => c.op === 'delete');
  const ins = calls.filter((c) => c.op === 'insert');
  assert.equal(dels.length, 1);
  assert.equal(ins.length, 1);
  assert.deepEqual(ins[0].rows, [
    { ordem: 1, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null, solicitacao_id: 'S1' },
    { ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null, solicitacao_id: 'S1' },
  ]);
});
