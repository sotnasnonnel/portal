import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, MousePointerClick } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { fetchApontamentos, fetchProjetos, fetchColaboradores, fetchGerencias } from '../../lib/data';
import { agruparHoras, serieDiaria, somaMs } from '../../lib/aggregate';
import { fmtHoras, startOfDay, startOfWeek, startOfMonth, periodoPadrao, intervaloTs } from '../../lib/format';
import { escopo, isGestao } from '../../lib/roles';
import { lookupProjetos, lookupColaboradores, gerentesDoEscopo } from '../../lib/lookups';
import { labelsUsados, valorDoCampo } from '../../lib/camposEquipe';
import { BrandBarChart, BrandLineChart, BrandPieChart } from '../components/Charts';
import ApontamentosTable from '../components/ApontamentosTable';
import Modal from '../components/Modal';
import Aviso, { Carregando } from '../components/Aviso';
import SearchableSelect from '../components/SearchableSelect';
import AusenciasProximaSemana from '../components/AusenciasProximaSemana';

export default function DashboardPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const tipo = escopo(role); // meu | equipe
  const colaboradorId = user?.id;
  const gerenciaId = user?.horasGerenciaId || null;

  const [apont, setApont] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [gerencias, setGerencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [range, setRange] = useState(() => periodoPadrao(30));
  const [filtro, setFiltro] = useState({ projeto: '', gerente: '', colab: '' });
  const [quebra, setQuebra] = useState(''); // campo do apontamento escolhido
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErro('');
      try {
        const { sinceTs, ateTs } = intervaloTs(range);
        const [a, ps, cs, gs] = await Promise.all([
          fetchApontamentos({ role, colaboradorId, sinceTs, ateTs }),
          fetchProjetos({ incluirArquivados: true }),
          isGestao(role) ? fetchColaboradores() : Promise.resolve([]),
          isGestao(role) ? fetchGerencias() : Promise.resolve([]),
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

  const proj = useMemo(() => lookupProjetos(projetos), [projetos]);
  const colab = useMemo(() => lookupColaboradores(colabs), [colabs]);

  // O filtro só oferece projetos que aparecem nos apontamentos do escopo.
  const projetosEscopo = useMemo(() => proj.usadosEm(apont), [proj, apont]);

  // Filtro por gerente: a equipe considerada é a ATUAL do colaborador.
  const gerentes = useMemo(() => gerentesDoEscopo(gerencias, colabs), [gerencias, colabs]);
  const gerenteAtual = gerentes.some((g) => g.value === filtro.gerente) ? filtro.gerente : '';
  const colabsDoGerente = useMemo(
    () => (gerenteAtual ? new Set(colabs.filter((c) => c.gerenciaId === gerenteAtual).map((c) => c.id)) : null),
    [colabs, gerenteAtual]
  );

  const list = useMemo(() => {
    let l = apont;
    if (filtro.projeto) l = l.filter((a) => a.projetoId === filtro.projeto);
    if (isGestao(role) && colabsDoGerente) l = l.filter((a) => colabsDoGerente.has(a.colaboradorId));
    if (isGestao(role) && filtro.colab) l = l.filter((a) => a.colaboradorId === filtro.colab);
    return l;
  }, [apont, filtro, role, colabsDoGerente]);

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
  if (gerenteAtual) subt += ` · Gerente: ${gerentes.find((g) => g.value === gerenteAtual)?.label}`;
  if (filtro.colab) subt += ` · ${colab.nome(filtro.colab)}`;

  if (loading) {
    return (
      <>
        <h1>{titulo}</h1>
        <Carregando />
      </>
    );
  }

  // Colaboradores oferecidos no filtro: a equipe (subárvore) que a RPC devolveu,
  // restrita ao gerente escolhido.
  const colabsFiltro = colabsDoGerente ? colabs.filter((c) => colabsDoGerente.has(c.id)) : colabs;

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
            aria-label="Campo do apontamento usado no gráfico"
            className="horas-inline-select"
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

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {/* Filtros: período (consulta ao banco) + gerência/projeto/colaborador (na tela) */}
      <div className="horas-card">
        <div className="horas-toolbar" style={{ marginBottom: 0 }}>
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label htmlFor="horas-dash-de">De</label>
            <input id="horas-dash-de" type="date" value={range.de} onChange={(e) => setRange((r) => ({ ...r, de: e.target.value }))} />
          </div>
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label htmlFor="horas-dash-ate">Até</label>
            <input id="horas-dash-ate" type="date" value={range.ate} onChange={(e) => setRange((r) => ({ ...r, ate: e.target.value }))} />
          </div>
          <div className="horas-fld" style={{ maxWidth: 340, flex: '1 1 260px' }}>
            <label htmlFor="horas-dash-projeto">Projeto</label>
            <SearchableSelect
              id="horas-dash-projeto"
              value={filtro.projeto}
              placeholder="Todos"
              onChange={(v) => setFiltro((f) => ({ ...f, projeto: v }))}
              options={[{ value: '', label: 'Todos' }, ...projetosEscopo.map((p) => ({ value: p.id, label: p.nome }))]}
            />
          </div>
          {isGestao(role) && gerentes.length > 1 ? (
            <div className="horas-fld" style={{ maxWidth: 280, flex: '1 1 220px' }}>
              <label>Gerente</label>
              <SearchableSelect
                value={gerenteAtual}
                placeholder="Todos"
                onChange={(v) =>
                  setFiltro((f) => {
                    const c = colabs.find((x) => x.id === f.colab);
                    // Troca de gerente limpa o colaborador que não é da equipe nova.
                    const manterColab = !v || (c && c.gerenciaId === v);
                    return { ...f, gerente: v, colab: manterColab ? f.colab : '' };
                  })
                }
                options={[{ value: '', label: 'Todos' }, ...gerentes]}
              />
            </div>
          ) : null}
          {isGestao(role) ? (
            <div className="horas-fld" style={{ maxWidth: 220 }}>
              <label htmlFor="horas-dash-colab">Colaborador</label>
              <select id="horas-dash-colab" value={filtro.colab} onChange={(e) => setFiltro((f) => ({ ...f, colab: e.target.value }))}>
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
          {filtro.projeto || gerenteAtual || filtro.colab ? (
            <button
              className="horas-btn2"
              type="button"
              onClick={() => setFiltro({ projeto: '', gerente: '', colab: '' })}
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

      {/* Veio do Dashboard do gestor em Gestão de Pessoas. Só na visão de equipe. */}
      {tipo === 'equipe' ? <AusenciasProximaSemana /> : null}

      {/* A dica vem ANTES dos gráficos: no rodapé, ninguém a lia antes de clicar. */}
      <p className="horas-nota">
        <MousePointerClick size={14} aria-hidden="true" />
        Clique numa fatia, ponto ou barra para ver os apontamentos por trás do número.
      </p>

      {/* Grid único: os cards existentes ficam lado a lado. Quando o total é
          ímpar, o último ocupa a linha inteira em vez de deixar meia coluna vazia. */}
      <div className="horas-g2">
        {graficos.map((g, i) => (
          <section
            className="horas-card"
            key={g.id}
            aria-labelledby={`horas-graf-${g.id}`}
            style={graficos.length % 2 === 1 && i === graficos.length - 1 ? { gridColumn: '1 / -1' } : undefined}
          >
            <div className="horas-card-topo">
              <h2 className="horas-sec" id={`horas-graf-${g.id}`}>
                {g.titulo}
              </h2>
              {g.acao}
            </div>
            <div className="horas-chart-wrap">{g.chart}</div>
          </section>
        ))}
      </div>

      {popup ? (
        <Modal titulo={popup.title} onClose={() => setPopup(null)} fechar className="horas-modal-lg">
          <p className="horas-modal-msg">
            Total: <b>{fmtHoras(somaMs(popup.list))}</b> em {popup.list.length} apontamento(s).
          </p>
          <div
            className="horas-table-wrap"
            style={{ border: '1px solid var(--h-border)', borderRadius: 'var(--h-radius-lg)' }}
          >
            <ApontamentosTable
              list={popup.list}
              projetoNome={proj.nome}
              projetoCor={proj.cor}
              nameOf={mostraColaborador ? colab.nome : undefined}
            />
          </div>
        </Modal>
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
