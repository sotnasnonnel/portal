import {
  LayoutDashboard, Car, FileText, Receipt, Fuel, Wrench, TriangleAlert, ShieldCheck, Users, BarChart3, SlidersHorizontal,
} from 'lucide-react';

// Navegação da sidebar da Frota, na mesma divisão do protótipo. Fica fora do
// Sidebar.jsx para não quebrar o fast refresh. `contagens` são os itens críticos
// que o protótipo mostrava ao lado do menu (condutor irregular, revisão vencida,
// fatura vencida sem pagamento).
export function navSections({ isAdmin = false, contagens = {} } = {}) {
  const secoes = [
    {
      label: 'Visão geral',
      key: 'geral',
      items: [{ label: 'Painel', href: '/frota/painel', Icon: LayoutDashboard }],
    },
    {
      label: 'Frota',
      group: true,
      key: 'frota',
      Icon: Car,
      items: [
        { label: 'Veículos', href: '/frota/veiculos', Icon: Car },
        { label: 'Faturas', href: '/frota/faturas', Icon: FileText, badge: contagens.faturas },
        { label: 'Controle mensal', href: '/frota/mensal', Icon: Receipt },
        { label: 'Combustível', href: '/frota/combustivel', Icon: Fuel },
        { label: 'Manutenção', href: '/frota/manutencao', Icon: Wrench, badge: contagens.manutencao },
      ],
    },
    {
      label: 'Ocorrências',
      group: true,
      key: 'ocorrencias',
      Icon: TriangleAlert,
      items: [{ label: 'Multas e avarias', href: '/frota/ocorrencias', Icon: TriangleAlert }],
    },
    {
      label: 'Pessoas',
      group: true,
      key: 'pessoas',
      Icon: Users,
      items: [{ label: 'Condutores e termos', href: '/frota/condutores', Icon: ShieldCheck, badge: contagens.condutores }],
    },
    {
      label: 'Análise',
      key: 'analise',
      items: [{ label: 'Relatórios', href: '/frota/relatorios', Icon: BarChart3 }],
    },
  ];

  if (isAdmin) {
    secoes.push({
      label: 'Administração',
      key: 'admin',
      items: [{ label: 'Configurações', href: '/frota/configuracoes', Icon: SlidersHorizontal }],
    });
  }

  return secoes;
}
