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

/** Para onde um alerta leva: a ficha do imóvel ou uma tela geral. */
export const rotaDoAlerta = (x) => {
  if (x.aid) return rotaFicha(x.aid, x.tab);
  return `/alojamentos/${x.go}${x.filter ? `?situacao=${x.filter}` : ''}`;
};
