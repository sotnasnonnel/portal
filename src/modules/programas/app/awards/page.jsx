import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Award, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { AWARDS_CATEGORIAS, AWARDS_CATEGORIA_LABEL } from '../../../../config/programas';
import {
  buscarEstado, excluirProjeto, listarFinalistas, listarMeusVotos, listarPodio, listarProjetos,
} from '../../lib/awards';
import { podeInscrever, situacaoInscricoes } from '../../lib/awardsRegras';
import DetalheProjeto from './DetalheProjeto';
import Vencedores from './Vencedores';
import Votacao from './Votacao';

const AVISO_PRAZO = {
  antes: 'As inscrições abrem em 16/11 e vão até 04/12.',
  abertas: 'Inscrições abertas até 04/12.',
  encerradas: 'As inscrições foram encerradas em 04/12.',
};

/**
 * Projetos do Ano: o cadastro, os finalistas com o voto e, no fim, os
 * vencedores. O que aparece depende da fase que quem avalia definiu.
 */
export default function ProjetosDoAno() {
  const { user, modules } = useAuth();
  const [projetos, setProjetos] = useState([]);
  const [estado, setEstado] = useState(null);
  const [finalistas, setFinalistas] = useState(new Set());
  const [meusVotos, setMeusVotos] = useState({});
  const [podio, setPodio] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [detalhe, setDetalhe] = useState(null);

  const fase = estado?.fase || 'validacao';
  const liberado = fase === 'validacao' && podeInscrever(user, modules);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [todos, est] = await Promise.all([listarProjetos(), buscarEstado()]);
      setProjetos(todos);
      setEstado(est);
      if (est.fase !== 'validacao') {
        const [fin, votos, pod] = await Promise.all([
          listarFinalistas(),
          listarMeusVotos(user?.id),
          est.fase === 'revelada' ? listarPodio() : {},
        ]);
        setFinalistas(fin);
        setMeusVotos(votos);
        setPodio(pod);
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const excluir = async (projeto) => {
    await excluirProjeto(projeto);
    setProjetos((atual) => atual.filter((p) => p.id !== projeto.id));
  };

  // Quem avalia recebe todos da RLS; aqui a pessoa vê os dela e os finalistas.
  const meus = projetos.filter((p) => p.autor_id === user?.id);
  const listaFinal = projetos.filter((p) => finalistas.has(p.id));

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title"><Award size={24} /> Projetos do Ano</h1>
      <p className="pg-sub">
        PHD Awards: reconhecendo quem faz a diferença dentro e fora do campo. O prêmio celebra os
        projetos que mais representaram o propósito da PHD: transformar a forma de planejar e
        executar obras no Brasil, com impacto real para nossos clientes e para a sociedade.
      </p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : (
        <>
          {fase === 'validacao' && (
            <>
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
            </>
          )}

          {fase === 'votacao' && (
            <div className="pg-aviso pg-aw-prazo">
              A votação está aberta. Escolha o 1º, o 2º e o 3º lugar de cada categoria. Você pode
              mudar o voto até o encerramento.
            </div>
          )}
          {fase === 'encerrada' && (
            <div className="pg-aviso pg-aw-prazo">
              A votação foi encerrada. Os vencedores serão revelados na premiação.
            </div>
          )}

          {fase === 'revelada' && (
            <>
              <h2 className="pg-secao">Vencedores</h2>
              <Vencedores podio={podio} projetos={projetos} onVer={setDetalhe} />
            </>
          )}

          {(fase === 'votacao' || fase === 'encerrada') && (
            <>
              <h2 className="pg-secao">Finalistas</h2>
              <Votacao
                finalistas={listaFinal}
                meusVotos={meusVotos}
                aberta={fase === 'votacao'}
                onVotou={(categoria, ids) => setMeusVotos((atual) => ({ ...atual, [categoria]: ids }))}
                onVer={setDetalhe}
              />
            </>
          )}

          <h2 className="pg-secao" style={{ marginTop: fase === 'validacao' ? 0 : 24 }}>O que você cadastrou</h2>
          {meus.length === 0 ? (
            <div className="pg-vazio">Você não cadastrou nenhum projeto.</div>
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
                  {meus.map((p) => (
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
        </>
      )}

      {detalhe && (
        <DetalheProjeto
          projeto={detalhe}
          podeMexer={liberado && detalhe.autor_id === user?.id}
          onFechar={() => setDetalhe(null)}
          onExcluir={excluir}
        />
      )}
    </div>
  );
}
