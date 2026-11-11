import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Search, Trash2, UserMinus } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchGerencias,
  createGerencia,
  deleteGerencia,
  fetchColaboradores,
  fetchProjetos,
  setGerenciaColaborador,
} from '../../lib/data';
import { ROLE_LABEL, isGestao, isHorasAdmin } from '../../lib/roles';
import ConfirmModal from '../components/ConfirmModal';
import Aviso, { Carregando } from '../components/Aviso';
import SearchableSelect from '../components/SearchableSelect';

// Valor do filtro de gerência para quem ainda não tem uma.
const SEM_GERENCIA = '__sem__';

// Busca por nome sem ligar para acento nem maiúscula ("joao" acha "João").
const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

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
  const [busca, setBusca] = useState('');
  const [filtroGer, setFiltroGer] = useState('');

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

  // A RPC horas_colaboradores já devolve a equipe do logado (a subárvore) — ou
  // todo mundo, se for admin do módulo. Os filtros de nome e gerência são só na tela.
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return colabs.filter((c) => {
      if (termo && !semAcento(c.nome).includes(termo)) return false;
      if (filtroGer === SEM_GERENCIA) return !c.gerenciaId;
      if (filtroGer) return c.gerenciaId === filtroGer;
      return true;
    });
  }, [colabs, busca, filtroGer]);

  // A gerência escolhida pode ter sido excluída: aí o filtro volta para "Todas".
  const gerAtual = filtroGer === SEM_GERENCIA || gerMap.has(filtroGer) ? filtroGer : '';
  const filtrando = !!busca.trim() || !!gerAtual;

  // Gate de UI (a RLS e a RPC é que protegem as escritas de verdade).
  if (!isGestao(role)) return <Navigate to="/horas/apontar" replace />;

  // A criação/vínculo de áreas é automática (uma por líder); só o admin do
  // módulo mexe nisso manualmente.
  const podeGerencias = isHorasAdmin(user);

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
        <Carregando />
      </>
    );
  }

  return (
    <>
      <h1>{podeGerencias ? 'Gerências & Equipe' : 'Minha Equipe'}</h1>
      <p className="horas-sub">
        {podeGerencias
          ? 'Crie as gerências e vincule cada colaborador a uma delas.'
          : 'Quem está abaixo de você na hierarquia e a gerência de cada um.'}
      </p>

      {/* Uma explicação só por papel: antes quem não administra lia duas caixas
          dizendo quase a mesma coisa. */}
      {podeGerencias ? (
        <Aviso>
          O papel de cada pessoa (Usuário, Coordenador ou Gestor) e a <b>equipe</b> vêm da
          hierarquia da <b>Gestão de Pessoas</b> (quem é superior de quem). Aqui você define apenas a{' '}
          <b>gerência</b> — o conjunto de projetos que a pessoa vê ao apontar.
        </Aviso>
      ) : (
        <Aviso>
          Sua equipe e o papel de cada pessoa vêm automaticamente da hierarquia da{' '}
          <b>Gestão de Pessoas</b> — não precisa vincular ninguém aqui. Para mudar quem está sob
          você, ajuste o superior da pessoa lá.
        </Aviso>
      )}

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {podeGerencias ? (
        <section className="horas-card" aria-labelledby="horas-ger-tit">
          <h2 className="horas-sec" id="horas-ger-tit">
            Gerências ({gerencias.length})
          </h2>
          <div className="horas-add-inline" style={{ marginBottom: 14 }}>
            <input
              type="text"
              aria-label="Nome da nova gerência"
              placeholder="Nome da nova gerência…"
              value={novaGer}
              onChange={(e) => setNovaGer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && criarGerencia()}
            />
            <button className="horas-btn" type="button" onClick={criarGerencia} disabled={!novaGer.trim()}>
              <Plus size={16} /> Criar gerência
            </button>
          </div>
          <div className="horas-table-wrap">
            <table className="horas-tbl-resp">
              <thead>
                <tr>
                  <th>Gerência</th>
                  <th>Projetos</th>
                  <th>Colaboradores</th>
                  <th>
                    <span className="horas-sr">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {gerencias.map((g) => (
                  <tr key={g.id}>
                    <td data-label="Gerência">
                      <b>{g.nome}</b>
                    </td>
                    <td className="horas-muted horas-num" data-label="Projetos">{projetos.filter((p) => p.gerencia_id === g.id).length}</td>
                    <td className="horas-muted horas-num" data-label="Colaboradores">{colabs.filter((c) => c.gerenciaId === g.id).length}</td>
                    <td className="horas-right horas-td-acao">
                      <button
                        className="horas-btn-icon is-danger"
                        type="button"
                        title="Excluir"
                        aria-label={`Excluir a gerência ${g.nome}`}
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
        </section>
      ) : null}

      <section className="horas-card" aria-labelledby="horas-colab-tit">
        <h2 className="horas-sec" id="horas-colab-tit">
          Colaboradores ({filtrando ? `${visiveis.length} de ${colabs.length}` : colabs.length})
        </h2>
        <div className="horas-toolbar" style={{ marginBottom: 14 }}>
          <div className="horas-fld" style={{ maxWidth: 280, flex: '1 1 220px' }}>
            <label htmlFor="horas-equipe-busca">Nome</label>
            <div className="horas-busca">
              <Search size={14} aria-hidden="true" />
              <input
                id="horas-equipe-busca"
                type="text"
                value={busca}
                placeholder="Buscar pelo nome…"
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="horas-fld" style={{ maxWidth: 280, flex: '1 1 220px' }}>
            <label>Gerência</label>
            <SearchableSelect
              value={gerAtual}
              placeholder="Todas"
              onChange={(v) => setFiltroGer(v)}
              options={[
                { value: '', label: 'Todas' },
                { value: SEM_GERENCIA, label: '(sem gerência)' },
                ...gerencias.map((g) => ({ value: g.id, label: g.nome })),
              ]}
            />
          </div>
          <div className="horas-spacer" />
          {filtrando ? (
            <button
              className="horas-btn2"
              type="button"
              onClick={() => {
                setBusca('');
                setFiltroGer('');
              }}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
        <div className="horas-table-wrap">
          <table className="horas-tbl-resp">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Função</th>
                <th>Papel</th>
                <th>Gerência</th>
                {!podeGerencias ? (
                  <th>
                    <span className="horas-sr">Ações</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id}>
                  <td data-label="Nome">
                    <b>{c.nome}</b>
                  </td>
                  <td className="horas-muted" data-label="Função">{c.funcao || '—'}</td>
                  <td data-label="Papel">
                    <span className={`horas-badge ${c.role}`}>{ROLE_LABEL[c.role]}</span>
                  </td>
                  <td data-label="Gerência">
                    {podeGerencias ? (
                      <select
                        className="horas-inline-select"
                        aria-label={`Gerência de ${c.nome}`}
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
                    <td className="horas-right horas-td-acao">
                      {c.id !== user?.id ? (
                        <button
                          className="horas-btn-icon is-danger"
                          type="button"
                          title="Remover da equipe"
                          aria-label={`Remover ${c.nome} da equipe`}
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
                    {filtrando ? 'Nenhum colaborador com esses filtros.' : 'Nenhum colaborador.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={!!aExcluir}
        title="Excluir gerência"
        message={`Excluir a gerência "${aExcluir?.nome || ''}"? Os projetos dela também serão removidos.`}
        onConfirm={confirmarExclusaoGerencia}
        onCancel={() => setAExcluir(null)}
      />

      <ConfirmModal
        open={!!aRemover}
        title="Remover da equipe"
        message={`Remover ${aRemover?.nome || ''} da sua gerência? Os apontamentos já feitos permanecem no histórico da gerência.`}
        confirmLabel="Remover"
        onConfirm={confirmarRemocao}
        onCancel={() => setARemover(null)}
      />
    </>
  );
}
