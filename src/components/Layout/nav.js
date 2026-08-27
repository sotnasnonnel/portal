import {
  LayoutDashboard, ClipboardCheck, Users, CalendarClock, UserPlus, List, CalendarDays,
  FileText, Network, Coins, PlusCircle, Workflow, Clock, ShieldAlert, ScrollText, Search,
} from 'lucide-react';
import { isHorasExtrasDp } from '../../config/horasExtras';

// Navegação da sidebar de Gestão de Pessoas, na mesma divisão dos outros
// módulos (padrão do Financeiro): grupos colapsáveis + seções simples.
// Fica fora do Sidebar.jsx para não quebrar o fast refresh.
//
// Horas Extras: só o TRATAMENTO do DP mora aqui. Pedir, acompanhar e aprovar
// ficam no Controle de Horas. Não entra por perfil porque quem enxerga é quem
// passa em isHorasExtrasDp — inclusive um gestor com rh_dp, que continua
// com o perfil 'gestor'.
const grupoHorasExtras = {
  group: true,
  key: 'horasExtras',
  label: 'Horas Extras',
  Icon: Clock,
  items: [
    { label: 'Painel', Icon: ClipboardCheck, href: '/admin/horas-extras' },
    { label: 'Exceções de Prazo', Icon: ShieldAlert, href: '/admin/horas-extras/excecoes' },
    { label: 'Auditoria', Icon: ScrollText, href: '/admin/horas-extras/auditoria' },
  ],
};

const consultas = (comValores) => ({
  label: 'Consultas',
  key: 'consultas',
  items: [
    { label: 'Organograma', Icon: Network, href: '/organograma' },
    ...(comValores ? [{ label: 'Ajustes de Valores', Icon: Coins, href: '/valores' }] : []),
  ],
});

// pendencias: ausências aguardando o gestor. requisicoes: requisições DP
// aguardando ação (ou concluídas desde a última visita).
export function navSections({ perfil, user, pendencias = 0, requisicoes = 0 } = {}) {
  const secoes = [];

  if (perfil === 'admin') {
    secoes.push(
      {
        label: 'Colaboradores',
        group: true,
        key: 'colaboradores',
        Icon: Users,
        items: [
          { label: 'Cadastro', Icon: UserPlus, href: '/admin/cadastro' },
          { label: 'Listagem', Icon: List, href: '/admin/listagem' },
        ],
      },
      {
        label: 'Requisições DP',
        group: true,
        key: 'requisicoes',
        Icon: FileText,
        items: [
          { label: 'Requisições DP', Icon: FileText, href: '/admin/solicitacoes', badge: requisicoes },
          { label: 'Fluxos de Aprovação', Icon: Workflow, href: '/admin/fluxos' },
        ],
      },
      consultas(true),
    );
  } else if (perfil === 'gestor' || perfil === 'coordenador') {
    secoes.push(
      {
        label: 'Equipe',
        group: true,
        key: 'equipe',
        Icon: Users,
        items: [
          { label: 'Dashboard', Icon: LayoutDashboard, href: '/gestor' },
          { label: 'Minha Equipe', Icon: Users, href: '/gestor/equipe' },
        ],
      },
      // Em construção: aparece com cadeado, sem expandir.
      { label: 'Ausências', group: true, key: 'ausencias', Icon: CalendarClock, locked: true,
        items: [
          { label: 'Aprovações', Icon: ClipboardCheck, href: '/gestor/aprovacoes', badge: pendencias },
          { label: 'Gestão de Ausência', Icon: CalendarClock, href: '/gestor/ausencia' },
          { label: 'Minha Ausência', Icon: CalendarDays, href: '/gestor/minha-ausencia' },
        ] },
      {
        label: 'Requisições DP',
        group: true,
        key: 'requisicoes',
        Icon: FileText,
        items: [
          { label: 'Requisição', Icon: PlusCircle, href: '/gestor/solicitacoes/nova' },
          { label: 'Acompanhar', Icon: ClipboardCheck, href: '/gestor/solicitacoes/acompanhar', badge: requisicoes },
        ],
      },
      consultas(perfil === 'gestor'),
    );
  } else if (perfil === 'rh') {
    secoes.push(
      {
        label: 'Requisições DP',
        group: true,
        key: 'requisicoes',
        Icon: FileText,
        items: [
          { label: 'Nova Requisição', Icon: PlusCircle, href: '/gestor/solicitacoes/nova' },
          { label: 'Requisições', Icon: ClipboardCheck, href: '/gestor/solicitacoes/acompanhar', badge: requisicoes },
        ],
      },
      { label: 'Consultas', key: 'consultas', items: [{ label: 'Organograma', Icon: Search, href: '/organograma' }] },
    );
  } else {
    secoes.push({
      label: 'Menu',
      key: 'menu',
      items: [{ label: 'Minha Ausência', Icon: CalendarDays, href: '/usuario', locked: true }],
    });
  }

  if (isHorasExtrasDp(user)) secoes.push(grupoHorasExtras);
  return secoes;
}
