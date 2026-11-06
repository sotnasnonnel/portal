import {
  Home, Building2, BedDouble, Receipt, Sofa,
} from 'lucide-react';

// Navegação da sidebar de Alojamentos: as mesmas cinco telas do protótipo. Fica
// fora do Sidebar.jsx para não quebrar o fast refresh.
export const navSections = () => [
  {
    label: 'Gestão de alojamentos',
    key: 'alojamentos',
    items: [
      { label: 'Início', href: '/alojamentos/inicio', Icon: Home },
      { label: 'Alojamentos', href: '/alojamentos/lista', Icon: Building2 },
      { label: 'Ocupação', href: '/alojamentos/ocupacao', Icon: BedDouble },
      { label: 'Pagamentos', href: '/alojamentos/pagamentos', Icon: Receipt },
      { label: 'Mobiliário', href: '/alojamentos/mobiliario', Icon: Sofa },
    ],
  },
];

/** A ficha do imóvel, já na aba pedida. */
export const rotaFicha = (id, aba) => `/alojamentos/imovel/${id}${aba && aba !== 'geral' ? `?aba=${aba}` : ''}`;

/**
 * Faturas é subaba de Pagamentos: a rota fica debaixo de /pagamentos para o menu
 * acender "Pagamentos" sozinho. `atalho` e `comp` abrem a tela já filtrada.
 */
export const rotaFaturas = ({ atalho, comp } = {}) => {
  const q = new URLSearchParams();
  if (atalho) q.set('atalho', atalho);
  if (comp) q.set('comp', comp);
  const s = q.toString();
  return `/alojamentos/pagamentos/faturas${s ? `?${s}` : ''}`;
};

/** Para onde um alerta leva: a ficha do imóvel ou uma tela geral. */
export const rotaDoAlerta = (x) => {
  if (x.aid) return rotaFicha(x.aid, x.tab);
  if (x.go === 'pagamentos/faturas') return rotaFaturas({ atalho: x.chip });
  return `/alojamentos/${x.go}${x.filter ? `?situacao=${x.filter}` : ''}`;
};
