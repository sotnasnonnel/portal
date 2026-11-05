import test from 'node:test';
import assert from 'node:assert/strict';
import { ehAdminSetorAdm, podeAcessarSetorAdm, SETOR_ADM_EM_BREVE } from './setorAdm.js';

const marcus = { email: 'marcus.guimaraes@phdengenharia.eng.br' };
const lennon = { email: 'Lennon.Santos@phdengenharia.eng.br' };
const jarbas = { email: 'jarbas.junior@phdengenharia.eng.br' };
const admin = { administrativo: 'admin' };
const atendente = { administrativo: 'atendente' };
const semPapel = { administrativo: 'user' };

test('em lançamento restrito, só os dois da lista entram', { skip: !SETOR_ADM_EM_BREVE }, () => {
  assert.equal(podeAcessarSetorAdm(marcus, admin), true);
  assert.equal(podeAcessarSetorAdm(lennon, atendente), true);
  assert.equal(podeAcessarSetorAdm(jarbas, admin), false);
  assert.equal(podeAcessarSetorAdm(null, admin), false);
});

test('na lista, atendente também administra; fora dela, nem o admin', { skip: !SETOR_ADM_EM_BREVE }, () => {
  assert.equal(ehAdminSetorAdm(admin, marcus), true);
  assert.equal(ehAdminSetorAdm(atendente, lennon), true);
  assert.equal(ehAdminSetorAdm(admin, jarbas), false);
  assert.equal(ehAdminSetorAdm(semPapel, marcus), false);
});
