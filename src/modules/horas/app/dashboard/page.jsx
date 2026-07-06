import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { fetchApontamentos, fetchProjetos, fetchColaboradores } from '../../lib/data';
import { agruparHoras, serieDiaria, somaMs } from '../../lib/aggregate';
import { fmtHoras, startOfDay, startOfWeek, startOfMonth, periodoPadrao, intervaloTs } from '../../lib/format';
import { BrandBarChart, BrandLineChart, BrandPieChart } from '../components/Charts';
import ApontamentosTable from '../components/ApontamentosTable';

export default function DashboardPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'membro';
  const isAdmin = role === 'admin';
  const colaboradorId = user?.id;

  const [apont, setApont] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [range, setRange] = useState(() => periodoPadrao(30));
  const [filtro, setFiltro] = useState({ projeto: '', colab: '' });
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErro('');
      try {
        const { sinceTs, ateTs } = intervaloTs(range);
        const [a, ps, cs] = await Promise.all([
          fetchApontamentos({ role, colaboradorId, sinceTs, ateTs }),
          fetchProjetos({ incluirArquivados: true }),
          isAdmin ? fetchColaboradores() : Promise.resolve([]),
        ]);
        if (cancel) return;
        setApont(a);
        setProjetos(ps);
        setColabs(cs);
      } catch (e) {
        if (!cancel) setErro(e?.message || 'Falha ao carregar o dashboard.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [role, isAdmin, colaboradorId, range]);

  const projetoMap = useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos]);
  const projetoNome = (id) => projetoMap.get(id)?.nome || '—';
  const projetoCor = (id) => projetoMap.get(id)?.cor || '#C44A28';
  const colabMap = useMemo(() => new Map(colabs.map((c) => [c.id, c])), [colabs]);
  const nomeColab = (id) => colabMap.get(id)?.nome || '—';
  const funcaoColab = (id) => colabMap.get(id)?.funcao || '—';

  const list = useMemo(() => {
    let l = apont;
    if (filtro.projeto) l = l.filter((a) => a.projetoId === filtro.projeto);
    if (isAdmin && filtro.colab) l = l.filter((a) => a.colaboradorId === filtro.colab);
    return l;
  }, [apont, filtro, isAdmin]);

  const agora = Date.now();
  const stats = useMemo(
    () => ({
      hoje: somaMs(list.filter((a) => a.inicio >= startOfDay(agora))),
      semana: somaMs(list.filter((a) => a.inicio >= startOfWeek(agora))),
      mes: somaMs(list.filter((a) => a.inicio >= startOfMonth(agora))),
      total: somaMs(list),
      qtd: list.length,
    }),
    [list, agora]
  );

  // projetoNome/nomeColab/funcaoColab derivam de projetoMap/colabMap (já são deps).
  /* eslint-disable react-hooks/exhaustive-deps */
  const porProjeto = useMemo(() => agruparHoras(list, (a) => projetoNome(a.projetoId)), [list, projetoMap]);
  const porColab = useMemo(
    () => (isAdmin ? agruparHoras(list, (a) => nomeColab(a.colaboradorId)) : []),
    [list, isAdmin, colabMap]
  );
  const porFuncao = useMemo(
    () => (isAdmin ? agruparHoras(list, (a) => funcaoColab(a.colaboradorId)) : []),
    [list, isAdmin, colabMap]
  );
  /* eslint-enable react-hooks/exhaustive-deps */
  const serie = useMemo(() => serieDiaria(list, 14, agora), [list, agora]);

  const openPopup = (title, predicate) => setPopup({ title, list: list.filter(predicate) });

  const titulo = isAdmin ? 'Dashboard · Todos' : 'Meu Dashboard';

  if (loading) {
    return (
      <>
        <h1>{titulo}</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  return (
    <>
      <h1>{titulo}</h1>
      <p className="horas-sub">{isAdmin ? 'Horas de toda a equipe.' : 'Suas horas apontadas.'}</p>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      {/* Filtros: período (consulta ao banco) + projeto/colaborador (na tela) */}
      <div className="horas-card">
        <div className="horas-toolbar" style={{ marginBottom: 0 }}>
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label>De</label>
            <input type="date" value={range.de} onChange={(e) => setRange((r) => ({ ...r, de: e.target.value }))} />
          </div>
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label>Até</label>
            <input type="date" value={range.ate} onChange={(e) => setRange((r) => ({ ...r, ate: e.target.value }))} />
          </div>
          <div className="horas-fld" style={{ maxWidth: 220 }}>
            <label>Projeto</label>
            <select value={filtro.projeto} onChange={(e) => setFiltro((f) => ({ ...f, projeto: e.target.value }))}>
              <option value="">Todos</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          {isAdmin ? (
            <div className="horas-fld" style={{ maxWidth: 220 }}>
              <label>Colaborador</label>
              <select value={filtro.colab} onChange={(e) => setFiltro((f) => ({ ...f, colab: e.target.value }))}>
                <option value="">Todos</option>
                {colabs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <div className="horas-stats">
        <Stat k="Hoje" v={fmtHoras(stats.hoje)} />
        <Stat k="Esta semana" v={fmtHoras(stats.semana)} />
        <Stat k="Este mês" v={fmtHoras(stats.mes)} />
        <Stat k="No período" v={fmtHoras(stats.total)} />
        <Stat k="Apontamentos" v={stats.qtd} />
      </div>

      <div className="horas-g2">
        <div className="horas-card">
          <div className="horas-sec">Horas por projeto</div>
          <div className="horas-chart-wrap">
            <BrandPieChart
              data={porProjeto}
              onSelect={(n) => openPopup(`Projeto · ${n}`, (a) => projetoNome(a.projetoId) === n)}
            />
          </div>
        </div>
        <div className="horas-card">
          <div className="horas-sec">Evolução diária (14 dias)</div>
          <div className="horas-chart-wrap">
            <BrandLineChart
              data={serie}
              onSelect={(n) => {
                const dia = serie.find((d) => d.name === n);
                if (dia) openPopup(`Dia ${n}`, (a) => a.inicio >= dia.dayStart && a.inicio < dia.dayStart + 86400000);
              }}
            />
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="horas-g2">
          <div className="horas-card">
            <div className="horas-sec">Horas por colaborador</div>
            <div className="horas-chart-wrap">
              <BrandBarChart
                data={porColab}
                onSelect={(n) => openPopup(`Colaborador · ${n}`, (a) => nomeColab(a.colaboradorId) === n)}
              />
            </div>
          </div>
          <div className="horas-card">
            <div className="horas-sec">Horas por função</div>
            <div className="horas-chart-wrap">
              <BrandBarChart
                data={porFuncao}
                onSelect={(n) => openPopup(`Função · ${n}`, (a) => funcaoColab(a.colaboradorId) === n)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="horas-hint" style={{ marginTop: 18 }}>
        💡 Clique em qualquer fatia, ponto ou barra dos gráficos para ver os apontamentos.
      </div>

      {popup ? (
        <div className="horas-modal-bg" onClick={(e) => e.target === e.currentTarget && setPopup(null)}>
          <div className="horas-modal" style={{ width: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <h3 style={{ margin: 0 }}>{popup.title}</h3>
              <button className="horas-btn-icon" type="button" onClick={() => setPopup(null)} title="Fechar">
                ✕
              </button>
            </div>
            <p className="horas-sub" style={{ marginBottom: 12 }}>
              Total: <b>{fmtHoras(somaMs(popup.list))}</b> em {popup.list.length} apontamento(s).
            </p>
            <div className="horas-table-wrap" style={{ border: '1px solid var(--h-border)', borderRadius: 12 }}>
              <ApontamentosTable
                list={popup.list}
                projetoNome={projetoNome}
                projetoCor={projetoCor}
                nameOf={isAdmin ? nomeColab : undefined}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Stat({ k, v }) {
  return (
    <div className="horas-stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}
