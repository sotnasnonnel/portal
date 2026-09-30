// Adicional de Ausências — dias a mais combinados entre o gestor e a equipe,
// por projeto, que depois de aprovados somam no saldo da Ausência Programada.
//
// Não é a Ausência Programada (pedido de dias) nem a Folga de Campo (aviso de
// ausência da obra): é CRÉDITO de dias. Regras decididas em 30/09/2026 — ver
// supabase/supabase_migration_ausencia_adicionais.sql. Quem protege de verdade
// é o banco; estas funções só decidem o que a tela mostra.

import { isAusenciaRh } from './ausenciaProgramada.js';

export const ROTA_ADICIONAL = '/adicional-ausencias';

/** Valor do seletor de projeto para "não está na lista" — o nome vai digitado. */
export const OUTRO_PROJETO = 'outro';

/** Só coordenador e gestor registram (para a própria equipe). */
export const podeRegistrarAdicional = (user) => ['gestor', 'coordenador'].includes(user?.perfil);

/** A fila de aprovação: quem tem cargo de gestão e o RH. */
export const veAprovacoesAdicional = (user) => ['gestor', 'coordenador', 'admin'].includes(user?.perfil)
  || isAusenciaRh(user);

/** O módulo aparece no menu para quem registra, aprova ou acompanha (RH). */
export const veAdicionais = (user) => podeRegistrarAdicional(user) || veAprovacoesAdicional(user);

export const STATUS_ADICIONAL = {
  pendente: { label: 'Aguardando aprovação', badge: 'pendente' },
  aprovada: { label: 'Aprovado', badge: 'aprovada' },
  reprovada: { label: 'Reprovado', badge: 'reprovada' },
  cancelada: { label: 'Cancelado', badge: 'inativo' },
};

export function validarRegistro({ colaboradorId, projetoId, projetoNome, dias }) {
  if (!colaboradorId) return 'Escolha o colaborador.';
  if (!projetoId) return 'Escolha o projeto.';
  if (projetoId === OUTRO_PROJETO && !String(projetoNome || '').trim()) return 'Digite o nome do projeto.';
  const n = Number(dias);
  if (!Number.isInteger(n) || n < 1) return 'Informe a quantidade de dias adicionais (1 ou mais).';
  return '';
}

/** Espelha public.ausencia_adicional_decidir. */
export function podeDecidirAdicional(r, { userId, ehRh = false } = {}) {
  if (!r || r.status !== 'pendente') return false;
  if (r.registrado_por === userId || r.colaborador_id === userId) return false;
  return r.aprovador_id === userId || ehRh;
}

/** Espelha public.ausencia_adicional_cancelar. */
export function podeCancelarAdicional(r, { userId, ehRh = false } = {}) {
  if (!r) return false;
  if (ehRh) return ['pendente', 'aprovada'].includes(r.status);
  return r.status === 'pendente' && r.registrado_por === userId;
}
