import { useMemo } from 'react';
import {
  Car, Download, Pencil, Plus,
} from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import {
  Busca, Chip, Esqueleto, Estado, LinhaVazia, PageHead, Pill, Placa, Selecao,
} from '../components/Pecas';
import {
  isNum, norm, respTone, revisao, stTone, uniq,
} from '../../lib/regras';
import {
  fmtDate, fmtInt, int, linhaClicavel, money,
} from '../../lib/formato';
import { COLS_VEIC } from '../../lib/relatorios';
import { exportarLinhas } from '../../lib/exportar';

const ORDEM = { Ativo: 0, Reservado: 1, Inativo: 2 };

export default function VeiculosFrota() {
  const {
    dados, cfg, ctx, carregando, filtros, setFiltro, abrirDetalhe, abrirForm, podeEscrever, toast,
  } = useFrota();
  const f = filtros.veiculos;
  const set = (patch) => setFiltro('veiculos', patch);
  const vs = dados.veiculos;

  const rows = useMemo(() => {
    const q = norm(f.q);
    return vs
      .filter((v) => (!f.status || v.status === f.status)
        && (!f.locadora || v.locadora === f.locadora)
        && (!f.ct || v.ct === f.ct)
        && (!f.custo_resp || v.custo_resp === f.custo_resp)
        && (!q || norm([v.placa, v.modelo, v.condutor, v.contrato, v.codigo_reserva, v.ct, v.gps_numero, (v.historico || []).map((h) => h.condutor).join(' ')].join(' ')).includes(q)))
      .sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || String(a.condutor || '').localeCompare(String(b.condutor || ''), 'pt-BR'));
  }, [vs, f]);

  const cnt = (s) => vs.filter((v) => !s || v.status === s).length;
  const exportar = () => exportarLinhas({
    base: 'frota-veiculos', cols: COLS_VEIC, rows, aba: 'Veículos', ctx,
  }).catch((e) => toast(e.message, 'err'));

  return (
    <div className="frota-page frota-stack">
      <PageHead Icon={Car} titulo="Veículos" sub="Cadastro da frota: contrato de locação, condutor, centro de custo, quilometragem e equipamentos.">
        <button type="button" className="frota-btn" onClick={exportar}><Download size={15} /> Exportar</button>
        {podeEscrever && (
          <button type="button" className="frota-btn primary" onClick={() => abrirForm('veiculos', null, { status: 'Ativo' })}><Plus size={15} /> Novo veículo</button>
        )}
      </PageHead>
      <Estado />
      <div className="frota-card frota-stack">
        <div className="frota-filters">
          <Busca id="vf-q" valor={f.q} onChange={(q) => set({ q })} placeholder="Placa, condutor, modelo, contrato ou nº GPS" />
          <Selecao id="vf-loc" label="Locadora" opcoes={uniq(vs.map((v) => v.locadora))} valor={f.locadora} onChange={(locadora) => set({ locadora })} todos="Todas" />
          <Selecao id="vf-ct" label="CT / Centro de custo" opcoes={uniq(vs.map((v) => v.ct))} valor={f.ct} onChange={(ct) => set({ ct })} />
          <Selecao id="vf-cr" label="Custo por conta de" opcoes={['PHD', 'Cliente']} valor={f.custo_resp} onChange={(custo_resp) => set({ custo_resp })} />
        </div>
        <div className="frota-chips">
          <Chip ativo={f.status === 'Ativo'} onClick={() => set({ status: 'Ativo' })} contagem={cnt('Ativo')}>Ativos</Chip>
          <Chip ativo={f.status === 'Reservado'} onClick={() => set({ status: 'Reservado' })} contagem={cnt('Reservado')}>Retirada pendente</Chip>
          <Chip ativo={f.status === 'Inativo'} onClick={() => set({ status: 'Inativo' })} contagem={cnt('Inativo')}>Devolvidos / inativos</Chip>
          <Chip ativo={f.status === ''} onClick={() => set({ status: '' })} contagem={cnt('')}>Todos</Chip>
        </div>
      </div>
      {carregando ? <Esqueleto /> : (
        <TableScroll className="frota-tbl">
          <table className="frota-t">
            <thead>
              <tr>
                <th>Veículo</th><th>Condutor</th><th>Locadora</th><th>Contrato</th><th>Retirada</th>
                <th className="n">Km atual</th><th className="n">Locação/mês</th><th>Custo</th><th>Revisão</th><th>Status</th><th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((v) => {
                const r = revisao(v, cfg);
                return (
                  <tr key={v.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('veiculos', v.id))}>
                    <td><div className="frota-cellv"><Placa placa={v.placa} /><div><div className="p">{v.modelo || '—'}</div><div className="s">{v.cor || ''}</div></div></div></td>
                    <td><div className="p">{v.condutor || '—'}</div><div className="s">{v.ct || ''}</div></td>
                    <td>{v.locadora || '—'}<div className="s">{v.grupo ? `Grupo ${v.grupo}` : ''}</div></td>
                    <td>{v.contrato || '—'}<div className="s">{v.codigo_reserva || ''}</div></td>
                    <td>{fmtDate(v.retirada)}{v.devolucao && <div className="s">dev. {fmtDate(v.devolucao)}</div>}</td>
                    <td className="n">{int(v.km_atual)}<div className="s">{isNum(v.km_contratado) ? `${fmtInt.format(v.km_contratado)} km/mês` : ''}</div></td>
                    <td className="n">{money(v.custo_mensal)}</td>
                    <td>{v.custo_resp ? <Pill tone={respTone(v.custo_resp)}>{v.custo_resp}</Pill> : '—'}</td>
                    <td>{v.status === 'Inativo' ? <span className="frota-muted">—</span> : <Pill tone={r.tone}>{r.label}</Pill>}</td>
                    <td><Pill tone={stTone(v.status)}>{v.status === 'Reservado' ? 'Retirada pendente' : v.status}</Pill></td>
                    <td>
                      {podeEscrever && (
                        <button type="button" className="frota-ibtn" aria-label="Editar" onClick={(e) => { e.stopPropagation(); abrirForm('veiculos', v.id); }}><Pencil size={15} /></button>
                      )}
                    </td>
                  </tr>
                );
              }) : <LinhaVazia colunas={11} titulo="Nenhum veículo encontrado" sub="Ajuste a busca ou os filtros." />}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}
