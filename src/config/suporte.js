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
  'marcus.guimaraes@phdengenharia.eng.br',
];

// Botão "Fale conosco" (barra dos módulos e Home). Desligado: o botão some, mas a
// caixa em /fale-conosco continua no ar para responder o que já chegou.
export const FALE_CONOSCO_ATIVO = false;

export function ehSuporte(user) {
  return ATENDENTES_SUPORTE.includes((user?.email || '').toLowerCase());
}

// Canal pausado (07/10/2026, decisão do Marcus: foco em outras frentes). O
// botão continua na barra, com cadeado, para ninguém achar que sumiu — e
// travado para TODOS, inclusive quem atende. A caixa segue em /fale-conosco
// para responder o que já chegou. Para reabrir, volte para false.
export const FALE_CONOSCO_TRAVADO = true;
export const MSG_FALE_CONOSCO_TRAVADO = 'Fale conosco pausado por enquanto';

// Recebe o usuário para a regra poder voltar a abrir exceções sem mexer nas telas.
// eslint-disable-next-line no-unused-vars
export function faleConoscoTravado(user) {
  return FALE_CONOSCO_TRAVADO;
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

// Anexos da mensagem. Espelha o bucket e a constraint da migração
// supabase_migration_fale_conosco_anexos.sql (tipos, 10 MB, até 3): validar
// aqui evita que o erro chegue como a recusa crua do Storage.
export const ANEXOS_FC = {
  bucket: 'fale-conosco-anexos',
  max: 3,
  maxMb: 10,
  tipos: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  accept: 'image/png,image/jpeg,image/webp,application/pdf',
};

/** Evento que abre o modal a partir do botão da barra superior. */
export const FALE_CONOSCO_OPEN_EVENT = 'abrir_fale_conosco';
