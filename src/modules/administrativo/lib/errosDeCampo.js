/**
 * Erro de validação -> campo da tela.
 *
 * Os validadores devolvem só a PRIMEIRA mensagem, em texto. Para a tela isso
 * significava um aviso no topo e nenhuma pista de onde estava o problema, e
 * quem deixava cinco campos vazios precisava clicar em enviar cinco vezes.
 *
 * Aqui nenhuma regra é reescrita: quem decide o que é inválido continua sendo o
 * validador de cada formulário. Este arquivo só pergunta a ele campo a campo,
 * então uma regra nova não tem como divergir da tela; no pior caso, a mensagem
 * sem campo conhecido cai no aviso geral (`semCampo`), como antes.
 *
 * Lógica pura para poder ser testada.
 */

import { validarCamposExtras } from './camposExtras.js';
import { schemaDoServico } from '../app/novo/formularios/schemas.js';

const DATA_QUALQUER = '2000-01-01';

/** Formulário por esquema: a definição já diz qual é o campo. */
export function errosDoEsquema(definicao = [], valores = {}) {
  const erros = {};
  for (const campo of definicao) {
    const msg = validarCamposExtras([campo], valores);
    // Abaixo do rótulo, repetir o nome do campo só alonga a mensagem: em meia
    // coluna ela quebrava em duas linhas e desalinhava os vizinhos.
    if (msg) erros[campo.chave] = msg.startsWith('Preencha o campo') ? 'Preencha este campo.' : msg;
  }
  return erros;
}

// [mensagem do validador, chave do campo na tela, o que faz o validador seguir].
// O terceiro item só existe para achar o PRÓXIMO erro: é aplicado numa cópia e
// nunca chega ao chamado.
const REGRAS_MOBILIZACAO = [
  [/^Escolha o profissional/, 'profissional_id', { profissional_id: 'x' }],
  [/será devolvido/, 'devolucao_descricao', { devolucao_descricao: 'x' }],
  // A mesma mensagem vale para os dois campos de data de saída, e nunca os dois
  // estão na tela ao mesmo tempo.
  [/data da desmobilização/, 'data_desmob', { data_desmobilizacao: DATA_QUALQUER, desmob_data: DATA_QUALQUER }],
  [/^Informe o projeto/, 'projeto', { projeto: 'x' }],
  [/^Informe o cliente/, 'cliente', { cliente: 'x' }],
  [/centro de custo/, 'cc', { cc: 'x' }],
  [/quais treinamentos/, 'treinamentos', { treinamentos: 'x' }],
  [/local da obra/, 'local_obra', { local_obra: 'x' }],
  [/data de início/, 'data_inicio_cliente', { data_inicio_cliente: DATA_QUALQUER }],
  [/nome do contato/, 'contato_nome', { contato_nome: 'x' }],
  [/telefone do contato/, 'contato_telefone', { contato_telefone: '11999999999' }],
  [/e-mail válido/, 'contato_email', { contato_email: 'a@b.co' }],
  // 'nao' e não 'sim': "sim" faria surgir a pergunta do crachá entregue, que a
  // pessoa ainda nem vê na tela.
  [/possui crachá/, 'desmob_possui_cracha', { desmob_possui_cracha: 'nao' }],
  [/crachá já foi entregue/, 'desmob_cracha_entregue', { desmob_cracha_entregue: 'nao' }],
];

const REGRAS_SAUDE_SEGURANCA = [
  [/centro de custo/, 'cc', { cc: 'x' }],
  [/quantidade inteira/, 'itens', { itens: [], tipo_livre: 'x' }],
  [/no catálogo ou descreva/, 'itens', { tipo_livre: 'x' }],
  [/^Informe o motivo/, 'motivo', { motivo: 'x' }],
];

/**
 * Pergunta ao validador até ele não ter mais o que dizer, "corrigindo" numa
 * cópia cada erro encontrado para revelar o seguinte.
 */
export function coletarErros(validar, valores = {}, regras = []) {
  const erros = {};
  let copia = valores;
  // Teto: cada regra corrige um erro, então uma volta a mais já é mensagem que
  // não sai com a correção e o laço não pode ficar preso nela.
  for (let i = 0; i <= regras.length; i += 1) {
    const msg = validar(copia);
    if (!msg) break;
    const regra = regras.find(([padrao]) => padrao.test(msg));
    if (!regra) return { erros, semCampo: msg };
    const [, chave, correcao] = regra;
    if (!erros[chave]) erros[chave] = msg;
    copia = { ...copia, ...correcao };
  }
  return { erros, semCampo: '' };
}

/** Os erros do formulário próprio de um serviço, já ligados aos campos. */
export function errosDoServico({ classe, servico, validar, valores }) {
  const schema = schemaDoServico(classe, servico);
  if (schema) return { erros: errosDoEsquema(schema, valores), semCampo: '' };
  const regras = classe === 'mobilizacao' ? REGRAS_MOBILIZACAO
    : classe === 'saude-seguranca' ? REGRAS_SAUDE_SEGURANCA : [];
  return coletarErros(validar, valores, regras);
}

export const idDoErro = (chave) => `adm-erro-${chave}`;

/** Atributos de um controle nativo com erro: é o que o leitor de tela anuncia. */
export const ariaDoErro = (chave, msg) => (msg
  ? { 'aria-invalid': true, 'aria-describedby': idDoErro(chave) }
  : {});
