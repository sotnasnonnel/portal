import { useMemo } from 'react';
import { Paperclip, Plus, Wrench } from 'lucide-react';
import TableScroll from '../../../../components/UI/TableScroll';
import { useFrota } from '../components/FrotaContext';
import {
  Busca, Chip, Esqueleto, Estado, Kpi, LinhaVazia, Medidor, PageHead, Pill, Placa, Secao,
} from '../components/Pecas';
import {
  isNum, n0, norm, revisao, todayISO,
} from '../../lib/regras';
import {
  fmtDate, fmtInt, int, km, linhaClicavel, money,
} from '../../lib/formato';

const situacao = (x) => {
  if (x.r.lvl === 2) return 'vencida';
  if (x.r.lvl === 1) return 'programar';
  return x.r.label === 'Sem registro' ? 'sem' : 'emdia';
};

export default function ManutencaoFrota() {
  const {
    dados, cfg, carregando, filtros, setFiltro, abrirDetalhe, abrirForm, podeEscrever,
  } = useFrota();
  const f = filtros.manutencao;
  const set = (patch) => setFiltro('manutencao', patch);

  const base = useMemo(
    () => dados.veiculos.filter((v) => v.status === 'Ativo').map((v) => ({ v, r: revisao(v, cfg) })),
    [dados.veiculos, cfg],
  );
  const q = norm(f.q);
  const rows = base
    .filter((x) => (!f.st || situacao(x) === f.st) && (!q || norm([x.v.placa, x.v.condutor, x.v.modelo].join(' ')).includes(q)))
    .sort((a, b) => b.r.lvl - a.r.lvl || n0(b.r.desde) - n0(a.r.desde));
  const c = (s) => base.filter((x) => situacao(x) === s).length;
  const hist = dados.manutencoes
    .filter((m) => !q || norm([m.placa, m.tipo, m.descricao, m.local, m.condutor].join(' ')).includes(q))
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  const nova = (v) => abrirForm('manutencoes', null, v ? {
    placa: v.placa, data: todayISO(), tipo: 'Revisão preventiva', km: v.km_atual, condutor: v.condutor,
  } : { data: todayISO(), tipo: 'Revisão preventiva' });

  return (
    <div className="frota-page frota-stack">
      <PageHead
        Icon={Wrench}
        titulo="Manutenção"
        sub={`Revisão a cada ${fmtInt.format(cfg.intervalo_revisao_km)} km; o sistema avisa ${fmtInt.format(cfg.margem_revisao_km)} km antes. A locadora cobra multa quando a revisão passa do prazo.`}
      >
        {podeEscrever && (
          <button type="button" className="frota-btn primary" onClick={() => nova()}><Plus size={15} /> Registrar manutenção</button>
        )}
      </PageHead>
      <Estado />
      <div className="frota-kpis">
        <Kpi label="Revisões vencidas" valor={c('vencida')} sub="km ou data acima do limite" tone={c('vencida') ? 'crit' : 'ok'} onClick={() => set({ st: 'vencida' })} />
        <Kpi label="A programar" valor={c('programar')} sub={`faltam menos de ${fmtInt.format(cfg.margem_revisao_km)} km`} tone={c('programar') ? 'warn' : ''} onClick={() => set({ st: 'programar' })} />
        <Kpi label="Em dia" valor={c('emdia')} tone="ok" onClick={() => set({ st: 'emdia' })} />
        <Kpi label="Sem registro de km" valor={c('sem')} sub="informe o km da última manutenção" onClick={() => set({ st: 'sem' })} />
      </div>
      <div className="frota-card frota-stack">
        <div className="frota-filters">
          <Busca id="mn-q" valor={f.q} onChange={(v) => set({ q: v })} placeholder="Placa, condutor, modelo ou tipo de serviço" />
        </div>
        <div className="frota-chips">
          <Chip ativo={f.st === ''} onClick={() => set({ st: '' })} contagem={base.length}>Todos</Chip>
          <Chip ativo={f.st === 'vencida'} onClick={() => set({ st: 'vencida' })} contagem={c('vencida')}>Vencidas</Chip>
          <Chip ativo={f.st === 'programar'} onClick={() => set({ st: 'programar' })} contagem={c('programar')}>A programar</Chip>
          <Chip ativo={f.st === 'emdia'} onClick={() => set({ st: 'emdia' })} contagem={c('emdia')}>Em dia</Chip>
          <Chip ativo={f.st === 'sem'} onClick={() => set({ st: 'sem' })} contagem={c('sem')}>Sem registro</Chip>
        </div>
      </div>
      {carregando ? <Esqueleto /> : (
        <TableScroll className="frota-tbl">
          <table className="frota-t">
            <thead>
              <tr>
                <th>Veículo</th><th>Condutor</th><th className="n">Km atual</th><th>Última manutenção</th><th className="n">Km desde</th><th>Próxima</th><th>Situação</th><th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map(({ v, r }) => (
                <tr key={v.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('veiculos', v.id))}>
                  <td><div className="frota-cellv"><Placa placa={v.placa} /><div><div className="p">{v.modelo || '—'}</div><div className="s">{v.locadora || ''}</div></div></div></td>
                  <td>{v.condutor || '—'}</td>
                  <td className="n">{int(v.km_atual)}</td>
                  <td>{isNum(v.km_ultima_manutencao) ? km(v.km_ultima_manutencao) : '—'}<div className="s">{v.data_ultima_revisao ? fmtDate(v.data_ultima_revisao) : ''}</div></td>
                  <td className="n">
                    {r.desde != null ? (
                      <span className="frota-km fim">
                        <Medidor pct={r.desde / cfg.intervalo_revisao_km} tone={r.lvl === 2 ? 'crit' : (r.lvl === 1 ? 'warn' : '')} largura={64} />
                        {fmtInt.format(r.desde)}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{r.prox != null ? km(r.prox) : '—'}<div className="s">{v.data_proxima_revisao ? `até ${fmtDate(v.data_proxima_revisao)}` : ''}</div></td>
                  <td><Pill tone={r.tone}>{r.label}</Pill></td>
                  <td>
                    {podeEscrever && (
                      <button type="button" className="frota-ibtn" aria-label="Registrar manutenção" onClick={(e) => { e.stopPropagation(); nova(v); }}><Plus size={15} /></button>
                    )}
                  </td>
                </tr>
              )) : <LinhaVazia colunas={8} titulo="Nenhum veículo nesta situação" />}
            </tbody>
          </table>
        </TableScroll>
      )}
      <Secao titulo="Histórico de manutenções" contagem={hist.length}>
        {hist.length ? (
          <TableScroll>
            <table className="frota-mini">
              <thead>
                <tr><th>Data</th><th>Veículo</th><th>Serviço</th><th className="n">Km</th><th>Local / protocolo</th><th className="n">Valor</th><th>Anexos</th></tr>
              </thead>
              <tbody>
                {hist.map((m) => (
                  <tr key={m.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('manutencoes', m.id))}>
                    <td>{fmtDate(m.data)}</td>
                    <td>{m.placa || '—'}</td>
                    <td>{m.tipo || '—'}<div className="s">{(m.descricao || '').slice(0, 80)}</div></td>
                    <td className="n">{int(m.km)}</td>
                    <td>{m.local || ''}{m.protocolo && <div className="s">Prot. {m.protocolo}</div>}</td>
                    <td className="n">{money(m.valor)}</td>
                    <td>{(m.anexos || []).length > 0 && <Pill><Paperclip size={12} aria-label="Anexos" /> {m.anexos.length}</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        ) : <div className="frota-empty">Nenhuma manutenção registrada.</div>}
      </Secao>
    </div>
  );
}
