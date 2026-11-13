import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, ListChecks, Loader2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  AWARDS_CATEGORIAS, AWARDS_CATEGORIA_LABEL, AWARDS_CRITERIOS, AWARDS_FASES, AWARDS_PESO_COMISSAO,
  AWARDS_PESO_VOTACAO, ehAvaliadorAwards, percentual,
} from '../../../../config/programas';
import {
  buscarEstado, buscarResultado, confirmarPodio, listarNotas, listarPodio, listarProjetos, mudarFase,
  reiniciarPremiacao,
} from '../../lib/awards';
import { podeReiniciarPremiacao, posicoesExigidas, rankingDaCategoria } from '../../lib/awardsRegras';
import AvaliarProjeto from './AvaliarProjeto';
import DetalheProjeto from './DetalheProjeto';

const formatar = (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/**
 * Todos os projetos cadastrados, só para quem avalia (quem protege o dado é a
 * RLS). Aqui também se abre e encerra a votação (todos os inscritos entram), se
 * acompanha o resultado parcial e se confirma o pódio. A revelação é a cerimônia
 * de Projetos do Ano (Cerimonia.jsx), no botão "Revelar vencedores!".
 */
export default function ProjetosInscritos() {
  const { user } = useAuth();
  const avaliador = ehAvaliadorAwards(user);
  const [linhas, setLinhas] = useState([]);
  const [estado, setEstado] = useState(null);
  const [resultado, setResultado] = useState([]);
  const [podioSalvo, setPodioSalvo] = useState({});
  const [notas, setNotas] = useState({});
  const [avaliando, setAvaliando] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [categoria, setCategoria] = useState('');
  const [detalhe, setDetalhe] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [todos, est] = await Promise.all([listarProjetos(), buscarEstado()]);
      setLinhas(todos);
      setEstado(est);
      const [res, pod, nts] = est.fase === 'validacao'
        ? [[], {}, {}]
        : await Promise.all([buscarResultado(), listarPodio(), listarNotas()]);
      setResultado(res);
      setPodioSalvo(pod);
      setNotas(nts);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { if (avaliador) carregar(); }, [avaliador, carregar]);

  const visiveis = useMemo(
    () => (categoria ? linhas.filter((p) => p.categoria === categoria) : linhas),
    [linhas, categoria],
  );

  if (!avaliador) return <Navigate to="/programas/awards" replace />;

  const fase = estado?.fase || 'validacao';
  const contar = (valor) => linhas.filter((p) => p.categoria === valor).length;

  const executar = async (acao) => {
    setErro('');
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <div className="pg-page pg-page-wide">
      <h1 className="pg-title"><ListChecks size={24} /> Projetos inscritos</h1>
      <p className="pg-sub">PHD Awards: Projetos do Ano. Só quem avalia vê esta tela.</p>

      {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="pg-vazio"><Loader2 size={20} className="pg-spin" /> Carregando…</div>
      ) : (
        <>
          <PainelFase
            estado={estado}
            inscritos={AWARDS_CATEGORIAS.map((c) => `${c.label} ${contar(c.valor)}`)}
            semVotos={!resultado.some((r) => r.eleitores > 0)}
            onMudar={(nova) => executar(() => mudarFase(nova))}
            onReiniciar={() => executar(reiniciarPremiacao)}
          />

          {fase !== 'validacao' && (
            <Resultado
              fase={fase}
              resultado={resultado}
              projetos={linhas}
              onVer={setDetalhe}
              podioSalvo={podioSalvo}
              notas={notas}
              onAvaliar={setAvaliando}
              onConfirmar={(podio) => executar(() => confirmarPodio(podio))}
            />
          )}

          <h2 className="pg-secao" style={{ marginTop: 24 }}>Todos os inscritos</h2>
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

          {visiveis.length === 0 ? (
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
                    <th>Vídeo</th>
                    <th>Apresentação</th>
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
                      <td>{p.video ? 'Sim' : 'Não'}</td>
                      <td>{p.apresentacao ? 'Sim' : 'Não'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {detalhe && <DetalheProjeto projeto={detalhe} onFechar={() => setDetalhe(null)} />}
      {avaliando && (
        <AvaliarProjeto
          projeto={avaliando}
          notas={notas[avaliando.id]}
          colaboradorId={user?.id}
          onSalvo={(id, valores) => setNotas((atual) => ({ ...atual, [id]: valores }))}
          onFechar={() => setAvaliando(null)}
        />
      )}
    </div>
  );
}

/**
 * Confirmação em dois passos no próprio botão, como o BotaoExcluir: abrir,
 * encerrar e revelar mudam o que todo mundo vê.
 */
function BotaoConfirmar({ rotulo, pergunta, primario = false, onConfirmar }) {
  const [armado, setArmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const classe = primario ? 'pg-btn-primary' : 'pg-btn-ghost';

  if (!armado) {
    return <button type="button" className={`pg-btn ${classe}`} onClick={() => setArmado(true)}>{rotulo}</button>;
  }
  const confirmar = async () => {
    setOcupado(true);
    await onConfirmar();
    setOcupado(false);
    setArmado(false);
  };
  return (
    <span className="pg-aw-confirma">
      <strong>{pergunta}</strong>
      <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => setArmado(false)} disabled={ocupado}>
        Cancelar
      </button>
      <button type="button" className="pg-btn pg-btn-primary pg-btn-sm" onClick={confirmar} disabled={ocupado}>
        {ocupado ? <Loader2 size={14} className="pg-spin" /> : 'Confirmar'}
      </button>
    </span>
  );
}

function PainelFase({ estado, inscritos, semVotos, onMudar, onReiniciar }) {
  const { fase, mudou_em: mudouEm } = estado;
  const podeReiniciar = podeReiniciarPremiacao();
  return (
    <section className="pg-card">
      <div className="pg-roi-cab">
        <h2 className="pg-card-tit">Fase do prêmio</h2>
        <span className="pg-badge tom-destaque">{AWARDS_FASES[fase].label}</span>
      </div>
      <p className="pg-aw-dica">{AWARDS_FASES[fase].dica}</p>
      <p className="pg-aw-dica">
        Inscritos: {inscritos.join(' · ')}
        {mudouEm && fase !== 'validacao' && ` · desde ${new Date(mudouEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`}
      </p>
      <div className="pg-acoes" style={{ marginTop: 12 }}>
        {fase === 'validacao' && (
          <BotaoConfirmar
            primario rotulo="Abrir votação"
            pergunta="Todos os inscritos entram na votação e ficam visíveis para todos, e os projetos não mudam mais. Abrir?"
            onConfirmar={() => onMudar('votacao')}
          />
        )}
        {fase === 'votacao' && (
          <>
            <BotaoConfirmar
              primario rotulo="Encerrar votação"
              pergunta="Ninguém mais vota. Encerrar?"
              onConfirmar={() => onMudar('encerrada')}
            />
            {semVotos && (
              <BotaoConfirmar
                rotulo="Voltar para as inscrições"
                pergunta="Os projetos deixam de aparecer para todos e voltam a poder ser editados. Voltar?"
                onConfirmar={() => onMudar('validacao')}
              />
            )}
          </>
        )}
        {fase === 'encerrada' && (
          <BotaoConfirmar
            rotulo="Reabrir votação"
            pergunta="Todos voltam a poder votar. Reabrir?"
            onConfirmar={() => onMudar('votacao')}
          />
        )}
        {fase === 'revelada' && (
          <>
            <Link className="pg-btn pg-btn-primary" to="/programas/awards">Ver como todos veem</Link>
            <BotaoConfirmar
              rotulo="Ocultar vencedores"
              pergunta="O pódio some para todos e a votação volta a ficar encerrada. Ocultar?"
              onConfirmar={() => onMudar('encerrada')}
            />
          </>
        )}
        {podeReiniciar && (
          <BotaoConfirmar
            rotulo="Reiniciar premiação"
            pergunta="Apaga votos e vencedores e volta para as inscrições. Reiniciar?"
            onConfirmar={onReiniciar}
          />
        )}
      </div>
      {podeReiniciar && (
        <p className="pg-aw-dica" style={{ marginTop: 10, marginBottom: 0 }}>
          Até 15/11 dá para percorrer todas as etapas e reiniciar a premiação quantas vezes quiserem.
          Os projetos cadastrados até lá cada um apaga pelo botão Excluir, em Projetos do Ano. A
          partir de 16/11 o botão some e os votos passam a valer.
        </p>
      )}
    </section>
  );
}

/**
 * Resultado por categoria: votos, nota da votação, nota da comissão e nota final
 * (pelos pesos de AWARDS_PESO_*). Com a votação encerrada, o pódio a confirmar.
 */
function Resultado({
  fase, resultado, projetos, podioSalvo, notas, onVer, onAvaliar, onConfirmar,
}) {
  const porId = useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos]);
  const rankings = useMemo(() => Object.fromEntries(AWARDS_CATEGORIAS.map((c) => [
    c.valor, rankingDaCategoria(resultado.filter((r) => r.categoria === c.valor), notas),
  ])), [resultado, notas]);
  const temCriterios = AWARDS_CRITERIOS.length > 0;
  const podeAvaliar = temCriterios && (fase === 'votacao' || fase === 'encerrada');

  const sugerido = useMemo(() => Object.fromEntries(AWARDS_CATEGORIAS.map((c) => {
    const r = rankings[c.valor];
    return [c.valor, r.slice(0, posicoesExigidas(r.length)).map((l) => l.projeto_id)];
  })), [rankings]);
  // Com pódio já confirmado, a tela abre nele, não no cálculo: o empate resolvido fica.
  const temSalvo = AWARDS_CATEGORIAS.some((c) => podioSalvo[c.valor]?.length);
  const inicial = useMemo(
    () => (temSalvo ? { ...sugerido, ...podioSalvo } : sugerido),
    [temSalvo, sugerido, podioSalvo],
  );
  const [podio, setPodio] = useState(inicial);
  useEffect(() => { setPodio(inicial); }, [inicial]);
  const confirmado = temSalvo && AWARDS_CATEGORIAS.every(
    (c) => (podioSalvo[c.valor] || []).join() === (podio[c.valor] || []).join(),
  );
  const [confirmando, setConfirmando] = useState(false);
  const confirmar = async () => {
    setConfirmando(true);
    await onConfirmar(podio);
    setConfirmando(false);
  };

  const escolher = (cat, i, id) => setPodio((atual) => ({
    ...atual, [cat]: atual[cat].map((v, j) => (j === i ? id : v)),
  }));

  const cartoes = AWARDS_CATEGORIAS.map((c) => {
    const ranking = rankings[c.valor];
    const eleitores = ranking[0]?.eleitores || 0;
    const temEmpate = ranking.some((l) => l.empate);
    const semNota = temCriterios ? ranking.filter((l) => l.comissao == null).length : 0;
    return (
      <section className="pg-card" key={c.valor}>
        <div className="pg-roi-cab">
          <h2 className="pg-card-tit">Resultado · {c.label}</h2>
          <span className="pg-badge tom-neutro">{eleitores} {eleitores === 1 ? 'pessoa votou' : 'pessoas votaram'}</span>
        </div>

        {ranking.length > 0 && !temCriterios && (
          <p className="pg-aw-dica">
            Os critérios da comissão ainda não foram definidos: por enquanto a nota final é só a da votação.
          </p>
        )}
        {semNota > 0 && (
          <p className="pg-aw-dica">
            Falta a nota da comissão em {semNota} {semNota === 1 ? 'projeto' : 'projetos'}: sem ela, o projeto fica sem nota final e vai para o fim da lista.
          </p>
        )}

        {ranking.length === 0 ? (
          <p className="pg-aw-dica">Nenhum projeto nesta categoria.</p>
        ) : (
          <div className="pg-tabela-scroll">
            <table className="pg-tabela pg-aw-resultado">
              <thead>
                <tr>
                  <th>Posição</th>
                  <th className="col-titulo">Projeto</th>
                  <th>Cadastrado por</th>
                  <th className="num">Votos em 1º</th>
                  <th className="num">Em 2º</th>
                  <th className="num">Em 3º</th>
                  <th className="num">Pontos</th>
                  <th className="num">Votação ({percentual(AWARDS_PESO_VOTACAO)})</th>
                  {temCriterios && <th className="num">Comissão ({percentual(AWARDS_PESO_COMISSAO)})</th>}
                  <th className="num">Nota final</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((l) => {
                  const p = porId.get(l.projeto_id);
                  return (
                    <tr key={l.projeto_id} className={l.posicao <= 3 ? 'pg-roi-podio' : ''}>
                      <td>
                        <span className="pg-roi-pos">{l.posicao}º</span>
                        {l.empate && <span className="pg-badge tom-andamento" style={{ marginLeft: 6 }}>Empate</span>}
                      </td>
                      <td className="col-titulo">
                        {p ? <button type="button" className="pg-link" onClick={() => onVer(p)}>{p.codigo_setor}</button> : '—'}
                      </td>
                      <td>{p?.autorNome || '—'}</td>
                      <td className="num">{l.primeiro}</td>
                      <td className="num">{l.segundo}</td>
                      <td className="num">{l.terceiro}</td>
                      <td className="num">{l.pontos}</td>
                      <td className="num">{formatar(l.votacao)}</td>
                      {temCriterios && (
                        <td className="num">
                          {formatar(l.comissao)}
                          {podeAvaliar && p && (
                            <button type="button" className="pg-link" style={{ marginLeft: 8 }} onClick={() => onAvaliar(p)}>
                              {l.comissao == null ? 'Avaliar' : 'Editar'}
                            </button>
                          )}
                        </td>
                      )}
                      <td className="num"><strong>{formatar(l.final)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {fase === 'encerrada' && ranking.length > 0 && (
          <>
            <h3 className="pg-secao" style={{ marginTop: 16 }}>Pódio a confirmar</h3>
            {temEmpate && (
              <div className="pg-aviso tom-atencao">
                <AlertTriangle size={16} /> Há empate na nota final do pódio. A comissão decide a ordem: ajuste abaixo antes de confirmar.
              </div>
            )}
            <div className="pg-aw-voto">
              {(podio[c.valor] || []).map((id, i) => (
                <div className="pg-campo" key={i}>
                  <label htmlFor={`podio-${c.valor}-${i}`}>{i + 1}º lugar</label>
                  <select
                    id={`podio-${c.valor}-${i}`}
                    className="pg-input pg-select"
                    value={id}
                    onChange={(e) => escolher(c.valor, i, e.target.value)}
                  >
                    {ranking.map((l) => (
                      <option key={l.projeto_id} value={l.projeto_id}>
                        {porId.get(l.projeto_id)?.codigo_setor || '—'} (nota {formatar(l.final)})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}

      </section>
    );
  });

  return (
    <>
      {cartoes}
      {fase === 'encerrada' && confirmado && (
        <div className="pg-aviso tom-ok">
          <CheckCircle2 size={16} />
          <span>
            Pódio confirmado. Ninguém vê ainda. Na hora do anúncio, abra{' '}
            <Link className="pg-link" to="/programas/awards">Projetos do Ano</Link> e clique em
            {' '}<strong>Revelar vencedores!</strong>: o 3º, o 2º e o 1º de cada categoria aparecem um por vez.
          </span>
        </div>
      )}
      {fase === 'encerrada' && (
        <div className="pg-acoes" style={{ marginTop: 0 }}>
          <button type="button" className="pg-btn pg-btn-primary" onClick={confirmar} disabled={confirmando || confirmado}>
            {confirmando && <Loader2 size={15} className="pg-spin" />}
            {confirmado ? 'Pódio confirmado' : temSalvo ? 'Confirmar o pódio alterado' : 'Confirmar pódio'}
          </button>
        </div>
      )}
    </>
  );
}
