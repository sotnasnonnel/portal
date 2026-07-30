import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITE_PADRAO,
  minutosEntre,
  horaParaMin,
  fmtMin,
  diaISO,
  fmtDataBr,
  fmtHora,
  statusLabel,
  statusClasse,
  validarPrazo,
  podeDecidir,
  podeCompensar,
} from './horasExtras.js';

// Hora local fixa, para o teste não depender do fuso da máquina de CI.
const em = (dia, hora, min) => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y, m - 1, d, hora, min, 0, 0);
};

test('minutosEntre soma o intervalo e zera quando o fim não é maior', () => {
  assert.equal(minutosEntre('18:00', '20:00'), 120);
  assert.equal(minutosEntre('18:30', '19:15'), 45);
  assert.equal(minutosEntre('20:00', '18:00'), 0); // invertido
  assert.equal(minutosEntre('18:00', '18:00'), 0);
  assert.equal(minutosEntre('', '20:00'), 0);
});

test('horaParaMin rejeita horários impossíveis', () => {
  assert.equal(horaParaMin('00:00'), 0);
  assert.equal(horaParaMin('23:59'), 1439);
  assert.equal(horaParaMin('24:00'), null);
  assert.equal(horaParaMin('12:60'), null);
  assert.equal(horaParaMin('abc'), null);
});

test('fmtMin devolve HH:MM com dois dígitos', () => {
  assert.equal(fmtMin(120), '02:00');
  assert.equal(fmtMin(45), '00:45');
  assert.equal(fmtMin(605), '10:05');
  assert.equal(fmtMin(0), '00:00');
  assert.equal(fmtMin(null), '00:00');
});

test('diaISO usa a data local (não a UTC)', () => {
  // 23h no horário local ainda é o mesmo dia, mesmo que em UTC já seja o dia seguinte.
  assert.equal(diaISO(em('2026-07-30', 23, 30)), '2026-07-30');
  assert.equal(diaISO(em('2026-07-30', 0, 10)), '2026-07-30');
});

test('formatação de data e hora do banco', () => {
  assert.equal(fmtDataBr('2026-07-30'), '30/07/2026');
  assert.equal(fmtDataBr(null), '—');
  assert.equal(fmtHora('18:00:00'), '18:00');
  assert.equal(fmtHora(null), '—');
});

test('statusLabel junta o destino na aprovada e na compensada', () => {
  assert.equal(statusLabel('pendente'), 'Pendente de Aprovação');
  assert.equal(statusLabel('aprovada', 'medicao'), 'Aprovada · Medição/Pagamento');
  assert.equal(statusLabel('compensada', 'banco'), 'Compensada · Banco de Horas');
  assert.equal(statusLabel('reprovada', 'medicao'), 'Reprovada'); // destino não entra
});

test('statusClasse separa medição de banco na aprovada', () => {
  assert.equal(statusClasse('aprovada', 'banco'), 'banco');
  assert.equal(statusClasse('aprovada', 'medicao'), 'medicao');
  assert.equal(statusClasse('reprovada', null), 'reprovada');
});

test('prazo: dentro do limite no próprio dia', () => {
  const r = validarPrazo({ data: '2026-07-30', agora: em('2026-07-30', 9, 0) });
  assert.equal(r.ok, true);
  assert.equal(r.limite, LIMITE_PADRAO);
  assert.match(r.msg, /Horário limite: 12:00 \(regra padrão\)/);
});

test('prazo: bloqueia depois do limite no próprio dia', () => {
  const r = validarPrazo({ data: '2026-07-30', agora: em('2026-07-30', 12, 1) });
  assert.equal(r.ok, false);
  assert.match(r.msg, /Prazo encerrado às 12:00/);
});

test('prazo: 12:00 em ponto ainda vale', () => {
  const r = validarPrazo({ data: '2026-07-30', agora: em('2026-07-30', 12, 0) });
  assert.equal(r.ok, true);
});

test('prazo: dia futuro não olha o horário', () => {
  const r = validarPrazo({ data: '2026-08-05', agora: em('2026-07-30', 23, 50) });
  assert.equal(r.ok, true);
});

test('prazo: retroativo bloqueado sem exceção', () => {
  const r = validarPrazo({ data: '2026-07-29', agora: em('2026-07-30', 8, 0) });
  assert.equal(r.ok, false);
  assert.match(r.msg, /retroativa não permitida/);
});

test('prazo: exceção estende o limite do dia', () => {
  const excecao = { tipo: 'global', novo_horario: '15:00:00', data_inicial: '2026-07-30', data_final: '2026-07-30' };
  const r = validarPrazo({ data: '2026-07-30', agora: em('2026-07-30', 14, 30), excecao });
  assert.equal(r.ok, true);
  assert.equal(r.limite, '15:00');
  assert.match(r.msg, /exceção ativa: global/);
  // Passado o novo limite, volta a bloquear — agora citando o horário da exceção.
  const r2 = validarPrazo({ data: '2026-07-30', agora: em('2026-07-30', 15, 5), excecao });
  assert.equal(r2.ok, false);
  assert.match(r2.msg, /Prazo encerrado às 15:00/);
});

test('prazo: exceção libera o retroativo dentro do seu período', () => {
  const excecao = { tipo: 'colaborador', novo_horario: '18:00:00', data_inicial: '2026-07-27', data_final: '2026-07-29' };
  const r = validarPrazo({ data: '2026-07-28', agora: em('2026-07-30', 9, 0), excecao });
  assert.equal(r.ok, true);
  assert.match(r.msg, /retroativo liberado/);
});

test('prazo: sem data não passa', () => {
  const r = validarPrazo({ data: '', agora: em('2026-07-30', 9, 0) });
  assert.equal(r.ok, false);
});

test('podeDecidir só para o aprovador da vez', () => {
  const s = { status: 'pendente', aprovador_id: 'g1' };
  assert.equal(podeDecidir(s, 'g1'), true);
  assert.equal(podeDecidir(s, 'outro'), false);
  assert.equal(podeDecidir({ ...s, status: 'aprovada' }, 'g1'), false);
});

test('podeCompensar só no banco de horas aprovado', () => {
  assert.equal(podeCompensar({ status: 'aprovada', destino: 'banco' }), true);
  assert.equal(podeCompensar({ status: 'aprovada', destino: 'medicao' }), false);
  assert.equal(podeCompensar({ status: 'compensada', destino: 'banco' }), false);
});
