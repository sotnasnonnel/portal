import { useMemo } from 'react';
import {
  Car, Gauge, Info, LayoutDashboard, ShieldCheck, TriangleAlert, Wrench,
} from 'lucide-react';
import { useFrota } from '../components/FrotaContext';
import {
  Esqueleto, Estado, Hbars, Kpi, PageHead, Pill, Secao, SeletorComp,
} from '../components/Pecas';
import {
  combOf, compLabel, compLong, comps, conformidade, extrasOf, groupSum, isNum, kmRodado, mensalOf, ocAberta,
  revisao, sum, totalOf, uniq,
} from '../../lib/regras';
import {
  compResolvida, fmtDate, fmtInt, money, money0,
} from '../../lib/formato';

const TOM_ALERTA = { crit: 'Crítico', warn: 'Atenção' };

export default function PainelFrota() {
  const {
    dados, cfg, carregando, filtros, setFiltro, irPara, abrirDetalhe,
  } = useFrota();
  const comp = compResolvida(filtros.painel.comp, dados.mensal);

  const p = useMemo(() => {
    const ms = mensalOf(dados.mensal, comp);
    const ativos = dados.veiculos.filter((v) => v.status === 'Ativo');
    const reservas = dados.veiculos.filter((v) => v.status === 'Reservado');
    const conds = dados.condutores
      .filter((c) => c.situacao === 'Ativo')
      .map((c) => ({ c, k: conformidade(c, dados.veiculos, cfg) }));
    const irr = conds.filter((x) => x.k.geral.lvl === 2);
    const att = conds.filter((x) => x.k.geral.lvl === 1);
    const ocA = dados.ocorrencias.filter(ocAberta);
    const revs = ativos.map((v) => ({ v, r: revisao(v, cfg) }));
    const revV = revs.filter((x) => x.r.lvl === 2);
    const revP = revs.filter((x) => x.r.lvl === 1);
    const kmEx = ms
      .map((m) => ({ m, kr: kmRodado(m, dados.mensal) }))
      .filter((x) => x.kr != null && isNum(x.m.km_contratado) && x.kr > x.m.km_contratado);

    const al = [];
    irr.concat(att).forEach(({ c, k }) => al.push({
      id: `c-${c.id}`, lvl: k.geral.lvl, tone: k.geral.tone, Icon: ShieldCheck, t: c.nome,
      s: `${k.cnh.label} · ${k.termo.label}`, abrir: () => abrirDetalhe('condutores', c.id),
    }));
    revV.concat(revP).forEach(({ v, r }) => al.push({
      id: `v-${v.id}`, lvl: r.lvl, tone: r.tone, Icon: Wrench, t: `${v.placa} · ${v.modelo || ''}`,
      s: `${r.label}${r.desde != null ? ` — ${fmtInt.format(r.desde)} km desde a última` : ''}${v.data_proxima_revisao ? ` · prevista ${fmtDate(v.data_proxima_revisao)}` : ''}`,
      abrir: () => abrirDetalhe('veiculos', v.id),
    }));
    kmEx.forEach(({ m, kr }) => al.push({
      id: `k-${m.id}`, lvl: 1, tone: 'warn', Icon: Gauge, t: `${m.placa} rodou ${fmtInt.format(kr)} km em ${compLabel(m.competencia)}`,
      s: `Contratado: ${fmtInt.format(m.km_contratado)} km/mês · risco de cobrança de km excedente`,
      abrir: () => abrirDetalhe('mensal', m.id),
    }));
    reservas.forEach((v) => al.push({
      id: `r-${v.id}`, lvl: 0, tone: 'info', Icon: Car, t: `Retirada pendente — ${v.condutor || 'sem condutor'}`,
      s: `${v.locadora || ''}${v.retirada ? ` · prevista para ${fmtDate(v.retirada)}` : ''}`,
      abrir: () => abrirDetalhe('veiculos', v.id),
    }));
    if (ocA.length) {
      al.push({
        id: 'oc', lvl: 1, tone: 'warn', Icon: TriangleAlert, t: `${ocA.length} multas/avarias sem baixa`,
        s: `${money(sum(ocA, 'valor'))} em aberto ou em tratativa`,
        abrir: () => irPara('ocorrencias', { status: 'abertas' }),
      });
    }
    const obsN = ms.filter((m) => m.obs).length;
    if (obsN) {
      al.push({
        id: 'obs', lvl: 0, tone: 'info', Icon: Info, t: `${obsN} pontos de atenção anotados em ${compLabel(comp)}`,
        s: 'Observações do controle mensal', abrir: () => irPara('mensal'),
      });
    }
    al.sort((a, b) => b.lvl - a.lvl);

    return {
      ms, ativos, reservas, irr, att, ocA, revV, revP, al,
      custo: sum(ms, totalOf),
      phd: sum(ms.filter((m) => m.custo_resp === 'PHD'), totalOf),
      cli: sum(ms.filter((m) => m.custo_resp === 'Cliente'), totalOf),
      loc: sum(ms, 'custo_locacao') + sum(ms, 'gps_valor'),
      ext: sum(ms, extrasOf),
      comb: sum(ms, (m) => combOf(m)),
      lim: sum(ms, 'recarga_mensal'),
      hasComb: ms.some((m) => combOf(m) != null),
      porLoc: uniq(ativos.map((v) => v.locadora)).map((l) => `${l} ${ativos.filter((v) => v.locadora === l).length}`).join(' · '),
      evo: comps(dados.mensal).map((c) => ({ c, v: sum(mensalOf(dados.mensal, c), totalOf) })),
    };
  }, [dados, cfg, comp, abrirDetalhe, irPara]);

  const cabecalho = (
    <PageHead
      Icon={LayoutDashboard}
      titulo="Painel da frota"
      sub={carregando ? 'Carregando a base…' : `Visão consolidada de ${compLong(comp)}. Clique nos indicadores para abrir o detalhe.`}
    >
      <SeletorComp valor={comp} onChange={(v) => setFiltro('painel', { comp: v })} />
    </PageHead>
  );

  if (carregando) return <div className="frota-page">{cabecalho}<Esqueleto linhas={8} /></div>;

  if (!dados.veiculos.length && !dados.mensal.length) {
    return (
      <div className="frota-page">
        {cabecalho}
        <Estado />
        <div className="frota-card">
          <div className="frota-empty">
            <strong>Nenhum veículo na base ainda</strong>
            Cadastre o primeiro em Frota › Veículos, ou aguarde a carga inicial da planilha.
          </div>
        </div>
      </div>
    );
  }

  const partes = [
    { l: 'Locação + GPS', v: p.loc, c: 'var(--f-s1)' },
    { l: 'Combustível', v: p.comb, c: 'var(--f-s2)' },
    { l: 'Extras', titulo: 'Extras (multas, avarias, laudos, adesivo, frete)', v: p.ext, c: 'var(--f-s3)' },
  ];
  const tot = partes.reduce((a, b) => a + b.v, 0) || 1;
  const maxE = Math.max(...p.evo.map((e) => e.v), 1);
  const combPct = p.lim ? Math.round((p.comb / p.lim) * 100) : null;
  const pendRev = p.revV.length + p.revP.length;
  const pendCond = p.irr.length + p.att.length;

  return (
    <div className="frota-page frota-stack">
      {cabecalho}
      <Estado />
      <div className="frota-kpis">
        <Kpi
          destaque
          label="Veículos ativos"
          valor={p.ativos.length}
          sub={`${p.porLoc || '—'}${p.reservas.length ? ` · ${p.reservas.length} retirada(s) pendente(s)` : ''}`}
          onClick={() => irPara('veiculos')}
        />
        <Kpi label={`Custo ${compLabel(comp)}`} valor={money0(p.custo)} sub={`PHD ${money0(p.phd)} · Cliente ${money0(p.cli)}`} onClick={() => irPara('mensal')} />
        <Kpi
          label="Combustível consumido"
          valor={p.hasComb ? money0(p.comb) : '—'}
          sub={p.hasComb ? (p.lim ? `${combPct}% do limite de ${money0(p.lim)}` : '') : `Saldo de ${compLabel(comp)} ainda não lançado · limite ${money0(p.lim)}`}
          onClick={() => irPara('combustivel')}
        />
        <Kpi label="Multas e avarias em aberto" valor={p.ocA.length} sub={money(sum(p.ocA, 'valor'))} tone={p.ocA.length ? 'warn' : 'ok'} onClick={() => irPara('ocorrencias', { status: 'abertas' })} />
        <Kpi label="Condutores com pendência" valor={pendCond} sub={`${p.irr.length} irregular(es) · ${p.att.length} em atenção`} tone={p.irr.length ? 'crit' : (p.att.length ? 'warn' : 'ok')} onClick={() => irPara('condutores', { conf: 'pend' })} />
        <Kpi label="Revisões" valor={pendRev} sub={`${p.revV.length} vencida(s) · ${p.revP.length} a programar`} tone={p.revV.length ? 'crit' : (p.revP.length ? 'warn' : 'ok')} onClick={() => irPara('manutencao')} />
      </div>

      <div className="frota-grid g2 frota-painel">
        <div className="frota-stack">
          <Secao className="is-fill" titulo="Pontos de atenção" contagem={p.al.length}>
            {p.al.length ? (
              <div className="frota-alerts">
                {p.al.map((a) => (
                  <button key={a.id} type="button" className="frota-al" onClick={a.abrir}>
                    <span className={`ic ${a.tone}`}><a.Icon size={16} aria-hidden="true" /></span>
                    <span className="tx"><b>{a.t}</b><span>{a.s}</span></span>
                    <Pill tone={TOM_ALERTA[a.tone] ? a.tone : 'info'}>{TOM_ALERTA[a.tone] || 'Info'}</Pill>
                  </button>
                ))}
              </div>
            ) : (
              <div className="frota-empty"><strong>Tudo em dia.</strong>Nenhuma pendência de documentos, revisão ou ocorrência.</div>
            )}
          </Secao>
          <Secao titulo={`Custo por centro de custo · ${compLabel(comp)}`}>
            <p className="frota-card-s">Do maior para o menor; inclui locação, GPS e extras.</p>
            <Hbars itens={groupSum(p.ms, (m) => m.ct, totalOf, 10)} />
          </Secao>
        </div>
        <div className="frota-stack">
          <Secao titulo={`Composição do custo · ${compLabel(comp)}`}>
            <div className="frota-stackbar" role="img" aria-label="Composição do custo">
              {partes.filter((x) => x.v > 0).map((x) => (
                <div key={x.l} style={{ width: `${((x.v / tot) * 100).toFixed(2)}%`, background: x.c }} title={`${x.titulo || x.l}\n${money(x.v)} · ${Math.round((x.v / tot) * 100)}%`} />
              ))}
            </div>
            <div className="frota-legend">
              {partes.map((x) => (
                <span key={x.l}><i style={{ background: x.c }} />{x.l}<b>{x.l === 'Combustível' && !p.hasComb ? 'não lançado' : money0(x.v)}</b></span>
              ))}
            </div>
          </Secao>
          <Secao titulo={`Custo por locadora · ${compLabel(comp)}`}>
            <p className="frota-card-s">Quantidade de veículos e valor no mês.</p>
            <Hbars itens={groupSum(p.ms, (m) => m.locadora, totalOf, 6).map((x) => ({
              ...x, t: `${p.ms.filter((m) => (m.locadora || 'Não informado') === x.l).length} veículo(s)`,
            }))}
            />
          </Secao>
          <Secao className="is-fill" titulo="Evolução do custo mensal" nota="locação, GPS e extras">
            {p.evo.length ? (
              <div className="frota-cols">
                {p.evo.map((e) => (
                  <div key={e.c} className="c" title={`${compLong(e.c)}\n${money(e.v)}`}>
                    <div className="area">
                      <span className="folga" style={{ flexGrow: 1 - e.v / maxE }} />
                      <span className="val">{money0(e.v)}</span>
                      <div className={`bar ${e.c === comp ? '' : 'apagada'}`} style={{ flexGrow: e.v / maxE }} />
                    </div>
                    <span className="x">{compLabel(e.c)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="frota-empty">Sem competências lançadas.</div>}
          </Secao>
        </div>
      </div>
    </div>
  );
}
