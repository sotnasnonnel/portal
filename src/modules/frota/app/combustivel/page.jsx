import { useMemo } from 'react';
import { Download, Fuel } from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import {
  Busca, Esqueleto, Estado, Kpi, LinhaVazia, Medidor, PageHead, Placa, SeletorComp,
} from '../components/Pecas';
import {
  combOf, compLabel, compLong, kmRodado, mensalOf, n0, norm, sum,
} from '../../lib/regras';
import {
  compResolvida, decZ, fmtBRL, fmtInt, linhaClicavel, money, money0,
} from '../../lib/formato';
import { REPORTS } from '../../lib/relatorios';
import { exportarLinhas } from '../../lib/exportar';

export default function CombustivelFrota() {
  const {
    dados, ctx, carregando, filtros, setFiltro, abrirDetalhe, toast,
  } = useFrota();
  const f = filtros.combustivel;
  const set = (patch) => setFiltro('combustivel', patch);
  const comp = compResolvida(f.comp, dados.mensal);

  const rows = useMemo(() => {
    const q = norm(f.q);
    return mensalOf(dados.mensal, comp)
      .filter((m) => !q || norm([m.placa, m.condutor, m.ct].join(' ')).includes(q))
      .sort((a, b) => n0(combOf(b)) - n0(combOf(a)));
  }, [dados.mensal, comp, f.q]);

  const lim = sum(rows, 'recarga_mensal');
  const con = sum(rows, (m) => combOf(m));
  const sal = sum(rows, 'saldo_remanescente');
  const comKm = rows.map((m) => ({ kr: kmRodado(m, dados.mensal), c: combOf(m) })).filter((x) => x.kr && x.c);
  const rpk = comKm.length ? sum(comKm, (x) => x.c) / sum(comKm, (x) => x.kr) : null;
  const semDados = rows.length > 0 && rows.every((m) => combOf(m) == null);

  const exportar = () => exportarLinhas({
    base: `combustivel-${comp}`, cols: REPORTS.combustivel.cols, rows: mensalOf(dados.mensal, comp), aba: compLabel(comp), ctx,
  }).catch((e) => toast(e.message, 'err'));

  return (
    <div className="frota-page frota-stack">
      <PageHead Icon={Fuel} titulo="Combustível" sub={`Recarga do cartão por veículo em ${compLong(comp)}: limite mensal, saldo remanescente e valor consumido (a recarregar).`}>
        <SeletorComp valor={comp} onChange={(v) => set({ comp: v })} />
        <button type="button" className="frota-btn" onClick={exportar}><Download size={15} /> Exportar</button>
      </PageHead>
      <Estado />
      <div className="frota-kpis">
        <Kpi label="Limite de recarga" valor={money0(lim)} sub={`${rows.length} veículo(s)`} />
        <Kpi destaque label="Consumido" valor={money0(con)} sub={lim ? `${Math.round((con / lim) * 100)}% do limite` : ''} />
        <Kpi label="Saldo remanescente" valor={money0(sal)} />
        <Kpi
          label="Custo por km"
          valor={rpk ? `${fmtBRL.format(rpk)}/km` : '—'}
          sub={rpk ? `média de ${comKm.length} veículo(s) com leitura de km` : 'precisa de km em duas competências'}
        />
      </div>
      {semDados && (
        <div className="frota-note warn">
          <span>Saldo e consumo de {compLabel(comp)} ainda não foram lançados. Abra o lançamento do veículo e preencha “Saldo remanescente” no fechamento do cartão.</span>
        </div>
      )}
      <div className="frota-card">
        <div className="frota-filters">
          <Busca id="cf-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Condutor, placa ou CT" />
        </div>
      </div>
      {carregando ? <Esqueleto /> : (
        <TableScroll className="frota-tbl">
          <table className="frota-t">
            <thead>
              <tr>
                <th>Veículo / condutor</th><th>CT</th><th className="n">Limite R$</th><th className="n">Saldo R$</th><th className="n">Consumido R$</th><th>Uso do limite</th><th className="n">Km no mês</th><th className="n">R$/km</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((m) => {
                const c = combOf(m);
                const kr = kmRodado(m, dados.mensal);
                const p = c != null && m.recarga_mensal ? c / m.recarga_mensal : null;
                return (
                  <tr key={m.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('mensal', m.id))}>
                    <td><div className="frota-cellv"><Placa placa={m.placa} /><div><div className="p">{m.condutor || '—'}</div><div className="s">{m.locadora || ''}</div></div></div></td>
                    <td>{m.ct || '—'}</td>
                    <td className="n">{decZ(m.recarga_mensal)}</td>
                    <td className="n">{decZ(m.saldo_remanescente)}</td>
                    <td className="n"><b>{decZ(c)}</b></td>
                    <td>
                      {p != null ? (
                        <span className="frota-km">
                          <Medidor pct={p} tone={p > 0.98 ? 'crit' : (p > 0.85 ? 'warn' : '')} largura={90} />
                          {Math.round(p * 100)}%
                        </span>
                      ) : <span className="frota-muted">—</span>}
                    </td>
                    <td className="n">{kr != null ? fmtInt.format(kr) : '—'}</td>
                    <td className="n">{c && kr ? fmtBRL.format(c / kr) : '—'}</td>
                  </tr>
                );
              }) : <LinhaVazia colunas={8} titulo="Nenhum lançamento nesta competência" />}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="n">{money(lim)}</td>
                  <td className="n">{money(sal)}</td>
                  <td className="n">{money(con)}</td>
                  <td />
                  <td />
                  <td className="n">{rpk ? fmtBRL.format(rpk) : '—'}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </TableScroll>
      )}
    </div>
  );
}
