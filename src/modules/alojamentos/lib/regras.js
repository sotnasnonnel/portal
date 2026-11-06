// Regras do módulo de Alojamentos, portadas do protótipo
// docs/ref/"Gestão de Alojamentos PHD - HTML.html". Sem React e sem Supabase
// (roda sob `node --test`).
//
// Tudo trabalha sobre a BASE, o mesmo formato que lib/alojamentos.js carrega:
//   { alojamentos: [{ ...colunas, quartos, contas, pendencias }],
//     estadias, pagamentos, itens, ocorrencias }
// `hoje` é sempre um parâmetro (YYYY-MM-DD), para o teste não depender do relógio.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const N0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const pad = (n) => String(n).padStart(2, '0');

/* ===================== formatação ===================== */
export const num = (v) => ((v === null || v === undefined || v === '' || Number.isNaN(+v)) ? null : +v);
export const money = (v) => (num(v) === null ? '' : BRL.format(+v));
export const moneyCurto = (v) => money(v).replace('R$', '').trim();
export const inteiro = (v) => N0.format(v);
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const plural = (n, s, p) => `${n} ${n === 1 ? s : (p || `${s}s`)}`;
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function initials(s) {
  const p = String(s || '').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : (p[0] || '')[1] || '')).toUpperCase();
}

/* ===================== datas ===================== */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function pISO(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function fdate(s) {
  const d = pISO(s);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
}
/** Data local de um timestamptz (conferido_em), em DD/MM/AAAA. */
export function fdateTs(ts) {
  const d = ts ? new Date(ts) : null;
  return d && !Number.isNaN(d.getTime()) ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
}
export function fdm(s) {
  const d = pISO(s);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : '';
}
export function daysBetween(a, b) {
  const x = pISO(a);
  const y = pISO(b);
  return (x && y) ? Math.round((y - x) / 86400000) : null;
}
export function daysUntil(s, hoje = todayISO()) {
  return daysBetween(hoje, s);
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MES3 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const curComp = (hoje = todayISO()) => hoje.slice(0, 7);
export function compLabel(c) {
  if (!c) return '';
  const [y, m] = c.split('-').map(Number);
  return `${MES3[m - 1]}/${y}`;
}
export function compLong(c) {
  if (!c) return '';
  const [y, m] = c.split('-').map(Number);
  return `${cap(MESES[m - 1])} de ${y}`;
}
export function addMonths(c, n) {
  const [y, m] = c.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function addDays(iso, n) {
  const d = pISO(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Último dia do mês "YYYY-MM", como data ISO. */
export function lastDay(c) {
  const [y, m] = c.split('-').map(Number);
  return `${c}-${pad(new Date(y, m, 0).getDate())}`;
}

/* ===================== constantes ===================== */
export const STATUS = {
  ativo: { l: 'Ativo', c: 'good' },
  desmobilizacao: { l: 'Em desmobilização', c: 'warn' },
  inativo: { l: 'Inativo', c: '' },
};
export const ORDER = { ativo: 0, desmobilizacao: 1, inativo: 2 };
export const CONTAS = ['Aluguel', 'Condomínio', 'IPTU', 'Água', 'Energia', 'Internet', 'Gás', 'Faxina', 'Manutenção', 'Caução', 'Outros'];
/**
 * Contas variáveis: sempre têm coluna nos quadros e aceitam vários lançamentos no
 * mês, mas nunca geram "a lançar" (não entram em contas_controladas).
 */
export const SEMPRE = ['Manutenção'];
/** O que o cadastro oferece para controle mês a mês. */
export const CONTAS_CONTROLAVEIS = CONTAS.filter((c) => c !== 'Caução' && !SEMPRE.includes(c));
export const UTIL_TIPOS = ['Água', 'Energia', 'Internet', 'Gás', 'TV', 'Outro'];
export const CHAVE = {
  com_morador: { l: 'Com o morador', c: 'info' },
  com_terceiro: { l: 'Com outro morador', c: 'warn' },
  devolvida: { l: 'Devolvida', c: 'good' },
  pendente: { l: 'Devolução pendente', c: 'bad' },
  nao_entregue: { l: 'Não entregue', c: '' },
  nao_informado: { l: 'Não informado', c: '' },
};
export const PAG_ST = {
  pago: { l: 'Pago', c: 'good' },
  pendente: { l: 'Pendente', c: 'warn' },
  agendado: { l: 'Agendado', c: 'info' },
};
/** Conferência da fatura pelo Contas a Pagar (alojamentos_pagamentos.conferencia_status). */
export const CONF = {
  pendente: { l: 'A conferir', c: 'warn' },
  conferida: { l: 'Conferida', c: 'good' },
  divergencia: { l: 'Divergência', c: 'bad' },
};
export const confSt = (p) => (CONF[p?.conferencia_status] ? p.conferencia_status : 'pendente');
export const FORMAS = ['Boleto', 'PIX', 'PIX agendado', 'Débito automático', 'Transferência', 'Cartão corporativo', 'Reembolso', 'Outro'];
export const DESTINOS = ['Em uso', 'Transferir p/ outro alojamento', 'Vender', 'Doar', 'Descartar', 'Deixar no imóvel'];
export const DEST_C = {
  'Em uso': 'info', 'Transferir p/ outro alojamento': 'accent', Vender: 'warn', Doar: 'good', Descartar: 'bad', 'Deixar no imóvel': '',
};
export const TIPOS_OC = ['Contrato', 'Contas', 'Manutenção', 'Moradores', 'Vistoria', 'Segurança', 'Outro'];
export const TIPOS_IMOVEL = ['Apartamento', 'Casa', 'Hotel', 'Pousada', 'Imóvel', 'Outro'];
export const UFS = ['', 'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

/* ===================== dados derivados ===================== */
export const byId = (base, id) => base.alojamentos.find((a) => a.id === id);
export const doAloj = (lista, aid) => lista.filter((x) => x.alojamento_id === aid);
export const operando = (a) => a.status !== 'inativo';

export function alojs(base, filtro) {
  const lista = [...base.alojamentos].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)
    || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  return filtro ? lista.filter(filtro) : lista;
}

export const isOn = (e, hoje = todayISO()) => !e.saida || e.saida > hoje;
export const staysOn = (base, aid, hoje = todayISO()) => doAloj(base.estadias, aid).filter((e) => isOn(e, hoje));
export const vagas = (a) => (a.quartos || []).reduce((s, q) => s + Math.max(1, +q.vagas || 1), 0);
export const totalItem = (i) => (+i.quantidade || 0) * (+i.preco_unitario || 0);
export const invest = (base, aid) => doAloj(base.itens, aid).reduce((s, i) => s + totalItem(i), 0);
export const custoFixo = (a) => (num(a.aluguel_valor) || 0) + (num(a.condominio_valor) || 0) + (num(a.iptu) || 0);
export const temCustoFixo = (a) => num(a.aluguel_valor) !== null || num(a.condominio_valor) !== null || num(a.iptu) !== null;
export const local = (a) => [a.cidade, a.uf].filter(Boolean).join(' · ')
  || (a.pais && a.pais !== 'Brasil' ? a.pais : 'Local não informado');

export function missing(a) {
  const m = [];
  if (!a.endereco) m.push('endereço');
  if (num(a.aluguel_valor) === null) m.push('valor do aluguel');
  if (!a.contrato_fim) m.push('fim do contrato');
  if (!(a.quartos || []).length) m.push('quartos');
  if (!a.proprietario_nome && !a.imobiliaria_nome) m.push('locador');
  return m;
}

/**
 * Mês a partir do qual a conta é cobrada como "a lançar": o 1º lançamento
 * existente; sem lançamentos, o mês do cadastro no sistema. Contrato que começa
 * depois disso empurra o início.
 */
export function inicioControle(a, base, hoje = todayISO()) {
  const ps = base.pagamentos.filter((p) => p.alojamento_id === a.id && p.competencia).map((p) => p.competencia).sort();
  let ini = ps[0] || String(a.created_at || '').slice(0, 7) || curComp(hoje);
  const ci = String(a.contrato_inicio || '').slice(0, 7);
  if (ci && ci > ini) ini = ci;
  return ini;
}

export const esperado = (a, conta, comp, base, hoje = todayISO()) => operando(a)
  && (a.contas_controladas || []).includes(conta)
  && comp >= inicioControle(a, base, hoje)
  && comp <= curComp(hoje);

export const pagsDe = (base, aid, conta, comp) => base.pagamentos
  .filter((p) => p.alojamento_id === aid && p.conta === conta && p.competencia === comp);

export const pagoAno = (base, aid, ano) => base.pagamentos
  .filter((p) => p.alojamento_id === aid && String(p.competencia).startsWith(String(ano)))
  .reduce((s, p) => s + (num(p.valor) || 0), 0);

export function contratoInfo(a, hoje = todayISO()) {
  if (a.status === 'inativo') {
    return a.devolucao_data
      ? { label: `Devolvido em ${fdate(a.devolucao_data)}`, c: '' }
      : { label: 'Encerrado', c: '' };
  }
  const alvo = a.status === 'desmobilizacao' && a.encerramento_previsto ? a.encerramento_previsto : a.contrato_fim;
  if (!alvo) return { label: 'Sem data de fim', c: '', d: null };
  const d = daysUntil(alvo, hoje);
  const c = d < 0 ? 'bad' : d <= 30 ? 'bad' : d <= 90 ? 'warn' : '';
  const txt = d < 0 ? `vencido há ${-d} d` : d === 0 ? 'hoje' : `em ${d} d`;
  return { label: `${fdate(alvo)} · ${txt}`, c, d, alvo };
}

/**
 * Nome do quarto de uma estadia. Quarto excluído zera quarto_id no banco, e o
 * gatilho guarda o nome em quarto_nome: é isso que mantém o histórico legível.
 */
export function quartoNome(a, e) {
  const q = (a?.quartos || []).find((x) => x.id === e?.quarto_id);
  if (q) return q.nome;
  return e?.quarto_nome ? `${e.quarto_nome} (removido)` : 'Sem quarto';
}

/** Chave ainda fora do lugar: saiu sem devolver, ou devolução marcada como pendente. */
export const chaveARecolher = (e, hoje = todayISO()) => (e.saida && e.saida <= hoje
  && ['com_morador', 'com_terceiro', 'pendente'].includes(e.chave)) || e.chave === 'pendente';

export function movimentos(base) {
  const ev = [];
  base.estadias.forEach((e) => {
    const a = byId(base, e.alojamento_id);
    if (!a) return;
    if (e.entrada) ev.push({ d: e.entrada, t: 'Entrada', e, a });
    if (e.saida) ev.push({ d: e.saida, t: 'Saída', e, a });
  });
  return ev.sort((x, y) => y.d.localeCompare(x.d));
}

/** Quantas contas a competência espera e quantas já têm lançamento. */
export function resumoCompetencia(base, comp, hoje = todayISO()) {
  let exp = 0;
  let lanc = 0;
  let pend = 0;
  base.alojamentos.filter(operando).forEach((a) => (a.contas_controladas || []).forEach((c) => {
    if (!esperado(a, c, comp, base, hoje)) return;
    exp += 1;
    const ps = pagsDe(base, a.id, c, comp);
    if (ps.length) {
      lanc += 1;
      if (ps.some((p) => p.status !== 'pago')) pend += 1;
    }
  }));
  return { exp, lanc, pend };
}

/* ===================== alertas ===================== */
const SEV = { bad: 0, warn: 1, info: 2 };

export function alerts(base, hoje = todayISO()) {
  const out = [];
  const comp = curComp(hoje);

  base.alojamentos.forEach((a) => {
    const pend = (a.pendencias || []).filter((x) => !x.feito);
    if (a.status === 'inativo') {
      if (pend.length) {
        out.push({ sev: 'warn', aid: a.id, tab: 'geral', title: `${plural(pend.length, 'pendência')} de encerramento`, text: pend.map((x) => x.texto).join(' · ') });
      }
      return;
    }
    if (a.status === 'desmobilizacao') {
      const d = a.encerramento_previsto ? daysUntil(a.encerramento_previsto, hoje) : null;
      out.push({
        sev: d !== null && d <= 30 ? 'bad' : 'warn',
        aid: a.id,
        tab: 'geral',
        title: d === null ? 'Desmobilização sem data prevista' : d < 0 ? `Desmobilização atrasada há ${plural(-d, 'dia')}` : `Desmobilização em ${plural(d, 'dia')}`,
        text: a.encerramento_previsto
          ? `Entrega prevista para ${fdate(a.encerramento_previsto)}. Definir destino do mobiliário, chaves e encerramento das contas.`
          : 'Informe a data prevista de entrega do imóvel.',
      });
    } else if (a.contrato_fim) {
      const d = daysUntil(a.contrato_fim, hoje);
      const auto = !!a.contrato_renovacao_automatica;
      if (d < 0) {
        out.push({
          sev: auto ? 'info' : 'bad',
          aid: a.id,
          tab: 'geral',
          title: auto ? 'Contrato em prorrogação automática' : `Contrato vencido há ${plural(-d, 'dia')}`,
          text: `Fim previsto em ${fdate(a.contrato_fim)}. Atualize a vigência ou registre o encerramento.`,
        });
      } else if (d <= 90) {
        out.push({
          sev: auto ? 'info' : d <= 30 ? 'bad' : 'warn',
          aid: a.id,
          tab: 'geral',
          title: `Contrato encerra em ${plural(d, 'dia')}`,
          text: `Fim em ${fdate(a.contrato_fim)}${auto ? ' · prorrogação automática prevista' : ''}. Decidir renovação ou devolução.`,
        });
      }
    }
    if (pend.length) {
      out.push({ sev: 'info', aid: a.id, tab: 'geral', title: `${plural(pend.length, 'pendência')} em aberto`, text: pend.map((x) => x.texto).join(' · ') });
    }
  });

  base.estadias.forEach((e) => {
    const a = byId(base, e.alojamento_id);
    if (!a) return;
    if (chaveARecolher(e, hoje)) {
      out.push({ sev: 'bad', aid: a.id, tab: 'ocupacao', title: `Chave não devolvida · ${e.morador}`, text: `${a.nome} · ${quartoNome(a, e)}${e.saida ? ` · saída em ${fdate(e.saida)}` : ''}` });
    } else if (!e.saida && e.saida_prevista && e.saida_prevista < hoje) {
      out.push({ sev: 'warn', aid: a.id, tab: 'ocupacao', title: `Saída prevista vencida · ${e.morador}`, text: `Prevista para ${fdate(e.saida_prevista)} em ${a.nome}. Registre a saída ou atualize a data.` });
    }
  });

  let exp = 0;
  let done = 0;
  const falt = new Set();
  base.alojamentos.filter(operando).forEach((a) => (a.contas_controladas || []).forEach((c) => {
    if (!esperado(a, c, comp, base, hoje)) return;
    exp += 1;
    if (pagsDe(base, a.id, c, comp).length) done += 1;
    else falt.add(a.id);
  }));
  if (exp && done < exp) {
    out.push({ sev: 'info', go: 'pagamentos', title: `${compLong(comp)}: ${exp - done} de ${exp} contas sem lançamento`, text: `${plural(falt.size, 'alojamento')} com contas a lançar na competência atual.` });
  }

  out.push(...alertasFaturas(base, hoje));

  const inc = base.alojamentos.filter((a) => a.status === 'ativo' && missing(a).length);
  if (inc.length) {
    out.push({ sev: 'info', go: 'lista', filter: 'incompletos', title: plural(inc.length, 'cadastro incompleto', 'cadastros incompletos'), text: inc.map((a) => a.nome).join(', ') });
  }

  return out.sort((x, y) => SEV[x.sev] - SEV[y.sev]);
}

/* ===================== quadro de pagamentos ===================== */

/** O que a célula do quadro mostra, para um conjunto de lançamentos não vazio. */
export function resumoCelula(ps) {
  const st = ps.every((p) => p.status === 'pago') ? 'pago' : ps.some((p) => p.status === 'pendente') ? 'pendente' : 'agendado';
  const tot = ps.reduce((s, p) => s + (num(p.valor) || 0), 0);
  const temValor = ps.some((p) => num(p.valor) !== null);
  const dia = ps.find((p) => p.data_pagamento)?.data_pagamento;
  const principal = temValor ? moneyCurto(tot) : st === 'pago' ? '✓ pago' : PAG_ST[st].l;
  const sub = st === 'pago'
    ? (dia ? `dia ${+dia.slice(8)}` : (temValor ? 'pago' : ''))
    : (ps[0].vencimento ? `vence ${fdm(ps[0].vencimento)}` : PAG_ST[st].l.toLowerCase());
  return { st, principal, sub };
}

/** Colunas do quadro: as controladas, as SEMPRE e as que já têm lançamento. */
export const contasDoQuadro = (controladas, lancadas) => CONTAS
  .filter((c) => controladas.includes(c) || SEMPRE.includes(c) || lancadas.includes(c));

/** A célula abre a lista (e não o formulário direto) quando há mais de um lançamento ou a conta é SEMPRE. */
export const celulaAbreLista = (conta, ps) => ps.length > 1 || SEMPRE.includes(conta);

/* ===================== faturas (Contas a Pagar) ===================== */
const somaV = (l) => l.reduce((s, p) => s + (num(p.valor) || 0), 0);
export const emAberto = (p) => p.status !== 'pago';
export const vencida = (p, hoje = todayISO()) => !!p.vencimento && p.vencimento < hoje && emAberto(p);

/** Alertas do Início: vencidas sem pagamento e as que vencem em até 3 dias. */
export function alertasFaturas(base, hoje = todayISO()) {
  const abertas = base.pagamentos.filter((p) => byId(base, p.alojamento_id) && p.vencimento && emAberto(p));
  const atras = abertas.filter((p) => p.vencimento < hoje);
  const ate = addDays(hoje, 3);
  const prox = abertas.filter((p) => p.vencimento >= hoje && p.vencimento <= ate);
  const resumo = (l) => `${money(somaV(l)) || 'R$ 0,00'} · ${[...new Set(l.map((p) => byId(base, p.alojamento_id).nome))].join(', ')}`;
  const out = [];
  if (atras.length) {
    out.push({
      sev: 'bad', go: 'pagamentos/faturas', chip: 'vencidas', title: `${plural(atras.length, 'fatura vencida', 'faturas vencidas')} sem pagamento`, text: resumo(atras),
    });
  }
  if (prox.length) {
    out.push({
      sev: 'warn', go: 'pagamentos/faturas', chip: '3d', title: `${plural(prox.length, 'fatura vence', 'faturas vencem')} em até 3 dias`, text: resumo(prox),
    });
  }
  return out;
}

/** Filtros da tela de faturas, todos vazios. */
export const FAT0 = () => ({
  comp: '', de: '', ate: '', aloj: '', conta: '', sit: '', conf: '', anexo: '', q: '',
});
export const filtroAtivo = (f) => Object.values(f).some(Boolean);

export function fatFiltrar(base, f, hoje = todayISO()) {
  const q = norm(f.q).trim();
  const nome = (p) => String(byId(base, p.alojamento_id)?.nome || '');
  return base.pagamentos.filter((p) => {
    const a = byId(base, p.alojamento_id);
    if (!a) return false;
    if (f.comp && p.competencia !== f.comp) return false;
    if ((f.de || f.ate) && !p.vencimento) return false;
    if (f.de && p.vencimento < f.de) return false;
    if (f.ate && p.vencimento > f.ate) return false;
    if (f.aloj && p.alojamento_id !== f.aloj) return false;
    if (f.conta && p.conta !== f.conta) return false;
    if (f.conf && confSt(p) !== f.conf) return false;
    const n = (p.anexos || []).length;
    if (f.anexo === 'com' && !n) return false;
    if (f.anexo === 'sem' && n) return false;
    if (f.sit === 'apagar' && !emAberto(p)) return false;
    if (f.sit === 'pago' && emAberto(p)) return false;
    if (f.sit === 'vencidas' && !vencida(p, hoje)) return false;
    if (q && !norm([a.nome, a.sigla, a.centro_custo, p.conta, p.fornecedor, p.documento, p.obs, ...(p.anexos || []).map((x) => x.nome)].join(' ')).includes(q)) return false;
    return true;
  }).sort((x, y) => (x.vencimento || '9999').localeCompare(y.vencimento || '9999')
    || nome(x).localeCompare(nome(y), 'pt-BR') || String(x.conta).localeCompare(String(y.conta)));
}

export const ATALHOS_FATURA = [
  ['hoje', 'Vencem hoje'], ['3d', 'Próximos 3 dias'], ['7d', 'Próximos 7 dias'], ['mes', 'Vencimento no mês'],
  ['vencidas', 'Vencidas sem pagamento'], ['conferir', 'Com fatura, a conferir'],
];

export function fatChipOn(f, k, hoje = todayISO()) {
  const m = f.comp || curComp(hoje);
  if (k === 'hoje') return f.de === hoje && f.ate === hoje;
  if (k === '3d') return f.de === hoje && f.ate === addDays(hoje, 3);
  if (k === '7d') return f.de === hoje && f.ate === addDays(hoje, 7);
  if (k === 'mes') return f.de === `${m}-01` && f.ate === lastDay(m);
  if (k === 'vencidas') return f.sit === 'vencidas';
  if (k === 'conferir') return f.conf === 'pendente' && f.anexo === 'com';
  return false;
}

/**
 * Aplica um atalho e devolve os filtros novos (não muda `atual`). Clicar no
 * atalho já ligado o desliga. `reset` parte dos filtros vazios: é como o alerta
 * do Início abre a tela.
 */
export function fatChip(atual, k, hoje = todayISO(), reset = false) {
  if (k === 'limpar') return FAT0();
  const f = reset ? FAT0() : { ...atual };
  if (!reset && fatChipOn(f, k, hoje)) {
    if (k === 'vencidas') f.sit = '';
    else if (k === 'conferir') Object.assign(f, { conf: '', anexo: '' });
    else Object.assign(f, { de: '', ate: '' });
    return f;
  }
  const m = f.comp || curComp(hoje);
  const novos = {
    hoje: { de: hoje, ate: hoje, comp: '' },
    '3d': { de: hoje, ate: addDays(hoje, 3), comp: '' },
    '7d': { de: hoje, ate: addDays(hoje, 7), comp: '' },
    mes: { de: `${m}-01`, ate: lastDay(m), comp: '' },
    vencidas: {
      sit: 'vencidas', de: '', ate: '', comp: '',
    },
    conferir: { conf: 'pendente', anexo: 'com' },
  }[k];
  return novos ? { ...f, ...novos } : f;
}

export function resumoFaturas(lista, hoje = todayISO()) {
  const venc = lista.filter((p) => vencida(p, hoje));
  return {
    total: somaV(lista),
    semValor: lista.filter((p) => num(p.valor) === null).length,
    comAnexo: lista.filter((p) => (p.anexos || []).length).length,
    conferidas: lista.filter((p) => confSt(p) === 'conferida').length,
    divergencias: lista.filter((p) => confSt(p) === 'divergencia').length,
    vencidas: venc.length,
    valorVencido: somaV(venc),
  };
}

const caminhos = (l) => (l || []).map((x) => x.path).join(',');
/**
 * Mesma regra do gatilho app_private.aloj_conferencia: mexer no valor, no
 * vencimento ou nos anexos de um lançamento já conferido o devolve para "A
 * conferir". O banco é quem aplica; o front usa só para avisar.
 */
export const voltaParaConferir = (antes, depois) => confSt(antes) !== 'pendente' && (
  num(antes.valor) !== num(depois.valor)
  || (antes.vencimento || '') !== (depois.vencimento || '')
  || caminhos(antes.anexos) !== caminhos(depois.anexos));

/** Validação do formulário de conferência; devolve a mensagem de erro ou ''. */
export function erroConferencia(p, v) {
  if (v.conferencia_status === 'divergencia' && !String(v.conferencia_obs || '').trim()) return 'Descreva a divergência encontrada.';
  if (v.status === 'pago' && !v.data_pagamento && num(p.valor) === null) return 'Informe a data do pagamento.';
  return '';
}

/* ===================== anexos ===================== */
const TIPOS_ARQ = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
};
export const LIMITE_ANEXO = 20 * 1024 * 1024;
export function tipoDoArquivo(file) {
  if (Object.values(TIPOS_ARQ).includes(file.type)) return file.type;
  return TIPOS_ARQ[String(file.name).split('.').pop().toLowerCase()] || '';
}
/**
 * Arquivos que o formulário subiu e que já não servem: ao cancelar, os novos;
 * ao salvar, os (originais + novos) que saíram da lista final.
 */
export function anexosOrfaos(originais, novos, finais, salvou) {
  const ficam = new Set((finais || []).map((x) => x.path));
  const candidatos = salvou ? [...(originais || []).map((x) => x.path), ...novos] : novos;
  return [...new Set(candidatos)].filter((p) => !ficam.has(p));
}
