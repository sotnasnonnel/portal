import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { fetchProjetos, createProjeto, updateProjeto, deleteProjeto } from '../../lib/data';
import ConfirmModal from '../components/ConfirmModal';

const CORES = ['#C44A28', '#26405d', '#00a49a', '#b85236', '#F59E0B', '#9a3412', '#64748b', '#10B981'];

export default function ProjetosPage() {
  const { modules } = useAuth();
  const isAdmin = modules?.horas === 'admin';

  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState({ nome: '', cliente: '', cor: CORES[0] });
  const [aExcluir, setAExcluir] = useState(null);

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      setProjetos(await fetchProjetos({ incluirArquivados: true }));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar projetos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) carregar();
  }, [isAdmin]);

  // Gate de UI (a RLS é quem protege as escritas de verdade).
  if (!isAdmin) return <Navigate to="/horas/apontar" replace />;

  async function adicionar() {
    const nome = novo.nome.trim();
    if (!nome) return;
    try {
      await createProjeto({ nome, cliente: novo.cliente.trim(), cor: novo.cor });
      setNovo({ nome: '', cliente: '', cor: CORES[0] });
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao criar o projeto.');
    }
  }

  async function salvar(p, patch) {
    setProjetos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    try {
      await updateProjeto(p.id, patch);
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
      await carregar();
    }
  }

  async function confirmarExclusao() {
    const p = aExcluir;
    setAExcluir(null);
    if (!p) return;
    try {
      await deleteProjeto(p.id);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir.');
    }
  }

  return (
    <>
      <h1>Projetos</h1>
      <p className="horas-sub">Gerencie a lista de projetos que os colaboradores usam ao apontar horas.</p>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      <div className="horas-card">
        <div className="horas-sec">Novo projeto</div>
        <div className="horas-toolbar">
          <div className="horas-fld" style={{ maxWidth: 260 }}>
            <label>Nome</label>
            <input
              type="text"
              placeholder="Nome do projeto"
              value={novo.nome}
              onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            />
          </div>
          <div className="horas-fld" style={{ maxWidth: 220 }}>
            <label>Cliente (opcional)</label>
            <input
              type="text"
              placeholder="Cliente"
              value={novo.cliente}
              onChange={(e) => setNovo((n) => ({ ...n, cliente: e.target.value }))}
            />
          </div>
          <div className="horas-fld">
            <label>Cor</label>
            <SeletorCor value={novo.cor} onChange={(cor) => setNovo((n) => ({ ...n, cor }))} />
          </div>
          <button className="horas-btn" type="button" onClick={adicionar}>
            <Plus size={16} /> Criar
          </button>
        </div>
      </div>

      <div className="horas-card horas-table-wrap">
        {loading ? (
          <div className="horas-empty">Carregando…</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Cliente</th>
                <th>Cor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projetos.map((p) => (
                <tr key={p.id} style={p.arquivado ? { opacity: 0.55 } : undefined}>
                  <td>
                    <span className="horas-pill" style={{ background: p.cor }} />
                    <b>{p.nome}</b>
                  </td>
                  <td className="horas-muted">{p.cliente || '—'}</td>
                  <td>
                    <SeletorCor value={p.cor} onChange={(cor) => salvar(p, { cor })} />
                  </td>
                  <td className="horas-muted">{p.arquivado ? 'Arquivado' : 'Ativo'}</td>
                  <td className="horas-right" style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="horas-btn-icon"
                      type="button"
                      title={p.arquivado ? 'Reativar' : 'Arquivar'}
                      onClick={() => salvar(p, { arquivado: !p.arquivado })}
                    >
                      {p.arquivado ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                    </button>
                    <button className="horas-btn-icon" type="button" title="Excluir" onClick={() => setAExcluir(p)}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {projetos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="horas-empty">
                    Nenhum projeto ainda. Crie o primeiro acima.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={!!aExcluir}
        title="Excluir projeto"
        message={`Excluir o projeto "${aExcluir?.nome || ''}"? Os apontamentos existentes ficam no histórico, sem projeto. Para apenas ocultá-lo, use "Arquivar".`}
        onConfirm={confirmarExclusao}
        onCancel={() => setAExcluir(null)}
      />
    </>
  );
}

function SeletorCor({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {CORES.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: c,
            border: value === c ? '2px solid var(--h-ink)' : '2px solid transparent',
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  );
}
