import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diasCorridos, fimPorDias, inicioAlerta, situacaoPeriodo, resumoSaldo, periodoSugerido,
  validarPedido, statusExibido, podeCancelar, podeDecidir, isAusenciaRh,
} from './ausenciaProgramada.js';

const HOJE = '2026-09-17';

// Período do exemplo do briefing: admissão em 20/08/2024, uso a partir de
// 20/08/2025. Cada teste troca as datas que importam para o caso.
const periodo = (extra = {}) => ({
  id: 'p1',
  inicio_periodo: '2024-08-20',
  fim_periodo: '2025-08-20',
  data_inicial: '2025-08-20',
  data_limite: '2026-08-20',
  saldo: 21,
  dias_tirados: 0,
  dias_agendados: 0,
  dias_pendentes: 0,
  ...extra,
});

test('dias corridos contam o início e o fim', () => {
  assert.equal(diasCorridos('2026-10-01', '2026-10-01'), 1);
  assert.equal(diasCorridos('2026-10-01', '2026-10-21'), 21);
  // Atravessa o fim do horário de verão/mês sem escorregar.
  assert.equal(diasCorridos('2026-10-25', '2026-11-08'), 15);
  assert.equal(diasCorridos('2026-10-02', '2026-10-01'), 0);
});

test('fim por quantidade de dias (divisão 14 + 7)', () => {
  assert.equal(fimPorDias('2026-10-01', 14), '2026-10-14');
  assert.equal(fimPorDias('2026-12-20', 7), '2026-12-26');
  assert.equal(fimPorDias('2026-10-01', 0), '');
  assert.equal(fimPorDias('', 5), '');
});

test('alerta começa 3 meses antes da data limite, respeitando o fim do mês', () => {
  assert.equal(inicioAlerta('2026-12-31'), '2026-09-30');
  assert.equal(inicioAlerta('2027-05-31'), '2027-02-28');
  assert.equal(inicioAlerta('2026-11-20'), '2026-08-20');
});

test('situação do período', () => {
  assert.equal(situacaoPeriodo(periodo({ data_inicial: '2027-09-14', data_limite: '2028-09-14' }), HOJE), 'em_aquisicao');
  assert.equal(situacaoPeriodo(periodo({ data_limite: '2027-08-20' }), HOJE), 'disponivel');
  assert.equal(situacaoPeriodo(periodo({ data_limite: '2026-12-01' }), HOJE), 'vencendo');
  assert.equal(situacaoPeriodo(periodo({ data_limite: '2026-08-20' }), HOJE), 'vencido');
  assert.equal(situacaoPeriodo(periodo({ data_limite: '2026-08-20', saldo: 0 }), HOJE), 'sem_saldo');
  assert.equal(situacaoPeriodo(periodo({ data_limite: '2027-08-20', saldo: 0 }), HOJE), 'sem_saldo');
});

test('resumo soma só o saldo que dá para usar hoje', () => {
  const r = resumoSaldo([
    periodo({ id: 'a', data_limite: '2026-12-10', saldo: 11, dias_tirados: 10 }),
    periodo({ id: 'b', data_inicial: '2026-08-20', data_limite: '2027-08-20', saldo: 21, dias_agendados: 0 }),
    periodo({ id: 'c', data_inicial: '2027-08-20', data_limite: '2028-08-20', saldo: 21 }),
    periodo({ id: 'd', data_limite: '2026-01-01', saldo: 5 }),
  ], HOJE);
  assert.equal(r.saldo, 32);
  assert.equal(r.tirados, 10);
  assert.equal(r.dataLimite, '2026-12-10');
  assert.equal(r.vencendo.length, 1);
  assert.equal(r.bloqueado, false);
});

test('colaborador novo fica bloqueado até completar o período', () => {
  const r = resumoSaldo([periodo({ data_inicial: '2027-09-14', data_limite: '2028-09-14' })], HOJE);
  assert.equal(r.bloqueado, true);
  assert.equal(r.saldo, 0);
  assert.equal(r.dataInicial, '2027-09-14');
});

test('período sugerido é o de data limite mais próxima', () => {
  const ps = [
    periodo({ id: 'novo', data_inicial: '2026-08-20', data_limite: '2027-08-20' }),
    periodo({ id: 'velho', data_limite: '2026-12-31' }),
    periodo({ id: 'zerado', data_limite: '2026-10-01', saldo: 0 }),
  ];
  assert.equal(periodoSugerido(ps, '2026-10-05').id, 'velho');
  assert.equal(periodoSugerido([periodo({ data_inicial: '2027-01-01' })], '2026-10-05'), null);
});

test('pedido válido e pedido fora do prazo (avisa, não bloqueia)', () => {
  const ok = validarPedido({ periodo: periodo({ data_limite: '2027-08-20' }), inicio: '2026-10-01', fim: '2026-10-14', hoje: HOJE });
  assert.equal(ok.ok, true);
  assert.equal(ok.dias, 14);
  assert.deepEqual(ok.avisos, []);

  const fora = validarPedido({ periodo: periodo({ data_limite: '2026-10-10' }), inicio: '2026-10-01', fim: '2026-10-14', hoje: HOJE });
  assert.equal(fora.ok, true);
  assert.equal(fora.avisos.length, 1);
  assert.match(fora.avisos[0], /Fora do prazo/);
});

test('pedido bloqueado: saldo, passado, período não liberado, sobreposição', () => {
  const p = periodo({ data_limite: '2027-08-20', saldo: 7 });
  assert.match(validarPedido({ periodo: p, inicio: '2026-10-01', fim: '2026-10-14', hoje: HOJE }).erros.join(), /Saldo insuficiente/);
  assert.match(validarPedido({ periodo: p, inicio: '2026-09-10', fim: '2026-09-11', hoje: HOJE }).erros.join(), /passado/);
  assert.match(
    validarPedido({ periodo: periodo({ data_inicial: '2027-01-01', data_limite: '2028-01-01' }), inicio: '2026-10-01', fim: '2026-10-02', hoje: HOJE }).erros.join(),
    /a partir de 01\/01\/2027/,
  );
  const outras = [
    { id: 'x', numero: 7, status: 'aprovada', data_inicio: '2026-10-05', data_fim: '2026-10-06' },
    { id: 'y', numero: 8, status: 'cancelada', data_inicio: '2026-10-01', data_fim: '2026-10-02' },
  ];
  const r = validarPedido({ periodo: p, inicio: '2026-10-01', fim: '2026-10-05', outras, hoje: HOJE });
  assert.equal(r.ok, false);
  assert.match(r.erros.join(), /#7/);
  // O próprio pedido em edição não conflita consigo mesmo.
  assert.equal(validarPedido({ periodo: p, inicio: '2026-10-05', fim: '2026-10-06', outras, idAtual: 'x', hoje: HOJE }).ok, true);
});

test('campos obrigatórios', () => {
  const r = validarPedido({ hoje: HOJE });
  assert.equal(r.ok, false);
  assert.equal(r.erros.length, 3);
});

test('concluída é a aprovada que já terminou', () => {
  assert.equal(statusExibido({ status: 'aprovada', data_fim: '2026-09-16' }, HOJE), 'concluida');
  assert.equal(statusExibido({ status: 'aprovada', data_fim: '2026-09-17' }, HOJE), 'aprovada');
  assert.equal(statusExibido({ status: 'pendente', data_fim: '2026-01-01' }, HOJE), 'pendente');
});

test('cancelamento: colaborador só antes de começar; gestor e RH sempre', () => {
  const aprovadaFutura = { status: 'aprovada', colaborador_id: 'eu', data_inicio: '2026-10-01' };
  const aprovadaEmCurso = { status: 'aprovada', colaborador_id: 'eu', data_inicio: '2026-09-15' };
  assert.equal(podeCancelar(aprovadaFutura, { userId: 'eu' }, HOJE), true);
  assert.equal(podeCancelar(aprovadaEmCurso, { userId: 'eu' }, HOJE), false);
  assert.equal(podeCancelar(aprovadaEmCurso, { userId: 'g', ehAprovador: true }, HOJE), true);
  assert.equal(podeCancelar({ ...aprovadaFutura, status: 'reprovada' }, { userId: 'eu', ehRh: true }, HOJE), false);
  assert.equal(podeCancelar(aprovadaFutura, { userId: 'outro' }, HOJE), false);
});

test('decisão: aprovador ou RH, nunca a própria', () => {
  const s = { status: 'pendente', colaborador_id: 'c', aprovador_id: 'g' };
  assert.equal(podeDecidir(s, { userId: 'g' }), true);
  assert.equal(podeDecidir(s, { userId: 'x' }), false);
  assert.equal(podeDecidir(s, { userId: 'x', ehRh: true }), true);
  assert.equal(podeDecidir(s, { userId: 'c', ehRh: true }), false);
  assert.equal(podeDecidir({ ...s, status: 'aprovada' }, { userId: 'g' }), false);
});

test('RH da ausência', () => {
  assert.equal(isAusenciaRh({ rhDp: true, perfil: 'gestor' }), true);
  assert.equal(isAusenciaRh({ perfil: 'admin' }), true);
  assert.equal(isAusenciaRh({ perfil: 'usuario' }), false);
  assert.equal(isAusenciaRh(null), false);
});
