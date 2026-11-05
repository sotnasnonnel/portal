// Colunas de exportação e os seis relatórios da Frota. Sem React, sem Supabase.
// Coluna: { k, l, t?, v? }. `v(r, ctx)` calcula quando o valor não é um campo;
// ctx = { dados, cfg }.
import {
  compLabel, extrasOf, totalOf, combOf, kmRodado, revisao, conformidade, termoValidade, placaAtualDe, ocsDe,
  norm, sum,
} from './regras.js';

export const COLS_VEIC = [
  { k: 'placa', l: 'Placa' }, { k: 'modelo', l: 'Modelo' }, { k: 'cor', l: 'Cor' }, { k: 'status', l: 'Status' },
  { k: 'condutor', l: 'Condutor' }, { k: 'ct', l: 'CT / Centro de custo' }, { k: 'custo_resp', l: 'Custo por conta de' },
  { k: 'locadora', l: 'Locadora' }, { k: 'grupo', l: 'Grupo' }, { k: 'contrato', l: 'Nº contrato' }, { k: 'codigo_reserva', l: 'Código de reserva' },
  { k: 'retirada', l: 'Retirada', t: 'date' }, { k: 'devolucao', l: 'Devolução', t: 'date' }, { k: 'km_contratado', l: 'Km contratado/mês', t: 'int' },
  { k: 'custo_mensal', l: 'Locação (R$/mês)', t: 'money' }, { k: 'recarga_mensal', l: 'Recarga mensal', t: 'money' }, { k: 'gps', l: 'GPS' },
  { k: 'gps_numero', l: 'Nº GPS' }, { k: 'adesivo', l: 'Adesivo' }, { k: 'km_atual', l: 'Km atual', t: 'int' },
  { k: 'km_ultima_manutencao', l: 'Km última manutenção', t: 'int' }, { k: 'data_ultima_revisao', l: 'Data última revisão', t: 'date' },
  { k: 'data_proxima_revisao', l: 'Data próxima revisão', t: 'date' },
  { k: '_rev', l: 'Situação da revisão', v: (v, ctx) => revisao(v, ctx.cfg).label },
  { k: 'cidade', l: 'Cidade' }, { k: 'proxima_fatura', l: 'Próxima fatura', t: 'date' }, { k: 'obs', l: 'Pontos de atenção' },
];

export const COLS_MENSAL = [
  { k: 'competencia', l: 'Competência', v: (m) => compLabel(m.competencia) }, { k: 'status', l: 'Status' }, { k: 'condutor', l: 'Condutor' },
  { k: 'placa', l: 'Placa' }, { k: 'modelo', l: 'Modelo' }, { k: 'locadora', l: 'Locadora' }, { k: 'grupo', l: 'Grupo' },
  { k: 'codigo_reserva', l: 'Código de reserva' }, { k: 'contrato', l: 'Nº contrato' }, { k: 'retirada', l: 'Retirada', t: 'date' },
  { k: 'devolucao', l: 'Devolução', t: 'date' }, { k: 'ct', l: 'CT' }, { k: 'custo_resp', l: 'Custo por conta de' },
  { k: 'custo_locacao', l: 'Locação', t: 'money' }, { k: 'gps_valor', l: 'GPS / telemetria', t: 'money' }, { k: 'gps_numero', l: 'Nº GPS' },
  { k: 'multas', l: 'Multas', t: 'money' }, { k: 'avarias', l: 'Avarias', t: 'money' }, { k: 'laudos', l: 'Laudos', t: 'money' },
  { k: 'adesivo', l: 'Adesivo', t: 'money' }, { k: 'frete', l: 'Frete', t: 'money' },
  { k: '_ext', l: 'Extras', t: 'money', v: (m) => extrasOf(m) }, { k: '_tot', l: 'Total (sem combustível)', t: 'money', v: (m) => totalOf(m) },
  { k: 'km_contratado', l: 'Km contratado', t: 'int' }, { k: 'km_atual', l: 'Km atual', t: 'int' },
  { k: '_kr', l: 'Km rodado no mês', t: 'int', v: (m, ctx) => kmRodado(m, ctx.dados.mensal) },
  { k: 'recarga_mensal', l: 'Recarga mensal (limite)', t: 'money' }, { k: 'saldo_remanescente', l: 'Saldo remanescente', t: 'money' },
  { k: '_comb', l: 'Combustível consumido', t: 'money', v: (m) => combOf(m) }, { k: 'obs', l: 'Pontos de atenção' },
];

export const COLS_OC = [
  { k: 'data', l: 'Data da ocorrência', t: 'date' }, { k: 'tipo', l: 'Tipo' }, { k: 'categoria', l: 'Tipo de infração / dano' }, { k: 'gravidade', l: 'Gravidade' },
  { k: 'placa', l: 'Placa' }, { k: 'modelo', l: 'Veículo' }, { k: 'condutor', l: 'Condutor' }, { k: 'gestor', l: 'Gestor PHD' }, { k: 'locadora', l: 'Locadora' },
  { k: 'cidade', l: 'Cidade / local' }, { k: 'valor', l: 'Valor', t: 'money' }, { k: 'status', l: 'Status' }, { k: 'data_phd_informada', l: 'PHD informada em', t: 'date' },
  { k: 'data_condutor_informado', l: 'Condutor informado em', t: 'date' }, { k: 'numero_bo', l: 'Nº BO' }, { k: 'bo_registrado', l: 'BO registrado' },
  { k: 'numero_fatura', l: 'Nº fatura' }, { k: 'contrato', l: 'Nº contrato' }, { k: 'vencimento', l: 'Vencimento', t: 'date' }, { k: 'data_pagamento', l: 'Pagamento', t: 'date' },
  { k: 'forma_pagamento', l: 'Forma de pagamento' }, { k: 'responsavel_pagamento', l: 'Responsável pelo pagamento' }, { k: 'desconto_condutor', l: 'Desconto do condutor' },
  { k: 'forma_desconto', l: 'Forma de desconto' }, { k: 'financeiro_informado', l: 'Financeiro informado' }, { k: 'laudo_recebido', l: 'Laudo recebido' },
  { k: 'descricao', l: 'Descrição' }, { k: 'obs', l: 'Observações' }, { k: '_anx', l: 'Anexos', v: (o) => (o.anexos || []).length || '' },
];

export const COLS_COND = [
  { k: 'nome', l: 'Condutor' }, { k: 'situacao', l: 'Situação' }, { k: 'email', l: 'E-mail' },
  { k: '_placa', l: 'Veículo atual', v: (c, ctx) => placaAtualDe(c.nome, ctx.dados.veiculos) }, { k: 'ct', l: 'CT' },
  { k: 'cnh_categoria', l: 'Categoria CNH' }, { k: 'cnh_validade', l: 'Validade CNH', t: 'date' },
  { k: '_cnh', l: 'Status CNH', v: (c, ctx) => conformidade(c, ctx.dados.veiculos, ctx.cfg).cnh.label },
  { k: 'termo_assinatura', l: 'Termo assinado em', t: 'date' }, { k: '_tv', l: 'Termo válido até', t: 'date', v: (c, ctx) => termoValidade(c, ctx.cfg) },
  { k: 'termo_placa', l: 'Termo vinculado à placa' }, { k: '_termo', l: 'Status termo', v: (c, ctx) => conformidade(c, ctx.dados.veiculos, ctx.cfg).termo.label },
  { k: '_geral', l: 'Conformidade', v: (c, ctx) => conformidade(c, ctx.dados.veiculos, ctx.cfg).geral.label },
  { k: '_oc', l: 'Ocorrências', t: 'int', v: (c, ctx) => ocsDe(c.nome, ctx.dados.ocorrencias).length },
  { k: '_ocv', l: 'Valor ocorrências', t: 'money', v: (c, ctx) => sum(ocsDe(c.nome, ctx.dados.ocorrencias), 'valor') },
  { k: 'obs', l: 'Observações' },
];

export const REPORTS = {
  custos: {
    l: 'Custos mensais', d: 'Locação, GPS e extras por competência', fonte: 'mensal', date: 'competencia', dateType: 'month', cols: COLS_MENSAL,
    filters: ['locadora', 'ct', 'custo_resp', 'condutor', 'placa', 'status'],
    groups: { competencia: 'Competência', locadora: 'Locadora', ct: 'CT', custo_resp: 'Custo por conta de', condutor: 'Condutor', placa: 'Placa' },
    sums: ['custo_locacao', 'gps_valor', '_ext', '_tot', '_comb'],
  },
  combustivel: {
    l: 'Combustível', d: 'Limite, saldo e consumo por veículo', fonte: 'mensal', date: 'competencia', dateType: 'month',
    cols: [
      COLS_MENSAL[0], COLS_MENSAL[2], COLS_MENSAL[3], COLS_MENSAL[5], COLS_MENSAL[11],
      { k: 'recarga_mensal', l: 'Limite', t: 'money' }, { k: 'saldo_remanescente', l: 'Saldo', t: 'money' },
      { k: '_comb', l: 'Consumido', t: 'money', v: (m) => combOf(m) },
      { k: '_kr', l: 'Km no mês', t: 'int', v: (m, ctx) => kmRodado(m, ctx.dados.mensal) },
      {
        k: '_rpk', l: 'R$/km', t: 'money',
        v: (m, ctx) => {
          const c = combOf(m);
          const k = kmRodado(m, ctx.dados.mensal);
          return c && k ? Math.round((c / k) * 100) / 100 : null;
        },
      },
    ],
    filters: ['locadora', 'ct', 'condutor', 'placa'],
    groups: { competencia: 'Competência', locadora: 'Locadora', ct: 'CT', condutor: 'Condutor', placa: 'Placa' },
    sums: ['recarga_mensal', 'saldo_remanescente', '_comb'],
  },
  ocorrencias: {
    l: 'Multas e avarias', d: 'Por condutor, veículo, tipo e período', fonte: 'ocorrencias', date: 'data', dateType: 'date', cols: COLS_OC,
    filters: ['tipo', 'categoria', 'gravidade', 'status', 'condutor', 'placa', 'locadora'],
    groups: { tipo: 'Tipo', categoria: 'Tipo de infração / dano', condutor: 'Condutor', placa: 'Placa', status: 'Status', _ano: 'Ano', _mes: 'Mês' },
    sums: ['valor'],
  },
  frota: {
    l: 'Cadastro da frota', d: 'Veículos, contratos e alocação', fonte: 'veiculos', date: 'retirada', dateType: 'date', cols: COLS_VEIC,
    filters: ['status', 'locadora', 'ct', 'custo_resp', 'modelo'],
    groups: { status: 'Status', locadora: 'Locadora', ct: 'CT', custo_resp: 'Custo por conta de', modelo: 'Modelo' },
    sums: ['custo_mensal', 'recarga_mensal'],
  },
  condutores: {
    l: 'Condutores e documentos', d: 'CNH, termos e conformidade', fonte: 'condutores', date: null, cols: COLS_COND,
    filters: ['situacao', 'cnh_categoria'],
    groups: { situacao: 'Situação', _geral: 'Conformidade', cnh_categoria: 'Categoria CNH' },
    sums: ['_ocv'],
  },
  manutencao: {
    l: 'Manutenções', d: 'Serviços realizados por veículo', fonte: 'manutencoes', date: 'data', dateType: 'date',
    cols: [
      { k: 'data', l: 'Data', t: 'date' }, { k: 'placa', l: 'Placa' }, { k: 'condutor', l: 'Condutor' }, { k: 'tipo', l: 'Serviço' }, { k: 'km', l: 'Km', t: 'int' },
      { k: 'local', l: 'Local / oficina' }, { k: 'protocolo', l: 'Protocolo' }, { k: 'valor', l: 'Valor', t: 'money' }, { k: 'descricao', l: 'Descrição' },
    ],
    filters: ['tipo', 'placa'],
    groups: { tipo: 'Serviço', placa: 'Placa', _mes: 'Mês' },
    sums: ['valor'],
  },
};

export const LBL = {
  locadora: 'Locadora', ct: 'CT / Centro de custo', custo_resp: 'Custo por conta de', condutor: 'Condutor', placa: 'Placa', status: 'Status', tipo: 'Tipo',
  categoria: 'Tipo de infração / dano', gravidade: 'Gravidade', modelo: 'Modelo', situacao: 'Situação', cnh_categoria: 'Categoria CNH',
};

export const colVal = (r, c, ctx) => (c.v ? c.v(r, ctx) : r[c.k]);

function repKey(r, k, rep, ctx) {
  if (k === '_ano') return String(r[rep.date] || '').slice(0, 4) || 'Sem data';
  if (k === '_mes') {
    const d = String(r[rep.date] || '');
    return d ? compLabel(d.slice(0, 7)) : 'Sem data';
  }
  if (k === 'competencia') return r.competencia;
  if (k === '_geral') return conformidade(r, ctx.dados.veiculos, ctx.cfg).geral.label;
  return r[k] || 'Não informado';
}

/** Linhas filtradas, ordenadas e, se pedido, agrupadas. `f` é o filtro da tela. */
export function repData(f, ctx) {
  const rep = REPORTS[f.tipo];
  const q = norm(f.q);
  const fonte = ctx.dados[rep.fonte];
  const rows = fonte.filter((r) => {
    if (rep.date && (f.de || f.ate)) {
      const d = String(r[rep.date] || '');
      const dv = rep.dateType === 'month' ? d.slice(0, 7) : d;
      if (!dv) return false;
      if (f.de && dv < f.de) return false;
      if (f.ate && dv > f.ate) return false;
    }
    for (const k of rep.filters) {
      const v = f.sel[k];
      if (v && !(k === 'condutor' ? norm(r[k]).split(' / ').includes(norm(v)) : String(r[k] || '') === v)) return false;
    }
    if (q && !norm(rep.cols.map((c) => colVal(r, c, ctx)).join(' ')).includes(q)) return false;
    return true;
  });
  if (rep.date) rows.sort((a, b) => String(b[rep.date] || '').localeCompare(String(a[rep.date] || '')));

  let groups = null;
  if (f.grp) {
    const m = new Map();
    rows.forEach((r) => {
      const k = repKey(r, f.grp, rep, ctx);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    const sc = rep.sums.map((k) => rep.cols.find((c) => c.k === k)).filter(Boolean);
    const porData = f.grp === 'competencia' || f.grp === '_mes' || f.grp === '_ano';
    groups = {
      cols: sc,
      itens: [...m.entries()]
        .map(([k, rs]) => ({
          k: f.grp === 'competencia' ? compLabel(k) : k,
          raw: k,
          n: rs.length,
          s: sc.map((c) => sum(rs, (r) => colVal(r, c, ctx))),
        }))
        .sort((a, b) => (porData
          ? String(b.raw).localeCompare(String(a.raw))
          : (b.s[0] || 0) - (a.s[0] || 0) || b.n - a.n)),
    };
  }
  return { rep, rows, groups, fonte };
}
