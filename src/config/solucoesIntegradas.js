import { GraduationCap, Activity, Headset, CreditCard, Handshake, BookOpen } from 'lucide-react';

/**
 * Ferramentas externas usadas na empresa, agrupadas no card expansível
 * "Soluções Integradas" da tela inicial (src/pages/Home/Home.jsx).
 *
 * - nome: rótulo exibido
 * - desc: linha curta de apoio
 * - url:  destino do link (abre em nova aba, direto na tela de login da ferramenta).
 *         Deixe em string vazia para o item aparecer como "Em breve", sem link.
 * - icon: ícone lucide-react
 *
 * Fonte única: para trocar um endereço ou incluir uma ferramenta nova, mexa só aqui.
 */
export const SOLUCOES_INTEGRADAS = [
  {
    nome: 'Engrow',
    desc: 'Treinamentos e desenvolvimento',
    url: 'https://engrow.com.br/',
    icon: GraduationCap,
  },
  {
    nome: 'Pulses',
    desc: 'Clima e engajamento',
    url: 'https://www.pulses.com.br/app/aplicativo/#/',
    icon: Activity,
  },
  {
    nome: 'Milldesk',
    desc: 'Chamados de TI e suporte',
    url: 'https://phdengenharia.milldesk.com',
    icon: Headset,
  },
  {
    nome: 'Clara',
    desc: 'Cartões corporativos e despesas',
    url: 'https://brasil.clara.com/auth/login',
    icon: CreditCard,
  },
  {
    nome: 'RD Station',
    desc: 'CRM de vendas',
    url: 'https://accounts.rdstation.com/',
    icon: Handshake,
  },
  {
    nome: 'Biblioteca',
    desc: 'Documentos, políticas e procedimentos',
    url: 'https://phdengenhariabr.sharepoint.com/sites/IntranetPHDEngenharia/Documentos%20PHD/Forms/AllItems.aspx',
    icon: BookOpen,
  },
];
