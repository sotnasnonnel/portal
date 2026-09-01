import { Bug, Lightbulb, Heart } from 'lucide-react';

// Fale conosco: canal do portal para bug, melhoria e elogio.
//
// Quem ATENDE a fila. Mesmo desenho do super-admin (config/superAdmin.js): a
// lista é por e-mail, e a proteção real é a RLS — app_private.is_suporte(), no
// banco, tem a MESMA lista. Incluir alguém exige mexer nos dois lugares
// (supabase/supabase_migration_fale_conosco.sql); mexer só aqui dá uma tela
// que abre e não lê nada.
export const ATENDENTES_SUPORTE = [
  'lennon.santos@phdengenharia.eng.br',
  'andre.guimaraes@phdengenharia.eng.br',
];

export function ehSuporte(user) {
  return ATENDENTES_SUPORTE.includes((user?.email || '').toLowerCase());
}

// Prazo prometido na tela e gravado no banco (fale_conosco.prazo_em).
// 48h CORRIDAS, não úteis: é o que o botão promete, e a promessa tem que ser a
// mesma dos dois lados.
export const SLA_HORAS = 48;

export const TIPOS_FALE_CONOSCO = [
  {
    id: 'bug',
    label: 'Bug',
    Icon: Bug,
    ajuda: 'Algo que não funciona ou funciona errado.',
    placeholder: 'O que você tentou fazer, o que aconteceu e em qual tela.',
  },
  {
    id: 'melhoria',
    label: 'Melhoria',
    Icon: Lightbulb,
    ajuda: 'Uma ideia para o portal ficar melhor.',
    placeholder: 'O que hoje é trabalhoso, e o que facilitaria a sua vida.',
  },
  {
    id: 'elogio',
    label: 'Elogio',
    Icon: Heart,
    ajuda: 'O que está funcionando bem.',
    placeholder: 'O que te ajudou, para a gente saber o que preservar.',
  },
];

export const tipoFaleConosco = (id) =>
  TIPOS_FALE_CONOSCO.find((t) => t.id === id) || TIPOS_FALE_CONOSCO[0];

/** Passou do prazo e ainda está aberto? */
export function atrasado(item) {
  return item?.status === 'aberto' && new Date(item.prazo_em) < new Date();
}

/** "em 31h" / "há 4h" — quanto falta (ou passou) do prazo. */
export function prazoRelativo(prazoIso) {
  const ms = new Date(prazoIso).getTime() - Date.now();
  const horas = Math.round(Math.abs(ms) / 3_600_000);
  const texto = horas >= 24 ? `${Math.round(horas / 24)}d` : `${horas}h`;
  return ms >= 0 ? `em ${texto}` : `há ${texto}`;
}

/** Evento que abre o modal a partir do botão da barra superior. */
export const FALE_CONOSCO_OPEN_EVENT = 'abrir_fale_conosco';
