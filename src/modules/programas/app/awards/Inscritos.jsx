import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, ListChecks, Loader2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  AWARDS_CATEGORIAS, AWARDS_CATEGORIA_LABEL, ehAvaliadorAwards,
} from '../../../../config/programas';
import { listarProjetos } from '../../lib/awards';
import DetalheProjeto from './DetalheProjeto';

/** Todos os projetos cadastrados, só para quem avalia. Quem protege o dado é a RLS. */
export default function ProjetosInscritos() {
  const { user } = useAuth();
  const avaliador = ehAvaliadorAwards(user);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [categoria, setCategoria] = useState('');
  const [detalhe, setDetalhe] = useState(null);

  useEffect(() => {
    if (!avaliador) return;
    listarProjetos()
      .then(setLinhas)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [avaliador]);

  const visiveis = useMemo(
    () => (categoria ? linhas.filter((p) => p.categoria === categoria) : linhas),
    [linhas, categoria],
  );

  if (!avaliador) return <Navigate to="/programas/awards" replace />;

  const contar = (valor) => linhas.filter((p) => p.categoria === valor).length;

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title"><ListChecks size={24} /> Projetos inscritos</h1>
      <p className="pg-sub">PHD Awards: Projetos do Ano. Só quem avalia vê esta lista.</p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      <div className="pg-chips" style={{ marginBottom: 14 }}>
        <button
          type="button" className={`pg-chip ${!categoria ? 'is-on' : ''}`}
          aria-pressed={!categoria} onClick={() => setCategoria('')}
        >
          Todos ({linhas.length})
        </button>
        {AWARDS_CATEGORIAS.map((c) => (
          <button
            key={c.valor} type="button" className={`pg-chip ${categoria === c.valor ? 'is-on' : ''}`}
            aria-pressed={categoria === c.valor} onClick={() => setCategoria(c.valor)}
          >
            {c.label} ({contar(c.valor)})
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : visiveis.length === 0 ? (
        <div className="pg-vazio">Nenhum projeto cadastrado aqui ainda.</div>
      ) : (
        <div className="pg-tabela-scroll">
          <table className="pg-tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th className="col-titulo">Código ou setor</th>
                <th>Categoria</th>
                <th>Cadastrado por</th>
                <th className="col-curta">Enviado</th>
                <th>Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <tr key={p.id}>
                  <td className="num">#{p.numero}</td>
                  <td className="col-titulo">
                    <button type="button" className="pg-link" onClick={() => setDetalhe(p)}>{p.codigo_setor}</button>
                  </td>
                  <td>{AWARDS_CATEGORIA_LABEL[p.categoria]}</td>
                  <td>{p.autorNome || '—'}</td>
                  <td className="num">{new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td>{p.apresentacao ? 'Sim' : 'Não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && <DetalheProjeto projeto={detalhe} onFechar={() => setDetalhe(null)} />}
    </div>
  );
}
