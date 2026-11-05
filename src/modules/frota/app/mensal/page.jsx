import { useMemo, useState } from 'react';
import {
  Copy, Download, Info, Plus, Receipt,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import Confirmar from '../components/Confirmar';
import {
  Busca, Esqueleto, Estado, Kpi, LinhaVazia, Medidor, PageHead, Pill, Placa, Selecao, SeletorComp,
} from '../components/Pecas';
import {
  combOf, compLabel, compLong, extrasOf, gerarCompetencia, kmRodado, lastComp, mensalOf, compNext, norm, respTone, sum,
  totalOf, uniq,
} from '../../lib/regras';
import {
  compResolvida, dec, decZ, fmtInt, linhaClicavel, money0,
} from '../../lib/formato';
import { COLS_MENSAL } from '../../lib/relatorios';
import { exportarLinhas } from '../../lib/exportar';
import { inserirVarios } from '../../lib/frota';

export default function MensalFrota() {
  const {
    dados, ctx, carregando, filtros, setFiltro, irPara, abrirDetalhe, abrirForm, podeEscrever, recarregar, toast,
  } = useFrota();
  const f = filtros.mensal;
  const set = (patch) => setFiltro('mensal', patch);
  const comp = compResolvida(f.comp, dados.mensal);
  const doMes = useMemo(() => mensalOf(dados.mensal, comp), [dados.mensal, comp]);
  const [gerando, setGerando] = useState(null);

  const rows = useMemo(() => {
    const q = norm(f.q);
    return doMes
      .filter((m) => (!f.locadora || m.locadora === f.locadora)
        && (!f.custo_resp || m.custo_resp === f.custo_resp)
        && (!q || norm([m.placa, m.condutor, m.ct, m.modelo, m.obs].join(' ')).includes(q)))
      .sort((a, b) => String(a.condutor || '').localeCompare(String(b.condutor || ''), 'pt-BR'));
  }, [doMes, f]);

  const T = (k) => sum(rows, k);
  const proxima = comp ? compNext(lastComp(dados.mensal)) : '';
  const temComb = rows.some((m) => combOf(m) != null);

  const exportar = () => exportarLinhas({
    base: `controle-mensal-${comp}`, cols: COLS_MENSAL, rows, aba: compLabel(comp), ctx,
  }).catch((e) => toast(e.message, 'err'));

  const gerar = async () => {
    try {
      await inserirVarios('mensal', gerando.todo);
      await recarregar(['mensal']);
      set({ comp: gerando.para });
      toast(`${compLabel(gerando.para)} gerada com ${gerando.todo.length} lançamentos`);
    } catch (e) {
      toast(e.message, 'err');
    }
    setGerando(null);
  };

  return (
    <div className="frota-page-wide frota-stack">
      <PageHead Icon={Receipt} titulo="Controle mensal" sub={`Custos de ${compLong(comp)} por veículo: locação, GPS, multas, avarias, laudos, adesivo e frete.`}>
        <SeletorComp valor={comp} onChange={(v) => set({ comp: v })} />
        <button type="button" className="frota-btn" onClick={exportar}><Download size={15} /> Exportar</button>
        {podeEscrever && proxima && (
          <button type="button" className="frota-btn" onClick={() => setGerando(gerarCompetencia(dados.veiculos, dados.mensal))}><Copy size={15} /> Gerar {compLabel(proxima)}</button>
        )}
        {podeEscrever && (
          <button type="button" className="frota-btn primary" onClick={() => abrirForm('mensal', null, { competencia: f.comp || lastComp(dados.mensal), status: 'Ativo' })}><Plus size={15} /> Lançamento</button>
        )}
      </PageHead>
      <Estado />
      <div className="frota-kpis">
        <Kpi label="Locação" valor={money0(T('custo_locacao'))} sub={`${rows.length} lançamento(s)`} />
        <Kpi label="GPS / telemetria" valor={money0(T('gps_valor'))} />
        <Kpi label="Extras" valor={money0(T(extrasOf))} sub="multas, avarias, laudos, adesivo e frete" />
        <Kpi
          destaque
          label="Total do mês"
          valor={money0(T(totalOf))}
          sub={`PHD ${money0(sum(rows.filter((r) => r.custo_resp === 'PHD'), totalOf))} · Cliente ${money0(sum(rows.filter((r) => r.custo_resp === 'Cliente'), totalOf))}`}
        />
        <Kpi
          label="Combustível consumido"
          valor={temComb ? money0(T((m) => combOf(m))) : '—'}
          sub={temComb ? 'ver tela Combustível' : 'saldo do mês ainda não lançado'}
          onClick={() => irPara('combustivel')}
        />
      </div>
      <div className="frota-card">
        <div className="frota-filters">
          <Busca id="mf-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Condutor, placa, CT ou observação" />
          <Selecao id="mf-loc" label="Locadora" opcoes={uniq(doMes.map((m) => m.locadora))} valor={f.locadora} onChange={(locadora) => set({ locadora })} todos="Todas" />
          <Selecao id="mf-cr" label="Custo por conta de" opcoes={['PHD', 'Cliente']} valor={f.custo_resp} onChange={(custo_resp) => set({ custo_resp })} />
        </div>
      </div>
      {carregando ? <Esqueleto /> : (
        <TableScroll className="frota-tbl">
          <table className="frota-t">
            <thead>
              <tr>
                <th>Veículo / condutor</th><th>Locadora</th><th>CT</th><th>Custo</th>
                <th className="n">Locação R$</th><th className="n">GPS</th><th className="n">Multas</th><th className="n">Avarias</th><th className="n">Laudos</th><th className="n">Adesivo</th><th className="n">Frete</th><th className="n">Total R$</th>
                <th>Km no mês</th><th aria-label="Observação" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((m) => {
                const kr = kmRodado(m, dados.mensal);
                const pct = kr != null && m.km_contratado ? kr / m.km_contratado : null;
                return (
                  <tr key={m.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('mensal', m.id))}>
                    <td><div className="frota-cellv"><Placa placa={m.placa} /><div><div className="p">{m.condutor || '—'}</div><div className="s">{m.modelo || ''}{m.status === 'Inativo' ? ' · devolvido' : ''}</div></div></div></td>
                    <td>{m.locadora || '—'}</td>
                    <td>{m.ct || '—'}</td>
                    <td>{m.custo_resp ? <Pill tone={respTone(m.custo_resp)}>{m.custo_resp}</Pill> : '—'}</td>
                    <td className="n">{decZ(m.custo_locacao)}</td>
                    <td className="n">{dec(m.gps_valor)}</td>
                    <td className="n">{dec(m.multas)}</td>
                    <td className="n">{dec(m.avarias)}</td>
                    <td className="n">{dec(m.laudos)}</td>
                    <td className="n">{dec(m.adesivo)}</td>
                    <td className="n">{dec(m.frete)}</td>
                    <td className="n"><b>{decZ(totalOf(m))}</b></td>
                    <td>
                      {kr != null ? (
                        <span className="frota-km" title={`${fmtInt.format(kr)} km rodados de ${fmtInt.format(m.km_contratado || 0)} contratados`}>
                          <Medidor pct={pct} tone={pct > 1 ? 'crit' : (pct > 0.9 ? 'warn' : '')} />
                          {fmtInt.format(kr)}
                        </span>
                      ) : <span className="frota-muted" title="Sem leitura de km na competência anterior">—</span>}
                    </td>
                    <td>{m.obs && <span className="frota-obs" title={m.obs}><Info size={15} aria-label="Ponto de atenção" /></span>}</td>
                  </tr>
                );
              }) : (
                <LinhaVazia
                  colunas={14}
                  titulo="Nenhum lançamento nesta competência"
                  sub={podeEscrever ? 'Use “Gerar” para copiar os veículos ativos ou “Lançamento” para incluir um a um.' : ''}
                />
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Total · {rows.length} veículo(s)</td>
                  <td className="n">{decZ(T('custo_locacao'))}</td>
                  <td className="n">{decZ(T('gps_valor'))}</td>
                  <td className="n">{decZ(T('multas'))}</td>
                  <td className="n">{decZ(T('avarias'))}</td>
                  <td className="n">{decZ(T('laudos'))}</td>
                  <td className="n">{decZ(T('adesivo'))}</td>
                  <td className="n">{decZ(T('frete'))}</td>
                  <td className="n">{decZ(T(totalOf))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </TableScroll>
      )}
      {gerando && (
        <Confirmar
          titulo={`Gerar ${compLong(gerando.para)}`}
          texto={`Serão criados ${gerando.todo.length} lançamentos a partir dos veículos ativos e retiradas pendentes, copiando locação, GPS, CT, km contratado e limite de combustível de ${compLabel(gerando.de)}. Multas, avarias, laudos, adesivo, frete, km do mês e saldo de combustível começam em branco.`}
          ok={`Gerar ${gerando.todo.length} lançamentos`}
          onOk={gerar}
          onFechar={() => setGerando(null)}
        />
      )}
    </div>
  );
}
