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
 * Trava de lançamento, no mesmo molde de MOBILIZACAO_EM_BREVE. Enquanto `true`,
 * o card some da Home e as rotas devolvem para o início — exceto para a lista
 * abaixo. Para abrir ao time, além de pôr `false`, troque o corpo dos helpers em
 * supabase_migration_setor_adm_acesso.sql; sem isso o time entra e vê tudo vazio.
 */
export const SETOR_ADM_EM_BREVE = true;

/**
 * Só e-mail CORPORATIVO: o login é OAuth Microsoft.
 *
 * Esta lista só decide o que a tela mostra. Quem protege o dado é a cópia dela em
 * app_private.setor_adm_liberado() (supabase_migration_setor_adm_acesso.sql):
 * mudou aqui, muda lá.
 */
export const SETOR_ADM_LIBERADOS = [
  'marcus.guimaraes@phdengenharia.eng.br',
  'lennon.santos@phdengenharia.eng.br',
  'jarbas.junior@phdengenharia.eng.br',
  'perla.passos@phdengenharia.eng.br',
  'edijane.rodrigues@phdengenharia.eng.br',
];

/**
 * Reusa o papel do Atendimento DE PROPÓSITO, sem coluna nova em colaboradores:
 * é o mesmo time, como na Mobilização. A RLS das tabelas frota_* e alojamentos*
 * usa app_private.setor_adm_time / setor_adm_admin.
 */
export const ehTimeSetorAdm = (modules) =>
  modules?.administrativo === 'admin' || modules?.administrativo === 'atendente';

const estaNaLista = (user) => SETOR_ADM_LIBERADOS.includes((user?.email || '').trim().toLowerCase());

/**
 * Quem mexe nas configurações e exclui cadastros-mestre. Em lançamento restrito,
 * os liberados com papel no Atendimento, mesmo 'atendente': o poder extra vale só
 * nestes dois módulos. Mesma regra de app_private.setor_adm_admin().
 */
export const ehAdminSetorAdm = (modules, user) => (SETOR_ADM_EM_BREVE
  ? estaNaLista(user) && ehTimeSetorAdm(modules)
  : modules?.administrativo === 'admin');

/**
 * Diferente da Mobilização, aqui não há nada de consulta geral: são custos,
 * CNH e moradores, então depois de aberto o módulo continua só para o time.
 */
export const podeAcessarSetorAdm = (user, modules) => (SETOR_ADM_EM_BREVE
  ? estaNaLista(user)
  : ehTimeSetorAdm(modules));

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
