/**
 * Torre de Controle — módulo de CONSULTA.
 *
 * É a mesma visão da página /mobilizacao/torre, servida como módulo próprio no
 * portal para quem não trabalha dentro da Mobilização: coordenação, gerência e
 * diretoria abrem a torre, filtram pelo próprio nome e acompanham o status dos
 * chamados e das mobilizações sem precisar entrar no módulo.
 *
 * SÓ LEITURA, e isso não é uma limitação a corrigir depois: o módulo existe
 * para a reunião de torre, onde o Adm apresenta e cada responsável confere o
 * que é seu. Um botão de editar aqui faria alguém mexer no processo no meio da
 * reunião, sem o contexto que a tela do processo dá.
 */

/**
 * Quem enxerga: coordenadores, gerentes e diretoria.
 *
 * Traduzido para o que o banco tem: `perfil in ('coordenador', 'gestor')`.
 * Não existe perfil "gerente" nem "diretor" — como está escrito em
 * config/perfis.js, "a liderança real (coordenador → gerente → diretor → CEO) é
 * toda perfil 'gestor'". A diretoria se distingue por `formato = 'Diretoria'`,
 * que é dado de contrato, não de acesso.
 *
 * O time do Administrativo entra junto: é quem apresenta a reunião.
 */
export const PERFIS_TORRE = ['coordenador', 'gestor', 'admin'];

export const podeAcessarTorre = (user, modules) =>
  PERFIS_TORRE.includes(user?.perfil)
  || modules?.administrativo === 'admin'
  || modules?.administrativo === 'atendente';

/**
 * Trava de lançamento, no molde de MOBILIZACAO_EM_BREVE. Enquanto `true`, o
 * módulo some da Home e a rota devolve para o início — exceto para a lista
 * abaixo. Vira `false` junto com a Mobilização: uma torre sem os processos
 * carregados não teria o que apresentar.
 */
export const TORRE_EM_BREVE = true;

export const TORRE_LIBERADOS = [
  'marcus.guimaraes@phdengenharia.eng.br',
  'andre.guimaraes@phdengenharia.eng.br',
  'lennon.santos@phdengenharia.eng.br',
  // Passa por perfil = 'gestor'.
  'jarbas.junior@phdengenharia.eng.br',
  // Passa pelo ramo do Adm de podeAcessarTorre: perfil dela é nulo, mas
  // administrativo_role = 'atendente'. O mesmo vale no banco, onde
  // app_private.pode_torre() é `e_torre() or is_adm_time()`.
  'edijane.rodrigues@phdengenharia.eng.br',
];

export const podeVerTorre = (user, modules) => {
  if (!podeAcessarTorre(user, modules)) return false;
  if (!TORRE_EM_BREVE) return true;
  return TORRE_LIBERADOS.includes((user?.email || '').trim().toLowerCase());
};
