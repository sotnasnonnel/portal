import {
  LayoutDashboard, ClipboardCheck, Users, CalendarClock, UserPlus, List, CalendarDays,
  FileText, Network, Coins, PlusCircle, Workflow, Clock, ShieldAlert, ScrollText,
  Receipt, Briefcase, Building2, FileBarChart, History, Settings, CalendarRange, HardHat,
} from 'lucide-react';
import { isHorasExtrasDp } from '../../config/horasExtras';
import { podeAcessarFechamentoPj, ROTA_FECHAMENTO_PJ } from '../../config/fechamentoPj';
import { isAusenciaRh, veAprovacoes } from '../../config/ausenciaProgramada';
import { MODULOS_AUSENCIA, MOD_AUSENCIA } from '../../config/modulosAusencia';
import {
  ROTA_FOLGA_CAMPO, isFolgaCampoRh, podeAcessarFolgaCampo,
  veAprovacoes as veAprovacoesFolga,
} from '../../config/folgaCampo';
import { podeConsultarOrganograma } from '../../config/organograma';
import { podeAjustarValores } from '../../config/valores';

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

// Ícone do módulo — fica aqui, e não no descritor, para o config não depender
// de lucide-react.
const ICONE_MODULO = { [MOD_AUSENCIA.navKey]: CalendarRange };

// Ausência Programada: aberta a todo colaborador (qualquer modalidade), então
// entra para todos os perfis. Aprovações e equipe aparecem para quem tem cargo
// de gestão; o painel, para o RH.
function grupoAusencia(user, mod) {
  return {
    group: true,
    key: mod.navKey,
    label: mod.nome,
    Icon: ICONE_MODULO[mod.navKey],
    items: [
      { label: mod.menuMinha, Icon: CalendarDays, href: mod.rota, exato: true },
      ...(veAprovacoes(user)
        ? [
          { label: 'Aprovações', Icon: ClipboardCheck, href: `${mod.rota}/aprovacoes` },
          { label: 'Equipe', Icon: Users, href: `${mod.rota}/equipe` },
        ]
        : []),
      ...(isAusenciaRh(user)
        ? [{ label: 'Painel RH', Icon: LayoutDashboard, href: `${mod.rota}/painel` }]
        : []),
    ],
  };
}

// Folga de Campo: o aviso de que a pessoa vai ficar ausente da obra. Módulo
// próprio, sem saldo nem período — não confundir com a Ausência Programada
// acima. Em piloto: só aparece para quem está em FOLGA_CAMPO liberados.
function grupoFolgaCampo(user) {
  return {
    group: true,
    key: 'folgaCampo',
    label: 'Folga de Campo',
    Icon: HardHat,
    items: [
      { label: 'Minha Folga', Icon: CalendarDays, href: ROTA_FOLGA_CAMPO, exato: true },
      ...(veAprovacoesFolga(user)
        ? [
          { label: 'Aprovações', Icon: ClipboardCheck, href: `${ROTA_FOLGA_CAMPO}/aprovacoes` },
          { label: 'Equipe', Icon: Users, href: `${ROTA_FOLGA_CAMPO}/equipe` },
        ]
        : []),
      ...(isFolgaCampoRh(user)
        ? [{ label: 'Painel RH', Icon: LayoutDashboard, href: `${ROTA_FOLGA_CAMPO}/painel` }]
        : []),
    ],
  };
}

/**
 * Consultas: montado pelo que a PESSOA pode, e não pelo perfil dela.
 *
 * As duas telas do grupo têm permissão própria, que vale tanto pelo perfil do
 * DP quanto por flag avulsa (config/organograma.js e config/valores.js) — um
 * atendente do Atendimento pode ter o Organograma, os Ajustes de Valores, os
 * dois ou nenhum. Montar por permissão evita a lista de casos que existia aqui
 * e faz o grupo sumir sozinho para quem não tem nenhuma das duas.
 */
const consultas = (user) => {
  const items = [];
  if (podeConsultarOrganograma(user)) {
    items.push({ label: 'Organograma', Icon: Network, href: '/organograma' });
  }
  if (podeAjustarValores(user)) {
    items.push({ label: 'Ajustes de Valores', Icon: Coins, href: '/valores' });
  }
  return items.length ? { label: 'Consultas', key: 'consultas', items } : null;
};

// ---------------------------------------------------------------------------
// Áreas — a Home abre a escolha em popup (GestaoPessoasModal) e, dentro do
// módulo, o menu mostra SÓ a área em que se está (mesma mecânica do Financeiro
// e da Gestão de Horas). A área é a `key` do grupo em navSections.
// ---------------------------------------------------------------------------

// Rota -> área. Ordem importa: prefixo mais específico primeiro.
const ROTAS_AREA = [
  ...MODULOS_AUSENCIA.map((m) => [m.rota, m.navKey]),
  [ROTA_FOLGA_CAMPO, 'folgaCampo'],
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
  ...Object.fromEntries(MODULOS_AUSENCIA.map((m) => [
    m.navKey,
    { Icon: ICONE_MODULO[m.navKey], desc: m.descricaoCartao, cta: m.ctaCartao },
  ])),
  folgaCampo: {
    Icon: HardHat,
    desc: 'Aviso de ausência da obra, com aprovação do responsável.',
    cta: 'Abrir folga de campo',
  },
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
    );
  } else {
    secoes.push({
      label: 'Menu',
      key: 'menu',
      items: [{ label: 'Minha Ausência', Icon: CalendarDays, href: '/usuario', locked: true }],
    });
  }

  // O grupo entra para todo mundo que tenha ao menos uma das duas telas — por
  // perfil ou por flag. `perfil` vem separado no argumento e o `user` pode ser o
  // do login; juntar os dois evita que um chamador que só passe `perfil` perca
  // as permissões, e vice-versa.
  const grupoConsultas = consultas({ ...(user || {}), perfil: perfil ?? user?.perfil });
  if (grupoConsultas) secoes.push(grupoConsultas);

  MODULOS_AUSENCIA.forEach((m) => secoes.push(grupoAusencia(user, m)));
  // A Folga de Campo está em piloto e só aparece para quem foi liberado. O card
  // da Home sai de navSections, então some junto.
  if (podeAcessarFolgaCampo(user)) secoes.push(grupoFolgaCampo(user));
  if (isHorasExtrasDp(user)) secoes.push(grupoHorasExtras);
  if (podeAcessarFechamentoPj(user)) secoes.push(grupoFechamentoPj);
  if (area && secoes.some((s) => s.key === area)) return secoes.filter((s) => s.key === area);
  return secoes;
}
