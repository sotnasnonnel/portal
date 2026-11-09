import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Award, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { AWARDS_CATEGORIAS, AWARDS_CATEGORIA_LABEL } from '../../../../config/programas';
import { excluirProjeto, listarProjetos } from '../../lib/awards';
import { podeInscrever, situacaoInscricoes } from '../../lib/awardsRegras';
import DetalheProjeto from './DetalheProjeto';

const AVISO_PRAZO = {
  antes: 'As inscrições abrem em 16/11 e vão até 04/12.',
  abertas: 'Inscrições abertas até 04/12.',
  encerradas: 'As inscrições foram encerradas em 04/12.',
};

/** Projetos do Ano: o cadastro e o que a própria pessoa já enviou. */
export default function ProjetosDoAno() {
  const { user, modules } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const liberado = podeInscrever(user, modules);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      // Quem avalia recebe todos da RLS; aqui a pessoa vê os dela.
      const todos = await listarProjetos();
      setLinhas(todos.filter((p) => p.autor_id === user?.id));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const excluir = async (projeto) => {
    await excluirProjeto(projeto);
    setLinhas((atual) => atual.filter((p) => p.id !== projeto.id));
  };

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title"><Award size={24} /> Projetos do Ano</h1>
      <p className="pg-sub">
        PHD Awards: reconhecendo quem faz a diferença dentro e fora do campo. O prêmio celebra os
        projetos que mais representaram o propósito da PHD: transformar a forma de planejar e
        executar obras no Brasil, com impacto real para nossos clientes e para a sociedade.
      </p>

      <div className="pg-aw-cats">
        {AWARDS_CATEGORIAS.map((c) => (
          <div className="pg-aw-cat" key={c.valor}>
            <strong>{c.label}</strong>
            <span>{c.desc}</span>
          </div>
        ))}
      </div>

      <div className="pg-aviso pg-aw-prazo">{AVISO_PRAZO[situacaoInscricoes()]}</div>

      {liberado && (
        <div className="pg-acoes" style={{ marginTop: 0, marginBottom: 18 }}>
          <Link to="/programas/awards/novo" className="pg-btn pg-btn-primary">
            <Plus size={16} /> Cadastrar seu Projeto
          </Link>
        </div>
      )}

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      <h2 className="pg-secao">O que você cadastrou</h2>

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="pg-vazio">Você ainda não cadastrou nenhum projeto.</div>
      ) : (
        <div className="pg-tabela-scroll">
          <table className="pg-tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th className="col-titulo">Código ou setor</th>
                <th>Categoria</th>
                <th className="col-curta">Enviado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((p) => (
                <tr key={p.id}>
                  <td className="num">#{p.numero}</td>
                  <td className="col-titulo">
                    <button type="button" className="pg-link" onClick={() => setDetalhe(p)}>{p.codigo_setor}</button>
                  </td>
                  <td>{AWARDS_CATEGORIA_LABEL[p.categoria]}</td>
                  <td className="num">{new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && (
        <DetalheProjeto
          projeto={detalhe}
          podeMexer={liberado}
          onFechar={() => setDetalhe(null)}
          onExcluir={excluir}
        />
      )}
    </div>
  );
}
