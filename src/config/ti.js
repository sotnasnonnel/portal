/**
 * Módulo TI: controle de ativos de tecnologia e termos de responsabilidade.
 * Substitui o app de Power Apps "Controle de ativos" e a planilha
 * "Controle de ativos - organizado 1.xlsx" (carga em supabase_seed_ti_ativos.sql).
 *
 * Dois níveis (supabase_migration_ti_visibilidade.sql):
 *
 * - TIME DE TI: checkbox "TI" do Gerenciamento de acessos (colaboradores.ti_acesso,
 *   hoje inclui o Patrick Pereira). Vê todos os equipamentos e altera.
 * - TODOS OS DEMAIS: só consulta, e só o que está com a própria pessoa e com
 *   toda a equipe abaixo dela na hierarquia (superior_id, recursivo): o usuário
 *   vê o dele; o coordenador, o dele e dos subordinados; o gerente, o dele, dos
 *   coordenadores e dos subordinados destes.
 *
 * Estas funções só decidem o que a TELA mostra. Quem recorta os dados é a RLS de
 * ti_* (app_private.ti_time e app_private.ti_emails_visiveis).
 */
export const podeAcessarTi = (user) => !!user;
export const podeEditarTi = (user) => user?.tiAcesso === true;

/** Situação do equipamento. As da planilha, na ordem em que aparecem na tela. */
export const SITUACOES = [
  'Em utilização',
  'Aguardando atribuição',
  'Em preparação',
  'Parado',
  'Recolhido',
  'Devolução',
  'Não Encontrado',
  'Não identificado',
  'Furto/Roubo/Quebra',
  'Propriedade PHD',
];

/**
 * Situação do termo de responsabilidade. As quatro primeiras vêm da planilha;
 * 'Termo gerado' é do PDF que a TI gerava antes do aceite no portal.
 * 'Assinado' é o que a pessoa aceita em /ti/termos (ti_aceitar_termo).
 */
export const SITUACOES_TERMO = [
  'Sem termo',
  'A conferir',
  'Termo existente - a validar',
  'Termo divergente',
  'Termo gerado',
  'Assinado',
];

export const TERMO_ASSINADO = 'Assinado';

/** Situações em que o equipamento foi devolvido: entrar nelas grava data_devolucao. */
export const SITUACOES_DEVOLVIDO = ['Devolução', 'Recolhido'];

export const FORNECEDORES = ['Selbet', 'EMC', 'Próprio'];
export const TIPOS = ['Notebook', 'Monitor', 'Impressora', 'Tablet', 'Serviço', 'Licença'];
