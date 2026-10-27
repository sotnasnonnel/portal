import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ClipboardCheck, Loader2, Trophy } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ehAdminProgramas } from '../../../../config/programas';
import { listarIdeias } from '../../lib/ideias';
import {
  PRAZO_RELATORIO, calcularFinanceiro, calcularTempo, listarFichas, montarRanking,
  notaFacilidade, situacaoFicha, validarFicha,
} from '../../lib/roi';
import ValidarFichaModal from '../components/ValidarFichaModal';

/**
 * Ranking do Programa de Inovação 2026 — a pontuação que sai das fichas de ROI.
 *
 * Aberto a todos, como o Painel da Inovação. Três listas, porque são três
 * perguntas diferentes:
 *   classificação     -> quem está ganhando (só ficha validada e elegível)
 *   fora do ranking   -> o que ainda falta para cada ficha entrar
 *   sem ficha         -> quem registrou e ainda não preencheu (é obrigatório)
 *
 * A equipe de Inovação (admin do módulo) valida pelas duas primeiras tabelas.
 */

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const ordinal = (n) => (n ? `${n}º` : '—');

// Fora do ranking, o que espera a equipe vem primeiro: é a fila de quem valida.
const ORDEM = { pendente: 0, incompleta: 1, recusada: 2, nao_elegivel: 3 };

function Criterio({ valor, pos, pontos }) {
  return (
    <>
      <span className="pg-roi-valor">{valor}</span>
      <span className="pg-motivo">{ordinal(pos)} · {pontos} pt{pontos === 1 ? '' : 's'}</span>
    </>
  );
}

export default function Ranking() {
  const { user, modules } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [validando, setValidando] = useState(null);   // { ficha, registro }

  const souAdmin = ehAdminProgramas(modules);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [r, f] = await Promise.all([listarIdeias(), listarFichas()]);
      setRegistros(r);
      setFichas(f);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const ranking = useMemo(() => montarRanking(registros, fichas), [registros, fichas]);

  const porIdeia = useMemo(() => new Map(registros.map((r) => [r.id, r])), [registros]);
  const noRanking = useMemo(() => new Set(ranking.map((i) => i.id)), [ranking]);

  const foraDoRanking = useMemo(() => fichas
    .filter((f) => !noRanking.has(f.id) && porIdeia.has(f.ideia_id))
    .map((f) => ({ ficha: f, registro: porIdeia.get(f.ideia_id), situacao: situacaoFicha(f) }))
    .sort((a, b) => (ORDEM[a.situacao.valor] ?? 9) - (ORDEM[b.situacao.valor] ?? 9)
      || a.registro.numero - b.registro.numero),
  [fichas, noRanking, porIdeia]);

  const semFicha = useMemo(() => {
    const comFicha = new Set(fichas.map((f) => f.ideia_id));
    return registros.filter((r) => !comFicha.has(r.id)).sort((a, b) => a.numero - b.numero);
  }, [registros, fichas]);

  const aguardando = foraDoRanking.filter((i) => i.situacao.valor === 'pendente').length;

  const salvarParecer = async (valores) => {
    const nova = await validarFicha(validando.ficha, valores, user.id);
    setFichas((atual) => atual.map((f) => (f.id === nova.id ? nova : f)));
    setValidando(null);
  };

  const acaoValidar = (ficha, registro) => souAdmin && (
    <td className="col-acoes">
      <button
        type="button" className="pg-icone-acao"
        onClick={() => setValidando({ ficha, registro })}
        title="Validar ficha" aria-label={`Validar ficha de ${registro.titulo}`}
      >
        <ClipboardCheck size={16} />
      </button>
    </td>
  );

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title"><Trophy size={24} /> Ranking</h1>
      <p className="pg-sub">
        Programa de Inovação 2026 — a pontuação de cada solução pela ficha de ROI. Fichas até {PRAZO_RELATORIO}.
      </p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : (
        <>
          <p className="pg-resumo pg-roi-resumo">
            <strong>{ranking.length}</strong> no ranking
            <span> · {aguardando} aguardando validação · {semFicha.length} registro(s) sem ficha</span>
          </p>

          <div className="pg-card">
            <h2 className="pg-card-tit">Classificação</h2>
            <p className="pg-campo-dica">
              Em cada critério, 1º lugar leva 3 pontos, 2º leva 2 e 3º leva 1 — máximo de 9. Os três primeiros
              no total são os vencedores. Empate no total: prevalece quem mais engajou no Campo de Ideias.
            </p>

            {ranking.length === 0 ? (
              <div className="pg-vazio pg-roi-vazio">
                Nenhuma ficha validada ainda. Entram aqui as fichas completas, com workshop da PHD, depois da
                validação da equipe de Inovação.
              </div>
            ) : (
              <div className="pg-tabela-scroll">
                <table className="pg-tabela">
                  <thead>
                    <tr>
                      <th>Pos.</th>
                      <th className="col-titulo">Solução</th>
                      <th>Autor · setor</th>
                      <th>Redução de custo</th>
                      <th>Redução de tempo</th>
                      <th>Facilidade</th>
                      <th>Pontos</th>
                      {souAdmin && <th className="col-acoes">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((i) => (
                      <tr key={i.id} className={i.posicao <= 3 ? 'pg-roi-podio' : ''}>
                        <td><span className="pg-roi-pos">{ordinal(i.posicao)}</span></td>
                        <td className="col-titulo">
                          <Link className="pg-link" to={`/programas/ideias/${i.registro.id}/roi`}>
                            #{i.registro.numero} — {i.registro.titulo}
                          </Link>
                          {i.desempatado && (
                            <span className="pg-motivo">
                              Empate no total, desempatado pelo engajamento ({i.engajamento} registro(s) no Campo de Ideias).
                            </span>
                          )}
                          {i.empateAberto && (
                            <span className="pg-motivo">Empate também no engajamento: a equipe de Inovação decide.</span>
                          )}
                        </td>
                        <td>{i.registro.autorNome || '—'} · {i.registro.setor}</td>
                        <td className="num">
                          <Criterio valor={i.custo === null ? 'n.a.' : pct.format(i.custo)} pos={i.pos.custo} pontos={i.pontos.custo} />
                        </td>
                        <td className="num">
                          <Criterio valor={pct.format(i.tempo)} pos={i.pos.tempo} pontos={i.pontos.tempo} />
                        </td>
                        <td className="num">
                          <Criterio valor={`${i.facilidade}/8`} pos={i.pos.facilidade} pontos={i.pontos.facilidade} />
                        </td>
                        <td className="num"><strong className="pg-roi-total">{i.total}</strong></td>
                        {acaoValidar(i.ficha, i.registro)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {foraDoRanking.length > 0 && (
            <div className="pg-card">
              <h2 className="pg-card-tit">Fichas fora do ranking</h2>
              <p className="pg-campo-dica">
                {souAdmin
                  ? 'Valide pelo ícone da linha. Só ficha completa e com workshop entra no ranking.'
                  : 'Fichas em preenchimento, esperando a equipe de Inovação ou sem workshop da PHD.'}
              </p>
              <div className="pg-tabela-scroll">
                <table className="pg-tabela">
                  <thead>
                    <tr>
                      <th className="col-titulo">Solução</th>
                      <th>Autor · setor</th>
                      <th>Redução de custo</th>
                      <th>Redução de tempo</th>
                      <th>Facilidade</th>
                      <th>Situação</th>
                      {souAdmin && <th className="col-acoes">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {foraDoRanking.map(({ ficha, registro, situacao }) => {
                      const fin = calcularFinanceiro(ficha);
                      const tempo = calcularTempo(ficha);
                      const fac = notaFacilidade(ficha);
                      return (
                        <tr key={ficha.id}>
                          <td className="col-titulo">
                            <Link className="pg-link" to={`/programas/ideias/${registro.id}/roi`}>
                              #{registro.numero} — {registro.titulo}
                            </Link>
                            {situacao.valor === 'recusada' && ficha.parecer && (
                              <span className="pg-motivo">{ficha.parecer}</span>
                            )}
                          </td>
                          <td>{registro.autorNome || '—'} · {registro.setor}</td>
                          <td className="num">{fin.estado !== 'ok' ? '—' : fin.reducao === null ? 'n.a.' : pct.format(fin.reducao)}</td>
                          <td className="num">{tempo.estado === 'ok' ? pct.format(tempo.reducao) : '—'}</td>
                          <td className="num">{fac.completa ? `${fac.nota}/8` : '—'}</td>
                          <td><span className={`pg-badge ${situacao.tom}`}>{situacao.label}</span></td>
                          {acaoValidar(ficha, registro)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {semFicha.length > 0 && (
            <div className="pg-card">
              <h2 className="pg-card-tit">Registros sem ficha de ROI</h2>
              <p className="pg-campo-dica">
                Todo registro do Campo de Ideias precisa da ficha preenchida por quem o registrou.
              </p>
              <div className="pg-tabela-scroll is-alta">
                <table className="pg-tabela">
                  <thead>
                    <tr>
                      <th className="col-titulo">Solução</th>
                      <th className="col-curta">Forma</th>
                      <th>Autor · setor</th>
                      <th className="col-curta">Registro</th>
                      <th className="col-acoes" aria-label="Ação" />
                    </tr>
                  </thead>
                  <tbody>
                    {semFicha.map((r) => (
                      <tr key={r.id}>
                        <td className="col-titulo">#{r.numero} — {r.titulo}</td>
                        <td className="col-curta">{r.tipo === 'ideia' ? 'Ideia' : 'Iniciativa'}</td>
                        <td>{r.autorNome || '—'} · {r.setor}</td>
                        <td className="num">{data(r.criado_em)}</td>
                        <td className="col-acoes">
                          {r.autor_id === user?.id && (
                            <Link className="pg-btn pg-btn-primary pg-btn-sm" to={`/programas/ideias/${r.id}/roi`}>
                              Preencher
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {validando && (
        <ValidarFichaModal
          ficha={validando.ficha}
          registro={validando.registro}
          onFechar={() => setValidando(null)}
          onValidar={salvarParecer}
        />
      )}
    </div>
  );
}
