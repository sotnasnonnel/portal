import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchApontamentos,
  fetchProjetos,
  fetchColaboradores,
  fetchGerencias,
  fetchCamposEquipe,
  createApontamento,
  updateApontamento,
  deleteApontamento,
} from '../../lib/data';
import { fmtHoras, periodoPadrao, intervaloTs } from '../../lib/format';
import { isGestao } from '../../lib/roles';
import { lookupProjetos, lookupColaboradores, lookupGerencias, gerentesDoEscopo } from '../../lib/lookups';
import { labelsUsados, valorDoCampo } from '../../lib/camposEquipe';
import ApontamentosTable from '../components/ApontamentosTable';
import ApontamentoModal from '../components/ApontamentoModal';
import ConfirmModal from '../components/ConfirmModal';
import SearchableSelect from '../components/SearchableSelect';
import Aviso, { AvisoTemporario, Carregando } from '../components/Aviso';

export default function RegistrosPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const colaboradorId = user?.id;

  const [list, setList] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [gerencias, setGerencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [range, setRange] = useState(() => periodoPadrao(30));
  const [filtro, setFiltro] = useState({ projeto: '', gerente: '', colab: '' });
  const [aEditar, setAEditar] = useState(null); // { apont, campos }
  const [aDuplicar, setADuplicar] = useState(null); // { apont, campos }
  const [aExcluir, setAExcluir] = useState(null);
  const [ok, setOk] = useState(''); // confirmação flutuante da última ação

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!colaboradorId) return;
      setLoading(true);
      setErro('');
      try {
        const { sinceTs, ateTs } = intervaloTs(range);
        const [a, ps, cs, gs] = await Promise.all([
          fetchApontamentos({ role, colaboradorId, sinceTs, ateTs }),
          fetchProjetos({ incluirArquivados: true }),
          isGestao(role) ? fetchColaboradores() : Promise.resolve([]),
          fetchGerencias(),
        ]);
        if (cancel) return;
        setList(a);
        setProjetos(ps);
        setColabs(cs);
        setGerencias(gs);
      } catch (e) {
        if (!cancel) setErro(e?.message || 'Falha ao carregar registros.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [role, colaboradorId, range]);

  const proj = useMemo(() => lookupProjetos(projetos), [projetos]);
  const colab = useMemo(() => lookupColaboradores(colabs), [colabs]);
  const ger = useMemo(() => lookupGerencias(gerencias), [gerencias]);

  // Só oferece o que existe nos registros do escopo (protótipo faz o mesmo).
  const projetosEscopo = useMemo(() => proj.usadosEm(list), [proj, list]);

  // Filtro por gerente: a equipe considerada é a ATUAL do colaborador.
  const gerentes = useMemo(() => gerentesDoEscopo(gerencias, colabs), [gerencias, colabs]);
  const gerenteAtual = gerentes.some((g) => g.value === filtro.gerente) ? filtro.gerente : '';
  const colabsDoGerente = useMemo(
    () => (gerenteAtual ? new Set(colabs.filter((c) => c.gerenciaId === gerenteAtual).map((c) => c.id)) : null),
    [colabs, gerenteAtual]
  );
  const colabsEscopo = useMemo(
    () => colab.usadosEm(list).filter((c) => !colabsDoGerente || colabsDoGerente.has(c.id)),
    [colab, list, colabsDoGerente]
  );

  const filtrado = useMemo(() => {
    let f = list;
    if (filtro.projeto) f = f.filter((a) => a.projetoId === filtro.projeto);
    if (isGestao(role) && colabsDoGerente) f = f.filter((a) => colabsDoGerente.has(a.colaboradorId));
    if (isGestao(role) && filtro.colab) f = f.filter((a) => a.colaboradorId === filtro.colab);
    return f;
  }, [list, filtro, role, colabsDoGerente]);

  const total = filtrado.reduce((s, a) => s + a.duracao, 0);
  const mostraColaborador = isGestao(role);

  // Espelha a RLS: o próprio, ou a subárvore (gestão). Vale para editar e para
  // excluir (as duas policies são a mesma regra). Se tentar mexer em algo fora
  // da subárvore, a RLS bloqueia — o botão só facilita o caminho feliz.
  const podeAlterar = (a) => isGestao(role) || a.colaboradorId === colaboradorId;

  // Os campos do formulário são os da equipe de QUEM fez o apontamento, não os
  // de quem está editando — um gestor corrige registro de gente de outra equipe.
  async function abrirEdicao(a) {
    setErro('');
    try {
      const gerenciaDaPessoa =
        a.colaboradorId === colaboradorId
          ? user?.horasGerenciaId
          : colabs.find((c) => c.id === a.colaboradorId)?.gerenciaId;
      setAEditar({ apont: a, campos: await fetchCamposEquipe(gerenciaDaPessoa) });
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar os campos da equipe.');
    }
  }

  // Duplicar é um lançamento manual pré-preenchido: sempre em nome de quem está
  // logado e com os campos da PRÓPRIA equipe, por isso só aparece nos próprios.
  async function abrirDuplicacao(a) {
    setErro('');
    try {
      setADuplicar({ apont: a, campos: await fetchCamposEquipe(user?.horasGerenciaId) });
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar os campos da equipe.');
    }
  }

  async function salvarDuplicacao(payload) {
    const novo = await createApontamento({
      ...payload,
      colaboradorId,
      gerenciaId: projetos.find((p) => p.id === payload.projetoId)?.gerencia_id || aDuplicar.apont.gerenciaId,
    });
    setADuplicar(null);
    setList((prev) => [novo, ...prev].sort((x, y) => y.inicio - x.inicio));
    setOk('Apontamento duplicado.');
  }

  async function salvarEdicao(payload) {
    const atualizado = await updateApontamento(aEditar.apont.id, {
      ...payload,
      // Mesma regra do apontamento: a gerência é a DONA do projeto escolhido.
      gerenciaId:
        projetos.find((p) => p.id === payload.projetoId)?.gerencia_id || aEditar.apont.gerenciaId,
    });
    setAEditar(null);
    setList((prev) => prev.map((x) => (x.id === atualizado.id ? atualizado : x)));
    setOk('Apontamento atualizado.');
  }

  async function confirmarExclusao() {
    const a = aExcluir;
    setAExcluir(null);
    if (!a) return;
    try {
      await deleteApontamento(a.id);
      setList((prev) => prev.filter((x) => x.id !== a.id));
      setOk('Apontamento excluído.');
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir.');
    }
  }

  function exportarCSV() {
    // Uma coluna por campo que APARECE nos registros exportados: cada equipe
    // configura os seus, e a listagem de um gestor pode misturar mais de uma.
    const labels = labelsUsados(filtrado);
    const head = [
      ...(mostraColaborador ? ['Colaborador'] : []),
      'Gerencia',
      'Projeto',
      ...labels,
      'Inicio',
      'Fim',
      'Duracao(h)',
      'Descricao',
    ];
    const rows = filtrado.map((a) => [
      ...(mostraColaborador ? [colab.nome(a.colaboradorId)] : []),
      ger.nome(a.gerenciaId),
      proj.nome(a.projetoId),
      ...labels.map((l) => valorDoCampo(a, l)),
      new Date(a.inicio).toLocaleString('pt-BR'),
      new Date(a.fim).toLocaleString('pt-BR'),
      (a.duracao / 3600000).toFixed(2).replace('.', ','),
      (a.descricao || '').replace(/[\n;]/g, ' '),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'apontamentos.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <h1>{mostraColaborador ? 'Registros' : 'Meus Registros'}</h1>
      <p className="horas-sub" aria-live="polite">
        {loading ? (
          'Carregando o período…'
        ) : (
          <>
            Total no período: <b>{fmtHoras(total)}</b> em {filtrado.length} apontamento(s).
          </>
        )}
      </p>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <div className="horas-card">
        <div className="horas-toolbar">
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label htmlFor="horas-reg-de">De</label>
            <input id="horas-reg-de" type="date" value={range.de} onChange={(e) => setRange((r) => ({ ...r, de: e.target.value }))} />
          </div>
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label htmlFor="horas-reg-ate">Até</label>
            <input id="horas-reg-ate" type="date" value={range.ate} onChange={(e) => setRange((r) => ({ ...r, ate: e.target.value }))} />
          </div>
          <div className="horas-fld" style={{ maxWidth: 340, flex: '1 1 260px' }}>
            <label htmlFor="horas-reg-projeto">Projeto</label>
            <SearchableSelect
              id="horas-reg-projeto"
              value={filtro.projeto}
              placeholder="Todos"
              onChange={(v) => setFiltro((f) => ({ ...f, projeto: v }))}
              options={[{ value: '', label: 'Todos' }, ...projetosEscopo.map((p) => ({ value: p.id, label: p.nome }))]}
            />
          </div>
          {mostraColaborador && gerentes.length > 1 ? (
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
          {mostraColaborador ? (
            <div className="horas-fld" style={{ maxWidth: 200 }}>
              <label htmlFor="horas-reg-colab">Colaborador</label>
              <select id="horas-reg-colab" value={filtro.colab} onChange={(e) => setFiltro((f) => ({ ...f, colab: e.target.value }))}>
                <option value="">Todos</option>
                {colabsEscopo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="horas-spacer" />
          <button className="horas-btn2" type="button" onClick={exportarCSV} disabled={!filtrado.length}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* horas-table-scroll: a tabela rola dentro do cartão, com cabeçalho e
          total fixos, em vez de empurrar a página inteira para baixo. */}
      <div
        className="horas-card horas-table-wrap horas-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Apontamentos do período"
      >
        {loading ? (
          <Carregando />
        ) : (
          <ApontamentosTable
            rodape
            vazio="Nenhum apontamento no período e nos filtros escolhidos."
            list={filtrado}
            projetoNome={proj.nome}
            projetoCor={proj.cor}
            nameOf={mostraColaborador ? colab.nome : undefined}
            onEdit={abrirEdicao}
            onDelete={setAExcluir}
            podeAlterar={podeAlterar}
            onDuplicate={abrirDuplicacao}
            podeDuplicar={(a) => a.colaboradorId === colaboradorId}
          />
        )}
      </div>

      {aEditar ? (
        <ApontamentoModal
          projetos={projetos}
          campos={aEditar.campos}
          inicial={aEditar.apont}
          onClose={() => setAEditar(null)}
          onSave={salvarEdicao}
        />
      ) : null}

      {aDuplicar ? (
        <ApontamentoModal
          projetos={projetos}
          campos={aDuplicar.campos}
          modelo={aDuplicar.apont}
          onClose={() => setADuplicar(null)}
          onSave={salvarDuplicacao}
        />
      ) : null}

      <ConfirmModal
        open={!!aExcluir}
        title="Excluir apontamento"
        message="Tem certeza que deseja excluir este apontamento? Esta ação não pode ser desfeita."
        onConfirm={confirmarExclusao}
        onCancel={() => setAExcluir(null)}
      />

      <AvisoTemporario msg={ok} onFim={() => setOk('')} />
    </>
  );
}
