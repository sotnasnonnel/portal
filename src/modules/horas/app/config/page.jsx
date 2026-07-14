import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { isSuperAdmin } from '../../../../config/superAdmin';
import {
  fetchGerencias,
  fetchProjetos,
  createProjeto,
  updateProjeto,
  deleteProjeto,
  fetchAtividades,
  updateAtividade,
} from '../../lib/data';
import { isGestao } from '../../lib/roles';
import ConfirmModal from '../components/ConfirmModal';
import BlocoAtividade from '../components/BlocoAtividade';
import SeletorCor from '../components/SeletorCor';
import { CORES } from '../../lib/cores';

// Configuração da ÁREA do gestor: os projetos e as 3 atividades controladas que
// a equipe dele vê ao apontar. Cada gestor edita só a sua área; o admin/super vê
// todas (a RLS garante isso no banco).
export default function ConfigPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const minhaGerencia = user?.horasGerenciaId || null;
  const veTudo = user?.perfil === 'admin' || isSuperAdmin(user);

  const [gerencias, setGerencias] = useState([]);
  const [sel, setSel] = useState(minhaGerencia || '');
  const [projetos, setProjetos] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState({ nome: '', cliente: '', cor: CORES[0] });
  const [aExcluir, setAExcluir] = useState(null);

  // Áreas que este usuário pode editar: o admin/super vê todas; o gestor vê a(s)
  // que ele é dono (gestor_id === ele).
  const areasGeriveis = useMemo(
    () => (veTudo ? gerencias : gerencias.filter((g) => g.gestor_id === user?.id)),
    [gerencias, veTudo, user?.id]
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
      const [ps, ats] = await Promise.all([
        fetchProjetos({ gerenciaId: sel, incluirArquivados: true }),
        fetchAtividades(sel),
      ]);
      setProjetos(ps);
      setAtividades(ats);
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

  // --- Atividades controladas ---
  async function salvarAtividade(a, patch) {
    setAtividades((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    try {
      await updateAtividade(a.id, patch);
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar a atividade.');
      await carregar();
    }
  }

  const setLabel = (a, valor) =>
    salvarAtividade(a, { label: valor.trim() || `Atividade Controlada ${a.ordem + 1}` });

  const addValor = (a, valor) => {
    const v = valor.trim();
    if (!v || a.valores.includes(v)) return;
    salvarAtividade(a, { valores: [...a.valores, v] });
  };

  const delValor = (a, i) => salvarAtividade(a, { valores: a.valores.filter((_, j) => j !== i) });

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
          Você não administra nenhuma área. Os projetos e atividades são definidos pelo <b>gestor</b>{' '}
          da sua equipe.
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
      <p className="horas-sub">
        Defina os projetos e as 3 atividades controladas (Fase do Projeto · Disciplina · Tipo de
        Esforço) que a sua equipe vê ao apontar.
      </p>

      <div className="horas-hint">
        Cada atividade controlada é uma lista de opções que o colaborador escolhe ao iniciar o
        cronômetro. Você pode renomear o rótulo e adicionar/remover as opções.
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
                  <SeletorCor value={p.cor} onChange={(cor) => salvarProjeto(p, { cor })} />
                </td>
                <td className="horas-muted">{p.arquivado ? 'Arquivado' : 'Ativo'}</td>
                <td className="horas-right" style={{ whiteSpace: 'nowrap' }}>
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

      <div className="horas-sec" style={{ marginTop: 22 }}>
        Atividades controladas
      </div>
      <div className="horas-card">
        {atividades.map((a) => (
          <BlocoAtividade
            key={a.id}
            atividade={a}
            onLabel={(v) => setLabel(a, v)}
            onAdd={(v) => addValor(a, v)}
            onDel={(i) => delValor(a, i)}
          />
        ))}
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
