/**
 * A tradução entre o chamado do Atendimento e o processo de Mobilização.
 *
 * Quem CRIA o processo é um gatilho no banco
 * (supabase_migration_mobilizacao_gatilho_adm.sql), não a tela: assim vale por
 * qualquer caminho — abertura pela tela, aprovação de alçada, correção manual,
 * reprocessamento — e o Atendimento não precisa importar nada daqui.
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
};

/**
 * As datas do chamado que NAO sao data-base.
 *
 * Ate 28/09/2026 a data de inicio no cliente virava a data-base do processo, e
 * com ela todos os prazos nasciam deslocados para o futuro — o Jarbas viu isso
 * como "4d de folga" numa etapa de SLA 0, feita no dia. Data-base, neste
 * modelo, e de onde partem as etapas RAIZ, e isso e a ABERTURA (e o que a carga
 * da planilha usou, e o que o comentario da coluna sempre disse).
 *
 * As duas datas continuam viajando, agora como informacao de operacao: quando a
 * pessoa entra na obra, e quando sai. Elas aparecem no resumo do processo.
 */
export const DATAS_DO_CHAMADO = ['data_inicio_cliente', 'data_desmobilizacao'];

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

  // Quem define a data-base e o banco, no momento em que cria o processo
  // (app_private.mob_dados_do_chamado): e o dia da abertura, que num chamado
  // com alcada e o dia da aprovacao.
  for (const chave of DATAS_DO_CHAMADO) {
    if (campos[chave]) dados[chave] = campos[chave];
  }
  return dados;
}
