import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMAS, schemaDoServico, inicialDoSchema, schemaUsaPessoa, usaDescricao, usaAnexo,
  formatarValorCampo,
} from './schemas.js';
import { TODOS_SERVICOS } from '../../../../../config/administrativo.js';

// Serviços que NÃO usam esquema declarativo. Lista explícita para que um serviço
// novo no catálogo sem formulário apareça como falha, e não passe despercebido.
const COM_FORMULARIO_CODIFICADO = [
  'mobilizacao/mobilizacao',        // marcadores e campos que somem por movimento
  'saude-seguranca/epi',
  'saude-seguranca/uniforme',
  'saude-seguranca/outras-demandas',
];
// Balcão geral: descrição e anexo do chamado bastam, não há campo a pedir.
const SEM_CAMPOS_POR_DECISAO = [
  'frota/outras-demandas',
  'outras-demandas/outras-demandas',
];

const TIPOS_VALIDOS = new Set([
  'texto', 'texto_longo', 'numero', 'data', 'hora', 'datahora', 'selecao', 'sim_nao', 'pessoa',
]);

const todosCampos = () => Object.entries(SCHEMAS).flatMap(([k, s]) => s.map((c) => [k, c]));

test('todo campo tem chave, rótulo e tipo conhecido', () => {
  for (const [servico, campo] of todosCampos()) {
    assert.ok(campo.chave, `${servico}: campo sem chave`);
    assert.ok(campo.rotulo, `${servico}: ${campo.chave} sem rótulo`);
    assert.ok(TIPOS_VALIDOS.has(campo.tipo), `${servico}: ${campo.chave} tem tipo "${campo.tipo}"`);
  }
});

// Chave repetida sobrescreveria silenciosamente o valor do outro campo no jsonb.
test('as chaves não se repetem dentro do mesmo serviço', () => {
  for (const [servico, schema] of Object.entries(SCHEMAS)) {
    const chaves = schema.map((c) => c.chave);
    assert.equal(new Set(chaves).size, chaves.length, `${servico} tem chave repetida`);
  }
});

test('campo de seleção sempre traz opções', () => {
  for (const [servico, campo] of todosCampos()) {
    if (campo.tipo === 'selecao') {
      assert.ok(campo.opcoes?.length, `${servico}: ${campo.chave} é seleção sem opções`);
    }
  }
});

// A descrição e os anexos são do chamado; repeti-los no serviço faria a pessoa
// escrever a mesma coisa duas vezes.
test('nenhum esquema recria a descrição ou os anexos do chamado', () => {
  for (const [servico, campo] of todosCampos()) {
    assert.notEqual(campo.chave, 'descricao', `${servico} duplica a descrição do chamado`);
    assert.notEqual(campo.chave, 'anexos', `${servico} duplica os anexos do chamado`);
  }
});

test('Uber e Correio pedem exatamente a mesma coisa', () => {
  assert.deepEqual(SCHEMAS['uber/viagem-uber'], SCHEMAS['correio/correio']);
});

test('schemaUsaPessoa acha o seletor de pessoa', () => {
  assert.equal(schemaUsaPessoa(SCHEMAS['viagem-hospedagem/passagem']), true);
  assert.equal(schemaUsaPessoa(SCHEMAS['compra/solicitacao-compra']), false);
});

// Campo sem chave no estado inicial faria o React trocar o input de
// não-controlado para controlado no primeiro toque.
test('estado inicial cobre todas as chaves do esquema', () => {
  for (const [servico, schema] of Object.entries(SCHEMAS)) {
    const inicial = inicialDoSchema(schema);
    for (const campo of schema) {
      assert.ok(campo.chave in inicial, `${servico}: ${campo.chave} fora do estado inicial`);
    }
  }
});

// As duas pontas: nenhum serviço do catálogo fica sem formulário, e nenhum
// esquema aponta para um serviço que não existe mais (renomeado ou removido).
test('todo serviço do catálogo tem formulário ou decisão explícita de não ter', () => {
  const cobertos = new Set([...Object.keys(SCHEMAS), ...COM_FORMULARIO_CODIFICADO, ...SEM_CAMPOS_POR_DECISAO]);
  const descobertos = TODOS_SERVICOS
    .map((s) => `${s.classeSlug}/${s.slug}`)
    .filter((s) => !cobertos.has(s));
  assert.deepEqual(descobertos, [], 'serviço no catálogo sem formulário');
});

test('nenhum esquema aponta para serviço fora do catálogo', () => {
  const doCatalogo = new Set(TODOS_SERVICOS.map((s) => `${s.classeSlug}/${s.slug}`));
  const orfaos = Object.keys(SCHEMAS).filter((s) => !doCatalogo.has(s));
  assert.deepEqual(orfaos, [], 'esquema órfão');
});

// Serviço sem esquema e sem descrição não teria onde o pedido ser escrito.
test('todo serviço tem esquema ou descrição — nenhum fica sem nada para preencher', () => {
  for (const s of TODOS_SERVICOS) {
    const temAlgo = !!schemaDoServico(s.classeSlug, s.slug)
      || usaDescricao(s.classeSlug, s.slug)
      || COM_FORMULARIO_CODIFICADO.includes(`${s.classeSlug}/${s.slug}`);
    assert.ok(temAlgo, `${s.classeSlug}/${s.slug} abriria um formulário vazio`);
  }
});

test('descrição só onde a planilha pede', () => {
  assert.equal(usaDescricao('frota', 'manutencao-veiculo-programada'), false);
  assert.equal(usaDescricao('manutencao-predial', 'manutencao-sede'), true);
  // Balcão geral precisa dela: é onde o pedido inteiro é escrito.
  assert.equal(usaDescricao('outras-demandas', 'outras-demandas'), true);
});

// Anexo é por exclusão: só a mobilização fica de fora.
test('anexo em todos, menos na mobilização', () => {
  for (const s of TODOS_SERVICOS) {
    const esperado = !(s.classeSlug === 'mobilizacao' && s.slug === 'mobilizacao');
    assert.equal(usaAnexo(s.classeSlug, s.slug), esperado, `${s.classeSlug}/${s.slug}`);
  }
});

test('schemaDoServico devolve null para serviço sem esquema', () => {
  assert.equal(schemaDoServico('mobilizacao', 'mobilizacao'), null);
  assert.equal(schemaDoServico('nao', 'existe'), null);
  assert.ok(schemaDoServico('uber', 'viagem-uber'));
});

// ---- formatação para leitura ----
// Intl separa "R$" do número com espaço NÃO SEPARÁVEL (U+00A0). Comparar com
// espaço comum faria o teste falhar mostrando dois textos visualmente iguais.
const semNbsp = (s) => s.replace(/\u00A0/g, ' ');

test('dinheiro sai em reais', () => {
  assert.equal(semNbsp(formatarValorCampo('compra', 'solicitacao-compra', 'valor_base', 12400)), 'R$ 12.400,00');
  assert.equal(semNbsp(formatarValorCampo('compra', 'solicitacao-compra', 'valor_base', '1234.5')), 'R$ 1.234,50');
});

// new Date('2026-09-01') é interpretado como UTC e, no nosso fuso, exibiria 31/08.
test('data não escorrega um dia por causa de fuso', () => {
  assert.equal(formatarValorCampo('compra', 'solicitacao-compra', 'data_necessidade', '2026-09-01'), '01/09/2026');
  assert.equal(formatarValorCampo('frota', 'reserva-veiculos', 'retirada_em', '2026-09-01T14:30'), '01/09/2026 14:30');
  assert.equal(formatarValorCampo('uber', 'viagem-uber', 'horario', '08:05:00'), '08:05');
});

// Patrimônio e número de série parecem número, mas são texto: formatar pelo
// conteúdo transformaria "004512" em "4512" ou em moeda.
test('campo de texto que parece número continua texto', () => {
  assert.equal(formatarValorCampo('ti', 'troca-equipamentos', 'patrimonio', '004512'), '004512');
  assert.equal(formatarValorCampo('ti', 'troca-equipamentos', 'numero_serie', '8871'), '8871');
});

test('sim/não, listas e vazio', () => {
  assert.equal(formatarValorCampo('ti', 'instalacao-software', 'homologado', 'sim'), 'Sim');
  assert.equal(formatarValorCampo('mobilizacao', 'mobilizacao', 'epis', ['Capacete', 'Botina']), 'Capacete, Botina');
  assert.equal(formatarValorCampo('compra', 'solicitacao-compra', 'valor_base', ''), '');
  assert.equal(formatarValorCampo('compra', 'solicitacao-compra', 'valor_base', null), '');
});
