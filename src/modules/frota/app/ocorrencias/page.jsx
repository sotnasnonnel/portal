import { useMemo } from 'react';
import {
  Download, Paperclip, Plus, TriangleAlert, X,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import {
  Busca, Chip, Esqueleto, Estado, Hbars, Kpi, LinhaVazia, PageHead, Pill, Placa, Secao, Selecao,
} from '../components/Pecas';
import {
  gravTone, groupSum, n0, norm, ocAberta, ocTone, sum, todayISO, uniq,
} from '../../lib/regras';
import {
  fmtDate, fmtInt, linhaClicavel, money, money0,
} from '../../lib/formato';
import { COLS_OC } from '../../lib/relatorios';
import { exportarLinhas } from '../../lib/exportar';

export default function OcorrenciasFrota() {
  const {
    dados, ctx, carregando, filtros, setFiltro, limparFiltros, abrirDetalhe, abrirForm, podeEscrever, toast,
  } = useFrota();
  const f = filtros.ocorrencias;
  const set = (patch) => setFiltro('ocorrencias', patch);
  const os = dados.ocorrencias;

  const rows = useMemo(() => {
    const q = norm(f.q);
    return os
      .filter((o) => (!f.tipo || o.tipo === f.tipo)
        && (!f.status || (f.status === 'abertas' ? ocAberta(o) : (f.status === 'fechadas' ? !ocAberta(o) : o.status === f.status)))
        && (!f.categoria || o.categoria === f.categoria)
        && (!f.ano || String(o.data || '').startsWith(f.ano))
        && (!f.condutor || norm(o.condutor).includes(norm(f.condutor)))
        && (!f.placa || o.placa === f.placa)
        && (!f.de || (o.data && o.data >= f.de))
        && (!f.ate || (o.data && o.data <= f.ate))
        && (!q || norm([o.placa, o.condutor, o.categoria, o.descricao, o.cidade, o.numero_bo, o.numero_fatura, o.gestor].join(' ')).includes(q)))
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  }, [os, f]);

  const mul = rows.filter((o) => o.tipo === 'Multa');
  const ava = rows.filter((o) => o.tipo === 'Avaria');
  const ab = rows.filter(ocAberta);
  const desc = rows.filter((o) => norm(o.desconto_condutor) === 'sim');
  const algumFiltro = Object.values(f).some(Boolean);

  // Ocorrência de dois condutores divide o valor entre eles no gráfico.
  const porCondutor = rows.flatMap((o) => {
    const cs = String(o.condutor || 'Não informado').split(' / ');
    return cs.map((c) => ({ c, v: n0(o.valor) / cs.length }));
  });

  const exportar = () => exportarLinhas({
    base: 'multas-e-avarias', cols: COLS_OC, rows, aba: 'Ocorrências', ctx,
  }).catch((e) => toast(e.message, 'err'));

  return (
    <div className="frota-page frota-stack">
      <PageHead Icon={TriangleAlert} titulo="Multas e avarias" sub="Registro por veículo, condutor, valor, data e tipo de infração ou dano — com BO, laudo e comprovantes anexados.">
        <button type="button" className="frota-btn" onClick={exportar}><Download size={15} /> Exportar</button>
        {podeEscrever && (
          <button type="button" className="frota-btn primary" onClick={() => abrirForm('ocorrencias', null, { status: 'Aberta', tipo: 'Multa', data: todayISO() })}><Plus size={15} /> Nova ocorrência</button>
        )}
      </PageHead>
      <Estado />
      <div className="frota-card frota-stack">
        <div className="frota-filters">
          <Busca id="of-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Placa, condutor, descrição, BO ou fatura" />
          <Selecao id="of-cat" label="Tipo de infração / dano" opcoes={uniq(os.map((o) => o.categoria))} valor={f.categoria} onChange={(categoria) => set({ categoria })} />
          <Selecao id="of-cond" label="Condutor" opcoes={uniq(os.flatMap((o) => String(o.condutor || '').split(' / ')))} valor={f.condutor} onChange={(condutor) => set({ condutor })} />
          <Selecao id="of-pl" label="Placa" opcoes={uniq(os.map((o) => o.placa))} valor={f.placa} onChange={(placa) => set({ placa })} todos="Todas" />
          <Selecao id="of-ano" label="Ano" opcoes={uniq(os.map((o) => String(o.data || '').slice(0, 4))).reverse()} valor={f.ano} onChange={(ano) => set({ ano })} />
          <div className="frota-fld">
            <label htmlFor="of-de">De</label>
            <input id="of-de" type="date" className="frota-inp" value={f.de} onChange={(e) => set({ de: e.target.value })} />
          </div>
          <div className="frota-fld">
            <label htmlFor="of-ate">Até</label>
            <input id="of-ate" type="date" className="frota-inp" value={f.ate} onChange={(e) => set({ ate: e.target.value })} />
          </div>
        </div>
        <div className="frota-chips">
          <Chip ativo={f.tipo === ''} onClick={() => set({ tipo: '' })}>Multas e avarias</Chip>
          <Chip ativo={f.tipo === 'Multa'} onClick={() => set({ tipo: 'Multa' })} contagem={os.filter((o) => o.tipo === 'Multa').length}>Multas</Chip>
          <Chip ativo={f.tipo === 'Avaria'} onClick={() => set({ tipo: 'Avaria' })} contagem={os.filter((o) => o.tipo === 'Avaria').length}>Avarias</Chip>
          <span className="frota-chip-sep" />
          <Chip ativo={f.status === ''} onClick={() => set({ status: '' })}>Qualquer status</Chip>
          <Chip ativo={f.status === 'abertas'} onClick={() => set({ status: 'abertas' })} contagem={os.filter(ocAberta).length}>Em aberto</Chip>
          <Chip ativo={f.status === 'fechadas'} onClick={() => set({ status: 'fechadas' })} contagem={os.filter((o) => !ocAberta(o)).length}>Pagas / encerradas</Chip>
          {algumFiltro && <Chip onClick={() => limparFiltros('ocorrencias')}><X size={13} aria-hidden="true" /> Limpar filtros</Chip>}
        </div>
      </div>
      <div className="frota-kpis">
        <Kpi destaque label="Ocorrências" valor={rows.length} sub={`de ${os.length} registradas`} />
        <Kpi label="Valor total" valor={money0(sum(rows, 'valor'))} />
        <Kpi label="Multas" valor={mul.length} sub={money(sum(mul, 'valor'))} />
        <Kpi label="Avarias" valor={ava.length} sub={money(sum(ava, 'valor'))} />
        <Kpi label="Em aberto" valor={ab.length} sub={money(sum(ab, 'valor'))} tone={ab.length ? 'warn' : 'ok'} />
        <Kpi label="Descontado do condutor" valor={desc.length} sub={money(sum(desc, 'valor'))} />
      </div>
      <div className="frota-grid g2">
        <Secao titulo="Valor por condutor">
          <Hbars itens={groupSum(porCondutor, (x) => x.c, (x) => x.v, 8)} />
        </Secao>
        <Secao titulo="Quantidade por tipo de infração / dano">
          <Hbars itens={groupSum(rows, (o) => o.categoria, () => 1, 8)} fmt={(v) => fmtInt.format(v)} />
        </Secao>
      </div>
      {carregando ? <Esqueleto /> : (
        <TableScroll className="frota-tbl">
          <table className="frota-t frota-t-oc">
            <thead>
              <tr>
                <th>Data</th><th>Veículo</th><th>Condutor</th><th className="frota-oc-col">Infração / dano</th><th className="n">Valor</th><th>Pagamento</th><th>Status</th><th aria-label="Anexos" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((o) => (
                <tr key={o.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('ocorrencias', o.id))}>
                  <td className="nw">{fmtDate(o.data)}<div className="s">{o.cidade || ''}</div></td>
                  <td className="nw"><div className="frota-cellv"><Placa placa={o.placa} /><div className="s">{o.modelo || ''}</div></div></td>
                  <td>
                    {/* Dois condutores, um por linha: lado a lado o nome ocupava a coluna inteira. */}
                    {String(o.condutor || '—').split(' / ').map((c) => <div key={c} className="p">{c}</div>)}
                    {o.gestor && <div className="s">Gestor: {o.gestor}</div>}
                  </td>
                  <td>
                    <div className="frota-oc-tit">
                      <Pill tone={o.tipo === 'Multa' ? 'brand' : 'info'}>{o.tipo || '—'}</Pill>
                      <span>{o.categoria || '—'}</span>
                      {o.gravidade && <Pill tone={gravTone(o.gravidade)}>{o.gravidade}</Pill>}
                    </div>
                    {o.descricao && <div className="frota-oc-desc" title={o.descricao}>{o.descricao}</div>}
                  </td>
                  <td className="n nw"><b>{money(o.valor)}</b></td>
                  <td>
                    {o.responsavel_pagamento || '—'}
                    <div className="s">
                      {norm(o.desconto_condutor) === 'sim'
                        ? `Desconto do condutor${o.forma_desconto ? ` · ${o.forma_desconto}` : ''}`
                        : (o.data_pagamento ? `Pago em ${fmtDate(o.data_pagamento)}` : '')}
                    </div>
                  </td>
                  <td className="nw"><Pill tone={ocTone(o.status || 'Aberta')}>{o.status || 'Aberta'}</Pill></td>
                  <td className="nw">{(o.anexos || []).length > 0 && <Pill><Paperclip size={12} aria-label="Anexos" /> {o.anexos.length}</Pill>}</td>
                </tr>
              )) : <LinhaVazia colunas={8} titulo="Nenhuma ocorrência encontrada" sub="Ajuste os filtros acima." />}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>{rows.length} ocorrência(s)</td>
                  <td className="n nw">{money(sum(rows, 'valor'))}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </TableScroll>
      )}
    </div>
  );
}
