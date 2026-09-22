import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS_AUSENCIA, MOD_AUSENCIA, MOD_FOLGA_CAMPO } from './modulosAusencia.js';

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
