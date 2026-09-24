import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS_AUSENCIA, MOD_AUSENCIA } from './modulosAusencia.js';

// As telas de src/pages/AusenciaProgramada/ leem tudo deste descritor: campo
// que falte vira "undefined" escrito na tela, sem erro nenhum em tempo de
// execução.
test('o descritor declara todos os campos que as telas usam', () => {
  const OBRIGATORIOS = [
    'chave', 'rota', 'rpc', 'tabelaPeriodos', 'evento', 'navKey', 'arquivo',
    'nome', 'nomeMinusculo', 'substantivo', 'substantivoTitulo', 'plural', 'doModulo',
    'menuMinha', 'tituloAprovacoes', 'tituloEquipe', 'tituloPainel',
    'descricaoCartao', 'ctaCartao',
  ];
  MODULOS_AUSENCIA.forEach((mod) => {
    OBRIGATORIOS.forEach((campo) => {
      assert.ok(mod[campo], `${mod.chave}: falta "${campo}"`);
    });
  });
});

test('a rota não termina em barra (as telas montam /aprovacoes, /equipe e /painel em cima dela)', () => {
  MODULOS_AUSENCIA.forEach((mod) => {
    assert.ok(mod.rota.startsWith('/'), `${mod.chave}: rota deve começar com /`);
    assert.ok(!mod.rota.endsWith('/'), `${mod.chave}: rota não pode terminar com /`);
  });
});

// A Folga de Campo saiu daqui em 23/09/2026 (não tem saldo, virou módulo
// próprio). Se alguém pendurar de volta um módulo sem saldo nestas telas, elas
// vão pedir período e data limite que ele não tem.
test('a folga de campo não está mais pendurada nas telas da ausência', () => {
  assert.deepEqual(MODULOS_AUSENCIA, [MOD_AUSENCIA]);
});
