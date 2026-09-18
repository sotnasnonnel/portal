import {
  LayoutDashboard, ClipboardCheck, Users, CalendarClock, UserPlus, List, CalendarDays,
  FileText, Network, Coins, PlusCircle, Workflow, Clock, ShieldAlert, ScrollText, Search,
  Receipt, Briefcase, Building2, FileBarChart, History, Settings, CalendarRange,
} from 'lucide-react';
import { isHorasExtrasDp } from '../../config/horasExtras';
import { podeAcessarFechamentoPj, ROTA_FECHAMENTO_PJ } from '../../config/fechamentoPj';
import { isAusenciaRh, ROTA_AUSENCIA, veAprovacoes } from '../../config/ausenciaProgramada';

// Navegação da sidebar de Gestão de Pessoas, na mesma divisão dos outros
// módulos (padrão do Financeiro): grupos colapsáveis + seções simples.
// Fica fora do Sidebar.jsx para não quebrar o fast refresh.
//
// Horas Extras: só o TRATAMENTO do DP mora aqui. Pedir, acompanhar e aprovar
// ficam na Gestão de Horas. Não entra por perfil porque quem enxerga é quem
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

// Fechamento PJ: como as Horas Extras, entra por quem a pessoa é (DP + lista
// de liberados), não pelo perfil.
const grupoFechamentoPj = {
  group: true,
  key: 'fechamentoPj',
  label: 'Fechamento PJ',
  Icon: Receipt,
  items: [
    { label: 'Folha do mês', Icon: ClipboardCheck, href: ROTA_FECHAMENTO_PJ, exato: true },
    { label: 'Prestadores', Icon: Briefcase, href: `${ROTA_FECHAMENTO_PJ}/prestadores` },
    { label: 'Fornecedores TOTVS', Icon: Building2, href: `${ROTA_FECHAMENTO_PJ}/fornecedores` },
    { label: 'Relatórios', Icon: FileBarChart, href: `${ROTA_FECHAMENTO_PJ}/relatorios` },
    { label: 'Histórico', Icon: History, href: `${ROTA_FECHAMENTO_PJ}/historico` },
    { label: 'Configurações', Icon: Settings, href: `${ROTA_FECHAMENTO_PJ}/configuracoes` },
  ],
};

// Ausência Programada: aberta a todo colaborador (qualquer modalidade), então
// entra para todos os perfis. Aprovações e equipe aparecem para quem tem cargo
// de gestão; o painel, para o RH.
function grupoAusenciaProgramada(user) {
  return {
    group: true,
    key: 'ausenciaProgramada',
    label: 'Ausência Programada',
    Icon: CalendarRange,
    items: [
      { label: 'Minha Ausência', Icon: CalendarDays, href: ROTA_AUSENCIA, exato: true },
      ...(veAprovacoes(user)
        ? [
          { label: 'Aprovações', Icon: ClipboardCheck, href: `${ROTA_AUSENCIA}/aprovacoes` },
          { label: 'Equipe', Icon: Users, href: `${ROTA_AUSENCIA}/equipe` },
        ]
        : []),
      ...(isAusenciaRh(user)
        ? [{ label: 'Painel RH', Icon: LayoutDashboard, href: `${ROTA_AUSENCIA}/painel` }]
        : []),
    ],
  };
}

const consultas = (comValores) => ({
  label: 'Consultas',
  key: 'consultas',
  items: [
    { label: 'Organograma', Icon: Network, href: '/organograma' },
    ...(comValores ? [{ label: 'Ajustes de Valores', Icon: Coins, href: '/valores' }] : []),
  ],
});

// ---------------------------------------------------------------------------
// Áreas — a Home abre a escolha em popup (GestaoPessoasModal) e, dentro do
// módulo, o menu mostra SÓ a área em que se está (mesma mecânica do Financeiro
// e da Gestão de Horas). A área é a `key` do grupo em navSections.
// ---------------------------------------------------------------------------

// Rota -> área. Ordem importa: prefixo mais específico primeiro.
const ROTAS_AREA = [
  [ROTA_AUSENCIA, 'ausenciaProgramada'],
  ['/admin/horas-extras', 'horasExtras'],
  [ROTA_FECHAMENTO_PJ, 'fechamentoPj'],
  ['/admin/cadastro', 'colaboradores'],
  ['/admin/listagem', 'colaboradores'],
  ['/admin/solicitacoes', 'requisicoes'],
  ['/admin/fluxos', 'requisicoes'],
  ['/gestor/solicitacoes', 'requisicoes'],
  ['/gestor/equipe', 'equipe'],
  ['/gestor/aprovacoes', 'ausencias'],
  ['/gestor/ausencia', 'ausencias'],
  ['/gestor/minha-ausencia', 'ausencias'],
  ['/organograma', 'consultas'],
  ['/valores', 'consultas'],
];

/** Área da rota atual; `null` fora das conhecidas (aí o menu lista tudo). */
export function areaDaRota(pathname = '') {
  if (pathname === '/gestor') return 'equipe';
  const achou = ROTAS_AREA.find(([prefixo]) => pathname === prefixo || pathname.startsWith(`${prefixo}/`));
  return achou ? achou[1] : null;
}

// O que o card de cada área diz no popup. `href` sobrescreve o primeiro item
// do grupo quando a porta de entrada natural é outra (a Listagem, não o
// formulário de Cadastro).
const CARTAO_AREA = {
  colaboradores: { Icon: Users, desc: 'Cadastro e listagem de todos os colaboradores.', cta: 'Abrir colaboradores', href: '/admin/listagem' },
  equipe: { Icon: Users, desc: 'Seu time, com os números da equipe num painel.', cta: 'Abrir equipe' },
  requisicoes: { Icon: FileText, desc: 'Pedidos ao DP: abrir, aprovar e acompanhar.', cta: 'Abrir requisições' },
  consultas: { Icon: Network, desc: 'Organograma e ajustes de valores.', cta: 'Abrir consultas' },
  horasExtras: { Icon: Clock, desc: 'Tratamento das horas extras pelo DP, prazos e auditoria.', cta: 'Abrir horas extras' },
  fechamentoPj: { Icon: Receipt, desc: 'Folha dos prestadores PJ, termos e pagamento no TOTVS.', cta: 'Abrir fechamento PJ' },
  ausenciaProgramada: { Icon: CalendarRange, desc: 'Saldo, data limite e pedidos de ausência com aprovação do gestor.', cta: 'Abrir ausência programada' },
};

/**
 * Cards do popup da Gestão de Pessoas, na ordem do menu. Sai de navSections
 * para as duas listas não se desencontrarem: quem não tem a área no menu não
 * tem o card. Grupo travado (em construção) fica de fora.
 */
export function areasGestaoPessoas({ perfil, user } = {}) {
  return navSections({ perfil, user })
    .filter((s) => !s.locked && CARTAO_AREA[s.key] && s.items?.length)
    .map((s) => {
      const c = CARTAO_AREA[s.key];
      return { slug: s.key, label: s.label, icon: c.Icon, desc: c.desc, cta: c.cta, href: c.href || s.items[0].href };
    });
}

// pendencias: ausências aguardando o gestor. requisicoes: requisições DP
// aguardando ação (ou concluídas desde a última visita).
// area: só a seção dessa área (ver areaDaRota). Se o perfil não tem seção com
// essa key, mostra tudo — menu vazio nunca é o resultado.
export function navSections({ perfil, user, pendencias = 0, requisicoes = 0, area = null } = {}) {
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

  secoes.push(grupoAusenciaProgramada(user));
  if (isHorasExtrasDp(user)) secoes.push(grupoHorasExtras);
  if (podeAcessarFechamentoPj(user)) secoes.push(grupoFechamentoPj);
  if (area && secoes.some((s) => s.key === area)) return secoes.filter((s) => s.key === area);
  return secoes;
}
