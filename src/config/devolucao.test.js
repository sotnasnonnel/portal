import test from 'node:test';
import assert from 'node:assert/strict';
import { etapaAtual, resumoAndamento, badgeDeStatus, STATUS_BADGE } from './aprovacao.js';

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

test('etapaAtual: cancelada encerra o fluxo (não vaza para a execução)', () => {
  const etapas = cadeia({ id: 'e2', patch: { status: 'cancelada', justificativa: 'Duplicada' } });
  assert.equal(etapaAtual(etapas), null);
});

test('etapaAtual: responder reabre a etapa de quem reprovou (a 1ª aprovou, e2 pendente de novo)', () => {
  // Cenário pós-"responder": e1 aprovada, e2 (quem reprovou) volta a pendente.
  const respondida = [
    { id: 'e1', ordem: 1, tipo_etapa: 'aprovacao', status: 'aprovada', aprovador_id: 'a', papel: 'Ana' },
    { id: 'e2', ordem: 2, tipo_etapa: 'aprovacao', status: 'pendente', aprovador_id: 'b', papel: 'Bruno' },
    { id: 'e3', ordem: 3, tipo_etapa: 'execucao', status: 'pendente', aprovador_id: 'x', papel: 'Admin (execução)' },
  ];
  assert.equal(etapaAtual(respondida)?.id, 'e2');
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

test('resumoAndamento: cancelada tem tom e texto próprios', () => {
  const r = resumoAndamento({ status: 'cancelada' }, cadeia({ id: 'e2', patch: { status: 'cancelada' } }));
  assert.equal(r.tom, 'cancelada');
  assert.match(r.texto, /Cancelada pelo Admin/);
});

// ---- Selo de situação (bug da #126: cancelada aparecia como "Em andamento") ----

test('badgeDeStatus: cancelada NÃO pode virar "Em andamento"', () => {
  const b = badgeDeStatus('cancelada');
  assert.equal(b.label, 'Cancelada');
  assert.notEqual(b.label, 'Em andamento');
});

test('badgeDeStatus: cobre os 5 status aceitos pelo CHECK do banco', () => {
  for (const st of ['pendente', 'concluida', 'reprovada', 'devolvida', 'cancelada']) {
    assert.ok(STATUS_BADGE[st], `sem selo para "${st}"`);
    assert.equal(badgeDeStatus(st), STATUS_BADGE[st]);
  }
});

test('badgeDeStatus: situação desconhecida mostra o próprio nome, nunca "Em andamento"', () => {
  // Era o fallback silencioso que escondia o status faltando no mapa.
  const b = badgeDeStatus('status_futuro');
  assert.equal(b.label, 'status_futuro');
  assert.notEqual(b.label, 'Em andamento');
  assert.equal(badgeDeStatus(undefined).label, '—');
});

test('resumoAndamento e o selo concordam numa requisição cancelada', () => {
  const etapas = cadeia({ id: 'e2', patch: { status: 'cancelada', justificativa: 'Valor errado' } });
  const r = resumoAndamento({ status: 'cancelada' }, etapas);
  assert.equal(badgeDeStatus(r.tom).label, 'Cancelada');
  assert.equal(etapaAtual(etapas), null);   // e não "aguardando" ninguém
});
