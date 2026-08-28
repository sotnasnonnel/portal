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
// (Fica fora do Sidebar.jsx para não quebrar o fast refresh: um arquivo de
// componente só deve exportar componentes.)
export function navSections(role, user) {
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

  if (isGestao(role)) {
    const secoes = [
      {
        label: 'Apontamento',
        group: true,
        key: 'apontamento',
        Icon: Clock,
        items: [{ label: 'Apontar', href: '/horas/apontar', Icon: Clock }],
      },
      {
        label: 'Gestão',
        group: true,
        key: 'gestao',
        Icon: Users,
        items: [
          { label: 'Dashboard da Equipe', href: '/horas/dashboard', Icon: BarChart3 },
          { label: 'Equipe', href: '/horas/equipe', Icon: Users },
          { label: 'Registros', href: '/horas/registros', Icon: ListChecks },
        ],
      },
      {
        label: 'Horas Extras',
        group: true,
        key: 'extras',
        Icon: FileClock,
        items: extras,
      },
    ];
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
    return secoes;
  }

  // Quem configura o apontamento sem ter papel de gestão (não é o caso hoje, mas
  // a lista é nominal e independe do papel) também precisa do atalho.
  const secoes = [
    {
      label: 'Apontamento',
      group: true,
      key: 'apontamento',
      Icon: Clock,
      items: [
        { label: 'Apontar', href: '/horas/apontar', Icon: Clock },
        { label: 'Meu Dashboard', href: '/horas/dashboard', Icon: BarChart3 },
        { label: 'Meus Registros', href: '/horas/registros', Icon: ListChecks },
      ],
    },
    {
      label: 'Horas Extras',
      group: true,
      key: 'extras',
      Icon: FileClock,
      items: extras,
    },
  ];
  if (configHoras.length) {
    secoes.push({ label: 'Administração', key: 'admin', Icon: UserCog, items: configHoras });
  }
  return secoes;
}

// Primeira rota permitida ao papel (destino do índice e dos redirecionamentos).
export function rotaInicial(role) {
  return navSections(role)[0].items[0].href;
}
