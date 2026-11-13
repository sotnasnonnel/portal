import test from 'node:test';
import assert from 'node:assert/strict';
import { ehAdminSetorAdm, ehTimeSetorAdm, podeAcessarSetorAdm } from './setorAdm.js';

const liberado = { email: 'marcus.guimaraes@phdengenharia.eng.br', setorAdmAcesso: true };
const semAcesso = { email: 'fulano.detal@phdengenharia.eng.br', setorAdmAcesso: false };
const admin = { administrativo: 'admin' };
const atendente = { administrativo: 'atendente' };
const semPapel = { administrativo: 'user' };

test('entra só quem está marcado no Gerenciamento de acessos', () => {
  assert.equal(podeAcessarSetorAdm(liberado), true);
  assert.equal(podeAcessarSetorAdm(semAcesso), false);
  // Sem a coluna carregada ainda (ou sessão a meio caminho), fica de fora:
  // o gate falha fechado, como a RLS.
  assert.equal(podeAcessarSetorAdm({ email: 'x@y.br' }), false);
  assert.equal(podeAcessarSetorAdm(null), false);
});

test('estar marcado já é ser do time: escrever não pede papel no Atendimento', () => {
  assert.equal(ehTimeSetorAdm(liberado), true);
  assert.equal(ehTimeSetorAdm(semAcesso), false);
});

test('administrar pede o checkbox E Admin no Atendimento', () => {
  assert.equal(ehAdminSetorAdm(admin, liberado), true);
  // Atendente do Adm entra e escreve, mas não configura nem exclui
  // cadastro-mestre — era o que a lista de e-mails deixava passar.
  assert.equal(ehAdminSetorAdm(atendente, liberado), false);
  assert.equal(ehAdminSetorAdm(semPapel, liberado), false);
  // Admin do Atendimento sem o checkbox não entra, então não administra.
  assert.equal(ehAdminSetorAdm(admin, semAcesso), false);
});
