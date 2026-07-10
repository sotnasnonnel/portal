import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, UserMinus } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchGerencias,
  createGerencia,
  deleteGerencia,
  fetchColaboradores,
  fetchProjetos,
  setGerenciaColaborador,
} from '../../lib/data';
import { ROLE_LABEL, isDiretoria, isGestor } from '../../lib/roles';
import ConfirmModal from '../components/ConfirmModal';

// Gerências & Equipe.
//   diretoria -> cria/exclui gerências e vincula qualquer pessoa a qualquer uma
//   gerente   -> vê a própria equipe, inclui quem não tem gerência e remove os seus
// O PAPEL (Usuário/Gerente/Diretoria) não se muda aqui: ele é concedido em
// /portal-admin ("Gerenciamento de acessos"), junto com os demais módulos.
export default function EquipePage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';
  const minhaGerencia = user?.horasGerenciaId || null;

  const [gerencias, setGerencias] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novaGer, setNovaGer] = useState('');
  const [aExcluir, setAExcluir] = useState(null);
  const [aRemover, setARemover] = useState(null);
  const [novoMembro, setNovoMembro] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [gs, cs, ps] = await Promise.all([
        fetchGerencias(),
        fetchColaboradores(),
        fetchProjetos({ incluirArquivados: true }),
      ]);
      setGerencias(gs);
      setColabs(cs);
      setProjetos(ps);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const gerMap = useMemo(() => new Map(gerencias.map((g) => [g.id, g.nome])), [gerencias]);

  // Gate de UI (a RLS e a RPC é que protegem as escritas de verdade).
  if (!isGestor(role)) return <Navigate to="/horas/apontar" replace />;

  const daDiretoria = isDiretoria(role);
  const minhaEquipe = colabs.filter((c) => c.gerenciaId && c.gerenciaId === minhaGerencia);
  const semGerencia = colabs.filter((c) => !c.gerenciaId && c.role !== 'diretoria');
  const visiveis = daDiretoria ? colabs : minhaEquipe;

  async function criarGerencia() {
    const nome = novaGer.trim();
    if (!nome) return;
    try {
      await createGerencia(nome);
      setNovaGer('');
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao criar a gerência.');
    }
  }

  // Como no protótipo: realoque a equipe antes de excluir a gerência.
  function pedirExclusaoGerencia(g) {
    if (colabs.some((c) => c.gerenciaId === g.id)) {
      setErro(`A gerência "${g.nome}" ainda tem colaboradores. Realoque-os antes de excluí-la.`);
      return;
    }
    setErro('');
    setAExcluir(g);
  }

  async function confirmarExclusaoGerencia() {
    const g = aExcluir;
    setAExcluir(null);
    if (!g) return;
    try {
      await deleteGerencia(g.id);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir a gerência.');
    }
  }

  async function vincular(colaboradorId, gerenciaId) {
    try {
      await setGerenciaColaborador(colaboradorId, gerenciaId || null);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao alterar a gerência do colaborador.');
    }
  }

  async function confirmarRemocao() {
    const c = aRemover;
    setARemover(null);
    if (!c) return;
    await vincular(c.id, null);
  }

  async function incluirMembro() {
    if (!novoMembro) return;
    await vincular(novoMembro, minhaGerencia);
    setNovoMembro('');
  }

  if (loading) {
    return (
      <>
        <h1>{daDiretoria ? 'Gerências & Equipe' : 'Minha Equipe'}</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  return (
    <>
      <h1>{daDiretoria ? 'Gerências & Equipe' : 'Minha Equipe'}</h1>
      <p className="horas-sub">
        {daDiretoria
          ? 'Crie as gerências e distribua os colaboradores entre elas.'
          : 'Colaboradores da sua gerência.'}
      </p>

      <div className="horas-hint">
        O papel de cada pessoa no Controle de Horas (Usuário · Gerente · Diretoria) é definido em
        <b> Gerenciamento de acessos</b>, no portal. Aqui você define apenas a <b>gerência</b> a que
        ela pertence.
      </div>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      {daDiretoria ? (
        <div className="horas-card">
          <div className="horas-sec">Gerências</div>
          <div className="horas-add-inline" style={{ marginBottom: 14 }}>
            <input
              type="text"
              placeholder="Nome da nova gerência…"
              value={novaGer}
              onChange={(e) => setNovaGer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && criarGerencia()}
            />
            <button className="horas-btn" type="button" onClick={criarGerencia}>
              <Plus size={16} /> Criar
            </button>
          </div>
          <div className="horas-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Gerência</th>
                  <th>Projetos</th>
                  <th>Colaboradores</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gerencias.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <b>{g.nome}</b>
                    </td>
                    <td className="horas-muted">{projetos.filter((p) => p.gerencia_id === g.id).length}</td>
                    <td className="horas-muted">{colabs.filter((c) => c.gerenciaId === g.id).length}</td>
                    <td className="horas-right">
                      <button
                        className="horas-btn-icon"
                        type="button"
                        title="Excluir"
                        onClick={() => pedirExclusaoGerencia(g)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {gerencias.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="horas-empty">
                      Nenhuma gerência ainda. Crie a primeira acima.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!daDiretoria && minhaGerencia ? (
        <div className="horas-card">
          <div className="horas-sec">Incluir na equipe</div>
          <div className="horas-toolbar">
            <div className="horas-fld" style={{ maxWidth: 320 }}>
              <label>Colaborador sem gerência</label>
              <select value={novoMembro} onChange={(e) => setNovoMembro(e.target.value)}>
                <option value="">Selecione…</option>
                {semGerencia.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.funcao ? ` — ${c.funcao}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button className="horas-btn" type="button" onClick={incluirMembro} disabled={!novoMembro}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
          {semGerencia.length === 0 ? (
            <div className="horas-muted" style={{ fontSize: '.82rem' }}>
              Não há colaboradores sem gerência no momento.
            </div>
          ) : null}
        </div>
      ) : null}

      {!daDiretoria && !minhaGerencia ? (
        <div className="horas-hint">
          Você ainda não está vinculado a uma gerência. Peça à diretoria para vincular você.
        </div>
      ) : null}

      <div className="horas-card">
        <div className="horas-sec">Colaboradores</div>
        <div className="horas-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Função</th>
                <th>Papel</th>
                <th>Gerência</th>
                {!daDiretoria ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td className="horas-muted">{c.funcao || '—'}</td>
                  <td>
                    <span className={`horas-badge ${c.role}`}>{ROLE_LABEL[c.role]}</span>
                  </td>
                  <td>
                    {daDiretoria ? (
                      <select
                        className="horas-inline-select"
                        value={c.gerenciaId || ''}
                        onChange={(e) => vincular(c.id, e.target.value)}
                      >
                        <option value="">(sem gerência)</option>
                        {gerencias.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nome}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="horas-muted">{gerMap.get(c.gerenciaId) || '—'}</span>
                    )}
                  </td>
                  {!daDiretoria ? (
                    <td className="horas-right">
                      {c.id !== user?.id ? (
                        <button
                          className="horas-btn-icon"
                          type="button"
                          title="Remover da equipe"
                          onClick={() => setARemover(c)}
                        >
                          <UserMinus size={15} />
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={daDiretoria ? 4 : 5} className="horas-empty">
                    Nenhum colaborador.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={!!aExcluir}
        title="Excluir gerência"
        message={`Excluir a gerência "${aExcluir?.nome || ''}"? Os projetos e as atividades controladas dela também serão removidos.`}
        onConfirm={confirmarExclusaoGerencia}
        onCancel={() => setAExcluir(null)}
      />

      <ConfirmModal
        open={!!aRemover}
        title="Remover da equipe"
        message={`Remover ${aRemover?.nome || ''} da sua gerência? Os apontamentos já feitos permanecem no histórico da gerência.`}
        onConfirm={confirmarRemocao}
        onCancel={() => setARemover(null)}
      />
    </>
  );
}
