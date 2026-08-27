import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RotateCcw, Search } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import {
  fetchProjetos,
  fetchAcessoProjeto,
  setAcessoProjeto,
  limparAcessoProjeto,
} from '../../../lib/data';
import { podeConfigurarHoras } from '../../../lib/roles';
import SearchableSelect from '../../components/SearchableSelect';

// Acesso a Projetos: quem enxerga cada projeto no seletor de "Apontar".
// O padrão continua sendo a herança de área (a pessoa vê os projetos da sua
// equipe + os das equipes dos gestores acima dela). Esta tela grava EXCEÇÕES
// por pessoa em cima disso — dá para tirar de quem é da área e conceder a quem
// não é. Voltar ao padrão APAGA a exceção, em vez de gravar o que a área já
// diria: assim a tabela só guarda o que é decisão de gente, e mudanças de
// equipe/organograma continuam valendo para o resto.
export default function ConfigProjetosPage() {
  const { user } = useAuth();

  const [projetos, setProjetos] = useState([]);
  const [projetoId, setProjetoId] = useState('');
  const [pessoas, setPessoas] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [emVoo, setEmVoo] = useState(null); // colaboradorId sendo gravado

  useEffect(() => {
    (async () => {
      try {
        const ps = await fetchProjetos({ incluirArquivados: false });
        setProjetos(ps);
        setProjetoId((id) => id || ps[0]?.id || '');
      } catch (e) {
        setErro(e?.message || 'Falha ao carregar os projetos.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const carregar = useCallback(async () => {
    if (!projetoId) return;
    setErro('');
    setCarregando(true);
    try {
      setPessoas(await fetchAcessoProjeto(projetoId));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar as pessoas.');
    } finally {
      setCarregando(false);
    }
  }, [projetoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return pessoas;
    return pessoas.filter(
      (p) => p.nome.toLowerCase().includes(t) || p.equipe.toLowerCase().includes(t)
    );
  }, [pessoas, busca]);

  const quantosVeem = pessoas.filter((p) => p.efetivo).length;
  const excecoes = pessoas.filter((p) => p.override !== null).length;

  // Gate de UI (a RLS e a RPC repetem a regra no banco).
  if (!podeConfigurarHoras(user)) return <Navigate to="/horas/apontar" replace />;

  const aplicarLocal = (colaboradorId, patch) =>
    setPessoas((lista) =>
      lista.map((p) => (p.colaboradorId === colaboradorId ? { ...p, ...patch } : p))
    );

  // Marcar/desmarcar. Quando o alvo coincide com o que a área já daria, a
  // exceção perde a razão de existir e é apagada.
  async function alternar(pessoa) {
    const alvo = !pessoa.efetivo;
    const voltaAoPadrao = alvo === pessoa.porArea;
    aplicarLocal(pessoa.colaboradorId, {
      efetivo: alvo,
      override: voltaAoPadrao ? null : alvo,
    });
    await gravar(pessoa.colaboradorId, voltaAoPadrao ? null : alvo);
  }

  async function voltarAoPadrao(pessoa) {
    aplicarLocal(pessoa.colaboradorId, { efetivo: pessoa.porArea, override: null });
    await gravar(pessoa.colaboradorId, null);
  }

  // `permitido` null = apagar a exceção. A tela já se atualizou; se o banco
  // recusar, recarregamos para não deixar uma caixa mentindo.
  async function gravar(colaboradorId, permitido) {
    setEmVoo(colaboradorId);
    setErro('');
    try {
      if (permitido === null) {
        await limparAcessoProjeto(projetoId, colaboradorId);
      } else {
        await setAcessoProjeto({
          projetoId,
          colaboradorId,
          permitido,
          definidoPor: user?.id,
        });
      }
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar. A lista foi recarregada.');
      await carregar();
    } finally {
      setEmVoo(null);
    }
  }

  if (loading) {
    return (
      <>
        <h1>Acesso a Projetos</h1>
        <div className="horas-hint">Carregando…</div>
      </>
    );
  }

  if (!projetos.length) {
    return (
      <>
        <h1>Acesso a Projetos</h1>
        <div className="horas-hint">Nenhum projeto ativo cadastrado ainda.</div>
      </>
    );
  }

  return (
    <>
      <h1>Acesso a Projetos</h1>
      <p className="horas-sub">
        Escolha o projeto e marque quem pode vê-lo no seletor de "Apontar".
      </p>

      <div className="horas-hint">
        Por padrão vale a <b>herança de área</b>: a pessoa vê os projetos da equipe dela e das
        equipes dos gestores acima. Marcar ou desmarcar cria uma <b>exceção</b> só para esta
        pessoa neste projeto — dá tanto para tirar de quem é da área quanto para conceder a quem
        não é. Isto muda apenas o seletor do apontamento; o histórico já registrado não é afetado.
      </div>

      {erro ? <div className="horas-hint">⚠️ {erro}</div> : null}

      <div className="horas-card">
        <div className="horas-toolbar" style={{ marginBottom: 0 }}>
          <div className="horas-fld" style={{ maxWidth: 420 }}>
            <label>Projeto ({projetos.length} ativos)</label>
            <SearchableSelect
              value={projetoId}
              placeholder="Selecione o projeto…"
              onChange={(v) => {
                setProjetoId(v);
                setBusca('');
              }}
              options={projetos.map((p) => ({
                value: p.id,
                label: p.nome + (p.cliente ? ` — ${p.cliente}` : ''),
              }))}
            />
          </div>
          <div className="horas-fld" style={{ maxWidth: 280 }}>
            <label>Buscar pessoa ou equipe</label>
            <div className="horas-busca">
              <Search size={14} />
              <input
                type="text"
                value={busca}
                placeholder="Nome ou equipe…"
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="horas-stats">
        <Stat k="Veem este projeto" v={`${quantosVeem} de ${pessoas.length}`} />
        <Stat k="Exceções neste projeto" v={excecoes} />
        <Stat k="Na lista" v={filtradas.length} />
      </div>

      <div className="horas-card horas-table-wrap">
        {carregando ? (
          <div className="horas-empty">Carregando…</div>
        ) : (
          <table className="horas-tbl-resp">
            <thead>
              <tr>
                <th style={{ width: 44 }}>Vê</th>
                <th>Pessoa</th>
                <th>Equipe</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p.colaboradorId}>
                  <td data-label="Vê">
                    <input
                      type="checkbox"
                      className="horas-check"
                      checked={p.efetivo}
                      disabled={emVoo === p.colaboradorId}
                      onChange={() => alternar(p)}
                      aria-label={`${p.nome} vê este projeto`}
                    />
                  </td>
                  <td data-label="Pessoa">
                    <b>{p.nome}</b>
                    {p.funcao ? (
                      <div className="horas-muted" style={{ fontSize: 'var(--font-size-2xs)' }}>
                        {p.funcao}
                      </div>
                    ) : null}
                  </td>
                  <td className="horas-muted" data-label="Equipe">
                    {p.equipe || '— sem equipe —'}
                  </td>
                  <td data-label="Situação">
                    <Situacao pessoa={p} />
                  </td>
                  <td className="horas-right horas-td-acao">
                    {p.override !== null ? (
                      <button
                        className="horas-btn-icon"
                        type="button"
                        title="Voltar ao padrão da área"
                        disabled={emVoo === p.colaboradorId}
                        onClick={() => voltarAoPadrao(p)}
                      >
                        <RotateCcw size={15} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="horas-empty">
                    Ninguém encontrado com "{busca}".
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// Sem exceção, a situação é o padrão herdado (e vale dizer QUAL é, senão a
// caixa desmarcada parece um bloqueio que ninguém decidiu).
function Situacao({ pessoa }) {
  if (pessoa.override === null) {
    return (
      <span className="horas-muted">
        Padrão da área · {pessoa.porArea ? 'vê' : 'não vê'}
      </span>
    );
  }
  const redundante = pessoa.override === pessoa.porArea;
  return (
    <span className={`horas-tag ${pessoa.override ? 'ok' : 'no'}`}>
      {pessoa.override ? 'Concedido' : 'Bloqueado'}
      {redundante ? (pessoa.override ? ' (já via pela área)' : ' (já não via pela área)') : ''}
    </span>
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
