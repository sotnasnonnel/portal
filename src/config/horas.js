import { Clock, FileClock } from 'lucide-react';

// ============================ Áreas da Gestão de Horas ============================

/**
 * As duas rotinas do módulo, na escolha que o card "Gestão de Horas" da Home
 * abre (HorasModal.jsx) — mesmo desenho do card "Financeiro".
 *
 * São duas coisas diferentes, e é por isso que a escolha vem antes de entrar:
 * APONTAMENTO é o registro do tempo trabalhado, dia após dia; HORA EXTRA é um
 * pedido pontual que passa por aprovação e vira pagamento ou banco de horas.
 * Quem chega no card sabe qual das duas quer — o que não sabia era em qual
 * metade do módulo ela mora.
 *
 * Não há gate por área: o módulo é aberto a todos os logados, e o que muda por
 * papel é o que aparece DENTRO de cada área (ver navSections em
 * modules/horas/app/components/nav.js).
 */
export const AREAS_HORAS = [
  {
    slug: 'apontamento',
    label: 'Apontamento',
    icon: Clock,
    desc: 'Registre o tempo trabalhado por projeto e acompanhe os seus lançamentos.',
    href: '/horas/apontar',
    cta: 'Abrir apontamento',
  },
  {
    slug: 'extras',
    label: 'Horas Extras',
    icon: FileClock,
    desc: 'Peça hora extra, acompanhe a aprovação e o destino de cada uma.',
    href: '/horas/extras/minhas',
    cta: 'Abrir horas extras',
  },
];

export const getAreaHoras = (slug) => AREAS_HORAS.find((a) => a.slug === slug);
