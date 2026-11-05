import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Star, AlertCircle, MessageSquareText, ArrowRight, RotateCcw } from 'lucide-react';
import FiltroArea from '../components/FiltroArea';
import { CabecalhoPagina, Carregando, Vazio } from '../components/ui';
import { useAuth } from '../../../../contexts/AuthContext';
import { getClasse, getServico } from '../../../../config/administrativo';
import { listarAvaliacoes } from '../../lib/chamados';
import {
  resumoSatisfacao, faixaDaMedia, posicaoNaEscala, comentarios,
  MINIMO_CONFIAVEL, NOTA_MIN, NOTA_MAX, NOTA_BAIXA_ATE,
} from '../../lib/satisfacao';
import { filtrarPorArea } from '../../lib/indicadores';

const umaCasa = (n) => (n === null ? '—' : n.toFixed(1).replace('.', ','));
const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

/** Marcas do eixo: 1, 2, 3, 4, 5. */
const MARCAS = Array.from({ length: NOTA_MAX - NOTA_MIN + 1 }, (_, i) => NOTA_MIN + i);

export default function SatisfacaoAdm() {
  const { modules } = useAuth();
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [soBaixas, setSoBaixas] = useState(false);
  // Total / ADM / TI — o mesmo recorte e a mesma regra dos Indicadores.
  const [area, setArea] = useState('todos');
  const blocoObs = useRef(null);

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

  const daArea = useMemo(() => filtrarPorArea(avaliacoes, area), [avaliacoes, area]);
  const observacoes = useMemo(
    () => comentarios(daArea, { apenasBaixas: soBaixas }),
    [daArea, soBaixas]
  );
  const quantasBaixas = useMemo(() => comentarios(daArea, { apenasBaixas: true }).length, [daArea]);

  // Gate de UI — a RLS é quem realmente restringe os dados.
  if (modules?.administrativo !== 'admin') return <Navigate to="/administrativo/novo" replace />;

  const { total, media, distribuicao, porServico } = resumoSatisfacao(daArea);
  const maiorNaDistribuicao = Math.max(1, ...distribuicao.map((d) => d.total));

  // A nota baixa é o que pede ação nesta tela, e a lista dela fica no fim da
  // página: o atalho marca o filtro e já leva até lá.
  const verBaixas = () => {
    setSoBaixas(true);
    blocoObs.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="adm-page adm-page-wide">
      <CabecalhoPagina
        Icon={Star}
        titulo="Satisfação"
        subtitulo="Como os solicitantes avaliaram os chamados já concluídos."
      />

      {erro && (
        <div className="adm-aviso tom-erro" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{erro}</span>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm adm-aviso-acao" onClick={carregar}>
            <RotateCcw size={14} aria-hidden="true" /> Tentar de novo
          </button>
        </div>
      )}

      <FiltroArea valor={area} onChange={setArea} />

      {/* Com erro a lista está vazia por falha: dizer "nenhuma avaliação" ali
          seria afirmar o que não se sabe. */}
      {carregando ? (
        <Carregando />
      ) : erro ? null : total === 0 ? (
        <Vazio Icon={Star} titulo={avaliacoes.length === 0 ? 'Nenhuma avaliação registrada ainda' : 'Nenhuma avaliação desta área ainda'}>
          {avaliacoes.length === 0
            ? 'Elas aparecem aqui conforme os chamados são concluídos e avaliados.'
            : 'Troque a área acima para ver as demais.'}
        </Vazio>
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
              {quantasBaixas > 0 && (
                <button type="button" className="adm-sat-atalho" onClick={verBaixas}>
                  {quantasBaixas === 1 ? 'Ler 1 comentário' : `Ler ${quantasBaixas} comentários`} de nota
                  até {NOTA_BAIXA_ATE} <ArrowRight size={13} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="adm-card adm-sat-dist">
              <h2 className="adm-card-tit">Distribuição das notas</h2>
              {distribuicao.map((d) => (
                <div key={d.nota} className="adm-sat-linha">
                  <span className="adm-sat-nota" aria-label={`Nota ${d.nota}`}>{d.nota}<Star size={11} aria-hidden="true" /></span>
                  <span className="adm-sat-trilho" aria-hidden="true">
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
                números, e ela lê bem melhor do que um gráfico narrado. O title
                da linha é para quem passa o mouse no ponto. */}
            <div className="adm-graf" aria-hidden="true">
              {porServico.map((s) => {
                const srv = getServico(s.classe, s.servico);
                const faixa = faixaDaMedia(s.media);
                const poucos = s.total < MINIMO_CONFIAVEL;
                return (
                  <div
                    key={`${s.classe}/${s.servico}`}
                    className="adm-graf-linha"
                    title={`${srv?.label || s.servico}: média ${umaCasa(s.media)} em ${s.total} ${s.total === 1 ? 'avaliação' : 'avaliações'}`}
                  >
                    <span className="adm-graf-rot">
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
                    <span className={`adm-graf-n${poucos ? ' is-poucos' : ''}`}>{s.total} aval.</span>
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

            {/* Fechada de saída: repete o gráfico de cima, e com vinte serviços
                as duas juntas empurravam os comentários para longe. Continua
                sendo a versão para leitor de tela: o <summary> é anunciado. */}
            <details className="adm-sat-tabela">
              <summary>Ver como tabela, com a classe de cada serviço</summary>
              <div className="adm-tabela-scroll">
                <table className="adm-tabela adm-tabela-direita">
                  <thead>
                    <tr><th>Serviço</th><th>Classe</th><th className="num">Avaliações</th><th className="num">Média</th></tr>
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
            </details>
          </div>

          {/* As observações são o que o gráfico não diz. Nota até 3 exige
              comentário (POP 9.2), então é aqui que está o motivo de cada nota
              baixa — e o link leva ao chamado, que é onde se atua. */}
          <div className="adm-card adm-sat-obs-card" ref={blocoObs}>
            <div className="adm-sat-obs-cab">
              <h2 className="adm-card-tit"><MessageSquareText size={16} aria-hidden="true" /> Observações dos solicitantes</h2>
              <label className="adm-sat-obs-filtro">
                <input
                  type="checkbox"
                  checked={soBaixas}
                  onChange={(e) => setSoBaixas(e.target.checked)}
                />
                Só notas até {NOTA_BAIXA_ATE} ({quantasBaixas})
              </label>
            </div>
            <p className="adm-campo-dica">
              Da pior nota para a melhor. Notas de 4 e 5 só aparecem quando o solicitante
              escreveu algo — nelas o comentário é opcional.
            </p>

            {/* "Comentário", e não "avaliação": pode haver nota baixa antiga sem
                texto, e o gráfico acima a mostra. Dizer que não há nota nenhuma
                contradiria a distribuição. */}
            {observacoes.length === 0 ? (
              <Vazio>
                {soBaixas
                  ? `Nenhum comentário em notas até ${NOTA_BAIXA_ATE}.`
                  : 'Nenhuma observação registrada ainda.'}
              </Vazio>
            ) : (
              <ul className="adm-sat-obs">
                {observacoes.map((a) => {
                  const srv = getServico(a.classe, a.servico);
                  // O assunto costuma ser o próprio nome do serviço: repetir o
                  // mesmo texto duas vezes na linha só atrapalha a leitura.
                  const nomeChamado = a.assunto && a.assunto !== srv?.label
                    ? `#${a.numero} ${a.assunto}`
                    : `#${a.numero}`;
                  return (
                    <li key={`${a.chamadoId || a.numero}-${a.avaliado_em}`} className="adm-sat-obs-item">
                      <div className="adm-sat-obs-topo">
                        <span className={`adm-sat-obs-nota tom-${faixaDaMedia(Number(a.nota))}`} aria-label={`Nota ${a.nota}`}>
                          {a.nota}<Star size={12} aria-hidden="true" />
                        </span>
                        <span className="adm-sat-obs-srv">{srv?.label || a.servico}</span>
                        {a.chamadoId ? (
                          <Link className="adm-sat-obs-link" to={`/administrativo/chamado/${a.chamadoId}`}>
                            {nomeChamado}
                          </Link>
                        ) : (
                          <span className="adm-sat-obs-link">{nomeChamado}</span>
                        )}
                        <span className="adm-sat-obs-data">{dataCurta(a.avaliado_em)}</span>
                      </div>
                      <p className="adm-sat-obs-txt">{a.comentario}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
