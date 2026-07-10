import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchApontamentos,
  fetchProjetos,
  fetchColaboradores,
  fetchGerencias,
  deleteApontamento,
} from '../../lib/data';
import { fmtHoras, periodoPadrao, intervaloTs } from '../../lib/format';
import { isDiretoria, isGerente, isGestor } from '../../lib/roles';
import { lookupProjetos, lookupColaboradores, lookupGerencias } from '../../lib/lookups';
import ApontamentosTable from '../components/ApontamentosTable';
import ConfirmModal from '../components/ConfirmModal';

export default function RegistrosPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const colaboradorId = user?.id;
  const gerenciaId = user?.horasGerenciaId || null;

  const [list, setList] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [gerencias, setGerencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [range, setRange] = useState(() => periodoPadrao(30));
  const [filtro, setFiltro] = useState({ gerencia: '', projeto: '', colab: '' });
  const [aExcluir, setAExcluir] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!colaboradorId) return;
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
  }, [role, colaboradorId, gerenciaId, range]);

  const proj = useMemo(() => lookupProjetos(projetos), [projetos]);
  const colab = useMemo(() => lookupColaboradores(colabs), [colabs]);
  const ger = useMemo(() => lookupGerencias(gerencias), [gerencias]);

  // Só oferece o que existe nos registros do escopo (protótipo faz o mesmo).
  const projetosEscopo = useMemo(() => proj.usadosEm(list), [proj, list]);
  const colabsEscopo = useMemo(() => colab.usadosEm(list), [colab, list]);

  const filtrado = useMemo(() => {
    let f = list;
    if (isDiretoria(role) && filtro.gerencia) f = f.filter((a) => a.gerenciaId === filtro.gerencia);
    if (filtro.projeto) f = f.filter((a) => a.projetoId === filtro.projeto);
    if (isGestor(role) && filtro.colab) f = f.filter((a) => a.colaboradorId === filtro.colab);
    return f;
  }, [list, filtro, role]);

  const total = filtrado.reduce((s, a) => s + a.duracao, 0);
  const mostraColaborador = isGestor(role);

  // Espelha pode() do protótipo e a RLS: o próprio, a gerência (gerente), tudo (diretoria).
  const podeExcluir = (a) =>
    isDiretoria(role) ||
    a.colaboradorId === colaboradorId ||
    (isGerente(role) && a.gerenciaId === gerenciaId);

  async function confirmarExclusao() {
    const a = aExcluir;
    setAExcluir(null);
    if (!a) return;
    try {
      await deleteApontamento(a.id);
      setList((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir.');
    }
  }

  function exportarCSV() {
    const head = [
      ...(mostraColaborador ? ['Colaborador'] : []),
      'Gerencia',
      'Projeto',
      'Ativ1',
      'Ativ2',
      'Ativ3',
      'Inicio',
      'Fim',
      'Duracao(h)',
      'Descricao',
    ];
    const rows = filtrado.map((a) => [
      ...(mostraColaborador ? [colab.nome(a.colaboradorId)] : []),
      ger.nome(a.gerenciaId),
      proj.nome(a.projetoId),
      a.ativ?.[0] || '',
      a.ativ?.[1] || '',
      a.ativ?.[2] || '',
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
      <p className="horas-sub">
        Total no período: <b>{fmtHoras(total)}</b> em {filtrado.length} apontamento(s).
      </p>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      <div className="horas-card">
        <div className="horas-toolbar">
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label>De</label>
            <input type="date" value={range.de} onChange={(e) => setRange((r) => ({ ...r, de: e.target.value }))} />
          </div>
          <div className="horas-fld" style={{ maxWidth: 150 }}>
            <label>Até</label>
            <input type="date" value={range.ate} onChange={(e) => setRange((r) => ({ ...r, ate: e.target.value }))} />
          </div>
          {isDiretoria(role) ? (
            <div className="horas-fld" style={{ maxWidth: 200 }}>
              <label>Gerência</label>
              <select
                value={filtro.gerencia}
                onChange={(e) => setFiltro((f) => ({ ...f, gerencia: e.target.value, colab: '' }))}
              >
                <option value="">Todas</option>
                {gerencias.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="horas-fld" style={{ maxWidth: 200 }}>
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
          {mostraColaborador ? (
            <div className="horas-fld" style={{ maxWidth: 200 }}>
              <label>Colaborador</label>
              <select value={filtro.colab} onChange={(e) => setFiltro((f) => ({ ...f, colab: e.target.value }))}>
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

      <div className="horas-card horas-table-wrap">
        {loading ? (
          <div className="horas-empty">Carregando…</div>
        ) : (
          <ApontamentosTable
            list={filtrado}
            projetoNome={proj.nome}
            projetoCor={proj.cor}
            nameOf={mostraColaborador ? colab.nome : undefined}
            onDelete={setAExcluir}
            podeExcluir={podeExcluir}
          />
        )}
      </div>

      <ConfirmModal
        open={!!aExcluir}
        title="Excluir apontamento"
        message="Tem certeza que deseja excluir este apontamento? Esta ação não pode ser desfeita."
        onConfirm={confirmarExclusao}
        onCancel={() => setAExcluir(null)}
      />
    </>
  );
}
