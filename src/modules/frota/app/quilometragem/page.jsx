import { useMemo } from 'react';
import { Download, Gauge } from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import {
  Busca, Esqueleto, Estado, Kpi, LinhaVazia, Medidor, PageHead, Placa, SeletorComp,
} from '../components/Pecas';
import ImportarCobli from '../components/ImportarCobli';
import RelatoriosPlataformas from '../components/RelatoriosPlataformas';
import {
  compLabel, compLong, isNum, kmAnterior, kmRodado, mensalOf, norm, origemDoKm, sum,
} from '../../lib/regras';
import {
  compResolvida, fmtInt, linhaClicavel, money,
} from '../../lib/formato';
import { COLS_KM } from '../../lib/relatorios';
import { exportarLinhas } from '../../lib/exportar';

const km = (v) => (isNum(v) ? fmtInt.format(v) : '—');

/**
 * Quilometragem (v3): km por veículo no mês, de onde ele veio (Cobli, informado
 * ou pelo hodômetro) e o uso do km contratado. É também onde entram o relatório
 * da Cobli e os relatórios de quilometragem das locadoras.
 */
export default function QuilometragemFrota() {
  const {
    dados, ctx, carregando, filtros, setFiltro, abrirDetalhe, toast,
  } = useFrota();
  const f = filtros.quilometragem;
  const set = (patch) => setFiltro('quilometragem', patch);
  const comp = compResolvida(f.comp, dados.mensal);

  const rows = useMemo(() => {
    const q = norm(f.q);
    const valorKm = new Map(dados.veiculos.map((v) => [v.placa, v.valor_km_excedente]));
    return mensalOf(dados.mensal, comp)
      .filter((m) => m.placa)
      .filter((m) => !q || norm([m.placa, m.condutor, m.ct].join(' ')).includes(q))
      .map((m) => {
        const kr = kmRodado(m, dados.mensal);
        const ex = kr != null && isNum(m.km_contratado) ? Math.max(0, kr - m.km_contratado) : null;
        return {
          m, kr, ex, vk: valorKm.get(m.placa), ant: kmAnterior(m, dados.mensal), origem: origemDoKm(m, dados.mensal),
        };
      })
      .sort((a, b) => (b.kr ?? -1) - (a.kr ?? -1));
  }, [dados.mensal, dados.veiculos, comp, f.q]);

  const comKr = rows.filter((r) => r.kr != null);
  const totalKr = sum(comKr, (r) => r.kr);
  const comContrato = comKr.filter((r) => r.m.km_contratado);
  const uso = comContrato.length
    ? sum(comContrato, (r) => r.kr) / sum(comContrato, (r) => r.m.km_contratado)
    : null;
  const acima = rows.filter((r) => r.ex > 0);
  const kmExcedente = sum(acima, (r) => r.ex);
  const comValor = acima.filter((r) => isNum(r.vk));
  const valorExcedente = sum(comValor, (r) => r.ex * r.vk);

  const exportar = () => exportarLinhas({
    base: `quilometragem-${comp}`,
    cols: COLS_KM,
    rows: mensalOf(dados.mensal, comp).filter((m) => m.placa),
    aba: compLabel(comp),
    ctx,
  }).catch((e) => toast(e.message, 'err'));

  return (
    <div className="frota-page frota-stack">
      <PageHead
        Icon={Gauge}
        titulo="Quilometragem"
        sub={`Km por veículo em ${compLong(comp)}: hodômetro, km rodado e uso do km contratado. O km rodado vem do relatório importado ou da diferença entre as leituras do hodômetro.`}
      >
        <SeletorComp valor={comp} onChange={(v) => set({ comp: v })} />
        <button type="button" className="frota-btn" onClick={exportar}><Download size={15} /> Exportar</button>
      </PageHead>
      <Estado />
      <div className="frota-kpis">
        <Kpi destaque label="Km rodado no mês" valor={km(totalKr)} sub={`${comKr.length} de ${rows.length} veículo(s) com leitura`} />
        <Kpi
          label="Uso do contratado"
          valor={uso != null ? `${Math.round(uso * 100)}%` : '—'}
          tone={uso > 1 ? 'crit' : (uso > 0.9 ? 'warn' : '')}
          sub="média ponderada da frota"
        />
        <Kpi
          label="Acima do contratado"
          valor={acima.length}
          tone={acima.length ? 'warn' : 'ok'}
          sub={acima.length ? `${km(kmExcedente)} km excedentes` : 'nenhum veículo'}
        />
        <Kpi
          label="Excedente estimado"
          valor={comValor.length ? money(valorExcedente) : '—'}
          sub={comValor.length ? 'pelo R$/km do contrato' : 'informe R$/km excedente no veículo'}
        />
      </div>

      <ImportarCobli comp={comp} onComp={(c) => set({ comp: c })} />
      <RelatoriosPlataformas area="quilometragem" comp={comp} />

      <div className="frota-card">
        <div className="frota-filters">
          <Busca id="km-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Condutor, placa ou CT" />
        </div>
      </div>
      {carregando ? <Esqueleto /> : (
        <TableScroll className="frota-tbl">
          <table className="frota-t">
            <thead>
              <tr>
                <th>Veículo / condutor</th><th>CT</th><th className="n">Km anterior</th><th className="n">Km atual</th>
                <th className="n">Km rodado</th><th className="n">Contratado</th><th>Uso do contratado</th><th className="n">Excedente</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map(({
                m, kr, ex, vk, ant, origem,
              }) => {
                const p = kr != null && m.km_contratado ? kr / m.km_contratado : null;
                return (
                  <tr key={m.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('mensal', m.id))}>
                    <td><div className="frota-cellv"><Placa placa={m.placa} /><div><div className="p">{m.condutor || '—'}</div><div className="s">{m.locadora || ''}</div></div></div></td>
                    <td>{m.ct || '—'}</td>
                    <td className="n">{km(ant)}</td>
                    <td className="n">{km(m.km_atual)}</td>
                    <td className="n"><b>{km(kr)}</b><div className="frota-muted frota-km-origem">{origem}</div></td>
                    <td className="n">{km(m.km_contratado)}</td>
                    <td>
                      {p != null ? (
                        <span className="frota-km">
                          <Medidor pct={p} tone={p > 1 ? 'crit' : (p > 0.9 ? 'warn' : '')} largura={90} />
                          {Math.round(p * 100)}%
                        </span>
                      ) : <span className="frota-muted">—</span>}
                    </td>
                    <td className="n">
                      {ex > 0 ? (
                        <>
                          <span className="frota-crit-txt">{km(ex)} km</span>
                          {isNum(vk) && <div className="frota-muted">≈ {money(ex * vk)}</div>}
                        </>
                      ) : <span className="frota-muted">—</span>}
                    </td>
                  </tr>
                );
              }) : <LinhaVazia colunas={8} titulo="Nenhum lançamento nesta competência" />}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}
