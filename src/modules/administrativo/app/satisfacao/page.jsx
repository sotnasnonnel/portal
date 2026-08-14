import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Star, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { getClasse, getServico } from '../../../../config/administrativo';
import { listarAvaliacoes } from '../../lib/chamados';
import { resumoSatisfacao } from '../../lib/satisfacao';

const umaCasa = (n) => (n === null ? '—' : n.toFixed(1).replace('.', ','));

export default function SatisfacaoAdm() {
  const { modules } = useAuth();
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setAvaliacoes(await listarAvaliacoes());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Gate de UI — a RLS é quem realmente restringe os dados.
  if (modules?.administrativo !== 'admin') return <Navigate to="/administrativo/novo" replace />;

  const { total, media, distribuicao, porServico } = resumoSatisfacao(avaliacoes);
  const maiorNaDistribuicao = Math.max(1, ...distribuicao.map((d) => d.total));

  return (
    <div className="adm-page adm-page-wide">
      <h1 className="adm-title"><Star size={24} /> Satisfação</h1>
      <p className="adm-sub">Como os solicitantes avaliaram os chamados já concluídos.</p>

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div>
      ) : total === 0 ? (
        <div className="adm-vazio">
          Nenhuma avaliação registrada ainda. Elas aparecem aqui conforme os chamados
          são concluídos e avaliados.
        </div>
      ) : (
        <>
          {/* O número é o gráfico: a média geral não precisa de plotagem. */}
          <div className="adm-sat-topo">
            <div className="adm-card adm-sat-hero">
              <span className="adm-sat-rot">Média geral</span>
              <strong className="adm-sat-num">{umaCasa(media)}</strong>
              <span className="adm-sat-estrelas" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={16} className={n <= Math.round(media) ? 'is-on' : ''} />
                ))}
              </span>
              <span className="adm-sat-pe">
                {total} {total === 1 ? 'avaliação' : 'avaliações'}
              </span>
            </div>

            <div className="adm-card adm-sat-dist">
              <h2 className="adm-card-tit">Distribuição das notas</h2>
              {distribuicao.map((d) => (
                <div key={d.nota} className="adm-sat-linha">
                  <span className="adm-sat-nota">{d.nota}<Star size={11} /></span>
                  <span className="adm-sat-trilho">
                    <span className="adm-sat-barra" style={{ width: `${(d.total / maiorNaDistribuicao) * 100}%` }} />
                  </span>
                  <span className="adm-sat-valor">{d.total}</span>
                  <span className="adm-sat-pct">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="adm-card">
            <h2 className="adm-card-tit">Média por serviço</h2>
            <p className="adm-campo-dica">Do pior para o melhor — é onde está o que precisa de atenção.</p>
            <div className="adm-tabela-scroll">
              <table className="adm-tabela">
                <thead>
                  <tr><th>Serviço</th><th>Classe</th><th>Avaliações</th><th>Média</th></tr>
                </thead>
                <tbody>
                  {porServico.map((s) => {
                    const cls = getClasse(s.classe);
                    const srv = getServico(s.classe, s.servico);
                    return (
                      <tr key={`${s.classe}/${s.servico}`}>
                        <td>{srv?.label || s.servico}</td>
                        <td>{cls?.label || s.classe}</td>
                        <td className="num">{s.total}</td>
                        <td className="num">
                          <span className={`adm-sat-media tom-${s.media < 3 ? 'baixa' : s.media < 4 ? 'media' : 'alta'}`}>
                            {umaCasa(s.media)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
