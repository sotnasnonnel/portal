/**
 * A tradução entre o chamado do Administrativo e o processo de Mobilização.
 *
 * Quem CRIA o processo é um gatilho no banco
 * (supabase_migration_mobilizacao_gatilho_adm.sql), não a tela: assim vale por
 * qualquer caminho — abertura pela tela, aprovação de alçada, correção manual,
 * reprocessamento — e o Administrativo não precisa importar nada daqui.
 *
 * Este arquivo é o ESPELHO em JS desse mapa, e existe por dois motivos:
 * mostrar na tela do chamado qual fluxo vai nascer, e ser testável — o teste
 * quebra se o Adm ganhar um movimento novo que ninguém mapeou, que é
 * exatamente o erro que passaria calado (o gatilho registra a falha e segue,
 * para nunca impedir a abertura de um chamado).
 *
 * Lógica pura, testável.
 */

/**
 * Movimento do formulário do Adm → fluxo da Mobilização.
 *
 * "Movimentação de profissional" cai em mobilizacao_pessoa de propósito: o
 * cliente citou três situações, e movimentação não é uma delas. Ela é uma
 * mobilização em outro local, com alguns passos a menos. Modelar como quarto
 * fluxo duplicaria a lista inteira de etapas para omitir três — a coluna
 * `condicao` do catálogo resolve isso sem deploy, marcando as etapas exclusivas
 * de contratação nova com {"movimento": ["Nova mobilização"]}.
 */
export const FLUXO_POR_MOVIMENTO = {
  'Nova mobilização': 'mobilizacao_pessoa',
  'Movimentação de profissional': 'mobilizacao_pessoa',
  Desmobilização: 'desmobilizacao_pessoa',
};

/** @returns {string|null} null quando o movimento não tem fluxo — nunca um chute. */
export const fluxoDoMovimento = (movimento) => FLUXO_POR_MOVIMENTO[movimento] || null;

/** A classe do catálogo do Adm que dispara este módulo. */
export const CLASSE_GATILHO = 'mobilizacao';

/**
 * Os campos do chamado que viram campos do processo.
 *
 * As chaves de origem são as de
 * src/modules/administrativo/app/novo/formularios/mobilizacao.js, gravadas no
 * jsonb `chamados_adm.campos`. Mudar um nome lá sem mudar aqui faz o processo
 * nascer com o campo vazio — silenciosamente. Por isso o mapa é explícito, e
 * não um spread.
 */
export const CAMPOS_DO_CHAMADO = {
  profissional_id: 'profissional_id',
  profissional: 'profissional_nome',
  local_obra: 'local_obra',
  cc: 'cod_ct',
  gestor: 'ger_phd',
  contato_cliente: 'contato_cliente',
  cliente: 'cliente_phd',
  cliente_final: 'cliente_final',
  empresa_phd: 'empresa_phd',
  data_inicio_cliente: 'data_base',
};

/**
 * A data-base sai de campos DIFERENTES conforme o movimento: mobilizacao usa
 * a data de inicio no cliente, desmobilizacao usa a data em que a pessoa sai.
 * Sem esse desvio, o processo de desmobilizacao nascia sem prazo em passo
 * nenhum — o formulario simplesmente nao tem "data de inicio".
 */
export const dataBaseDoChamado = (campos = {}) =>
  campos.data_desmobilizacao || campos.data_inicio_cliente || '';

/** Traduz `chamados_adm.campos` para o `p_dados` de mobilizacao_abrir. */
export function dadosDoChamado(campos = {}) {
  const dados = {};
  for (const [de, para] of Object.entries(CAMPOS_DO_CHAMADO)) {
    const v = campos[de];
    if (v !== undefined && v !== null && v !== '') dados[para] = v;
  }
  // O movimento não vira coluna, mas precisa viajar: é o que a `condicao` do
  // catálogo consulta para decidir quais etapas nascem.
  if (campos.movimento) dados.movimento = campos.movimento;

  const base = dataBaseDoChamado(campos);
  if (base) dados.data_base = base;
  return dados;
}
