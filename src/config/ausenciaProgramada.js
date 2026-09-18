// Regras e rótulos da AUSÊNCIA PROGRAMADA (card da Gestão de Pessoas).
// Briefing: referencia/alinhamento_ausencia_programada.txt.
//
// Nomenclatura obrigatória na interface: ausência programada, ausência, saldo,
// data limite, período. Nunca "férias".
//
// O banco repete as regras que importam (saldo, data inicial, sobreposição) nas
// RPCs de supabase_migration_ausencia_programada.sql. Aqui elas existem para a
// tela avisar antes do envio. Sem dependências de React/Supabase, para poder
// ser testado com `node --test`.
import { isSuperAdmin } from './superAdmin.js';
import { diaISO, diffDias, fmtDataBr, somarDias } from './horasExtras.js';

export { diaISO, fmtDataBr };

export const ROTA_AUSENCIA = '/ausencia-programada';

// Direito médio por período. O RH ajusta caso a caso no período.
export const DIAS_DIREITO_PADRAO = 21;

// A partir de quantos meses antes da data limite o saldo é "vencendo".
export const MESES_ALERTA = 3;

export const STATUS_LABEL = {
  rascunho: 'Rascunho',
  pendente: 'Pendente de aprovação',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
};

export const SITUACAO_LABEL = {
  em_aquisicao: 'Em aquisição',
  disponivel: 'Disponível',
  vencendo: 'Data limite próxima',
  vencido: 'Data limite passou',
  sem_saldo: 'Sem saldo',
};

// RH da ausência programada. Espelha app_private.is_ausencia_rh() — quem
// protege de verdade é o banco. `rh` é o perfil efetivo de quem tem rh_dp.
export function isAusenciaRh(user) {
  if (!user) return false;
  return user.rhDp === true || user.perfil === 'rh' || user.perfil === 'admin' || isSuperAdmin(user);
}

// Quem enxerga a fila de aprovação e a equipe no menu. A fila em si é
// filtrada pelo banco (aprovador_id), então mostrar a mais não abre dado.
export function veAprovacoes(user) {
  return ['gestor', 'coordenador', 'admin'].includes(user?.perfil) || isAusenciaRh(user);
}

// ---- Dias -----------------------------------------------------------------
// Dias corridos, contando o início e o fim (21/09 a 21/09 = 1 dia).
export function diasCorridos(inicio, fim) {
  if (!inicio || !fim || fim < inicio) return 0;
  return diffDias(inicio, fim) + 1;
}

// Data fim para uma quantidade de dias corridos.
export function fimPorDias(inicio, dias) {
  const n = Math.floor(Number(dias));
  if (!inicio || !Number.isFinite(n) || n < 1) return '';
  return somarDias(inicio, n - 1);
}

// Data limite menos MESES_ALERTA meses (mesmo dia do mês, ajustado ao fim do mês).
export function inicioAlerta(dataLimite, meses = MESES_ALERTA) {
  if (!dataLimite) return '';
  const [y, m, d] = String(dataLimite).slice(0, 10).split('-').map(Number);
  const alvo = new Date(y, m - 1 - meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimo));
  return diaISO(alvo);
}

// ---- Períodos -------------------------------------------------------------
export function rotuloPeriodo(p) {
  return p ? `${fmtDataBr(p.inicio_periodo)} a ${fmtDataBr(p.fim_periodo)}` : '—';
}

// `periodo` é a linha de ausencia_periodos_listar (já com saldo calculado).
export function situacaoPeriodo(periodo, hoje = diaISO()) {
  if (!periodo) return null;
  if (hoje < periodo.data_inicial) return 'em_aquisicao';
  if (hoje > periodo.data_limite) return periodo.saldo > 0 ? 'vencido' : 'sem_saldo';
  if (periodo.saldo <= 0) return 'sem_saldo';
  if (hoje >= inicioAlerta(periodo.data_limite)) return 'vencendo';
  return 'disponivel';
}

// Dias até a data limite (negativo quando já passou).
export function diasAteLimite(periodo, hoje = diaISO()) {
  return periodo?.data_limite ? diffDias(hoje, periodo.data_limite) : null;
}

// Resumo do topo da tela do colaborador: soma só o que ainda vale (períodos
// liberados e dentro da data limite). "Data inicial" e "data limite" vêm do
// período mais antigo com saldo — é o que deve ser usado primeiro.
export function resumoSaldo(periodos = [], hoje = diaISO()) {
  const usaveis = periodos.filter((p) => p.saldo > 0 && p.data_inicial <= hoje && p.data_limite >= hoje);
  const proximo = [...periodos]
    .filter((p) => p.saldo > 0 && p.data_limite >= hoje)
    .sort((a, b) => (a.data_limite < b.data_limite ? -1 : a.data_limite > b.data_limite ? 1 : 0))[0] || null;
  return {
    saldo: usaveis.reduce((t, p) => t + p.saldo, 0),
    tirados: periodos.reduce((t, p) => t + (p.dias_tirados || 0), 0),
    agendados: periodos.reduce((t, p) => t + (p.dias_agendados || 0), 0),
    pendentes: periodos.reduce((t, p) => t + (p.dias_pendentes || 0), 0),
    dataInicial: proximo?.data_inicial || null,
    dataLimite: proximo?.data_limite || null,
    vencendo: periodos.filter((p) => situacaoPeriodo(p, hoje) === 'vencendo'),
    bloqueado: periodos.length > 0 && periodos.every((p) => p.data_inicial > hoje),
  };
}

// Período sugerido para um pedido: o de data limite mais próxima que já está
// liberado na data de início e ainda tem saldo.
export function periodoSugerido(periodos = [], inicio = diaISO()) {
  return [...periodos]
    .filter((p) => p.saldo > 0 && p.data_inicial <= inicio && p.data_limite >= diaISO())
    .sort((a, b) => (a.data_limite < b.data_limite ? -1 : a.data_limite > b.data_limite ? 1 : 0))[0] || null;
}

// ---- Pedido ---------------------------------------------------------------
// Validação da tela. `erros` impedem o envio; `avisos` não (o gestor decide).
// `periodo.saldo` já vale para um rascunho em edição: rascunho não reserva saldo.
// `outras` são as solicitações do colaborador, para checar sobreposição.
export function validarPedido({
  periodo, inicio, fim, idAtual = null, outras = [], hoje = diaISO(),
} = {}) {
  const erros = [];
  const avisos = [];
  if (!periodo) erros.push('Escolha o período de referência.');
  if (!inicio) erros.push('Informe a data de início.');
  if (!fim) erros.push('Informe a data fim ou a quantidade de dias.');
  if (erros.length) return { ok: false, erros, avisos, dias: 0 };

  const dias = diasCorridos(inicio, fim);
  if (fim < inicio) erros.push('A data fim não pode ser anterior à data de início.');
  if (inicio < hoje) erros.push('A data de início não pode estar no passado.');
  if (inicio < periodo.data_inicial) {
    erros.push(`Este período só pode ser usado a partir de ${fmtDataBr(periodo.data_inicial)}.`);
  }
  if (dias > Math.max(0, periodo.saldo)) {
    erros.push(`Saldo insuficiente: o período tem ${Math.max(0, periodo.saldo)} dia(s) e o pedido usa ${dias}.`);
  }
  const conflito = outras.find((s) => s.id !== idAtual
    && ['pendente', 'aprovada'].includes(s.status)
    && s.data_inicio <= fim && s.data_fim >= inicio);
  if (conflito) {
    erros.push(`As datas se sobrepõem à ausência #${conflito.numero} (${fmtDataBr(conflito.data_inicio)} a ${fmtDataBr(conflito.data_fim)}).`);
  }
  if (fim > periodo.data_limite) {
    avisos.push(`Fora do prazo: a data limite deste período é ${fmtDataBr(periodo.data_limite)}. Você pode enviar mesmo assim; o gestor decide.`);
  }
  return { ok: erros.length === 0, erros, avisos, dias };
}

// ---- Status ---------------------------------------------------------------
// "Concluída" não é gravada: é a aprovada cujo fim já passou.
export function statusExibido(s, hoje = diaISO()) {
  if (!s) return null;
  if (s.status === 'aprovada' && s.data_fim < hoje) return 'concluida';
  return s.status;
}

export function statusLabel(s, hoje = diaISO()) {
  const st = statusExibido(s, hoje);
  return STATUS_LABEL[st] || st || '—';
}

// Classe de badge (o DP só tem cinco tons em components/UI/Components.css).
export function badgeClasse(s, hoje = diaISO()) {
  const st = statusExibido(s, hoje);
  if (st === 'aprovada' || st === 'concluida') return 'aprovada';
  if (st === 'reprovada') return 'reprovada';
  if (st === 'cancelada' || st === 'rascunho') return 'inativo';
  return 'pendente';
}

// Espelham public.ausencia_cancelar / ausencia_decidir.
export function podeCancelar(s, { userId, ehAprovador = false, ehRh = false } = {}, hoje = diaISO()) {
  if (!s || !['pendente', 'aprovada'].includes(s.status)) return false;
  if (ehAprovador || ehRh) return true;
  if (s.colaborador_id !== userId) return false;
  return s.status === 'pendente' || s.data_inicio > hoje;
}

export function podeDecidir(s, { userId, ehRh = false } = {}) {
  if (!s || s.status !== 'pendente' || s.colaborador_id === userId) return false;
  return s.aprovador_id === userId || ehRh;
}

// ---- Exportação -----------------------------------------------------------
export function csv(linhas) {
  return linhas
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`).join(';'))
    .join('\n');
}
