import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchGerencias,
  fetchProjetos,
  createProjeto,
  updateProjeto,
  deleteProjeto,
  fetchAtividades,
  updateAtividade,
} from '../../lib/data';
import { isDiretoria, isGestor } from '../../lib/roles';
import ConfirmModal from '../components/ConfirmModal';

const CORES = ['#C44A28', '#26405d', '#00a49a', '#b85236', '#F59E0B', '#9a3412', '#64748b', '#10B981'];

// Configuração da gerência: os projetos e as 3 atividades controladas que
// aparecem no apontamento. A diretoria escolhe qual gerência editar; o gerente
// edita apenas a sua (a RLS garante isso no banco).
export default function ConfigPage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const minhaGerencia = user?.horasGerenciaId || null;

  const [gerencias, setGerencias] = useState([]);
  const [sel, setSel] = useState(isDiretoria(role) ? '' : minhaGerencia);
  const [projetos, setProjetos] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState({ nome: '', cliente: '', cor: CORES[0] });
  const [aExcluir, setAExcluir] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const gs = await fetchGerencias();
        setGerencias(gs);
        // Só a diretoria escolhe: o gerente fica preso à gerência dele.
        if (isDiretoria(role)) setSel((s) => s || gs[0]?.id || '');
      } catch (e) {
        setErro(e?.message || 'Falha ao carregar as gerências.');
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

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
  if (!isGestor(role)) return <Navigate to="/horas/apontar" replace />;

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
        <h1>Configuração da Gerência</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  if (!gerencias.length) {
    return (
      <>
        <h1>Configuração da Gerência</h1>
        <div className="horas-empty">
          Nenhuma gerência cadastrada. A diretoria cria em "Gerências &amp; Equipe".
        </div>
      </>
    );
  }

  if (!sel) {
    return (
      <>
        <h1>Configuração da Gerência</h1>
        <div className="horas-hint">
          Seu usuário não está vinculado a uma gerência. Peça à diretoria para vincular você em
          "Gerências &amp; Equipe".
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Configuração da Gerência</h1>
      <p className="horas-sub">Defina os projetos e as 3 atividades controladas que aparecem no apontamento.</p>

      <div className="horas-hint">
        Cada atividade controlada é uma lista de opções selecionável pelo colaborador ao iniciar o
        cronômetro. Você pode renomear o rótulo (ex.: "Atividade Controlada 1" → "Fase do Projeto").
      </div>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      {isDiretoria(role) ? (
        <div className="horas-card">
          <div className="horas-toolbar" style={{ marginBottom: 0 }}>
            <div className="horas-fld" style={{ maxWidth: 340 }}>
              <label>Gerência</label>
              <select value={sel} onChange={(e) => setSel(e.target.value)}>
                {gerencias.map((g) => (
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

function BlocoAtividade({ atividade, onLabel, onAdd, onDel }) {
  const [valor, setValor] = useState('');

  function adicionar() {
    onAdd(valor);
    setValor('');
  }

  return (
    <div className="horas-cfg-block">
      <div className="horas-lbl-edit">
        <span>Atividade Controlada {atividade.ordem + 1} · rótulo:</span>
        {/* Não controlado: o rótulo só é gravado ao sair do campo. A `key`
            ressincroniza o input quando o valor muda no servidor. */}
        <input
          key={atividade.label}
          type="text"
          defaultValue={atividade.label}
          onBlur={(e) => e.target.value !== atividade.label && onLabel(e.target.value)}
        />
      </div>
      <div className="horas-chips">
        {atividade.valores.length ? (
          atividade.valores.map((v, i) => (
            <span className="horas-chip" key={v}>
              {v}
              <button type="button" title="Remover" onClick={() => onDel(i)}>
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="horas-muted">Nenhum item.</span>
        )}
      </div>
      <div className="horas-add-inline">
        <input
          type="text"
          placeholder="Nova opção…"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <button className="horas-btn2" type="button" onClick={adicionar}>
          Adicionar
        </button>
      </div>
    </div>
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
