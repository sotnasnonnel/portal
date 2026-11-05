import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situacaoDoChamado, nomeDoCampoPessoa, ehIdCru, camposVisiveis } from './situacaoChamado.js';

const etapas = [
  { id: 'e2', ordem: 2, aprovador_id: 'ana', status: 'pendente' },
  { id: 'e1', ordem: 1, aprovador_id: 'eu', status: 'pendente' },
];
const nomesEtapas = { ana: 'Ana', eu: 'Pessoa' };

test('em aprovação, a bola está com a menor ordem pendente', () => {
  const minha = situacaoDoChamado({
    status: 'aguardando_aprovacao', meuId: 'eu', etapas, nomesEtapas, minhaEtapa: etapas[1],
  });
  assert.equal(minha.comQuem, 'Você, para aprovar');
  assert.equal(minha.passo.suaVez, true);

  const deOutro = situacaoDoChamado({ status: 'aguardando_aprovacao', meuId: 'bruno', etapas, nomesEtapas });
  assert.equal(deOutro.comQuem, 'Pessoa, para aprovar');
  assert.equal(deOutro.passo.suaVez, false);
});

test('aprovação sem cadeia só vira tarefa para o time', () => {
  const base = { status: 'aguardando_aprovacao', meuId: 'eu', etapas: [] };
  assert.equal(situacaoDoChamado(base).comQuem, 'Sem aprovador registrado');
  assert.equal(situacaoDoChamado(base).passo.suaVez, false);
  assert.equal(situacaoDoChamado({ ...base, souTime: true }).passo.suaVez, true);
});

test('sem responsável, quem pode assumir é chamado a assumir', () => {
  const r = situacaoDoChamado({ status: 'aberto', meuId: 'eu', podeAssumir: true });
  assert.equal(r.comQuem, 'Fila, sem responsável');
  assert.match(r.passo.texto, /^Assuma/);
  assert.equal(r.passo.suaVez, true);
});

test('o responsável vê a própria vez; o colega do time, não', () => {
  const meu = situacaoDoChamado({ status: 'em_atendimento', meuId: 'eu', atendenteId: 'eu' });
  assert.equal(meu.comQuem, 'Você');
  assert.equal(meu.passo.suaVez, true);

  const deOutro = situacaoDoChamado({
    status: 'em_atendimento', meuId: 'eu', atendenteId: 'ana', atendenteNome: 'Ana', podeAssumir: true,
  });
  assert.equal(deOutro.comQuem, 'Ana');
  assert.equal(deOutro.passo.suaVez, false);
});

test('aguardando solicitante: a bola é de quem abriu, mesmo com responsável', () => {
  const dele = situacaoDoChamado({
    status: 'aguardando_solicitante', meuId: 'eu', souSolicitante: true, atendenteId: 'ana',
  });
  assert.equal(dele.comQuem, 'Você');
  assert.equal(dele.passo.suaVez, true);

  const doAtendente = situacaoDoChamado({
    status: 'aguardando_solicitante', meuId: 'eu', atendenteId: 'eu', solicitanteNome: 'Bruno',
  });
  assert.equal(doAtendente.comQuem, 'Bruno');
  assert.match(doAtendente.passo.texto, /^Aguarde/);
});

test('fechado sem avaliação cobra quem abriu; avaliado não tem bola com ninguém', () => {
  const pendente = situacaoDoChamado({
    status: 'fechado', meuId: 'eu', souSolicitante: true, precisaAvaliar: true, podeReabrir: true,
  });
  assert.equal(pendente.comQuem, 'Você, para avaliar');
  assert.equal(pendente.passo.suaVez, true);

  const avaliado = situacaoDoChamado({
    status: 'fechado', meuId: 'eu', souSolicitante: true, temAvaliacao: true, podeReabrir: true,
  });
  assert.equal(avaliado.comQuem, null);
  assert.match(avaliado.passo.texto, /reabrir/);
});

test('reprovado e cancelado não têm dono nem tarefa', () => {
  for (const status of ['reprovado', 'cancelado']) {
    const r = situacaoDoChamado({ status, meuId: 'eu', souSolicitante: true });
    assert.equal(r.comQuem, null);
    assert.equal(r.passo.suaVez, false);
  }
});

test('campo de pessoa nunca mostra id cru', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal(nomeDoCampoPessoa(id, { [id]: 'Ana' }), 'Ana');
  assert.equal(nomeDoCampoPessoa(id, {}), 'Não identificado');
  assert.equal(nomeDoCampoPessoa('Fulano de chamado antigo', {}), 'Fulano de chamado antigo');
  assert.equal(ehIdCru(id), true);
  assert.equal(ehIdCru('CT-1042 Obra Paulínia'), false);
});

test('dados do pedido: recolhe só o excesso, e nunca para quem vai decidir', () => {
  assert.equal(camposVisiveis(5), 5);
  assert.equal(camposVisiveis(9), 9);
  assert.equal(camposVisiveis(14), 8);
  assert.equal(camposVisiveis(14, { expandido: true }), 14);
  assert.equal(camposVisiveis(14, { vaiDecidir: true }), 14);
});
