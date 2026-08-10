import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchGerencias,
  fetchProjetos,
  createProjeto,
  updateProjeto,
  deleteProjeto,
} from '../../lib/data';
import { isGestao, isHorasAdmin } from '../../lib/roles';
import ConfirmModal from '../components/ConfirmModal';
import SeletorCor from '../components/SeletorCor';
import { CORES } from '../../lib/cores';

// Configuração da ÁREA do gestor: os PROJETOS que a equipe dele vê ao apontar.
// Cada gestor edita só a sua área; o admin do módulo vê todas (a RLS garante
// isso no banco). Sigla, tarefa, etiqueta e tarefa 2 não estão aqui: viraram um
// catálogo fixo da empresa (lib/catalogoTarefas.js), igual para todas as áreas.
export default function ConfigPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const minhaGerencia = user?.horasGerenciaId || null;
  const veTudo = isHorasAdmin(user);

  const [gerencias, setGerencias] = useState([]);
  const [sel, setSel] = useState(minhaGerencia || '');
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState({ nome: '', cliente: '', cor: CORES[0] });
  const [aExcluir, setAExcluir] = useState(null);

  // Áreas que este usuário pode editar: o admin/super vê todas; o líder vê a(s)
  // que ele é dono (gestor_id === ele); e qualquer gestor/coordenador vê a área
  // da EQUIPE a que pertence (horas_gerencia_id) — assim um sub-gestor (ex.:
  // Vinicius) mantém a área do líder (André). Espelha o pode_gerir_gerencia.
  const areasGeriveis = useMemo(
    () =>
      veTudo
        ? gerencias
        : gerencias.filter((g) => g.gestor_id === user?.id || g.id === minhaGerencia),
    [gerencias, veTudo, user?.id, minhaGerencia]
  );

  useEffect(() => {
    (async () => {
      try {
        const gs = await fetchGerencias();
        setGerencias(gs);
      } catch (e) {
        setErro(e?.message || 'Falha ao carregar as áreas.');
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  // Garante que a área selecionada é uma que o usuário pode editar.
  useEffect(() => {
    if (!areasGeriveis.length) return;
    setSel((s) => (areasGeriveis.some((g) => g.id === s) ? s : minhaGerencia || areasGeriveis[0].id));
  }, [areasGeriveis, minhaGerencia]);

  const carregar = useCallback(async () => {
    if (!sel) return;
    setErro('');
    try {
      setProjetos(await fetchProjetos({ gerenciaId: sel, incluirArquivados: true }));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar a configuração.');
    }
  }, [sel]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Gate de UI (a RLS é quem protege as escritas de verdade).
  if (!isGestao(role)) return <Navigate to="/horas/apontar" replace />;

  async function adicionarProjeto() {
    const nome = novo.nome.trim();
    if (!nome || !sel) return;
    try {
      await createProjeto({ gerenciaId: sel, nome, cliente: novo.cliente.trim(), cor: novo.cor });
      setNovo({ nome: '', cliente: '', cor: CORES[0] });
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao criar o projeto.');
    }
  }

  async function salvarProjeto(p, patch) {
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

  if (loading) {
    return (
      <>
        <h1>Configuração da Área</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  if (!areasGeriveis.length) {
    return (
      <>
        <h1>Configuração da Área</h1>
        <div className="horas-hint">
          Você não administra nenhuma área. Os projetos são definidos pelo <b>gestor</b> da sua
          equipe.
        </div>
      </>
    );
  }

  if (!sel) {
    return (
      <>
        <h1>Configuração da Área</h1>
        <div className="horas-hint">Carregando a sua área…</div>
      </>
    );
  }

  return (
    <>
      <h1>Configuração da Área</h1>
      <p className="horas-sub">Defina os projetos que a sua equipe vê ao apontar.</p>

      <div className="horas-hint">
        Sigla, Tarefa, Etiqueta e Tarefa 2 não são configuráveis por área: vêm do catálogo único da
        empresa e já saem filtrados uns pelos outros no apontamento.
      </div>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      {areasGeriveis.length > 1 ? (
        <div className="horas-card">
          <div className="horas-toolbar" style={{ marginBottom: 0 }}>
            <div className="horas-fld" style={{ maxWidth: 340 }}>
              <label>Área</label>
              <select value={sel} onChange={(e) => setSel(e.target.value)}>
                {areasGeriveis.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

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
              onKeyDown={(e) => e.key === 'Enter' && adicionarProjeto()}
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
          <button className="horas-btn" type="button" onClick={adicionarProjeto}>
            <Plus size={16} /> Criar
          </button>
        </div>
      </div>

      <div className="horas-card horas-table-wrap">
        <table className="horas-tbl-resp">
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
                <td data-label="Projeto">
                  <span className="horas-pill" style={{ background: p.cor }} />
                  <b>{p.nome}</b>
                </td>
                <td className="horas-muted" data-label="Cliente">{p.cliente || '—'}</td>
                <td data-label="Cor">
                  <SeletorCor value={p.cor} onChange={(cor) => salvarProjeto(p, { cor })} />
                </td>
                <td className="horas-muted" data-label="Status">{p.arquivado ? 'Arquivado' : 'Ativo'}</td>
                <td className="horas-right horas-td-acao" style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="horas-btn-icon"
                    type="button"
                    title={p.arquivado ? 'Reativar' : 'Arquivar'}
                    onClick={() => salvarProjeto(p, { arquivado: !p.arquivado })}
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
                  Nenhum projeto nesta gerência. Crie o primeiro acima.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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
