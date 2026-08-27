import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, LayoutDashboard, Lightbulb, Loader2, Wrench,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  CATEGORIA_LABEL, SITUACOES, ehAdminProgramas,
} from '../../../../config/programas';
import {
  listarIdeias, atualizarSituacao, atualizarIdeia, excluirIdeia,
} from '../../lib/ideias';
import { DetalheIdeia } from '../components/Detalhe';

/**
 * Campo de Ideias — a tela de QUEM PARTICIPA, gêmea de "Alavanca PHD":
 * os botões de registrar no topo e, abaixo, o que essa pessoa registrou.
 *
 * A separação entre esta tela e o Painel da Inovação é a mesma do outro programa:
 *   aqui   -> eu registro e acompanho o MEU
 *   painel -> os números do programa inteiro, de todo mundo
 * Juntar as duas faz a tela de leitura virar também a de escrita, e aí ninguém
 * sabe se o painel é onde se olha ou onde se cadastra.
 *
 * A consulta é a mesma do painel — o Campo de Ideias é aberto, e a RLS
 * devolve tudo. O recorte "meus" é feito aqui, porque a pergunta desta tela é
 * "o que EU registrei".
 */

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export default function CampoDeIdeias() {
  const { user, modules } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState('');
  const [detalhe, setDetalhe] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setLinhas(await listarIdeias());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const minhas = useMemo(
    () => linhas.filter((l) => l.autor_id === user?.id),
    [linhas, user?.id]
  );
  const souAdmin = ehAdminProgramas(modules);

  const salvarEdicao = async (registro, valores) => {
    const atualizado = await atualizarIdeia(registro, valores, user.id);
    setLinhas((atual) => atual.map((l) => (l.id === registro.id ? atualizado : l)));
    setDetalhe(atualizado);
  };

  const apagar = async (registro) => {
    await excluirIdeia(registro.id);
    setLinhas((atual) => atual.filter((l) => l.id !== registro.id));
  };

  const trocarSituacao = async (registro, nova) => {
    setSalvando(registro.id);
    setErro('');
    try {
      const atualizado = await atualizarSituacao(registro, nova, user.id);
      setLinhas((atual) => atual.map((l) => (l.id === registro.id ? atualizado : l)));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando('');
    }
  };

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title"><Lightbulb size={24} /> Campo de Ideias</h1>
      <p className="pg-sub">
        Registre uma ideia nova ou cadastre o que você já está construindo. Tudo o que a
        empresa registrou fica no Painel da Inovação, aberto a todos.
      </p>

      {/* Dois botões, e não um com escolha depois: ideia e iniciativa são
          formulários diferentes, e a diferença entre elas está escrita logo
          abaixo — quem chega decide sem precisar de uma tela intermediária. */}
      <div className="pg-acoes" style={{ marginTop: 0, marginBottom: 8 }}>
        <Link to="/programas/ideias/nova/ideia" className="pg-btn pg-btn-primary">
          <Lightbulb size={16} /> Registrar ideia
        </Link>
        <Link to="/programas/ideias/nova/iniciativa" className="pg-btn pg-btn-primary">
          <Wrench size={16} /> Registrar iniciativa
        </Link>
        <Link to="/programas/dashboard" className="pg-btn pg-btn-ghost">
          <LayoutDashboard size={16} /> Abrir o Painel da Inovação
        </Link>
      </div>
      <p className="pg-campo-dica" style={{ marginBottom: 22 }}>
        <strong>Ideia</strong> é o que ainda não existe e você acha que a PHD deveria ter.{' '}
        <strong>Iniciativa</strong> é o que você já está construindo, para uso próprio ou em projeto.
      </p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      <h2 className="pg-secao">O que você registrou</h2>

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : minhas.length === 0 ? (
        <div className="pg-vazio">
          Você ainda não registrou nada. Use os botões acima — e veja o que o resto da
          empresa está inventando no{' '}
          <Link className="pg-link" to="/programas/dashboard">Painel da Inovação</Link>.
        </div>
      ) : (
        <div className="pg-tabela-scroll">
          <table className="pg-tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Forma</th>
                <th>Setor</th>
                <th>Tipo</th>
                <th>Registro</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {minhas.map((l) => (
                <tr key={l.id}>
                  <td className="num">#{l.numero}</td>
                  <td>
                    <button type="button" className="pg-link" onClick={() => setDetalhe(l)}>
                      {l.titulo}
                    </button>
                    {/* Pendência herdada da importação: fica visível na linha,
                        senão só quem abre o detalhe descobre que falta algo. */}
                    {l.retorno?.startsWith('A preencher') && (
                      <span className="pg-motivo">Falta o retorno esperado — clique para preencher.</span>
                    )}
                  </td>
                  <td>{l.tipo === 'ideia' ? 'Ideia' : 'Iniciativa'}</td>
                  <td>{l.setor}</td>
                  <td>{CATEGORIA_LABEL[l.categoria] || l.categoria}</td>
                  <td className="num">{data(l.criado_em)}</td>
                  <td>
                    <select
                      className="pg-select"
                      value={l.situacao}
                      disabled={salvando === l.id}
                      onChange={(e) => trocarSituacao(l, e.target.value)}
                      aria-label={`Situação de ${l.titulo}`}
                    >
                      {SITUACOES.map((s) => (
                        <option key={s.valor} value={s.valor}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Aqui só aparece o que é meu, então editar é sempre permitido — o
          `souAdmin` cobre o caso do admin que abre um registro alheio pelo
          Dashboard e volta com ele aberto. */}
      <DetalheIdeia
        registro={detalhe}
        podeEditar={Boolean(detalhe) && (souAdmin || detalhe.autor_id === user?.id)}
        onFechar={() => setDetalhe(null)}
        onSalvar={salvarEdicao}
        onExcluir={apagar}
      />
    </div>
  );
}
