// Regras e rótulos da Gestão de HORAS EXTRAS (fluxo de solicitação/aprovação,
// paralelo ao apontamento de horas). Portadas de
// referencia/Sistema_PHD_Gestao_Horas_Extras_Teste_Ajustado.html.
//
// Fica em src/config (e não dentro de um módulo) porque a ferramenta é dividida
// entre DOIS módulos: o pedido, o acompanhamento e a aprovação vivem no Controle
// de Horas; o painel do DP, as exceções de prazo e a auditoria vivem na Gestão
// de Pessoas. Sem dependências, para poder ser testada isoladamente.
import { isSuperAdmin } from './superAdmin.js';

// Horário-limite padrão para pedir hora extra do próprio dia.
export const LIMITE_PADRAO = '12:00';

// Prazo máximo para compensar hora extra mandada ao banco de horas, contado da
// DATA DA HORA EXTRA (leitura da CLT art. 59 §2: a compensação deve ocorrer
// dentro do período máximo, sem se estender por causa de aprovação tardia).
export const PRAZO_COMPENSACAO_DIAS = 180;

// A partir de quantos dias do vencimento o painel do DP passa a alertar.
export const LIMIAR_VENCENDO_DIAS = 30;

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

// DP/Admin das horas extras: trata o destino da hora, cancela, marca compensado,
// libera exceções de prazo e lê a auditoria. Espelha
// app_private.is_horas_extras_dp() no banco — quem protege de verdade é a RLS.
// `rh` é o perfil efetivo de quem tem rh_dp sem ser gestor (ver AuthContext).
export function isHorasExtrasDp(user) {
  if (!user) return false;
  return (
    user.rhDp === true || user.perfil === 'rh' || user.perfil === 'admin' || isSuperAdmin(user)
  );
}

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

// Meia-noite LOCAL de 'yyyy-mm-dd'. (new Date('2026-07-09') seria meia-noite UTC,
// o que no Brasil cairia no dia anterior.)
function meiaNoiteLocal(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Soma dias a uma data 'yyyy-mm-dd' e devolve no mesmo formato.
export function somarDias(iso, dias) {
  if (!iso) return '';
  const d = meiaNoiteLocal(iso);
  d.setDate(d.getDate() + dias);
  return diaISO(d);
}

// Diferença em dias inteiros entre duas datas 'yyyy-mm-dd' (b - a).
export function diffDias(a, b) {
  if (!a || !b) return 0;
  return Math.round((meiaNoiteLocal(b) - meiaNoiteLocal(a)) / 86400000);
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

// ---- Prazo do pedido ------------------------------------------------------
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

// Datas que o input de DATA DA HORA EXTRA aceita. Sem exceção, o passado é
// fechado (min = hoje); com exceção, abre até o início do período liberado.
export function janelaPedido({ agora = new Date(), excecao = null } = {}) {
  const hoje = diaISO(agora);
  const min = excecao?.data_inicial ? String(excecao.data_inicial).slice(0, 10) : hoje;
  return { min: min < hoje ? min : hoje, max: '' };
}

// ---- Prazo de compensação (banco de horas) --------------------------------
// Datas que o input de COMPENSAÇÃO aceita: da data da hora extra até 180 dias
// depois dela. Os mesmos limites viram a constraint he_compensacao_prazo.
export function janelaCompensacao(dataHe) {
  if (!dataHe) return { min: '', max: '' };
  const base = String(dataHe).slice(0, 10);
  return { min: base, max: somarDias(base, PRAZO_COMPENSACAO_DIAS) };
}

export function validarCompensacao({ dataHe, dataCompensacao } = {}) {
  if (!dataCompensacao) {
    return { ok: false, msg: 'Informe a data prevista para compensação.' };
  }
  if (!dataHe) return { ok: true, msg: '' };
  const { min, max } = janelaCompensacao(dataHe);
  if (dataCompensacao < min) {
    return {
      ok: false,
      msg: `A compensação não pode ser anterior à data da hora extra (${fmtDataBr(min)}).`,
    };
  }
  if (dataCompensacao > max) {
    return {
      ok: false,
      msg: `A compensação deve ocorrer em até ${PRAZO_COMPENSACAO_DIAS} dias da hora extra, ou seja, até ${fmtDataBr(max)}.`,
    };
  }
  return {
    ok: true,
    msg: `Dentro do prazo: a compensação pode ir até ${fmtDataBr(max)} (${PRAZO_COMPENSACAO_DIAS} dias da hora extra).`,
  };
}

// Situação do prazo de uma solicitação em banco de horas ainda não compensada.
// Devolve null quando o prazo não se aplica (medição, já compensada, reprovada,
// cancelada ou ainda pendente de aprovação).
export function situacaoCompensacao(s, agora = new Date()) {
  if (!s || s.destino !== 'banco' || s.status !== 'aprovada' || !s.data_he) return null;
  const vencimento = somarDias(String(s.data_he).slice(0, 10), PRAZO_COMPENSACAO_DIAS);
  const dias = diffDias(diaISO(agora), vencimento);
  const estado = dias < 0 ? 'vencido' : dias <= LIMIAR_VENCENDO_DIAS ? 'vencendo' : 'ok';
  return { estado, dias, vencimento };
}

// Texto curto do prazo, para a coluna do painel do DP.
export function rotuloPrazo(situacao) {
  if (!situacao) return '';
  const { estado, dias, vencimento } = situacao;
  if (estado === 'vencido') {
    const atraso = Math.abs(dias);
    return `Vencido há ${atraso} dia${atraso === 1 ? '' : 's'} (${fmtDataBr(vencimento)})`;
  }
  if (dias === 0) return `Vence hoje (${fmtDataBr(vencimento)})`;
  return `${dias} dia${dias === 1 ? '' : 's'} (até ${fmtDataBr(vencimento)})`;
}

// ---- Ações permitidas -----------------------------------------------------
// Espelham a RLS (que é quem protege de verdade): o aprovador decide enquanto
// está pendente; o DP trata o resto depois da decisão.
export const podeDecidir = (s, meuId) => s?.status === 'pendente' && s?.aprovador_id === meuId;
export const podeAlterarDestino = (s) => s?.status === 'aprovada' || s?.status === 'compensada';
export const podeCancelar = (s) => s?.status !== 'cancelada';
export const podeCompensar = (s) => s?.status === 'aprovada' && s?.destino === 'banco';
