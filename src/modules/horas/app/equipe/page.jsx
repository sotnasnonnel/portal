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
import { ROLE_LABEL, isGestao } from '../../lib/roles';
import { isSuperAdmin } from '../../../../config/superAdmin';
import ConfirmModal from '../components/ConfirmModal';

// Equipe & Gerências.
// A equipe vem da HIERARQUIA da Gestão de Pessoas (a RPC devolve a subárvore do
// logado). O PAPEL (Usuário/Coordenador/Gestor) também deriva do perfil lá —
// não se muda aqui. As gerências são apenas containers de projetos/atividades:
//   gestor -> cria/exclui gerências e vincula cada pessoa a uma (p/ ver os projetos)
//   coordenador -> vê a equipe e vincula quem ainda não tem gerência
export default function EquipePage() {
  const { user, modules } = useAuth();
  const role = modules?.horas || 'usuario';

  const [gerencias, setGerencias] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novaGer, setNovaGer] = useState('');
  const [aExcluir, setAExcluir] = useState(null);
  const [aRemover, setARemover] = useState(null);

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
  if (!isGestao(role)) return <Navigate to="/horas/apontar" replace />;

  // A RPC horas_colaboradores já devolve a equipe do logado (a subárvore).
  // A criação/vínculo de áreas é automática (uma por gestor); só o admin/super
  // mexe nisso manualmente.
  const podeGerencias = user?.perfil === 'admin' || isSuperAdmin(user);
  const visiveis = colabs;

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

  if (loading) {
    return (
      <>
        <h1>{podeGerencias ? 'Gerências & Equipe' : 'Minha Equipe'}</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  return (
    <>
      <h1>{podeGerencias ? 'Gerências & Equipe' : 'Minha Equipe'}</h1>
      <p className="horas-sub">
        {podeGerencias
          ? 'Crie as gerências e vincule cada colaborador a uma delas.'
          : 'A sua equipe.'}
      </p>

      <div className="horas-hint">
        O papel de cada pessoa (Usuário · Coordenador · Gestor) e a <b>equipe</b> vêm da
        hierarquia da <b>Gestão de Pessoas</b> (quem é superior de quem). Aqui você define apenas a
        <b> gerência</b> — o container de projetos/atividades que a pessoa vê ao apontar.
      </div>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      {podeGerencias ? (
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

      {!podeGerencias ? (
        <div className="horas-hint">
          Sua equipe vem automaticamente da hierarquia da Gestão de Pessoas — não precisa vincular
          ninguém aqui. Para mudar quem está sob você, ajuste o superior da pessoa lá.
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
                {!podeGerencias ? <th></th> : null}
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
                    {podeGerencias ? (
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
                  {!podeGerencias ? (
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
                  <td colSpan={podeGerencias ? 4 : 5} className="horas-empty">
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
