import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchApontamentos,
  fetchProjetos,
  fetchColaboradores,
  fetchGerencias,
  fetchAtividades,
} from '../../lib/data';
import { agruparHoras, serieDiaria, somaMs } from '../../lib/aggregate';
import { fmtHoras, startOfDay, startOfWeek, startOfMonth, periodoPadrao, intervaloTs } from '../../lib/format';
import { escopo, isDiretoria, isGestor } from '../../lib/roles';
import { BrandBarChart, BrandLineChart, BrandPieChart } from '../components/Charts';
import ApontamentosTable from '../components/ApontamentosTable';

export default function DashboardPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const tipo = escopo(role); // meu | gerencia | geral
  const colaboradorId = user?.id;
  const gerenciaId = user?.horasGerenciaId || null;

  const [apont, setApont] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [gerencias, setGerencias] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [range, setRange] = useState(() => periodoPadrao(30));
  const [filtro, setFiltro] = useState({ gerencia: '', projeto: '', colab: '' });
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErro('');
      try {
        const { sinceTs, ateTs } = intervaloTs(range);
        const [a, ps, cs, gs] = await Promise.all([
          fetchApontamentos({ role, colaboradorId, gerenciaId, sinceTs, ateTs }),
          fetchProjetos({ incluirArquivados: true }),
          isGestor(role) ? fetchColaboradores() : Promise.resolve([]),
          fetchGerencias(),
        ]);
        if (cancel) return;
        setApont(a);
        setProjetos(ps);
        setColabs(cs);
        setGerencias(gs);
      } catch (e) {
        if (!cancel) setErro(e?.message || 'Falha ao carregar o dashboard.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [role, colaboradorId, gerenciaId, range]);

  // Rótulos das atividades: da gerência do usuário, ou da gerência filtrada
  // (a diretoria não tem gerência própria, então só há rótulo quando ela filtra).
  const gerenciaRotulos = isDiretoria(role) ? filtro.gerencia : gerenciaId;
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!gerenciaRotulos) {
        setAtividades([]);
        return;
      }
      try {
        const ats = await fetchAtividades(gerenciaRotulos);
        if (!cancel) setAtividades(ats);
      } catch {
        if (!cancel) setAtividades([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [gerenciaRotulos]);

  const projetoMap = useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos]);
  const projetoNome = (id) => projetoMap.get(id)?.nome || '—';
  const projetoCor = (id) => projetoMap.get(id)?.cor || '#C44A28';
  const colabMap = useMemo(() => new Map(colabs.map((c) => [c.id, c])), [colabs]);
  const nomeColab = (id) => colabMap.get(id)?.nome || '—';
  const funcaoColab = (id) => colabMap.get(id)?.funcao || '—';
  const gerMap = useMemo(() => new Map(gerencias.map((g) => [g.id, g.nome])), [gerencias]);
  const nomeGerencia = (id) => gerMap.get(id) || '—';

  // O filtro só oferece projetos que aparecem nos apontamentos do escopo — um
  // gerente não deve ver a lista de projetos das outras gerências.
  const projetosEscopo = useMemo(() => {
    const usados = new Set(apont.map((a) => a.projetoId));
    return projetos.filter((p) => usados.has(p.id));
  }, [apont, projetos]);

  // Só as atividades já configuradas (com opções) entram nos gráficos.
  const ativsUsadas = useMemo(() => atividades.filter((a) => a.valores.length), [atividades]);
  const ativA = ativsUsadas[0] || null; // gráfico próprio
  // Quebra do "Meu Dashboard": a SEGUNDA atividade. Sem fallback para a primeira,
  // senão o mesmo dado apareceria em dois gráficos.
  const ativB = ativsUsadas[1] || null;

  const list = useMemo(() => {
    let l = apont;
    if (isDiretoria(role) && filtro.gerencia) l = l.filter((a) => a.gerenciaId === filtro.gerencia);
    if (filtro.projeto) l = l.filter((a) => a.projetoId === filtro.projeto);
    if (isGestor(role) && filtro.colab) l = l.filter((a) => a.colaboradorId === filtro.colab);
    return l;
  }, [apont, filtro, role]);

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

  // Quarta quebra, como no protótipo:
  //   geral sem filtro de gerência -> por gerência;  geral com filtro -> por colaborador
  //   gerencia                     -> por colaborador
  //   meu                          -> pela 2ª atividade controlada
  const breakSpec = useMemo(() => {
    if (tipo === 'geral' && !filtro.gerencia) {
      return { titulo: 'Horas por gerência', key: (a) => nomeGerencia(a.gerenciaId), tipoGrafico: 'bar' };
    }
    if (tipo === 'geral' || tipo === 'gerencia') {
      return { titulo: 'Horas por colaborador', key: (a) => nomeColab(a.colaboradorId), tipoGrafico: 'bar' };
    }
    if (!ativB) return null; // nenhuma atividade configurada ainda
    return {
      titulo: `Distribuição por ${ativB.label.toLowerCase()}`,
      key: (a) => a.ativ?.[ativB.ordem],
      tipoGrafico: 'pie',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nomeGerencia/nomeColab derivam de gerMap/colabMap
  }, [tipo, filtro.gerencia, gerMap, colabMap, ativB]);

  /* eslint-disable react-hooks/exhaustive-deps -- projetoNome deriva de projetoMap (já é dep) */
  const porProjeto = useMemo(() => agruparHoras(list, (a) => projetoNome(a.projetoId)), [list, projetoMap]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const porAtivA = useMemo(() => (ativA ? agruparHoras(list, (a) => a.ativ?.[ativA.ordem]) : []), [list, ativA]);
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- funcaoColab deriva de colabMap (já é dep) */
  const porFuncao = useMemo(() => (isGestor(role) ? agruparHoras(list, (a) => funcaoColab(a.colaboradorId)) : []), [list, role, colabMap]);
  const porBreak = useMemo(() => (breakSpec ? agruparHoras(list, breakSpec.key) : []), [list, breakSpec]);
  const serie = useMemo(() => serieDiaria(list, 14, agora), [list, agora]);

  const openPopup = (title, predicate) => setPopup({ title, list: list.filter(predicate) });

  const mostraColaborador = tipo !== 'meu';

  const titulo =
    tipo === 'geral' ? 'Dashboard Geral · Diretoria' : tipo === 'gerencia' ? 'Dashboard da Gerência' : 'Meu Dashboard';
  let subt =
    tipo === 'geral'
      ? 'Consolidado de todas as gerências.'
      : tipo === 'gerencia'
        ? `Visão da equipe — ${nomeGerencia(gerenciaId)}`
        : 'Suas horas apontadas.';
  if (filtro.gerencia) subt += ` · ${nomeGerencia(filtro.gerencia)}`;
  if (filtro.colab) subt += ` · ${nomeColab(filtro.colab)}`;

  if (loading) {
    return (
      <>
        <h1>{titulo}</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  // Colaboradores oferecidos no filtro: só os da gerência escolhida, quando houver.
  const colabsFiltro = colabs.filter(
    (c) => c.role !== 'diretoria' && c.gerenciaId && (!filtro.gerencia || c.gerenciaId === filtro.gerencia)
  );

  // Os gráficos que este papel/gerência tem hoje. Os condicionais entram na
  // lista só quando existem, para o grid não ficar com buracos.
  const graficos = [
    {
      id: 'projeto',
      titulo: 'Horas por projeto',
      chart: (
        <BrandPieChart
          data={porProjeto}
          onSelect={(n) => openPopup(`Projeto · ${n}`, (a) => projetoNome(a.projetoId) === n)}
        />
      ),
    },
  ];

  // Só existe quando a gerência já configurou uma atividade controlada.
  if (ativA) {
    graficos.push({
      id: 'ativA',
      titulo: `Horas por ${ativA.label.toLowerCase()}`,
      chart: (
        <BrandBarChart
          data={porAtivA}
          onSelect={(n) => openPopup(`${ativA.label} · ${n}`, (a) => (a.ativ?.[ativA.ordem] || '—') === n)}
        />
      ),
    });
  }

  graficos.push({
    id: 'evolucao',
    titulo: 'Evolução diária (14 dias)',
    chart: (
      <BrandLineChart
        data={serie}
        onSelect={(n) => {
          const dia = serie.find((d) => d.name === n);
          if (dia) openPopup(`Dia ${n}`, (a) => a.inicio >= dia.dayStart && a.inicio < dia.dayStart + 86400000);
        }}
      />
    ),
  });

  if (breakSpec) {
    const Grafico = breakSpec.tipoGrafico === 'pie' ? BrandPieChart : BrandBarChart;
    graficos.push({
      id: 'break',
      titulo: breakSpec.titulo,
      chart: (
        <Grafico
          data={porBreak}
          onSelect={(n) => openPopup(`${breakSpec.titulo} · ${n}`, (a) => (breakSpec.key(a) || '—') === n)}
        />
      ),
    });
  }

  // Quebra por função do colaborador — específica do portal (não vem do protótipo).
  if (isGestor(role)) {
    graficos.push({
      id: 'funcao',
      titulo: 'Horas por função',
      chart: (
        <BrandBarChart
          data={porFuncao}
          onSelect={(n) => openPopup(`Função · ${n}`, (a) => funcaoColab(a.colaboradorId) === n)}
        />
      ),
    });
  }

  return (
    <>
      <h1>{titulo}</h1>
      <p className="horas-sub">{subt}</p>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      {/* Filtros: período (consulta ao banco) + gerência/projeto/colaborador (na tela) */}
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
          {isDiretoria(role) ? (
            <div className="horas-fld" style={{ maxWidth: 220 }}>
              <label>Gerência</label>
              <select
                value={filtro.gerencia}
                onChange={(e) => setFiltro((f) => ({ ...f, gerencia: e.target.value, colab: '' }))}
              >
                <option value="">Todas as gerências</option>
                {gerencias.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="horas-fld" style={{ maxWidth: 220 }}>
            <label>Projeto</label>
            <select value={filtro.projeto} onChange={(e) => setFiltro((f) => ({ ...f, projeto: e.target.value }))}>
              <option value="">Todos</option>
              {projetosEscopo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          {isGestor(role) ? (
            <div className="horas-fld" style={{ maxWidth: 220 }}>
              <label>Colaborador</label>
              <select value={filtro.colab} onChange={(e) => setFiltro((f) => ({ ...f, colab: e.target.value }))}>
                <option value="">{tipo === 'gerencia' ? 'Toda a equipe' : 'Todos'}</option>
                {colabsFiltro.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="horas-spacer" />
          {filtro.gerencia || filtro.projeto || filtro.colab ? (
            <button
              className="horas-btn2"
              type="button"
              onClick={() => setFiltro({ gerencia: '', projeto: '', colab: '' })}
            >
              Limpar filtros
            </button>
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

      {/* Grid único: os cards existentes ficam lado a lado. Quando o total é
          ímpar, o último ocupa a linha inteira em vez de deixar meia coluna vazia. */}
      <div className="horas-g2">
        {graficos.map((g, i) => (
          <div
            className="horas-card"
            key={g.id}
            style={graficos.length % 2 === 1 && i === graficos.length - 1 ? { gridColumn: '1 / -1' } : undefined}
          >
            <div className="horas-sec">{g.titulo}</div>
            <div className="horas-chart-wrap">{g.chart}</div>
          </div>
        ))}
      </div>

      <div className="horas-hint" style={{ marginTop: 18 }}>
        💡 Clique em qualquer fatia, ponto ou barra dos gráficos para ver os apontamentos.
      </div>

      {popup ? (
        <div className="horas-modal-bg" onClick={(e) => e.target === e.currentTarget && setPopup(null)}>
          <div className="horas-modal" style={{ width: 720 }}>
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
                nameOf={mostraColaborador ? nomeColab : undefined}
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
