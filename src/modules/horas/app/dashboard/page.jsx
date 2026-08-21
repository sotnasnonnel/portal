import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { fetchApontamentos, fetchProjetos, fetchColaboradores } from '../../lib/data';
import { agruparHoras, serieDiaria, somaMs } from '../../lib/aggregate';
import { fmtHoras, startOfDay, startOfWeek, startOfMonth, periodoPadrao, intervaloTs } from '../../lib/format';
import { escopo, isGestao } from '../../lib/roles';
import { lookupProjetos, lookupColaboradores } from '../../lib/lookups';
import { labelsUsados, valorDoCampo } from '../../lib/camposEquipe';
import { BrandBarChart, BrandLineChart, BrandPieChart } from '../components/Charts';
import ApontamentosTable from '../components/ApontamentosTable';
import SearchableSelect from '../components/SearchableSelect';

export default function DashboardPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const tipo = escopo(role); // meu | equipe
  const colaboradorId = user?.id;
  const gerenciaId = user?.horasGerenciaId || null;

  const [apont, setApont] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [range, setRange] = useState(() => periodoPadrao(30));
  const [filtro, setFiltro] = useState({ projeto: '', colab: '' });
  const [quebra, setQuebra] = useState(''); // campo do apontamento escolhido
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
          isGestao(role) ? fetchColaboradores() : Promise.resolve([]),
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
  }, [role, colaboradorId, gerenciaId, range]);

  const proj = useMemo(() => lookupProjetos(projetos), [projetos]);
  const colab = useMemo(() => lookupColaboradores(colabs), [colabs]);

  // O filtro só oferece projetos que aparecem nos apontamentos do escopo.
  const projetosEscopo = useMemo(() => proj.usadosEm(apont), [proj, apont]);

  const list = useMemo(() => {
    let l = apont;
    if (filtro.projeto) l = l.filter((a) => a.projetoId === filtro.projeto);
    if (isGestao(role) && filtro.colab) l = l.filter((a) => a.colaboradorId === filtro.colab);
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

  // Quarta quebra: só na visão de equipe (por colaborador). Na visão "meu" o
  // gráfico do campo escolhido já dá o recorte de tipo de trabalho.
  const breakSpec = useMemo(
    () =>
      tipo === 'equipe'
        ? { titulo: 'Horas por colaborador', key: (a) => colab.nome(a.colaboradorId), tipoGrafico: 'bar' }
        : null,
    [tipo, colab]
  );

  // Campos disponíveis para a quebra: os que APARECEM nos apontamentos do
  // período (não a configuração atual da equipe) — assim o histórico do catálogo
  // antigo e as várias equipes de um gestor continuam rendendo gráfico.
  const labelsDisponiveis = useMemo(() => labelsUsados(apont), [apont]);
  const quebraAtual = labelsDisponiveis.includes(quebra) ? quebra : labelsDisponiveis[0] || '';

  const porProjeto = useMemo(() => agruparHoras(list, (a) => proj.nome(a.projetoId)), [list, proj]);
  const porCampo = useMemo(
    () => (quebraAtual ? agruparHoras(list, (a) => valorDoCampo(a, quebraAtual)) : []),
    [list, quebraAtual]
  );
  const porFuncao = useMemo(
    () => (isGestao(role) ? agruparHoras(list, (a) => colab.funcao(a.colaboradorId)) : []),
    [list, role, colab]
  );
  const porBreak = useMemo(() => (breakSpec ? agruparHoras(list, breakSpec.key) : []), [list, breakSpec]);
  const serie = useMemo(() => serieDiaria(list, 14, agora), [list, agora]);

  const openPopup = (title, predicate) => setPopup({ title, list: list.filter(predicate) });

  const mostraColaborador = tipo !== 'meu';

  // Exporta o que está na tela: os apontamentos já filtrados (detalhe) e o
  // resumo de cada gráfico. Import dinâmico do xlsx igual aos outros módulos.
  async function exportarXLSX() {
    const { utils, writeFile } = await import('xlsx');

    // Uma coluna por campo presente nos apontamentos exportados.
    const labels = labelsUsados(list);
    const detalhe = list.map((a) => ({
      ...(mostraColaborador ? { Colaborador: colab.nome(a.colaboradorId) || '—' } : {}),
      ...(mostraColaborador ? { Função: colab.funcao(a.colaboradorId) || '—' } : {}),
      Projeto: proj.nome(a.projetoId) || '—',
      ...Object.fromEntries(labels.map((l) => [l, valorDoCampo(a, l)])),
      Início: new Date(a.inicio).toLocaleString('pt-BR'),
      Fim: new Date(a.fim).toLocaleString('pt-BR'),
      'Duração (h)': Number((a.duracao / 3600000).toFixed(2)),
      Descrição: a.descricao || '',
    }));

    // Uma linha por grupo, com a mesma quebra dos gráficos.
    const resumo = [];
    const addResumo = (quebra, dados) =>
      dados.forEach((d) =>
        resumo.push({ Quebra: quebra, Item: d.name, 'Duração (h)': Number((d.ms / 3600000).toFixed(2)) })
      );
    addResumo('Projeto', porProjeto);
    if (quebraAtual) addResumo(quebraAtual, porCampo);
    if (breakSpec) addResumo(breakSpec.titulo, porBreak);
    if (isGestao(role)) addResumo('Função', porFuncao);

    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(detalhe), 'Apontamentos');
    utils.book_append_sheet(wb, utils.json_to_sheet(resumo), 'Resumo');
    writeFile(wb, `horas_${range.de}_a_${range.ate}.xlsx`);
  }

  const titulo = tipo === 'equipe' ? 'Dashboard da Equipe' : 'Meu Dashboard';
  let subt = tipo === 'equipe' ? 'Horas apontadas pela sua equipe.' : 'Suas horas apontadas.';
  if (filtro.colab) subt += ` · ${colab.nome(filtro.colab)}`;

  if (loading) {
    return (
      <>
        <h1>{titulo}</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  // Colaboradores oferecidos no filtro: a equipe (subárvore) que a RPC devolveu.
  const colabsFiltro = colabs;

  // Os gráficos que este papel/gerência tem hoje. Os condicionais entram na
  // lista só quando existem, para o grid não ficar com buracos.
  const graficos = [
    {
      id: 'projeto',
      titulo: 'Horas por projeto',
      chart: (
        <BrandPieChart
          data={porProjeto}
          onSelect={(n) => openPopup(`Projeto · ${n}`, (a) => proj.nome(a.projetoId) === n)}
        />
      ),
    },
  ];

  // Quebra pelos campos do apontamento. Como cada equipe monta os seus, o campo
  // é escolhido aqui em vez de fixo — e o seletor só aparece quando há mais de
  // um para escolher.
  if (quebraAtual) {
    graficos.push({
      id: 'campo',
      titulo: `Horas por ${quebraAtual.toLowerCase()}`,
      acao:
        labelsDisponiveis.length > 1 ? (
          <select
            value={quebraAtual}
            onChange={(e) => setQuebra(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            {labelsDisponiveis.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        ) : null,
      chart: (
        <BrandBarChart
          data={porCampo}
          onSelect={(n) =>
            openPopup(`${quebraAtual} · ${n}`, (a) => (valorDoCampo(a, quebraAtual) || '—') === n)
          }
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
  if (isGestao(role)) {
    graficos.push({
      id: 'funcao',
      titulo: 'Horas por função',
      chart: (
        <BrandBarChart
          data={porFuncao}
          onSelect={(n) => openPopup(`Função · ${n}`, (a) => colab.funcao(a.colaboradorId) === n)}
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
          <div className="horas-fld" style={{ maxWidth: 340, flex: '1 1 260px' }}>
            <label>Projeto</label>
            <SearchableSelect
              value={filtro.projeto}
              placeholder="Todos"
              onChange={(v) => setFiltro((f) => ({ ...f, projeto: v }))}
              options={[{ value: '', label: 'Todos' }, ...projetosEscopo.map((p) => ({ value: p.id, label: p.nome }))]}
            />
          </div>
          {isGestao(role) ? (
            <div className="horas-fld" style={{ maxWidth: 220 }}>
              <label>Colaborador</label>
              <select value={filtro.colab} onChange={(e) => setFiltro((f) => ({ ...f, colab: e.target.value }))}>
                <option value="">Toda a equipe</option>
                {colabsFiltro.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="horas-spacer" />
          {filtro.projeto || filtro.colab ? (
            <button
              className="horas-btn2"
              type="button"
              onClick={() => setFiltro({ projeto: '', colab: '' })}
            >
              Limpar filtros
            </button>
          ) : null}
          <button className="horas-btn2" type="button" onClick={exportarXLSX} disabled={!list.length}>
            <FileSpreadsheet size={16} color="#1D6F42" /> Exportar Excel
          </button>
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
            {g.acao ? (
              <div className="horas-campo-topo">
                <div className="horas-sec" style={{ margin: 0 }}>
                  {g.titulo}
                </div>
                {g.acao}
              </div>
            ) : (
              <div className="horas-sec">{g.titulo}</div>
            )}
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
                projetoNome={proj.nome}
                projetoCor={proj.cor}
                nameOf={mostraColaborador ? colab.nome : undefined}
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
