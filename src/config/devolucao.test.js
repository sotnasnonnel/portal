import test from 'node:test';
import assert from 'node:assert/strict';
import { etapaAtual, resumoAndamento } from './aprovacao.js';

// Cadeia típica: 2 aprovações + execução do admin.
const cadeia = (over = {}) => ([
  { id: 'e1', ordem: 1, tipo_etapa: 'aprovacao', status: 'aprovada', aprovador_id: 'a', papel: 'Ana' },
  { id: 'e2', ordem: 2, tipo_etapa: 'aprovacao', status: 'pendente', aprovador_id: 'b', papel: 'Bruno' },
  { id: 'e3', ordem: 3, tipo_etapa: 'execucao', status: 'pendente', aprovador_id: 'x', papel: 'Admin (execução)' },
  ...(over.extra || []),
].map((e) => (e.id === over.id ? { ...e, ...over.patch } : e)));

test('etapaAtual: fluxo normal aponta para a menor ordem pendente', () => {
  assert.equal(etapaAtual(cadeia())?.id, 'e2');
});

test('etapaAtual: devolvida encerra o fluxo (ninguém é a vez até reenviar)', () => {
  const etapas = cadeia({ id: 'e2', patch: { status: 'devolvida', justificativa: 'Faltou anexo' } });
  // Sem o tratamento, a execução (e3, ainda pendente) viraria "a atual" — errado.
  assert.equal(etapaAtual(etapas), null);
});

test('etapaAtual: reprovada continua encerrando o fluxo', () => {
  const etapas = cadeia({ id: 'e2', patch: { status: 'reprovada' } });
  assert.equal(etapaAtual(etapas), null);
});

test('etapaAtual: após reenvio (todas pendentes de novo) volta a apontar a 1ª', () => {
  const reenviada = [
    { id: 'e1', ordem: 1, tipo_etapa: 'aprovacao', status: 'pendente', aprovador_id: 'a', papel: 'Ana' },
    { id: 'e2', ordem: 2, tipo_etapa: 'aprovacao', status: 'pendente', aprovador_id: 'b', papel: 'Bruno' },
    { id: 'e3', ordem: 3, tipo_etapa: 'execucao', status: 'pendente', aprovador_id: 'x', papel: 'Admin (execução)' },
  ];
  assert.equal(etapaAtual(reenviada)?.id, 'e1');
});

test('resumoAndamento: devolvida nomeia quem devolveu, tom próprio', () => {
  const etapas = cadeia({ id: 'e2', patch: { status: 'devolvida', papel: 'Bruno' } });
  const r = resumoAndamento({ status: 'devolvida' }, etapas);
  assert.equal(r.tom, 'devolvida');
  assert.match(r.texto, /Devolvida para ajustes por Bruno/);
});

test('resumoAndamento: reprovada e concluída seguem inalteradas', () => {
  const rep = resumoAndamento({ status: 'reprovada' },
    cadeia({ id: 'e2', patch: { status: 'reprovada', papel: 'Bruno' } }));
  assert.equal(rep.tom, 'reprovada');
  assert.equal(resumoAndamento({ status: 'concluida' }, cadeia()).tom, 'concluida');
});
