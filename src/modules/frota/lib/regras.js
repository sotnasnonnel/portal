// Regras de negócio da Frota, portadas do protótipo docs/ref/"Gestão de Frota PHD
// - HTML.html" sem mudar o comportamento. Sem React e sem Supabase (roda sob
// `node --test`). As funções recebem as listas por parâmetro em vez de ler um
// estado global; os nomes de campo são os das colunas (frota_*).

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MES3 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const DEFAULT_CFG = {
  intervalo_revisao_km: 10000,
  margem_revisao_km: 1500,
  validade_termo_meses: 12,
  alerta_dias: 30,
  margem_revisao_dias: 15,
};

export const OC_STATUS = ['Aberta', 'Em tratativa', 'Paga', 'Descontada do condutor', 'Encerrada', 'Cancelada'];
export const CAT_MULTA = ['Excesso de velocidade (até 20%)', 'Excesso de velocidade (20% a 50%)', 'Excesso de velocidade (acima de 50%)', 'Avanço de sinal vermelho', 'Estacionamento irregular', 'Dirigir manuseando celular', 'Trânsito em faixa exclusiva', 'Sem cinto de segurança', 'Outra infração'];
export const CAT_AVARIA = ['Colisão', 'Lataria / para-choque', 'Para-brisa', 'Pneu / roda', 'Placa', 'Chave', 'Mecânica', 'Km excedente', 'Revisão fora do prazo', 'Outros danos'];
export const GRAV_MULTA = ['Leve', 'Média', 'Grave', 'Gravíssima'];
export const GRAV_AVARIA = ['Leve', 'Média', 'Alta'];
export const TIPOS_MAN = ['Revisão preventiva', 'Manutenção corretiva', 'Troca de pneus', 'Troca de óleo', 'Funilaria / pintura', 'Vidros', 'Elétrica', 'Outros'];

export const ocAberta = (o) => ['Aberta', 'Em tratativa'].includes(o.status || 'Aberta');
export const ocTone = (s) => ({ Aberta: 'crit', 'Em tratativa': 'warn', Paga: 'ok', 'Descontada do condutor': 'ok', Encerrada: 'neutral', Cancelada: 'neutral' }[s] || 'neutral');
export const gravTone = (g) => ({ Leve: 'info', Média: 'warn', Grave: 'crit', Gravíssima: 'crit', Alta: 'crit' }[g] || 'neutral');
export const stTone = (s) => ({ Ativo: 'ok', Reservado: 'info', Inativo: 'neutral' }[s] || 'neutral');
export const respTone = (s) => (s === 'Cliente' ? 'brand' : (s === 'PHD' ? 'info' : 'neutral'));

// ---------------------------------------------------------------- utilitários
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const n0 = (v) => (isNum(v) ? v : 0);
export const uniq = (arr) => [...new Set(arr.filter((v) => v != null && v !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
export const sum = (rows, k) => rows.reduce((a, r) => a + n0(typeof k === 'function' ? k(r) : r[k]), 0);

const pad2 = (n) => String(n).padStart(2, '0');

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function parseISO(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function daysUntil(s) {
  const d = parseISO(s);
  if (!d) return null;
  return Math.round((d - parseISO(todayISO())) / 86400000);
}
export function addMonths(s, m) {
  const d = parseISO(s);
  if (!d) return '';
  const r = new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
  return `${r.getFullYear()}-${pad2(r.getMonth() + 1)}-${pad2(r.getDate())}`;
}
export const compLabel = (c) => {
  if (!c) return '—';
  const [y, m] = c.split('-').map(Number);
  return `${MES3[m - 1]}/${y}`;
};
export const compLong = (c) => {
  if (!c) return '—';
  const [y, m] = c.split('-').map(Number);
  return `${MESES[m - 1]} de ${y}`;
};
export const compNext = (c) => {
  const [y, m] = c.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
export const compPrev = (c) => {
  const [y, m] = c.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
export function parseBR(v) {
  if (v == null) return null;
  let s = String(v).trim().replace(/R\$\s?/, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  // "21.000" é vinte e um mil. O protótipo lia como 21 e gravava km errado sem avisar.
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// ---------------------------------------------------------------- competências
export const comps = (mensal) => uniq(mensal.map((m) => m.competencia)).sort();
export const lastComp = (mensal) => {
  const c = comps(mensal);
  return c[c.length - 1] || '';
};
export const mensalOf = (mensal, comp) => mensal.filter((m) => m.competencia === comp);

// ---------------------------------------------------------------- custos do mês
export const extrasOf = (m) => n0(m.multas) + n0(m.avarias) + n0(m.laudos) + n0(m.adesivo) + n0(m.frete);

/** Combustível consumido: o valor informado ou, em branco, limite menos saldo. */
export function combOf(m) {
  if (isNum(m.recarga_mes)) return m.recarga_mes;
  if (isNum(m.recarga_mensal) && isNum(m.saldo_remanescente)) return Math.max(0, m.recarga_mensal - m.saldo_remanescente);
  return null;
}

/** Total do mês. Combustível fica de fora, como na planilha. */
export const totalOf = (m) => n0(m.custo_locacao) + n0(m.gps_valor) + extrasOf(m);

/**
 * Km rodado no mês, pela diferença do hodômetro para a competência anterior.
 * Diferença negativa, zerada ou acima de 15 mil km é erro de leitura ou troca de
 * veículo com a mesma placa: não vira número.
 */
export function kmRodado(m, mensal) {
  if (!m.placa || !isNum(m.km_atual)) return null;
  const anterior = compPrev(m.competencia);
  const prev = mensal.find((x) => x.competencia === anterior && x.placa === m.placa);
  if (!prev || !isNum(prev.km_atual)) return null;
  const d = m.km_atual - prev.km_atual;
  return (d > 0 && d < 15000) ? d : null;
}

// ---------------------------------------------------------------- revisão
export function revisao(v, cfg = DEFAULT_CFG) {
  const out = { tone: 'neutral', label: 'Sem registro', lvl: 0, desde: null, prox: null };
  if (isNum(v.km_atual) && isNum(v.km_ultima_manutencao)) {
    out.desde = Math.max(0, v.km_atual - v.km_ultima_manutencao);
    out.prox = v.km_ultima_manutencao + cfg.intervalo_revisao_km;
  } else if (isNum(v.km_atual) && !isNum(v.km_ultima_manutencao)) {
    out.prox = Math.ceil((v.km_atual + 1) / cfg.intervalo_revisao_km) * cfg.intervalo_revisao_km;
  }
  const dd = daysUntil(v.data_proxima_revisao);
  let lvl = 0;
  let label = 'Em dia';
  let tone = 'ok';
  if (out.desde == null && dd == null) return out;
  if (out.desde != null && out.desde >= cfg.intervalo_revisao_km) {
    lvl = 2; label = 'Revisão vencida'; tone = 'crit';
  } else if (out.desde != null && out.desde >= cfg.intervalo_revisao_km - cfg.margem_revisao_km) {
    lvl = 1; label = 'Programar revisão'; tone = 'warn';
  }
  if (dd != null) {
    if (dd < 0 && lvl < 2) {
      lvl = 2; label = 'Data de revisão vencida'; tone = 'crit';
    } else if (dd <= cfg.margem_revisao_dias && lvl < 1) {
      lvl = 1; label = 'Revisão próxima'; tone = 'warn';
    }
  }
  return { ...out, lvl, label, tone };
}

// ---------------------------------------------------------------- condutores
/** O campo condutor pode trazer dois nomes: "A / B". */
const nomesDe = (condutor) => norm(condutor).split(' / ');

export function placaAtualDe(nome, veiculos) {
  const k = norm(nome);
  const v = veiculos.find((x) => (x.status === 'Ativo' || x.status === 'Reservado') && x.placa && nomesDe(x.condutor).includes(k));
  return v ? v.placa : '';
}
export const ocsDe = (nome, ocorrencias) => {
  const k = norm(nome);
  return ocorrencias.filter((o) => nomesDe(o.condutor).includes(k));
};
export const termoValidade = (c, cfg = DEFAULT_CFG) => (
  c.termo_validade || (c.termo_assinatura ? addMonths(c.termo_assinatura, cfg.validade_termo_meses) : '')
);

export function conformidade(c, veiculos = [], cfg = DEFAULT_CFG) {
  const A = cfg.alerta_dias;
  let cnh;
  let termo;
  const dc = daysUntil(c.cnh_validade);
  if (dc == null) cnh = { tone: 'crit', label: 'CNH não registrada', lvl: 2 };
  else if (dc < 0) cnh = { tone: 'crit', label: 'CNH vencida', lvl: 2 };
  else if (dc <= A) cnh = { tone: 'warn', label: `CNH vence em ${dc} d`, lvl: 1 };
  else cnh = { tone: 'ok', label: 'CNH válida', lvl: 0 };

  const tv = termoValidade(c, cfg);
  const dt = daysUntil(tv);
  const pa = placaAtualDe(c.nome, veiculos);
  if (!c.termo_assinatura && !c.termo_arquivo) termo = { tone: 'crit', label: 'Termo pendente', lvl: 2 };
  else if (dt != null && dt < 0) termo = { tone: 'crit', label: 'Termo vencido', lvl: 2 };
  else if (!c.termo_arquivo) termo = { tone: 'warn', label: 'Termo sem anexo', lvl: 1 };
  else if (dt != null && dt <= A) termo = { tone: 'warn', label: `Termo vence em ${dt} d`, lvl: 1 };
  else if (c.termo_placa && pa && c.termo_placa !== pa) termo = { tone: 'warn', label: 'Termo de outro veículo', lvl: 1 };
  else termo = { tone: 'ok', label: 'Termo em dia', lvl: 0 };

  const lvl = Math.max(cnh.lvl, termo.lvl);
  const geral = lvl === 2
    ? { tone: 'crit', label: 'Irregular', lvl }
    : lvl === 1 ? { tone: 'warn', label: 'Atenção', lvl } : { tone: 'ok', label: 'Regular', lvl };
  return { cnh, termo, geral, termoVal: tv, placaAtual: pa };
}

// ---------------------------------------------------------------- efeitos da gravação
/**
 * O que um lançamento ou uma manutenção muda no cadastro do veículo: km só sobe,
 * última revisão só avança, próxima revisão sobrescreve. Devolve só os campos
 * alterados, ou null se nada mudou.
 */
export function patchVeiculo(v, patch) {
  const next = {};
  if (isNum(patch.km_atual) && (!isNum(v.km_atual) || patch.km_atual > v.km_atual)) next.km_atual = patch.km_atual;
  if (isNum(patch.km_ultima_manutencao) && (!isNum(v.km_ultima_manutencao) || patch.km_ultima_manutencao >= v.km_ultima_manutencao)) next.km_ultima_manutencao = patch.km_ultima_manutencao;
  if (patch.data_ultima_revisao && (!v.data_ultima_revisao || patch.data_ultima_revisao >= v.data_ultima_revisao)) next.data_ultima_revisao = patch.data_ultima_revisao;
  if (patch.data_proxima_revisao) next.data_proxima_revisao = patch.data_proxima_revisao;
  return Object.keys(next).length ? next : null;
}

/** Chave de um lançamento: a placa ou, na retirada pendente, o condutor. */
const chaveMensal = (comp, placa, condutor) => `${comp}|${placa || `RES-${slug(condutor)}`}`;

/**
 * "Gerar" o próximo mês: um lançamento por veículo ativo ou reservado, copiando
 * o que se repete. Multas, avarias, laudos, adesivo, frete, km do mês e saldo de
 * combustível começam em branco.
 */
export function gerarCompetencia(veiculos, mensal) {
  const L = lastComp(mensal);
  const N = compNext(L);
  const doMes = mensalOf(mensal, L);
  const exist = new Set(mensalOf(mensal, N).map((x) => chaveMensal(N, x.placa, x.condutor)));
  const todo = veiculos
    .filter((v) => v.status === 'Ativo' || v.status === 'Reservado')
    .map((v) => {
      const prev = doMes.find((x) => (v.placa && x.placa === v.placa) || (!v.placa && !x.placa && norm(x.condutor) === norm(v.condutor)));
      return {
        competencia: N, status: 'Ativo', condutor: v.condutor, placa: v.placa, modelo: v.modelo, locadora: v.locadora,
        grupo: v.grupo, codigo_reserva: v.codigo_reserva, contrato: v.contrato, retirada: v.retirada, devolucao: v.devolucao,
        ct: v.ct, custo_resp: v.custo_resp,
        gps_valor: prev && isNum(prev.gps_valor) ? prev.gps_valor : v.gps_valor,
        gps_numero: v.gps_numero,
        km_contratado: v.km_contratado ?? prev?.km_contratado ?? null,
        custo_locacao: prev && isNum(prev.custo_locacao) ? prev.custo_locacao : v.custo_mensal,
        recarga_mensal: v.recarga_mensal ?? prev?.recarga_mensal ?? null,
        km_ultima_manutencao: v.km_ultima_manutencao,
        data_ultima_revisao: v.data_ultima_revisao,
        data_proxima_revisao: v.data_proxima_revisao,
      };
    })
    .filter((b) => !exist.has(chaveMensal(N, b.placa, b.condutor)));
  return { de: L, para: N, todo };
}

/** Já existe outro registro com a mesma chave natural? Devolve o rótulo dela. */
export function duplicado(col, vals, id, dados) {
  const outros = (lista) => lista.filter((x) => x.id !== id);
  if (col === 'veiculos' && vals.placa && outros(dados.veiculos).some((v) => v.placa === vals.placa)) return vals.placa;
  if (col === 'mensal') {
    const k = chaveMensal(vals.competencia, vals.placa, vals.condutor);
    if (outros(dados.mensal).some((m) => chaveMensal(m.competencia, m.placa, m.condutor) === k)) {
      return `${compLabel(vals.competencia)} · ${vals.placa || vals.condutor}`;
    }
  }
  if (col === 'condutores' && outros(dados.condutores).some((c) => slug(c.nome) === slug(vals.nome))) return vals.nome;
  return null;
}

export const PLACA_RE = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

// ---------------------------------------------------------------- agregações
export function groupSum(rows, keyFn, valFn, top = 8) {
  const m = new Map();
  rows.forEach((r) => {
    const k = keyFn(r) || 'Não informado';
    m.set(k, (m.get(k) || 0) + n0(valFn(r)));
  });
  let arr = [...m.entries()].map(([l, v]) => ({ l, v })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  if (arr.length > top) {
    const rest = arr.slice(top - 1);
    arr = arr.slice(0, top - 1);
    arr.push({ l: `Outros (${rest.length})`, v: rest.reduce((a, b) => a + b.v, 0) });
  }
  return arr;
}

/** Contadores da sidebar: itens críticos. */
export function contagensNav(dados, cfg) {
  return {
    condutores: dados.condutores.filter((c) => c.situacao === 'Ativo' && conformidade(c, dados.veiculos, cfg).geral.lvl === 2).length,
    manutencao: dados.veiculos.filter((v) => v.status === 'Ativo' && revisao(v, cfg).lvl === 2).length,
  };
}
