// Regras e rótulos da Gestão de HORAS EXTRAS (fluxo de solicitação/aprovação,
// paralelo ao apontamento). Portadas de
// referencia/Sistema_PHD_Gestao_Horas_Extras_Teste_Ajustado.html — sem
// dependências, para poderem ser testadas isoladamente.

// Horário-limite padrão para pedir hora extra do próprio dia.
export const LIMITE_PADRAO = '12:00';

export const STATUS_LABEL = {
  pendente: 'Pendente de Aprovação',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
  cancelada: 'Cancelada',
  compensada: 'Compensada',
};

export const DESTINO_LABEL = {
  medicao: 'Medição/Pagamento',
  banco: 'Banco de Horas',
};

export const PERIODO_LABEL = {
  manha: 'Manhã',
  tarde: 'Tarde',
  dia_inteiro: 'Dia inteiro',
};

// Motivos do protótipo. 'Outro' abre o campo de texto livre.
export const MOTIVOS = [
  'Atendimento ao cliente',
  'Entrega de projeto',
  'Fechamento mensal',
  'Atividade emergencial',
  'Treinamento',
  'Reunião extraordinária',
  'Outro',
];
export const MOTIVO_OUTRO = 'Outro';

export const EXC_TIPO_LABEL = {
  solicitacao: 'Solicitação específica (colaborador + data)',
  colaborador: 'Colaborador por período',
  equipe: 'Equipe/Projeto por período',
  global: 'Horário global (toda a empresa)',
};

// "Aprovada · Banco de Horas" — o destino faz parte da identidade do status.
export function statusLabel(status, destino) {
  const base = STATUS_LABEL[status] || status || '—';
  if ((status === 'aprovada' || status === 'compensada') && destino) {
    return `${base} · ${DESTINO_LABEL[destino] || destino}`;
  }
  return base;
}

// Classe do badge: o destino colore a aprovada (medição x banco), como no protótipo.
export function statusClasse(status, destino) {
  if (status === 'aprovada' && destino === 'banco') return 'banco';
  if (status === 'aprovada' && destino === 'medicao') return 'medicao';
  return status || 'pendente';
}

// ---- Horas ----------------------------------------------------------------
// 'HH:MM' -> minutos desde a meia-noite. Devolve null se não for um horário.
export function horaParaMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Duração entre dois 'HH:MM' no MESMO dia. 0 quando o fim não é maior que o
// início (o formulário bloqueia; a constraint do banco também).
export function minutosEntre(inicio, fim) {
  const a = horaParaMin(inicio);
  const b = horaParaMin(fim);
  if (a == null || b == null) return 0;
  return Math.max(0, b - a);
}

// minutos -> 'HH:MM' (formato que o DP usa na folha).
export function fmtMin(min) {
  const total = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---- Datas ----------------------------------------------------------------
// yyyy-mm-dd na data LOCAL (new Date().toISOString() cortaria o dia às 21h no BR).
export function diaISO(ref = new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Intervalo padrão dos filtros: os últimos `dias` dias (limita o payload).
export function periodoUltimosDias(dias = 60, agora = Date.now()) {
  return { de: diaISO(new Date(agora - (dias - 1) * 86400000)), ate: diaISO(new Date(agora)) };
}

export function fmtDataBr(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
}

// 'HH:MM:SS' (o Postgres devolve time com segundos) -> 'HH:MM'.
export function fmtHora(t) {
  return t ? String(t).slice(0, 5) : '—';
}

// ---- Prazo ----------------------------------------------------------------
// Regra padrão: nada retroativo e, no próprio dia, só até LIMITE_PADRAO.
// Uma exceção ATIVA que cubra a data troca o limite E libera o retroativo dentro
// do seu período — é o caso que a própria Central de Exceções descreve
// ("colaborador em campo sem acesso ao sistema"), que de outra forma ficaria sem
// saída. `excecao` é o que a RPC horas_extras_excecao_aplicavel devolve (ou null).
export function validarPrazo({ data, agora = new Date(), excecao = null } = {}) {
  const limite = excecao?.novo_horario ? String(excecao.novo_horario).slice(0, 5) : LIMITE_PADRAO;
  const fonte = excecao ? `exceção ativa: ${excecao.tipo}` : 'regra padrão';

  if (!data) {
    return { ok: false, limite, fonte, msg: 'Informe a data da hora extra.' };
  }

  const hoje = diaISO(agora);

  if (data < hoje) {
    if (!excecao) {
      return {
        ok: false,
        limite,
        fonte,
        msg: 'Solicitação retroativa não permitida. Peça ao DP uma exceção de prazo para esta data.',
      };
    }
    return {
      ok: true,
      limite,
      fonte,
      msg: `Lançamento retroativo liberado pela ${fonte} (${fmtDataBr(excecao.data_inicial)} a ${fmtDataBr(excecao.data_final)}).`,
    };
  }

  if (data === hoje) {
    const agoraMin = agora.getHours() * 60 + agora.getMinutes();
    if (agoraMin > horaParaMin(limite)) {
      return {
        ok: false,
        limite,
        fonte,
        msg: `Solicitação não permitida. Prazo encerrado às ${limite} (${fonte}).`,
      };
    }
  }

  return {
    ok: true,
    limite,
    fonte,
    msg: `Dentro do prazo para solicitação. Horário limite: ${limite} (${fonte}).`,
  };
}

// ---- Ações permitidas -----------------------------------------------------
// Espelham a RLS (que é quem protege de verdade): o aprovador decide enquanto
// está pendente; o DP trata o resto depois da decisão.
export const podeDecidir = (s, meuId) => s?.status === 'pendente' && s?.aprovador_id === meuId;
export const podeAlterarDestino = (s) => s?.status === 'aprovada' || s?.status === 'compensada';
export const podeCancelar = (s) => s?.status !== 'cancelada';
export const podeCompensar = (s) => s?.status === 'aprovada' && s?.destino === 'banco';
