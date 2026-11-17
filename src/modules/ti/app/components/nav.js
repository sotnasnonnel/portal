import {
  LayoutDashboard, Laptop, ArrowLeftRight, FileSignature, Layers, Replace, UserPlus,
} from 'lucide-react';
import { ROTA_TROCA_EQUIPAMENTO } from '../../lib/regras';

// Navegação da sidebar da TI. Fica fora do Sidebar.jsx para não quebrar o fast
// refresh. As telas vieram do app antigo de Power Apps; "Pendências de termos"
// e "Preparar termos" viraram uma só, "Termo de responsabilidade" (aceite pela
// própria pessoa no portal). `contagens.termos`: pessoas com termo pendente.
const TERMO = 'Termo de responsabilidade';
export function navSections({ contagens = {}, podeEscrever = false } = {}) {
  // Quem não é do time de TI só consulta: o resumo e os termos, e pede a troca
  // por chamado no Atendimento (por último, separado). As demais telas
  // redirecionam (TiTimeRoute em AppRoutes.jsx).
  if (!podeEscrever) {
    return [
      {
        label: 'Consulta',
        key: 'consulta',
        items: [
          { label: 'Resumo', href: '/ti/modelos', Icon: Layers },
          { label: TERMO, href: '/ti/termos', Icon: FileSignature, badge: contagens.termos },
        ],
      },
      {
        label: 'Atendimento',
        key: 'troca',
        items: [{ label: 'Pedir troca de equipamento', href: ROTA_TROCA_EQUIPAMENTO, Icon: Replace }],
      },
    ];
  }
  return [
    {
      label: 'Visão geral',
      key: 'geral',
      items: [{ label: 'Painel', href: '/ti/painel', Icon: LayoutDashboard }],
    },
    {
      label: 'Ativos',
      group: true,
      key: 'ativos',
      Icon: Laptop,
      items: [
        { label: 'Ver ativos', href: '/ti/ativos', Icon: Laptop },
        { label: 'Alocar equipamentos', href: '/ti/alocar', Icon: UserPlus, badge: contagens.alocar },
        { label: 'Movimentar ativo', href: '/ti/movimentar', Icon: ArrowLeftRight },
        { label: 'Resumo por pessoa', href: '/ti/modelos', Icon: Layers },
      ],
    },
    {
      label: 'Termos',
      key: 'termos',
      items: [{ label: TERMO, href: '/ti/termos', Icon: FileSignature, badge: contagens.termos }],
    },
  ];
}
