import test from 'node:test';
import assert from 'node:assert/strict';
import gerador from './gerar_carga_mobilizacao.cjs';

const { data, normal, chaveDe, primeiraData, q, ABAS, STATUS } = gerador;

/**
 * As duas contas que, se errarem, ou duplicam processo ou jogam o ano inteiro
 * fora — e nenhuma das duas dá para conferir olhando o SQL gerado.
 */

test('serial do Excel vira data ISO', () => {
  // 46027 é 05/01/2026 na planilha (conferido contra a primeira linha de 2026).
  assert.equal(data(46027), '2026-01-05');
  assert.equal(data(45723), '2025-03-07');
});

// O erro clássico: a época do Excel é 30/12/1899 e a conta precisa ser em UTC.
// Em UTC-3, fazer a soma em horário local jogaria toda data para o dia anterior.
test('a conversão não escorrega de fuso', () => {
  assert.equal(data(46089), '2026-03-08');
  assert.equal(data(46090), '2026-03-09');
  assert.equal(data(46088), '2026-03-07');
});

test('célula vazia ou fora da faixa não vira data', () => {
  assert.equal(data(null), null);
  assert.equal(data(''), null);
  assert.equal(data(0), null);
  assert.equal(data(1), null, 'número de contagem não é data');
  assert.equal(data(99999), null);
  assert.equal(data('Finalizado'), null);
});

test('normalização tira acento, caixa e espaço em excesso', () => {
  assert.equal(normal('  GUILHERME  DE   ASSIS BRAGA '), 'guilherme de assis braga');
  assert.equal(normal('ELEVAÇÃO'), 'elevacao');
  assert.equal(normal('Letícia'), 'leticia');
  assert.equal(normal(null), '');
});

// As duas grafias de Letícia que convivem entre as abas da planilha precisam
// cair na mesma chave — senão a recarga cria um processo novo a cada import.
test('grafias divergentes casam na chave', () => {
  assert.equal(normal('Letícia'), normal('Leticia'));
});

test('a chave natural distingue o mesmo nome em datas diferentes', () => {
  const a = chaveDe('mobilizacao_pessoa', 'Fulano de Tal', '2026-03-01');
  const b = chaveDe('mobilizacao_pessoa', 'FULANO DE TAL', '2026-03-01');
  const c = chaveDe('mobilizacao_pessoa', 'Fulano de Tal', '2026-09-01');
  assert.equal(a, b, 'mesma pessoa, mesma data, mesma chave');
  assert.notEqual(a, c, 'a mesma pessoa mobilizada duas vezes são dois processos');
});

test('a chave separa os fluxos', () => {
  assert.notEqual(
    chaveDe('mobilizacao_pessoa', 'Fulano', '2026-03-01'),
    chaveDe('desmobilizacao_pessoa', 'Fulano', '2026-03-01'),
  );
});

test('linha sem data ainda gera chave estável', () => {
  assert.equal(chaveDe('mobilizacao_empresa', 'TERRABEL', null),
    'mobilizacao_empresa|terrabel|sem-data');
});

// Linha em andamento ainda não tem data real; descartá-la deixaria de fora
// justamente o que está rodando.
test('primeiraData cai para a coluna reserva', () => {
  const linha = [];
  linha[35] = 46027;   // DATA PREV
  assert.equal(primeiraData(linha, [36, 35]), '2026-01-05', 'sem a real, usa a prevista');
  linha[36] = 46031;   // DATA REAL
  assert.equal(primeiraData(linha, [36, 35]), '2026-01-09', 'com a real, ela manda');
  assert.equal(primeiraData([], [36, 35]), null);
});

test('escape de aspas no literal SQL', () => {
  assert.equal(q("O'Brien"), "'O''Brien'");
  assert.equal(q(null), 'null');
  assert.equal(q(undefined), 'null');
  assert.equal(q('normal'), "'normal'");
});

test('os três status da planilha estão mapeados', () => {
  assert.deepEqual(Object.values(STATUS).sort(), ['cancelado', 'em_andamento', 'finalizado']);
});

/**
 * Guarda contra o erro mais caro do mapeamento: um código de etapa que não
 * existe no catálogo faz `mob_carga_etapa` não atualizar NADA — em silêncio,
 * porque o UPDATE simplesmente não casa linha nenhuma.
 */
test('os códigos de etapa das abas batem com o seed do catálogo', async () => {
  const { readFile } = await import('node:fs/promises');
  const seed = await readFile(
    new URL('../supabase/supabase_seed_mobilizacao_catalogo.sql', import.meta.url), 'utf8');

  for (const cfg of ABAS) {
    for (const e of cfg.etapas) {
      assert.ok(
        seed.includes(`'${cfg.fluxo}', '${e.codigo}'`),
        `${cfg.aba}: código "${e.codigo}" não existe no catálogo de ${cfg.fluxo}`,
      );
    }
  }
});

test('cada aba mapeia todas as etapas do fluxo dela', () => {
  const esperado = { 'MOB.PESSOAS': 11, 'MOB.EMPRESAS': 8, 'DESMOB. PESSOAS': 5 };
  for (const cfg of ABAS) {
    assert.equal(cfg.etapas.length, esperado[cfg.aba], cfg.aba);
  }
});
