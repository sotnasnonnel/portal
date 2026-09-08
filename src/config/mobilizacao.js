import { UserPlus, UserMinus, Building2 } from 'lucide-react';

/**
 * Módulo de Gestão de Mobilização.
 *
 * Substitui a planilha referencia/planilha_modulo_mobilizacao.xlsx. Vocabulário
 * igual ao do banco (supabase_migration_mobilizacao.sql):
 *
 * - PROCESSO → uma linha da planilha: a mobilização de uma pessoa, a
 *              desmobilização dela, ou a mobilização de uma empresa num contrato.
 * - ETAPA    → um passo do processo, com predecessor, prazo e responsável. É a
 *              unidade de trabalho: o cartão do quadro é a etapa, não o processo.
 * - CATÁLOGO → a lista de etapas de cada fluxo. Vive em TABELA, não aqui: a
 *              planilha continua viva e vai mudar, e nome de etapa em .js
 *              exigiria deploy. O que fica no código são só os 3 fluxos, que
 *              são fixos.
 */

/**
 * Trava de lançamento, no mesmo molde de ADM_EM_BREVE e ESTOQUE_EM_BREVE.
 * Enquanto `true`, o módulo some da Home e a rota devolve para o início —
 * exceto para a lista abaixo. Vira `false` quando o catálogo estiver conferido
 * com o time e a carga de 2026 tiver rodado.
 */
export const MOBILIZACAO_EM_BREVE = true;

/**
 * Quem enxerga o módulo enquanto MOBILIZACAO_EM_BREVE for true.
 *
 * Só e-mail CORPORATIVO: o login é OAuth Microsoft, endereço pessoal não
 * autentica. Quando abrir, esta lista deixa de importar e valem as regras
 * normais — que são as do Administrativo (ver ehTimeMobilizacao).
 */
export const MOBILIZACAO_LIBERADOS = [
  'marcus.guimaraes@phdengenharia.eng.br',
  // Já é administrativo_role = 'admin', então entra como administrador do
  // módulo: enxerga todos os processos e configura o catálogo e os SLAs.
  'andre.guimaraes@phdengenharia.eng.br',
  // Também administrativo_role = 'admin'. Entra para o de-para de centro de
  // custo da Torre, que depende da base comercial que ele mantém.
  'lennon.santos@phdengenharia.eng.br',
];

export const podeAcessarMobilizacao = (user) => !MOBILIZACAO_EM_BREVE
  || MOBILIZACAO_LIBERADOS.includes((user?.email || '').trim().toLowerCase());

/**
 * Quem é do time — vê o quadro inteiro, assume etapa de qualquer processo e
 * abre processo novo.
 *
 * Reusa o papel do Administrativo DE PROPÓSITO, sem coluna nova em
 * colaboradores: quem controla a mobilização é o mesmo pessoal que atende o
 * chamado que a dispara. Duas listas de "quem é do time" divergiriam na
 * primeira contratação.
 *
 * Fora do time ninguém fica de fora do módulo: o quadro, a fila e os
 * indicadores são de consulta geral, e a RLS é quem limita o conteúdo — cada um
 * enxerga os processos em que está envolvido. Ser responsável de uma etapa não
 * exige papel nenhum, que é o que permite TI, DP ou o gerente da obra fecharem
 * o próprio passo.
 */
export const ehTimeMobilizacao = (modules) =>
  modules?.administrativo === 'admin' || modules?.administrativo === 'atendente';

/** Quem configura o catálogo de etapas e os SLAs. */
export const ehAdminMobilizacao = (modules) => modules?.administrativo === 'admin';

/**
 * Os 3 fluxos. Fixos, e por isso em código: são as 3 abas da planilha e não
 * mudam. O que muda é o CONTEÚDO de cada um, que é tabela.
 */
export const FLUXOS = [
  {
    slug: 'mobilizacao_pessoa',
    label: 'Mobilização de pessoas',
    curto: 'Mob. pessoa',
    descricao: 'Do contrato assinado ao crachá liberado.',
    Icon: UserPlus,
    aba: 'MOB.PESSOAS',
  },
  {
    slug: 'desmobilizacao_pessoa',
    label: 'Desmobilização de pessoas',
    curto: 'Desmob.',
    descricao: 'Da devolução do crachá à baixa pelo cliente.',
    Icon: UserMinus,
    aba: 'DESMOB. PESSOAS',
  },
  {
    slug: 'mobilizacao_empresa',
    label: 'Mobilização da empresa',
    curto: 'Mob. empresa',
    descricao: 'Do contrato novo à aprovação dos programas legais.',
    Icon: Building2,
    aba: 'MOB.EMPRESAS',
  },
];

export const getFluxo = (slug) => FLUXOS.find((f) => f.slug === slug) || null;
export const rotuloFluxo = (slug) => getFluxo(slug)?.label || slug || '—';
export const rotuloFluxoCurto = (slug) => getFluxo(slug)?.curto || slug || '—';

/** Vocabulário literal da planilha (coluna STATUS PROCESSO MOBILIZAÇÃO). */
export const STATUS_PROCESSO = {
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

/**
 * Responsável padrão por ÁREA, quando o catálogo não aponta uma pessoa.
 * A planilha diz "Edijane" numa linha e "cliente" na outra; o papel cobre o
 * segundo caso sem amarrar numa pessoa que sai de férias.
 */
export const PAPEIS_RESPONSAVEL = {
  adm: 'Administrativo',
  dp: 'Departamento Pessoal',
  sesmt: 'SESMT',
  ti: 'TI',
  comercial: 'Comercial',
  obra: 'Obra',
  cliente: 'Cliente',
};

export const rotuloPapel = (papel) => PAPEIS_RESPONSAVEL[papel] || papel || '';
