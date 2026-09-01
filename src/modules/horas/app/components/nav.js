import {
  Clock,
  BarChart3,
  ListChecks,
  Settings,
  SlidersHorizontal,
  FolderLock,
  Users,
  FilePlus2,
  FileClock,
  CheckSquare,
  UserCog,
} from 'lucide-react';
import { isGestao, podeConfigurarHoras } from '../../lib/roles';

// Navegação por papel, na mesma divisão dos outros módulos (padrão do
// Financeiro): grupos colapsáveis para as rotinas do dia a dia e uma seção
// simples de "Administração" no fim.
//
// A gestão (gestor/coordenador) aponta E administra/enxerga a equipe; o usuário
// só aponta e vê o próprio tempo.
// "Config. do Apontamento" e "Acesso a Projetos" fogem do papel: são curadoria
// central, restrita a uma lista nominal (daí o `user` além do `role`).
// A seção "Horas Extras" aqui é só a ponta do fluxo que o colaborador e o gestor
// usam (pedir, acompanhar, aprovar). O tratamento do DP — painel, exceções de
// prazo e auditoria — vive no módulo Gestão de Pessoas.
//
// O módulo tem DUAS ÁREAS (ver AREAS_HORAS em config/horas.js), e o menu mostra
// só a área em que se está — mesma mecânica do Financeiro: dentro do
// Apontamento aparece o apontamento (e a gestão/configuração que vive dele);
// dentro das Horas Extras, só o fluxo de hora extra. Trocar de área é decisão
// que se toma no card "Gestão de Horas" da Home, não no meio do menu.
// (Fica fora do Sidebar.jsx para não quebrar o fast refresh: um arquivo de
// componente só deve exportar componentes.)

/**
 * Qual área a rota atual pertence — mesma mecânica do areaDaRota do Financeiro.
 * Tudo que não é /horas/extras é apontamento: o apontamento é o corpo do
 * módulo (apontar, dashboard, registros, equipe e as telas de configuração).
 */
export function areaDaRota(pathname = '') {
  return pathname.startsWith('/horas/extras') ? 'extras' : 'apontamento';
}

export function navSections(role, user, area = null) {
  // `null` (sem rota conhecida) lista tudo — é o que o rotaInicial usa.
  const mostra = (a) => !area || area === a;
  const extras = [
    { label: 'Nova Solicitação', href: '/horas/extras/nova', Icon: FilePlus2 },
    { label: 'Minhas Solicitações', href: '/horas/extras/minhas', Icon: FileClock },
  ];
  // Quem é aprovador sem ter o papel de gestão chega pelo link do e-mail — a
  // rota não depende do menu.
  if (isGestao(role)) {
    extras.push({ label: 'Solicitações Pendentes', href: '/horas/extras/aprovacoes', Icon: CheckSquare });
  }

  // As duas telas de curadoria central do módulo, restritas à lista nominal.
  const configHoras = podeConfigurarHoras(user)
    ? [
        { label: 'Config. do Apontamento', href: '/horas/config/apontamento', Icon: SlidersHorizontal },
        { label: 'Acesso a Projetos', href: '/horas/config/projetos', Icon: FolderLock },
      ]
    : [];

  const secoes = [];

  if (mostra('apontamento')) {
    // A gestão também aponta, mas o resto do apontamento (dashboard, registros)
    // vem no grupo "Gestão", com o escopo da equipe.
    secoes.push({
      label: 'Apontamento',
      group: true,
      key: 'apontamento',
      Icon: Clock,
      items: isGestao(role)
        ? [{ label: 'Apontar', href: '/horas/apontar', Icon: Clock }]
        : [
            { label: 'Apontar', href: '/horas/apontar', Icon: Clock },
            { label: 'Meu Dashboard', href: '/horas/dashboard', Icon: BarChart3 },
            { label: 'Meus Registros', href: '/horas/registros', Icon: ListChecks },
          ],
    });

    if (isGestao(role)) {
      secoes.push({
        label: 'Gestão',
        group: true,
        key: 'gestao',
        Icon: Users,
        items: [
          { label: 'Dashboard da Equipe', href: '/horas/dashboard', Icon: BarChart3 },
          { label: 'Equipe', href: '/horas/equipe', Icon: Users },
          { label: 'Registros', href: '/horas/registros', Icon: ListChecks },
        ],
      });
    }
  }

  if (mostra('extras')) {
    secoes.push({
      label: 'Horas Extras',
      group: true,
      key: 'extras',
      Icon: FileClock,
      items: extras,
    });
  }

  // Administração é do apontamento: configura projetos, campos e visibilidade
  // do que se aponta. A gestão configura os projetos da própria área; a
  // curadoria central é da lista nominal (podeConfigurarHoras).
  if (mostra('apontamento')) {
    if (isGestao(role)) {
      secoes.push({
        label: 'Administração',
        key: 'admin',
        items: [
          // `exato`: /horas/config é prefixo de /horas/config/apontamento — sem
          // isso os dois acendiam juntos.
          { label: 'Configuração', href: '/horas/config', Icon: Settings, exato: true },
          ...configHoras,
        ],
      });
    } else if (configHoras.length) {
      // Quem configura o apontamento sem ter papel de gestão (não é o caso hoje,
      // mas a lista é nominal e independe do papel) também precisa do atalho.
      secoes.push({ label: 'Administração', key: 'admin', Icon: UserCog, items: configHoras });
    }
  }

  return secoes;
}

// Primeira rota permitida ao papel (destino do índice e dos redirecionamentos).
export function rotaInicial(role) {
  return navSections(role)[0].items[0].href;
}
