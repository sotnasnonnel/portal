import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULOS_AUSENCIA, MOD_AUSENCIA, MOD_FOLGA_CAMPO,
  FOLGA_CAMPO_LIBERADOS, modulosAusenciaDe, podeAcessarFolgaCampo,
} from './modulosAusencia.js';

// Ausência Programada e Folga de Campo rodam no MESMO código de tela e de
// serviço — o que separa uma da outra é só este descritor. Se dois campos de
// identidade se repetirem, a folga passa a ler e escrever na conta da ausência
// (ou o menu some), e nada nisso dá erro em tempo de execução.
const IDENTIDADE = ['chave', 'rota', 'rpc', 'tabelaPeriodos', 'evento', 'navKey', 'arquivo'];

test('os dois módulos têm identidade própria em todos os campos que separam um do outro', () => {
  IDENTIDADE.forEach((campo) => {
    assert.notEqual(
      MOD_AUSENCIA[campo], MOD_FOLGA_CAMPO[campo],
      `"${campo}" repetido nos dois módulos`,
    );
  });
});

test('todo módulo declara os campos que as telas usam', () => {
  const OBRIGATORIOS = [
    ...IDENTIDADE,
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

// ---- Piloto da Folga de Campo ---------------------------------------------
// O erro caro aqui é o inverso do esperado: travar a AUSÊNCIA, que é de todo
// mundo, ao travar a folga.
const liberado = { email: FOLGA_CAMPO_LIBERADOS[0] };
const qualquerUm = { email: 'fulano.silva@phdengenharia.eng.br' };

test('a folga de campo só aparece para quem está na lista do piloto', () => {
  assert.equal(podeAcessarFolgaCampo(liberado), true);
  assert.equal(podeAcessarFolgaCampo(qualquerUm), false);
  assert.equal(podeAcessarFolgaCampo(null), false);
  assert.equal(podeAcessarFolgaCampo({}), false);
});

test('e-mail com espaço ou em maiúsculas continua liberado', () => {
  assert.equal(podeAcessarFolgaCampo({ email: `  ${FOLGA_CAMPO_LIBERADOS[0].toUpperCase()} ` }), true);
});

test('o piloto não tira a ausência programada de ninguém', () => {
  assert.deepEqual(modulosAusenciaDe(qualquerUm), [MOD_AUSENCIA]);
  assert.deepEqual(modulosAusenciaDe(null), [MOD_AUSENCIA]);
  assert.deepEqual(modulosAusenciaDe(liberado), [MOD_AUSENCIA, MOD_FOLGA_CAMPO]);
});
