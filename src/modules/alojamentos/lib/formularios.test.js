import test from 'node:test';
import assert from 'node:assert/strict';
import {
  valoresIniciais, coletar, faltando, opcoes, stayFields, alojOpts, ALOJ_PADRAO, alojFields,
} from './formularios.js';

const base = {
  alojamentos: [
    { id: 'a1', nome: 'Prado', status: 'ativo', quartos: [{ id: 'q1', nome: 'Quarto 1', vagas: 2 }, { id: 'q2', nome: 'Quarto 2', vagas: 1 }] },
    { id: 'a2', nome: 'Velho', status: 'inativo', quartos: [] },
  ],
  estadias: [{ alojamento_id: 'a1', quarto_id: 'q2', morador: 'Ana' }],
  pagamentos: [],
  itens: [],
  ocorrencias: [],
};

test('select sem valor válido abre na 1ª opção, e é ela que vale ao salvar', () => {
  const campos = [{ k: 'tipo', type: 'select', opts: ['Casa', 'Hotel'] }, { k: 'dia', type: 'select', opts: ['', 'A'] }];
  assert.deepEqual(valoresIniciais(campos, { tipo: 'Inexistente' }), { tipo: 'Casa', dia: '' });
});

test('valoresIniciais aplica o padrão, o toggle e a lista de marcados', () => {
  const v = valoresIniciais(alojFields(true), ALOJ_PADRAO);
  assert.equal(v.status, 'ativo');
  assert.equal(v.tipo, 'Apartamento');
  assert.equal(v.contrato_renovacao_automatica, false);
  assert.ok(v.contas_controladas.includes('Aluguel'));
});

test('coletar apara texto e converte número; vazio de número vira null', () => {
  const campos = [{ section: 'X' }, { k: 'nome' }, { k: 'valor', type: 'money' }, { k: 'q', type: 'int' }, { k: 'ok', type: 'toggle' }];
  assert.deepEqual(coletar(campos, { nome: ' Ana ', valor: '10.5', q: '', ok: true }), { nome: 'Ana', valor: 10.5, q: null, ok: true });
});

test('faltando devolve os rótulos dos obrigatórios vazios', () => {
  const campos = [{ k: 'a', label: 'A', req: true }, { k: 'b', label: 'B', req: true }, { k: 'c', label: 'C' }];
  assert.deepEqual(faltando(campos, { a: '', b: 'x', c: '' }), ['A']);
});

test('quartos da entrada dizem quem está livre; alojamento inativo não entra na entrada', () => {
  const [aloj, quarto] = stayFields(base, false);
  assert.deepEqual(opcoes(aloj, {}).map(([v]) => v), ['', 'a1']);
  assert.deepEqual(opcoes(quarto, { alojamento_id: 'a1' }).map(([, l]) => l), ['Quarto 1 · 2 vaga(s) livre(s)', 'Quarto 2 · ocupado']);
  assert.deepEqual(opcoes(quarto, {}), [['', 'Escolha o alojamento']]);
  assert.equal(quarto.req, true);
});

test('na edição, estadia de quarto excluído não é movida para o 1º quarto', () => {
  const campos = stayFields(base, true);
  const v = valoresIniciais(campos, { alojamento_id: 'a1', quarto_id: null, morador: 'Ana' });
  assert.equal(v.quarto_id, '');
  assert.deepEqual(faltando(campos, coletar(campos, v)), []);
  assert.deepEqual(opcoes(campos[0], {}).map(([v2]) => v2), ['', 'a1', 'a2']);
});

test('alojOpts marca a situação de quem não está ativo', () => {
  assert.deepEqual(alojOpts(base, true), [['a1', 'Prado'], ['a2', 'Velho (inativo)']]);
});
