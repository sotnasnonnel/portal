import {
  LayoutDashboard, ClipboardCheck, Workflow, Receipt, CreditCard,
} from 'lucide-react';
import { SOLICITACOES_FIN } from '../../../../config/financeiro';

// Navegação da sidebar do Financeiro. Fica fora do Sidebar.jsx para não quebrar
// o fast refresh (um arquivo de componente só deve exportar componentes).
//
// Duas áreas separadas, porque são duas rotinas diferentes: CARTÕES (pedir,
// aprovar e acompanhar cartão corporativo) e REEMBOLSOS (despesa que a pessoa
// pagou do próprio bolso e quer de volta). Cada uma com o seu dashboard
// — um número só, misturando as duas, não respondia bem a nenhuma das duas.
//
// - canAbrir: coordenador/gestor (abrem solicitações de cartão).
// - isAdmin: time do Financeiro (configura fluxos, executa).
// - vePainelReembolso: gestor ou admin do Reembolso. Dashboard é ferramenta de
//   quem acompanha um conjunto de pedidos; para quem só abre o próprio, a
//   lista já responde tudo — e um painel com uma linha só é ruído.
// - temFinanceiro: acesso ao módulo Financeiro em si. Quem tem só o Reembolso
//   navega por aqui, então a área de Cartões não pode aparecer para ele.
// - temReembolso: acesso ao módulo de Reembolsos, que tem gate próprio
//   (reembolso_profiles) independente do acesso ao Financeiro.
// - area: qual das duas o menu mostra. Ver areaDaRota, abaixo.

/**
 * Qual área a rota atual pertence — mesma mecânica do programaDaRota dos
 * Programas. `null` fora das duas, e aí o menu lista tudo (nenhuma rota deste
 * shell cai nesse caso hoje; é o padrão seguro se alguma surgir).
 *
 * Adiantamento é reembolso: reaproveita o fluxo inteiro e mora na mesma tabela
 * (ver lib/kind.js), então a prestação de contas não pode trocar o menu no meio.
 */
export function areaDaRota(pathname = '') {
  if (pathname.startsWith('/reembolsos') || pathname.startsWith('/adiantamentos')) {
    return 'reembolsos';
  }
  if (pathname.startsWith('/financeiro')) return 'cartoes';
  return null;
}

export function navSections({
  canAbrir = false, isAdmin = false, temFinanceiro = false, temReembolso = false,
  vePainelReembolso = false, area = null,
} = {}) {
  const secoes = [];

  // O menu mostra SÓ A ÁREA EM QUE SE ESTÁ. Com as duas listadas, metade dele
  // era de uma rotina que a pessoa não estava usando — e a escolha entre elas
  // já acontece antes, no popup do card "Financeiro" da Home.
  const mostra = (a) => !area || area === a;

  if (temFinanceiro && mostra('cartoes')) {
    secoes.push({
      label: 'Cartões',
      group: true,
      key: 'cartoes',
      Icon: CreditCard,
      items: [
        // Dashboard só para o time do Financeiro.
        ...(isAdmin ? [{ label: 'Dashboard', href: '/financeiro/dashboard', Icon: LayoutDashboard }] : []),
        ...(canAbrir
          ? SOLICITACOES_FIN.map((s) => ({ label: s.curto, href: `/financeiro/solicitacoes/nova/${s.slug}`, Icon: s.icon }))
          : []),
        // Meus Cartões: o que a pessoa TEM (limite, vigência), não o que pediu.
        { label: 'Meus Cartões', href: '/financeiro/cartoes', Icon: CreditCard },
        { label: 'Aprovar / Acompanhar', href: '/financeiro/solicitacoes/acompanhar', Icon: ClipboardCheck },
      ],
    });
  }

  if (temReembolso && mostra('reembolsos')) {
    secoes.push({
      label: 'Reembolsos',
      group: true,
      key: 'reembolsos',
      Icon: Receipt,
      items: [
        ...(vePainelReembolso ? [{ label: 'Dashboard', href: '/reembolsos/dashboard', Icon: LayoutDashboard }] : []),
        { label: 'Reembolsos', href: '/reembolsos', Icon: Receipt },
      ],
    });
  }

  // Os fluxos configurados aqui são os das solicitações de cartão (/financeiro/
  // fluxos), então a seção acompanha os Cartões — no Reembolso ela apontaria
  // para uma tela que não decide nada do que está na frente da pessoa.
  if (isAdmin && mostra('cartoes')) {
    secoes.push({ label: 'Administração', items: [{ label: 'Fluxos de Aprovação', href: '/financeiro/fluxos', Icon: Workflow }] });
  }
  return secoes;
}

// Primeira rota do módulo (destino do índice e de redirecionamentos).
export const rotaInicialFin = '/financeiro/dashboard';
