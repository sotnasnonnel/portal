import {
  Users, BarChart3, CreditCard, Headset, Sparkles, ShieldCheck, Blocks, Radar, Target,
  Building2, MonitorSmartphone, Boxes, Route, Car, BedDouble, ClipboardCheck, Newspaper,
  Megaphone, Star, MessageSquarePlus, Smile, Lock, ExternalLink, FilePlus2, Receipt, CalendarDays,
} from 'lucide-react';
import { isSuperAdmin } from '../../config/superAdmin';
import { TODOS_SERVICOS, podeAcessarAdm } from '../../config/administrativo';
import { podeAcessarEstoque, ehOperadorEstoque } from '../../config/estoque';
import { podeAcessarMobilizacao, ehTimeMobilizacao, ehAdminMobilizacao } from '../../config/mobilizacao';
import { podeAcessarSetorAdm, ehAdminSetorAdm, AREAS_SETOR_ADM } from '../../config/setorAdm';
import { podeAcessarTi, podeEditarTi } from '../../config/ti';
import {
  podeAcessarProgramas, ehAdminProgramas, ehAvaliadorAwards, ehComercial, PROGRAMAS,
} from '../../config/programas';
import { podeVerTorre } from '../../config/torre';
import { podeVerPlr, podeEditarPlr, rotaInicialPlr, veSetoresPlr } from '../../config/plr';
import { areasFinanceiroDe } from '../../config/financeiro';
import { AREAS_HORAS } from '../../config/horas';
import { veFeed } from '../../config/feed';
import { veResumoHumor, veResumoEmpresa } from '../../config/humor';
import { FALE_CONOSCO_ATIVO } from '../../config/suporte';
import { SOLUCOES_INTEGRADAS } from '../../config/solucoesIntegradas';
import { semRepetidos } from '../../config/buscaPortal';
import { areasGestaoPessoas, navSections as navDp } from '../../components/Layout/nav';
import { navSections as navAdm } from '../../modules/administrativo/app/components/nav';
import { navSections as navEstoque } from '../../modules/estoque/app/components/nav';
import { navSections as navMobilizacao } from '../../modules/mobilizacao/app/components/nav';
import { navSections as navFin } from '../../modules/financeiro/app/components/nav';
import { navSections as navHoras } from '../../modules/horas/app/components/nav';
import { navSections as navFrota } from '../../modules/frota/app/components/nav';
import { navSections as navAlojamentos } from '../../modules/alojamentos/app/components/nav';
import { navSections as navTi } from '../../modules/ti/app/components/nav';
import { navSections as navTorre } from '../../modules/torre/app/components/nav';
import { navSections as navPlr } from '../../modules/plr/app/components/nav';
import { navSections as navProgramas } from '../../modules/programas/app/components/nav';

/**
 * O que a busca da Home consegue achar, já filtrado pelo que ESTA pessoa pode
 * abrir. A busca nunca mostra uma tela que daria "sem acesso".
 *
 * Fonte: os mesmos menus laterais dos módulos (navSections de cada um), com os
 * mesmos argumentos que a Sidebar de cada módulo passa, e os mesmos gates dos
 * cards da Home. Tela nova num menu entra na busca sozinha; se um gate mudar
 * na Sidebar, precisa mudar aqui também.
 *
 * O casamento do texto e a ordem ficam em config/buscaPortal.js.
 */

// Apelidos por módulo: o nome que as pessoas usam e que não está na tela.
// Vale para o módulo e para todas as telas dele.
const APELIDOS = {
  'Gestão de Pessoas': 'dp rh departamento pessoal',
  Dados: 'pmo bi solicitações power bi relatório',
  'Gestão de Horas': 'controle de horas apontamento timesheet hora',
  Atendimento: 'administrativo adm chamado chamados suporte pedido',
  Estoque: 'almoxarifado epi uniforme material',
  Mobilização: 'mobilizar desmobilização desmobilizar obra',
  Frota: 'carro veículo veiculos locadora',
  Alojamentos: 'alojamento casa república moradia imóvel aluguel',
  TI: 'notebook computador equipamento ativo termo de responsabilidade',
  Programas: 'ideia inovação awards prêmio indicação',
  'Torre de Controle': 'torre status',
  Resultados: 'plr metas participação nos lucros bônus',
  Financeiro: 'cartão cartões clara limite',
  Reembolso: 'reembolsos despesa adiantamento nota fiscal',
};

const apelido = (modulo) => APELIDOS[modulo] || '';

// Apelidos de uma tela só (pelo título), quando o do módulo seria largo demais:
// "férias" é da Ausência Programada, não de toda a Gestão de Pessoas.
const APELIDOS_TELA = {
  'Ausência Programada': 'férias ausência descanso',
  'Folga de Campo': 'folga obra campo',
  'Adicional de Ausências': 'dias adicionais férias',
  Organograma: 'hierarquia chefe gestor superior',
  'Central de Aprovações': 'aprovar',
};

// Itens de um menu lateral, achatados. Grupo ou item travado (em construção)
// fica de fora; o caminho até a tela vira o `onde`.
function telasDoMenu(modulo, secoes = []) {
  return secoes
    .filter((s) => s && !s.locked)
    .flatMap((s) => (s.items || [])
      .filter((i) => i && !i.locked && i.href)
      .map((i) => ({
        titulo: i.label,
        onde: s.label && ![i.label, modulo, 'Menu'].includes(s.label) ? `${modulo} · ${s.label}` : modulo,
        termos: apelido(modulo),
        href: i.href,
        Icon: i.Icon,
        tipo: 'tela',
      })));
}

const modulo = (titulo, href, Icon, extra = {}) => ({
  titulo, onde: 'Módulo', termos: apelido(titulo), href, Icon, tipo: 'modulo', ...extra,
});

export function montarIndiceBusca({ user, modules } = {}) {
  const e = [];

  // ---- Gestão de Pessoas: as áreas do popup e o menu de cada uma ----
  areasGestaoPessoas({ perfil: user?.perfil, user }).forEach((a) => {
    e.push({
      titulo: a.label, onde: 'Gestão de Pessoas', termos: `${apelido('Gestão de Pessoas')} ${a.desc}`,
      href: a.href, Icon: a.icon, tipo: 'modulo',
    });
  });
  e.push(...telasDoMenu('Gestão de Pessoas', navDp({ perfil: user?.perfil, user })));

  // ---- Dados ----
  if (modules?.solic) {
    e.push(modulo('Dados', '/solic/dashboard', BarChart3));
    if (modules.solic === 'admin') {
      e.push(...telasDoMenu('Dados', [{ label: 'Administração', items: [
        { label: 'Empresas', href: '/solic/admin/cadastros', Icon: Building2 },
        { label: 'Prazos', href: '/solic/admin/prazos', Icon: CalendarDays },
      ] }]));
    } else {
      e.push(...telasDoMenu('Dados', [{ label: 'Solicitações', items: [
        { label: 'Nova Solicitação', href: '/solic/surveys/new', Icon: FilePlus2 },
      ] }]));
    }
  }

  // ---- Gestão de Horas (aberta a todos) ----
  AREAS_HORAS.forEach((a) => e.push({
    titulo: a.label, onde: 'Gestão de Horas', termos: `${apelido('Gestão de Horas')} ${a.desc}`,
    href: a.href, Icon: a.icon, tipo: 'modulo',
  }));
  e.push(...telasDoMenu('Gestão de Horas', navHoras(modules?.horas || 'usuario', user, null)));

  // ---- Atendimento: chamados, estoque e mobilização ----
  if (podeAcessarAdm(user)) {
    e.push(modulo('Atendimento', '/administrativo/novo', Headset));
    e.push(...telasDoMenu('Atendimento', navAdm({
      isAdmin: modules?.administrativo === 'admin',
      podeTorre: podeVerTorre(user, modules),
    })));
    // Cada serviço do catálogo abre o formulário direto: quem procura "uber"
    // quer pedir o Uber, não chegar no catálogo e procurar de novo.
    TODOS_SERVICOS.forEach((s) => e.push({
      titulo: s.label,
      onde: `Atendimento · Abrir chamado · ${s.classeLabel}`,
      termos: apelido('Atendimento'),
      href: `/administrativo/novo/${s.classeSlug}/${s.slug}`,
      Icon: s.icon,
      tipo: 'chamado',
    }));
  }
  if (podeAcessarEstoque(user)) {
    e.push(modulo('Estoque', '/estoque/posicao', Boxes));
    e.push(...telasDoMenu('Estoque', navEstoque({ operador: ehOperadorEstoque(modules) })));
  }
  if (podeAcessarMobilizacao(user)) {
    e.push(modulo('Mobilização', '/mobilizacao/kanban', Route));
    e.push(...telasDoMenu('Mobilização', navMobilizacao({
      isTime: ehTimeMobilizacao(modules),
      isAdmin: ehAdminMobilizacao(modules),
      podeTorre: podeVerTorre(user, modules),
    })));
  }

  // ---- Setor administrativo: Frota e Alojamentos ----
  if (podeAcessarSetorAdm(user)) {
    const icone = { frota: Car, alojamentos: BedDouble };
    AREAS_SETOR_ADM.forEach((a) => e.push(modulo(a.label, a.href, icone[a.slug] || Building2, {
      onde: 'Administrativo', termos: `${apelido(a.label)} ${a.desc}`,
    })));
    e.push(...telasDoMenu('Frota', navFrota({ isAdmin: ehAdminSetorAdm(modules, user) })));
    e.push(...telasDoMenu('Alojamentos', navAlojamentos()));
  }

  // ---- TI ----
  if (podeAcessarTi(user)) {
    const podeEscrever = podeEditarTi(user);
    e.push(modulo('TI', podeEscrever ? '/ti/painel' : '/ti/modelos', MonitorSmartphone));
    e.push(...telasDoMenu('TI', navTi({ podeEscrever })));
  }

  // ---- Programas ----
  if (podeAcessarProgramas(user)) {
    e.push(modulo('Programas', '/programas/inicio', Sparkles));
    PROGRAMAS.forEach((p) => e.push({
      titulo: p.label, onde: 'Programas', termos: `${apelido('Programas')} ${p.desc}`,
      href: p.href, Icon: p.icon, tipo: 'modulo',
    }));
    e.push(...telasDoMenu('Programas', navProgramas({
      ehComercial: ehComercial(modules),
      ehAdmin: ehAdminProgramas(modules),
      avaliaAwards: ehAvaliadorAwards(user),
    })));
  }

  // ---- Torre de Controle ----
  if (podeVerTorre(user, modules)) {
    e.push(modulo('Torre de Controle', '/torre/mapa', Radar));
    e.push(...telasDoMenu('Torre de Controle', navTorre()));
  }

  // ---- Resultados (PLR) ----
  if (podeVerPlr(modules)) {
    e.push(modulo('Resultados', rotaInicialPlr(modules), Target));
    e.push(...telasDoMenu('Resultados', navPlr({
      podeEditar: podeEditarPlr(modules),
      veSetores: veSetoresPlr(modules),
    }).map((s) => ({ ...s, items: (s.items || []).filter(Boolean) }))));
  }

  // ---- Financeiro: Cartões e Reembolso ----
  areasFinanceiroDe(modules).forEach((a) => {
    const nome = a.slug === 'reembolsos' ? 'Reembolso' : 'Financeiro';
    e.push({
      titulo: a.label, onde: 'Financeiro', termos: `${apelido(nome)} ${a.desc}`,
      href: a.href, Icon: a.slug === 'reembolsos' ? Receipt : CreditCard, tipo: 'modulo',
    });
  });
  const isAdminFin = modules?.financeiro === 'admin';
  e.push(...telasDoMenu('Financeiro', navFin({
    canAbrir: !!modules?.financeiro,
    isAdmin: isAdminFin,
    temFinanceiro: !!modules?.financeiro,
    temReembolso: !!modules?.reembolso,
    vePainelReembolso: modules?.reembolso === 'admin' || modules?.reembolso === 'gestor' || isAdminFin,
  })).map((t) => ({ ...t, termos: apelido(t.href.startsWith('/reembolsos') ? 'Reembolso' : 'Financeiro') })));

  // ---- Telas do portal fora dos módulos ----
  e.push({ titulo: 'Central de Aprovações', onde: 'Portal', termos: 'aprovar pendências pendente', href: '/aprovacoes', Icon: ClipboardCheck, tipo: 'modulo' });
  if (veFeed(user)) e.push({ titulo: 'Feed PHD', onde: 'Portal', termos: 'posts notícias novidades rede social', href: '/feed', Icon: Newspaper, tipo: 'modulo' });
  e.push({ titulo: 'Avisos', onde: 'Portal', termos: 'comunicados mural', href: '/avisos', Icon: Megaphone, tipo: 'modulo' });
  e.push({ titulo: 'Publicar aviso', onde: 'Portal · Avisos', termos: 'novo aviso comunicado', href: '/avisos/novo', Icon: Megaphone, tipo: 'tela' });
  e.push({ titulo: 'Personalização', onde: 'Portal', termos: 'pontos loja moldura título tema', href: '/personalizacao', Icon: Star, tipo: 'modulo' });
  if (FALE_CONOSCO_ATIVO) e.push({ titulo: 'Fale conosco', onde: 'Portal', termos: 'suporte bug erro melhoria elogio relato', href: '/fale-conosco', Icon: MessageSquarePlus, tipo: 'modulo' });
  if (veResumoHumor(user) || veResumoEmpresa(user)) {
    e.push({ titulo: 'Humor da equipe', onde: 'Portal', termos: 'humor do dia clima', href: '/humor', Icon: Smile, tipo: 'modulo' });
  }
  e.push({ titulo: 'Aviso de Privacidade', onde: 'Portal', termos: 'lgpd dados pessoais', href: '/privacidade', Icon: Lock, tipo: 'tela' });
  if (isSuperAdmin(user)) {
    e.push({ titulo: 'Gerenciar acessos', onde: 'Portal', termos: 'permissões papéis acesso admin', href: '/portal-admin', Icon: ShieldCheck, tipo: 'modulo' });
  }

  // ---- Soluções Integradas (abrem em nova aba) ----
  SOLUCOES_INTEGRADAS.filter((s) => s.url).forEach((s) => e.push({
    titulo: s.nome, onde: 'Soluções Integradas', termos: s.desc,
    url: s.url, Icon: s.icon || ExternalLink, tipo: 'externo',
  }));
  e.push({ titulo: 'Soluções Integradas', onde: 'Portal', termos: 'ferramentas externas sistemas', acao: 'solucoes', href: '#solucoes', Icon: Blocks, tipo: 'modulo' });

  // Item de menu sem ícone próprio cai no genérico.
  return semRepetidos(e).map((x) => ({
    ...x,
    termos: [x.termos, APELIDOS_TELA[x.titulo]].filter(Boolean).join(' '),
    Icon: x.Icon || Users,
  }));
}
