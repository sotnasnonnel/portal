import test from 'node:test';
import assert from 'node:assert/strict';
import { motivosDe, documentosDoPlano, SCHEMA_PLANO_SAUDE, MOTIVOS_PLANO } from './planoSaude.js';
import { validarCamposExtras, campoAplica } from '../../../lib/camposExtras.js';
import { documentosDoServico } from './schemas.js';
import { assuntoDoServico } from '../../../../../config/administrativo.js';

test('motivo depende do plano e do tipo, como na aba Motivos', () => {
  assert.ok(motivosDe('Plano Médico', 'Solicitação').includes('Exclusão do titular'));
  assert.ok(!motivosDe('Plano Odontológico', 'Solicitação').includes('Exclusão do titular'));
  assert.ok(motivosDe('Plano Médico', 'Dúvida').includes('Coparticipação'));
  assert.ok(!motivosDe('Plano Odontológico', 'Dúvida').includes('Coparticipação'));
});

const rotulos = (v) => documentosDoPlano(v).documentos.map((d) => d.rotulo);
const obrigatorios = (v) => documentosDoPlano(v).documentos.filter((d) => d.obrigatorio).map((d) => d.rotulo);
const SOLIC_MED = { categoria: 'Plano Médico', tipo: 'Solicitação' };

test('documento obrigatório só onde a planilha marca "Anexo? Sim"', () => {
  for (const m of MOTIVOS_PLANO) {
    const v = { ...m, vinculo: 'Filho(a)' };
    assert.equal(obrigatorios(v).length > 0, m.anexo, `${m.categoria} / ${m.motivo}`);
  }
  assert.deepEqual(documentosDoPlano({}).documentos, []);
  // Só o plano de saúde pede documento a documento.
  assert.deepEqual(documentosDoServico('ti', 'impressoras', {}).documentos, []);
});

test('cada documento é um campo: RG e CPF separados na inclusão do titular', () => {
  const v = { ...SOLIC_MED, motivo: 'Inclusão no plano' };
  assert.deepEqual(obrigatorios(v), ['RG', 'CPF']);
  // O formulário da operadora é condicional na planilha.
  assert.ok(rotulos(v).includes('Formulário de adesão da operadora'));
});

test('documentos da inclusão de dependente seguem o vínculo', () => {
  const base = { ...SOLIC_MED, motivo: 'Inclusão de dependente' };
  assert.deepEqual(obrigatorios({ ...base, vinculo: 'Cônjuge' }),
    ['RG do cônjuge', 'CPF do cônjuge', 'Certidão de casamento']);
  assert.ok(obrigatorios({ ...base, vinculo: 'Companheiro(a)' }).includes('Comprovação de união estável'));
  assert.deepEqual(obrigatorios({ ...base, vinculo: 'Menor sob guarda/tutela' }),
    ['Certidão de nascimento', 'CPF do menor', 'Termo judicial de guarda ou tutela']);
  // Sem vínculo, ainda não dá para saber a lista.
  const sem = documentosDoPlano(base);
  assert.deepEqual(sem.documentos, []);
  assert.match(sem.aviso, /vínculo/);
});

test('as chaves dos documentos não se repetem num mesmo pedido', () => {
  for (const m of MOTIVOS_PLANO) {
    for (const vinculo of ['Cônjuge', 'Companheiro(a)', 'Filho(a)', 'Enteado(a)', 'Menor sob guarda/tutela']) {
      const chaves = documentosDoPlano({ ...m, vinculo }).documentos.map((d) => d.chave);
      assert.equal(new Set(chaves).size, chaves.length, `${m.motivo} / ${vinculo}`);
    }
  }
});

test('exclusão pede a carta', () => {
  assert.match(obrigatorios({ ...SOLIC_MED, motivo: 'Exclusão do titular' })[0], /^Carta de solicitação/);
  assert.deepEqual(obrigatorios({ ...SOLIC_MED, motivo: 'Exclusão de dependente' }),
    ['Carta de exclusão assinada pelo titular']);
});

test('campos complementares aparecem e são exigidos conforme o motivo', () => {
  const v = { tipo: 'Solicitação', categoria: 'Plano Médico', motivo: 'Inclusão de dependente' };
  assert.equal(validarCamposExtras(SCHEMA_PLANO_SAUDE, v), 'Preencha o campo "Nome do dependente".');
  const ok = { ...v, dependente: 'Ana', vinculo: 'Filho(a)', data_inclusao: '2026-12-01' };
  assert.equal(validarCamposExtras(SCHEMA_PLANO_SAUDE, ok), '');
  const competencia = SCHEMA_PLANO_SAUDE.find((c) => c.chave === 'competencia');
  assert.equal(campoAplica(competencia, ok), false);
});

test('motivo que não existe no plano escolhido é recusado', () => {
  const v = { tipo: 'Solicitação', categoria: 'Plano Odontológico', motivo: 'Exclusão do titular' };
  assert.match(validarCamposExtras(SCHEMA_PLANO_SAUDE, v), /Escolha de novo/);
});

test('assunto do chamado leva o plano e o motivo', () => {
  assert.equal(
    assuntoDoServico('dp', 'plano-saude', { categoria: 'Plano Médico', motivo: 'Inclusão no plano' }),
    'Plano Médico – Inclusão no plano',
  );
  assert.equal(assuntoDoServico('dp', 'plano-saude', {}), 'Plano de saúde e odontológico');
});

test('o formulário abre aos poucos: tipo, plano, motivo e só então o resto', async () => {
  const { detalhesLiberados } = await import('./schemas.js');
  const campo = (chave) => SCHEMA_PLANO_SAUDE.find((c) => c.chave === chave);
  const naTela = (v) => SCHEMA_PLANO_SAUDE.filter((c) => campoAplica(c, v)).map((c) => c.chave);

  assert.deepEqual(naTela({}), ['tipo']);
  assert.deepEqual(naTela({ tipo: 'Solicitação' }), ['tipo', 'categoria']);
  assert.deepEqual(naTela({ tipo: 'Solicitação', categoria: 'Plano Médico' }), ['tipo', 'categoria', 'motivo']);
  assert.equal(campoAplica(campo('vinculo'), { tipo: 'Solicitação', categoria: 'Plano Médico', motivo: 'Inclusão de dependente' }), true);

  assert.equal(detalhesLiberados('dp', 'plano-saude', { tipo: 'Solicitação', categoria: 'Plano Médico' }), false);
  assert.equal(detalhesLiberados('dp', 'plano-saude', { tipo: 'Solicitação', categoria: 'Plano Médico', motivo: 'Inclusão no plano' }), true);
  assert.equal(detalhesLiberados('ti', 'impressoras', {}), true);
});
