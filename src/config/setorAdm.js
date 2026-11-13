import { Car, BedDouble } from 'lucide-react';

/**
 * Card "Administrativo" da Home: as rotinas internas do SETOR administrativo
 * (Gestão de Frota e Gestão de Alojamentos), que substituem as planilhas
 * docs/ref/ADM_CONTROLE_GESTAO_DE_FROTA.xlsx e ADM_GESTAO_DE_ALOJAMENTOS.xlsx.
 *
 * ATENÇÃO AO NOME: `administrativo` no código é o módulo ATENDIMENTO (chamados,
 * pasta src/modules/administrativo, config/administrativo.js). Este arquivo é o
 * outro: o setor. Daí "setorAdm" nos identificadores, e rotas próprias
 * (/frota, /alojamentos) em vez de /administrativo/*.
 */

/**
 * O acesso é liberado PESSOA POR PESSOA, no checkbox "Frota e Alojamentos" da
 * tela de Gerenciamento de acessos (coluna colaboradores.setor_adm_acesso).
 * Antes era uma lista de e-mails chumbada aqui e repetida no corpo de
 * app_private.setor_adm_liberado(): liberar alguém pedia deploy e SQL.
 *
 * Esta função só decide o que a TELA mostra. Quem protege CNH, custos e
 * moradores é a RLS de frota_* e alojamentos*, via app_private.setor_adm_time /
 * setor_adm_admin — que leem a MESMA coluna.
 *
 * Diferente da Mobilização, aqui não há nada de consulta geral: o módulo é só
 * para quem foi liberado, sem versão esmaecida para os outros.
 */
export const podeAcessarSetorAdm = (user) => user?.setorAdmAcesso === true;

/**
 * Quem ESCREVE em frota_* e alojamentos*: o mesmo checkbox, de propósito.
 * Enquanto "entrar" e "ver dado" eram coisas diferentes — o checkbox de um lado,
 * papel no Atendimento do outro — quem fosse liberado sem o papel entrava e
 * encontrava tudo vazio.
 */
export const ehTimeSetorAdm = (user) => podeAcessarSetorAdm(user);

/**
 * Quem mexe nas configurações e exclui cadastros-mestre: liberado no checkbox E
 * admin do Atendimento. Mesma regra de app_private.setor_adm_admin().
 */
export const ehAdminSetorAdm = (modules, user) => podeAcessarSetorAdm(user)
  && modules?.administrativo === 'admin';

/** Áreas do popup do card, mesmo formato de AREAS_ADMINISTRATIVO. */
export const AREAS_SETOR_ADM = [
  {
    slug: 'frota',
    label: 'Frota',
    icon: Car,
    desc: 'Veículos locados, custos do mês, combustível, manutenção, multas e condutores.',
    href: '/frota/painel',
    cta: 'Abrir frota',
  },
  {
    slug: 'alojamentos',
    label: 'Alojamentos',
    icon: BedDouble,
    desc: 'Imóveis, contratos, moradores, contas do mês e mobiliário.',
    href: '/alojamentos/inicio',
    cta: 'Abrir alojamentos',
  },
];
