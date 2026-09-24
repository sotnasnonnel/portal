// Regras e rótulos da FOLGA DE CAMPO (card da Gestão de Pessoas).
//
// O colaborador avisa que vai ficar ausente da obra por alguns dias, o
// responsável aprova, e o registro fica para consulta.
//
// NÃO tem saldo, período aquisitivo nem data limite — é o que separa este
// módulo da Ausência Programada (config/ausenciaProgramada.js), que nasceu
// antes e conta dias. A primeira versão daqui era cópia dela; o usuário
// corrigiu em 23/09/2026. Se alguém for "reaproveitar" as telas de lá de novo,
// é esta a diferença.
//
// O banco repete as regras que importam em supabase_migration_folga_campo.sql.
// Aqui elas existem para a tela avisar antes do envio. Sem dependências de
// React/Supabase, para poder ser testado com `node --test`.
import { isSuperAdmin } from './superAdmin.js';
import { diaISO, diffDias, fmtDataBr } from './horasExtras.js';

export { diaISO, fmtDataBr };

export const ROTA_FOLGA_CAMPO = '/folga-de-campo';

// ---- Piloto ---------------------------------------------------------------
// Enquanto é piloto, o módulo só aparece para quem está na lista. Mesma trava
// do módulo Programas. Para abrir a todos: EM_PILOTO = false (a lista pode
// ficar, deixa de ser consultada).
//
// ATENÇÃO: trava de INTERFACE. As RPCs folga_campo_* continuam existindo para
// qualquer usuário autenticado; ninguém fora do piloto tem por onde chegar
// nelas pelo portal, mas isto é lançamento controlado, não sigilo.
export const EM_PILOTO = true;

export const LIBERADOS = [
  'marcus.guimaraes@phdengenharia.eng.br',
  'andre.guimaraes@phdengenharia.eng.br',
];

export function podeAcessarFolgaCampo(user) {
  if (!EM_PILOTO) return true;
  return LIBERADOS.includes(String(user?.email || '').trim().toLowerCase());
}

// ---- Papéis ---------------------------------------------------------------
// RH da folga de campo. Espelha app_private.is_folga_campo_rh() — quem protege
// de verdade é o banco.
export function isFolgaCampoRh(user) {
  if (!user) return false;
  return user.rhDp === true || user.perfil === 'rh' || user.perfil === 'admin' || isSuperAdmin(user);
}

// Quem enxerga a fila de aprovação e a consulta da equipe. A fila em si é
// filtrada pelo banco (aprovador_id), então mostrar a mais não abre dado.
export function veAprovacoes(user) {
  return ['gestor', 'coordenador', 'admin'].includes(user?.perfil) || isFolgaCampoRh(user);
}

// ---- Status ---------------------------------------------------------------
export const STATUS_LABEL = {
  pendente: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
};

// "Concluída" não é gravada: é a aprovada cujo fim já passou.
export function statusExibido(r, hoje = diaISO()) {
  if (!r) return null;
  if (r.status === 'aprovada' && r.data_fim < hoje) return 'concluida';
  return r.status;
}

export function statusLabel(r, hoje = diaISO()) {
  const st = statusExibido(r, hoje);
  return STATUS_LABEL[st] || st || '—';
}

// Classe de badge (o DP só tem cinco tons em components/UI/Components.css).
export function badgeClasse(r, hoje = diaISO()) {
  const st = statusExibido(r, hoje);
  if (st === 'aprovada' || st === 'concluida') return 'aprovada';
  if (st === 'reprovada') return 'reprovada';
  if (st === 'cancelada') return 'inativo';
  return 'pendente';
}

// ---- Dias -----------------------------------------------------------------
// Dias corridos, contando o início e o fim (21/09 a 21/09 = 1 dia).
export function diasCorridos(inicio, fim) {
  if (!inicio || !fim || fim < inicio) return 0;
  return diffDias(inicio, fim) + 1;
}

// ---- Registro -------------------------------------------------------------
// Validação da tela. `outros` são os registros do próprio colaborador, para
// checar sobreposição. Espelha public.folga_campo_registrar.
export function validarRegistro({ inicio, fim, motivo, outros = [], hoje = diaISO() } = {}) {
  const erros = [];
  if (!inicio) erros.push('Informe a data de início.');
  if (!fim) erros.push('Informe a data fim.');
  if (!String(motivo || '').trim()) erros.push('Informe o motivo da ausência.');
  if (!inicio || !fim) return { ok: false, erros, dias: 0 };

  if (fim < inicio) erros.push('A data fim não pode ser anterior à data de início.');
  if (inicio < hoje) erros.push('A data de início não pode estar no passado.');

  const conflito = outros.find((r) => ['pendente', 'aprovada'].includes(r.status)
    && r.data_inicio <= fim && r.data_fim >= inicio);
  if (conflito) {
    erros.push(`As datas se sobrepõem à folga #${conflito.numero} (${fmtDataBr(conflito.data_inicio)} a ${fmtDataBr(conflito.data_fim)}).`);
  }

  return { ok: erros.length === 0, erros, dias: diasCorridos(inicio, fim) };
}

// ---- Ações ----------------------------------------------------------------
// Espelham public.folga_campo_cancelar / folga_campo_decidir.
export function podeCancelar(r, { userId, ehAprovador = false, ehRh = false } = {}, hoje = diaISO()) {
  if (!r || !['pendente', 'aprovada'].includes(r.status)) return false;
  if (ehAprovador || ehRh) return true;
  if (r.colaborador_id !== userId) return false;
  return r.status === 'pendente' || r.data_inicio > hoje;
}

export function podeDecidir(r, { userId, ehRh = false } = {}) {
  if (!r || r.status !== 'pendente' || r.colaborador_id === userId) return false;
  return r.aprovador_id === userId || ehRh;
}

// ---- Exportação -----------------------------------------------------------
export function csv(linhas) {
  return linhas
    .map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`).join(';'))
    .join('\n');
}
