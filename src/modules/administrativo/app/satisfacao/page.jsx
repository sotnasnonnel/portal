import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Star, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { getClasse, getServico } from '../../../../config/administrativo';
import { listarAvaliacoes } from '../../lib/chamados';
import {
  resumoSatisfacao, faixaDaMedia, posicaoNaEscala, MINIMO_CONFIAVEL, NOTA_MIN, NOTA_MAX,
} from '../../lib/satisfacao';

const umaCasa = (n) => (n === null ? '—' : n.toFixed(1).replace('.', ','));

/** Marcas do eixo: 1, 2, 3, 4, 5. */
const MARCAS = Array.from({ length: NOTA_MAX - NOTA_MIN + 1 }, (_, i) => NOTA_MIN + i);

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
            <h2 className="adm-card-tit">Média por tipo de chamado</h2>
            <p className="adm-campo-dica">Do pior para o melhor — é onde está o que precisa de atenção.</p>

            {/* Oculto para leitor de tela: a tabela logo abaixo tem os mesmos
                números, e ela lê bem melhor do que um gráfico narrado. */}
            <div className="adm-graf" aria-hidden="true">
              {porServico.map((s) => {
                const srv = getServico(s.classe, s.servico);
                const faixa = faixaDaMedia(s.media);
                const poucos = s.total < MINIMO_CONFIAVEL;
                return (
                  <div key={`${s.classe}/${s.servico}`} className="adm-graf-linha">
                    <span className="adm-graf-rot" title={srv?.label || s.servico}>
                      {srv?.label || s.servico}
                    </span>
                    <span className="adm-graf-trilho">
                      {MARCAS.map((m) => (
                        <i key={m} className="adm-graf-marca" style={{ left: `${posicaoNaEscala(m)}%` }} />
                      ))}
                      <span className="adm-graf-guia" style={{ width: `${posicaoNaEscala(s.media)}%` }} />
                      <span
                        className={`adm-graf-ponto tom-${faixa}${poucos ? ' is-poucos' : ''}`}
                        style={{ left: `${posicaoNaEscala(s.media)}%` }}
                      />
                    </span>
                    <span className={`adm-sat-media tom-${faixa}`}>{umaCasa(s.media)}</span>
                    <span className={`adm-graf-n${poucos ? ' is-poucos' : ''}`}>n={s.total}</span>
                  </div>
                );
              })}

              <div className="adm-graf-linha adm-graf-eixo">
                <span className="adm-graf-rot" />
                <span className="adm-graf-trilho">
                  {MARCAS.map((m) => (
                    <i key={m} className="adm-graf-num" style={{ left: `${posicaoNaEscala(m)}%` }}>{m}</i>
                  ))}
                </span>
                <span /><span />
              </div>
            </div>

            <p className="adm-graf-nota">
              <span className="adm-graf-chave"><i className="tom-baixa" /> abaixo de 3</span>
              <span className="adm-graf-chave"><i className="tom-media" /> de 3 a 4</span>
              <span className="adm-graf-chave"><i className="tom-alta" /> 4 ou mais</span>
              <span className="adm-graf-chave adm-graf-chave-fim">
                <i className="is-poucos" /> menos de {MINIMO_CONFIAVEL} avaliações — média ainda instável
              </span>
            </p>

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
                          <span className={`adm-sat-media tom-${faixaDaMedia(s.media)}`}>
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
