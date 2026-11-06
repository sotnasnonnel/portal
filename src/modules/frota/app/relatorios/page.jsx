import { useMemo } from 'react';
import {
  AlertTriangle, BarChart3, Car, Download, FileText, Fuel, Receipt, ShieldCheck, Wrench, X,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import {
  Busca, Chip, Estado, Hbars, LinhaVazia, PageHead, Pill, Secao, Selecao,
} from '../components/Pecas';
import { sum, uniq } from '../../lib/regras';
import {
  fmtDate, int, money,
} from '../../lib/formato';
import {
  LBL, REPORTS, colVal, repData,
} from '../../lib/relatorios';
import { exportarLinhas } from '../../lib/exportar';

const ICONES = {
  custos: Receipt, combustivel: Fuel, ocorrencias: AlertTriangle, frota: Car, condutores: ShieldCheck, manutencao: Wrench, faturas: FileText,
};
const PREVIA_COLUNAS = 9;
const PREVIA_LINHAS = 300;

const fmtCell = (v, c) => {
  if (c.t === 'money') return money(v);
  if (c.t === 'int') return int(v);
  if (c.t === 'date') return fmtDate(v);
  return v == null || v === '' ? '—' : v;
};
const ehNumero = (c) => c.t === 'money' || c.t === 'int';

export default function RelatoriosFrota() {
  const {
    ctx, filtros, setFiltro, limparFiltros, toast,
  } = useFrota();
  const f = filtros.relatorios;
  const set = (patch) => setFiltro('relatorios', patch);
  const {
    rep, rows, groups, fonte,
  } = useMemo(() => repData(f, ctx), [f, ctx]);

  const colunas = rep.cols.slice(0, PREVIA_COLUNAS);
  const somas = rep.sums.map((k) => rep.cols.find((c) => c.k === k)).filter(Boolean);
  const ehMes = rep.dateType === 'month';

  const exportar = (fmt) => {
    const resumo = groups && {
      cols: [{ k: 'k', l: rep.groups[f.grp] }, { k: 'n', l: 'Registros', t: 'int' }, ...groups.cols.map((c, i) => ({ k: `s${i}`, l: c.l, t: c.t }))],
      rows: groups.itens.map((g) => {
        const o = { k: g.k, n: g.n };
        g.s.forEach((v, i) => { o[`s${i}`] = v; });
        return o;
      }),
    };
    exportarLinhas({
      base: `relatorio-${f.tipo}`, cols: rep.cols, rows, aba: rep.l, ctx, fmt, resumo,
    }).catch((e) => toast(e.message, 'err'));
  };

  return (
    <div className="frota-page frota-stack">
      <PageHead Icon={BarChart3} titulo="Relatórios" sub="Escolha o relatório, filtre e agrupe. A exportação leva exatamente o que está filtrado: Excel com abas de resumo e dados, ou CSV.">
        <button type="button" className="frota-btn" onClick={() => exportar('csv')}><Download size={15} /> CSV</button>
        <button type="button" className="frota-btn primary" onClick={() => exportar('xlsx')}><Download size={15} /> Exportar Excel</button>
      </PageHead>
      <Estado />
      <div className="frota-rep-types">
        {Object.entries(REPORTS).map(([k, r]) => {
          const Icon = ICONES[k];
          return (
            <button
              key={k}
              type="button"
              className={`frota-rtype ${f.tipo === k ? 'on' : ''}`}
              onClick={() => set({ tipo: k, grp: '', sel: {}, de: '', ate: '' })}
            >
              <span className="ic"><Icon size={16} aria-hidden="true" /></span>
              <span><b>{r.l}</b><span>{r.d}</span></span>
            </button>
          );
        })}
      </div>
      <div className="frota-card frota-stack">
        <div className="frota-filters">
          <Busca id="rf-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Texto livre em qualquer coluna" />
          {rep.date && (
            <>
              <div className="frota-fld">
                <label htmlFor="rf-de">{ehMes ? 'Competência de' : 'Data de'}</label>
                <input id="rf-de" className="frota-inp" type={rep.dateType} value={f.de} onChange={(e) => set({ de: e.target.value })} />
              </div>
              <div className="frota-fld">
                <label htmlFor="rf-ate">até</label>
                <input id="rf-ate" className="frota-inp" type={rep.dateType} value={f.ate} onChange={(e) => set({ ate: e.target.value })} />
              </div>
            </>
          )}
          {rep.filters.map((k) => (
            <Selecao
              key={k}
              id={`rs-${k}`}
              label={LBL[k] || k}
              opcoes={k === 'condutor' ? uniq(fonte.flatMap((r) => String(r[k] || '').split(' / '))) : uniq(fonte.map((r) => r[k]))}
              valor={f.sel[k] || ''}
              onChange={(v) => set({ sel: { ...f.sel, [k]: v } })}
            />
          ))}
          <div className="frota-fld">
            <label htmlFor="rf-grp">Agrupar por</label>
            <select id="rf-grp" className="frota-inp" value={f.grp} onChange={(e) => set({ grp: e.target.value })}>
              <option value="">Sem agrupamento</option>
              {Object.entries(rep.groups).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="frota-chips">
          <span className="frota-muted">{rows.length} registro(s) de {fonte.length}</span>
          {somas.map((c) => <Pill key={c.k} tone="info">{c.l}: {fmtCell(sum(rows, (r) => colVal(r, c, ctx)), c)}</Pill>)}
          <Chip onClick={() => limparFiltros('relatorios')}><X size={13} aria-hidden="true" /> Limpar filtros</Chip>
        </div>
      </div>
      {groups && (
        <Secao titulo={`Resumo por ${rep.groups[f.grp]}`} contagem={groups.itens.length}>
          <TableScroll>
            <table className="frota-mini">
              <thead>
                <tr>
                  <th>{rep.groups[f.grp]}</th>
                  <th className="n">Registros</th>
                  {groups.cols.map((c) => <th key={c.k} className="n">{c.l}</th>)}
                </tr>
              </thead>
              <tbody>
                {groups.itens.map((g) => (
                  <tr key={g.raw}>
                    <td>{g.k}</td>
                    <td className="n">{g.n}</td>
                    {g.s.map((v, i) => <td key={groups.cols[i].k} className="n">{fmtCell(v, groups.cols[i])}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="n">{rows.length}</td>
                  {groups.cols.map((c) => <td key={c.k} className="n">{fmtCell(sum(rows, (r) => colVal(r, c, ctx)), c)}</td>)}
                </tr>
              </tfoot>
            </table>
          </TableScroll>
          {groups.cols[0] && (
            <div className="frota-mt">
              <Hbars
                itens={groups.itens.slice(0, 10).map((g) => ({ l: g.k, v: g.s[0] || 0 })).filter((x) => x.v > 0)}
                fmt={(v) => fmtCell(v, groups.cols[0])}
              />
            </div>
          )}
        </Secao>
      )}
      <TableScroll className="frota-tbl">
        <table className="frota-t">
          <thead>
            <tr>{colunas.map((c) => <th key={c.k} className={ehNumero(c) ? 'n' : ''}>{c.l}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length ? rows.slice(0, PREVIA_LINHAS).map((r) => (
              <tr key={r.id}>
                {colunas.map((c) => <td key={c.k} className={ehNumero(c) ? 'n' : ''}>{fmtCell(colVal(r, c, ctx), c)}</td>)}
              </tr>
            )) : <LinhaVazia colunas={colunas.length} titulo="Nada encontrado com esses filtros" />}
          </tbody>
        </table>
      </TableScroll>
      <p className="frota-hint">
        A prévia mostra as primeiras {colunas.length} colunas{rows.length > PREVIA_LINHAS ? ` e ${PREVIA_LINHAS} linhas` : ''}; a exportação inclui todas as {rep.cols.length} colunas e todas as linhas filtradas.
      </p>
    </div>
  );
}
