import test from 'node:test';
import assert from 'node:assert/strict';
import {
  situacaoDaConfig, normalizarBusca, filtrarServicos, contarSituacoes, rascunhoMudou,
} from './configServico.js';

const CLASSES = [
  { slug: 'ti', label: 'Manutenção & Instalação TI', servicos: [{ slug: 'acessos', label: 'Liberação de acessos' }, { slug: 'software', label: 'Instalação de software' }] },
  { slug: 'frota', label: 'Gestão de frota', servicos: [{ slug: 'reserva', label: 'Reserva de veículos' }] },
];

test('serviço sem linha, ou com linha sem nada, é vazio', () => {
  assert.equal(situacaoDaConfig(undefined), 'vazio');
  assert.equal(situacaoDaConfig({ atendente_id: null, sla_dias_uteis: null, exige_aprovacao: false, campos_extras: [] }), 'vazio');
});

test('só fica pronto com atendente e prazo juntos', () => {
  assert.equal(situacaoDaConfig({ atendente_id: 'a', sla_dias_uteis: 2 }), 'pronto');
  assert.equal(situacaoDaConfig({ atendente_id: 'a' }), 'parcial');
  assert.equal(situacaoDaConfig({ sla_dias_uteis: 2 }), 'parcial');
  assert.equal(situacaoDaConfig({ exige_aprovacao: true }), 'parcial');
});

test('a busca ignora acento e caixa', () => {
  assert.equal(normalizarBusca('  MANUTENÇÃO '), 'manutencao');
  assert.equal(normalizarBusca(null), '');
});

test('filtro acha por serviço, por classe e por atendente, e some com grupo vazio', () => {
  const configs = { 'frota/reserva': { atendente_id: 'p1', sla_dias_uteis: 2 } };
  const nomePessoa = { p1: 'Bruno Lima' };
  const nomes = (r) => r.flatMap((c) => c.servicos.map((s) => s.slug));

  assert.deepEqual(nomes(filtrarServicos(CLASSES, { busca: 'veiculos' })), ['reserva']);
  assert.deepEqual(nomes(filtrarServicos(CLASSES, { busca: 'manutencao' })), ['acessos', 'software']);
  assert.deepEqual(nomes(filtrarServicos(CLASSES, { busca: 'bruno', configs, nomePessoa })), ['reserva']);
  assert.deepEqual(filtrarServicos(CLASSES, { busca: 'nada disso' }), []);
});

test('só pendentes esconde o que está pronto', () => {
  const configs = { 'frota/reserva': { atendente_id: 'p1', sla_dias_uteis: 2 } };
  const r = filtrarServicos(CLASSES, { soPendentes: true, configs });
  assert.deepEqual(r.map((c) => c.slug), ['ti']);
});

test('contagem separa prontos de pendentes', () => {
  const configs = { 'frota/reserva': { atendente_id: 'p1', sla_dias_uteis: 2 }, 'ti/acessos': { atendente_id: 'p1' } };
  assert.deepEqual(contarSituacoes(CLASSES, configs), { total: 3, prontos: 1, pendentes: 2 });
});

test('rascunho igual ao salvo não acusa mudança, mesmo com forma diferente', () => {
  const salvo = { atendente_id: 'a', sla_dias_uteis: 2, exige_aprovacao: false, aprovadores: [], campos_extras: [{ chave: 'x', rotulo: 'X', tipo: 'texto' }], classe: 'ti', servico: 'acessos' };
  const rascunho = { atendente_id: 'a', sla_dias_uteis: 2, exige_aprovacao: false, aprovadores: [], campos_extras: [{ chave: 'x', rotulo: 'X', tipo: 'texto', obrigatorio: false, opcoes: [] }] };
  assert.equal(rascunhoMudou(rascunho, salvo), false);
});

test('serviço sem linha comparado ao rascunho em branco não está sujo', () => {
  const branco = { atendente_id: null, sla_dias_uteis: null, exige_aprovacao: false, aprovadores: [], campos_extras: [] };
  assert.equal(rascunhoMudou(branco, undefined), false);
  assert.equal(rascunhoMudou({ ...branco, sla_dias_uteis: '' }, undefined), false);
});

test('cada mexida acusa mudança', () => {
  const salvo = { atendente_id: 'a', sla_dias_uteis: 2, exige_aprovacao: false, aprovadores: [], campos_extras: [] };
  assert.equal(rascunhoMudou({ ...salvo, atendente_id: 'b' }, salvo), true);
  assert.equal(rascunhoMudou({ ...salvo, sla_dias_uteis: 3 }, salvo), true);
  assert.equal(rascunhoMudou({ ...salvo, exige_aprovacao: true }, salvo), true);
  assert.equal(rascunhoMudou({ ...salvo, campos_extras: [{ chave: 'n', rotulo: '', tipo: 'texto' }] }, salvo), true);
});
