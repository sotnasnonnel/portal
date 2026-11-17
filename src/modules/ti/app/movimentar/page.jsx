import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeftRight, ArrowRight, Check, CheckCircle2, FileSignature, Mail, Search, X,
} from 'lucide-react';
import { SITUACOES } from '../../../../config/ti';
import { opcoesDePessoas } from '../../lib/campos';
import { useTi } from '../components/TiContext';
import {
  Estado, ListaSuspensa, PageHead, Pill, Secao,
} from '../components/Pecas';
import { fmtDate, tomSituacao, tomTermo } from '../../lib/formato';
import {
  ROTA_TROCA_EQUIPAMENTO, casaBusca, ehEmail, emUso, emailChave, pendenteTermo, todayISO,
} from '../../lib/regras';
import { movimentar } from '../../lib/ti';
import './movimentar.css';

const MAX_SUGESTOES = 8;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const equip = (n) => plural(n, 'equipamento', 'equipamentos');

/**
 * Movimentar ativo: troca o responsável e/ou a situação de um ou vários
 * equipamentos, com data e observação. Cada equipamento ganha uma linha no
 * histórico (ti_movimentacoes). Trocar de pessoa zera o termo do equipamento:
 * o termo antigo cobria outra pessoa.
 *
 * Fluxo da tela: 1) escolher os equipamentos, 2) dizer para onde vão, 3) revisar
 * o efeito de cada um (inclusive no termo) e confirmar. Depois de gravar, um
 * resumo fica na tela com o que mudou e o que a nova pessoa vai receber.
 */
export default function MovimentarTi() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const {
    dados, carregando, recarregar, toast, podeEscrever, nomeDe, abrirAtivo,
  } = useTi();
  const [sel, setSel] = useState(() => (params.get('ativo') ? [params.get('ativo')] : []));
  const [q, setQ] = useState('');
  const [para, setPara] = useState('');
  const [situacao, setSituacao] = useState('');
  const [data, setData] = useState(todayISO());
  const [obs, setObs] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState('');
  const [resultado, setResultado] = useState(null);
  const [anuncio, setAnuncio] = useState('');
  const revisaoRef = useRef(null);
  const resultadoRef = useRef(null);

  const porId = useMemo(() => new Map(dados.ativos.map((a) => [a.id, a])), [dados.ativos]);
  const escolhidos = sel.map((id) => porId.get(id)).filter(Boolean);
  const achados = useMemo(() => (q.trim().length < 2 ? [] : dados.ativos
    .filter((a) => !sel.includes(a.id) && casaBusca({ ...a, observacoes: nomeDe(a.responsavel) }, q))),
  [q, dados.ativos, sel, nomeDe]);
  const sugestoes = achados.slice(0, MAX_SUGESTOES);
  const comResp = useMemo(() => {
    const m = new Map();
    dados.ativos.filter(emUso).forEach((a) => {
      const k = emailChave(a.responsavel);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].map(([email, n]) => ({ email, n, nome: nomeDe(email) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [dados.ativos, nomeDe]);

  const pessoasOpcoes = useMemo(() => opcoesDePessoas(dados.pessoas, dados.ativos), [dados.pessoas, dados.ativos]);
  const atuais = [...new Set(escolhidos.map((a) => emailChave(a.responsavel)))];
  const novoResp = para.trim().toLowerCase();
  const respValido = !novoResp || ehEmail(novoResp);
  const situacaoFinal = situacao || (novoResp ? 'Em utilização' : '');
  const hoje = todayISO();

  // Efeito de cada equipamento, na mesma conta da gravação (lib/ti.js → movimentar).
  const efeitos = escolhidos.map((a) => {
    const trocaPessoa = !!novoResp && emailChave(a.responsavel) !== novoResp;
    const respDepois = novoResp || a.responsavel || '';
    const sitDepois = situacaoFinal || a.situacao || '';
    const termoDepois = trocaPessoa ? 'Sem termo' : (a.situacao_termo || '');
    return {
      a,
      trocaPessoa,
      respDepois,
      sitDepois,
      termoDepois,
      mudaSit: sitDepois !== (a.situacao || ''),
      pendente: pendenteTermo({ situacao: sitDepois, responsavel: respDepois, situacao_termo: termoDepois }),
    };
  });
  const semMudanca = efeitos.filter((e) => !e.trocaPessoa && !e.mudaSit);
  const trocam = efeitos.filter((e) => e.trocaPessoa);
  const pendentesNovo = trocam.filter((e) => e.pendente);

  // Tudo o que falta, em ordem; o primeiro item vira a mensagem do botão.
  const faltas = [];
  if (!escolhidos.length) faltas.push('Escolha ao menos um equipamento.');
  if (!respValido) faltas.push('O novo responsável deve ser um e-mail válido.');
  if (!novoResp && !situacao) faltas.push('Informe o novo responsável ou a nova situação.');
  if (!data) faltas.push('Informe a data da movimentação.');
  if (escolhidos.length && !faltas.length && semMudanca.length === escolhidos.length) {
    faltas.push(escolhidos.length === 1
      ? 'Nada muda: o equipamento já está com essa pessoa e nessa situação.'
      : 'Nada muda: todos os equipamentos já estão com essa pessoa e nessa situação.');
  }
  const erro = faltas[0] || '';

  // A revisão aparece abaixo dos dois cartões; leva a pessoa até ela.
  useEffect(() => {
    if (revisando) revisaoRef.current?.focus();
  }, [revisando]);
  useEffect(() => {
    if (resultado) resultadoRef.current?.focus();
  }, [resultado]);

  const mexeu = () => { setRevisando(false); setFalha(''); setResultado(null); };
  const adicionar = (id) => {
    const a = porId.get(id);
    setSel((s) => [...s, id]);
    setQ('');
    mexeu();
    if (a) setAnuncio(`${a.numero_serie} adicionado. ${equip(sel.length + 1)} na lista.`);
  };
  const tirar = (id) => {
    const a = porId.get(id);
    setSel((s) => s.filter((x) => x !== id));
    mexeu();
    if (a) setAnuncio(`${a.numero_serie} retirado da lista.`);
  };
  const limpar = () => { setSel([]); mexeu(); setAnuncio('Lista de equipamentos esvaziada.'); };
  const trazerDe = (email) => {
    if (!email) return;
    const ids = dados.ativos.filter((a) => emUso(a) && emailChave(a.responsavel) === email).map((a) => a.id);
    const novos = ids.filter((id) => !sel.includes(id));
    setSel((s) => [...new Set([...s, ...ids])]);
    mexeu();
    setAnuncio(novos.length
      ? `${equip(novos.length)} de ${nomeDe(email)} ${novos.length === 1 ? 'adicionado' : 'adicionados'}.`
      : `Os equipamentos de ${nomeDe(email)} já estavam na lista.`);
  };
  const teclaBusca = (e) => {
    if (e.key === 'Enter' && sugestoes.length) { e.preventDefault(); adicionar(sugestoes[0].id); }
    if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); }
  };

  const recomecar = () => {
    setSel([]); setPara(''); setSituacao(''); setObs(''); setData(todayISO());
    setRevisando(false); setFalha(''); setResultado(null);
  };

  const confirmar = async () => {
    setSalvando(true);
    setFalha('');
    const resumo = {
      n: escolhidos.length,
      para: novoResp ? nomeDe(novoResp) : '',
      situacao: situacaoFinal,
      data,
      trocam: trocam.length,
      pendentes: pendentesNovo.length,
      series: escolhidos.map((a) => a.numero_serie),
    };
    try {
      await movimentar(escolhidos, {
        para: novoResp || null, situacao: situacaoFinal || null, data, obs: obs.trim(),
      });
      // Recarrega tudo (poucas centenas de linhas) para a ficha já mostrar o histórico novo.
      await recarregar();
      toast(`${equip(resumo.n)} ${resumo.n === 1 ? 'movimentado' : 'movimentados'}.`);
      setSel([]); setPara(''); setSituacao(''); setObs(''); setRevisando(false);
      setResultado(resumo);
    } catch (e) {
      setFalha(e.message);
      toast(e.message, 'err');
    } finally {
      setSalvando(false);
    }
  };

  // Só o time de TI movimenta (a RLS também barra a gravação); os demais vão
  // para o chamado de troca de equipamento.
  if (!podeEscrever) return <Navigate to={ROTA_TROCA_EQUIPAMENTO} replace />;

  const nomeAtual = (email) => (email ? nomeDe(email) : 'sem responsável');
  const resumoAtual = (() => {
    if (!escolhidos.length) return '—';
    if (atuais.length === 1) return nomeAtual(atuais[0]);
    return `${plural(atuais.length, 'pessoa', 'pessoas')} diferentes`;
  })();

  return (
    <div className="ti-page ti-stack ti-mov">
      <PageHead Icon={ArrowLeftRight} titulo="Movimentar ativo" sub="Troque o responsável ou a situação de um ou mais equipamentos. Cada troca fica no histórico do equipamento." />
      <Estado />
      <p className="ti-mov-sr" aria-live="polite">{anuncio}</p>

      {resultado && (
        <section className="ti-mov-ok" tabIndex={-1} ref={resultadoRef} aria-labelledby="tm-ok-t">
          <div className="ti-mov-ok-h">
            <CheckCircle2 size={20} aria-hidden="true" />
            <h2 id="tm-ok-t">
              {equip(resultado.n)} {resultado.n === 1 ? 'movimentado' : 'movimentados'}
              {resultado.para ? ` para ${resultado.para}` : ''}
            </h2>
          </div>
          <ul className="ti-mov-ok-l">
            <li>Situação: <b>{resultado.situacao || 'mantida'}</b>, em {fmtDate(resultado.data)}.</li>
            {resultado.trocam > 0 && (
              <li>
                {resultado.trocam === 1
                  ? 'O termo do equipamento voltou para "Sem termo".'
                  : `O termo de ${equip(resultado.trocam)} voltou para "Sem termo".`}
              </li>
            )}
            {resultado.pendentes > 0 && (
              <li>
                <b>{resultado.para}</b> já vê o termo pendente em Termos e recebe um e-mail por dia até aceitar.
              </li>
            )}
            <li className="ti-mov-ok-series">{resultado.series.join(' · ')}</li>
          </ul>
          <div className="ti-ph-a">
            <button type="button" className="ti-btn primary" onClick={recomecar}>Nova movimentação</button>
            {resultado.pendentes > 0 && (
              <button type="button" className="ti-btn" onClick={() => navigate('/ti/termos')}>
                <FileSignature size={15} aria-hidden="true" /> Ver termos
              </button>
            )}
            <button type="button" className="ti-btn" onClick={() => navigate('/ti/painel')}>Voltar ao painel</button>
          </div>
        </section>
      )}

      <div className="ti-grid g2">
        <Secao titulo="1. Equipamentos" contagem={escolhidos.length}>
          {carregando ? (
            <div className="ti-stack" aria-busy="true" aria-label="Carregando equipamentos">
              {[90, 75, 60].map((w) => <div key={w} className="ti-skel" style={{ width: `${w}%` }} />)}
            </div>
          ) : (
            <div className="ti-stack">
              <div className="ti-fld">
                <label htmlFor="tm-origem">Trazer tudo o que está com…</label>
                <select id="tm-origem" className="ti-inp" value="" onChange={(e) => trazerDe(e.target.value)}>
                  <option value="">Escolha uma pessoa (opcional)</option>
                  {comResp.map((p) => (
                    <option key={p.email} value={p.email}>{p.nome} ({equip(p.n)})</option>
                  ))}
                </select>
              </div>
              <div className="ti-fld">
                <label htmlFor="tm-q">Ou localize por número de série, modelo ou responsável</label>
                <div className="ti-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    id="tm-q"
                    className="ti-inp"
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={teclaBusca}
                    placeholder="Digite ao menos 2 letras"
                    autoComplete="off"
                    aria-describedby="tm-q-ajuda"
                  />
                </div>
                <span id="tm-q-ajuda" className="ti-hint">
                  {q.trim().length >= 2 && sugestoes.length
                    ? 'Enter adiciona o primeiro da lista; Esc limpa a busca.'
                    : 'Clique num resultado para incluí-lo na movimentação.'}
                </span>
              </div>

              {q.trim().length >= 2 && (
                sugestoes.length > 0 ? (
                  <div className="ti-mov-sug" role="group" aria-label="Resultados da busca">
                    {sugestoes.map((a) => (
                      <button key={a.id} type="button" className="ti-pessoa" onClick={() => adicionar(a.id)}>
                        <span className="tx">
                          <b>{a.numero_serie}</b>
                          <span>{[a.tipo, a.modelo].filter(Boolean).join(' · ')} · {a.responsavel ? nomeDe(a.responsavel) : 'sem responsável'}</span>
                        </span>
                        <Pill tone={tomSituacao(a.situacao)}>{a.situacao || '—'}</Pill>
                        <span className="ti-mov-add" aria-hidden="true">Adicionar</span>
                      </button>
                    ))}
                    {achados.length > sugestoes.length && (
                      <p className="ti-hint">
                        Mostrando {sugestoes.length} de {achados.length}. Refine a busca para achar os outros.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="ti-mov-vazio" role="status">Nenhum equipamento encontrado para &quot;{q.trim()}&quot;.</p>
                )
              )}

              {escolhidos.length > 0 ? (
                <div className="ti-stack ti-mov-escolhidos">
                  <div className="ti-mov-lh">
                    <span className="ti-lbl">Na movimentação</span>
                    {escolhidos.length > 1 && (
                      <button type="button" className="ti-link" onClick={limpar}>Tirar todos</button>
                    )}
                  </div>
                  <ul className="ti-equip ti-mov-lista">
                    {escolhidos.map((a) => (
                      <li key={a.id} className="ti-equip-i">
                        <div className="tx">
                          <button type="button" className="ti-mov-serie" onClick={() => abrirAtivo(a.id)} title="Abrir a ficha do equipamento">
                            {a.numero_serie}
                          </button>
                          <span>{[a.tipo, a.modelo].filter(Boolean).join(' · ') || '—'}</span>
                          <span>Com: {nomeAtual(a.responsavel)}</span>
                          <span className="ti-mov-pills">
                            <Pill tone={tomSituacao(a.situacao)}>{a.situacao || 'sem situação'}</Pill>
                            {a.situacao_termo && <Pill tone={tomTermo(a.situacao_termo)}>Termo: {a.situacao_termo}</Pill>}
                          </span>
                        </div>
                        <button type="button" className="ti-ibtn ti-mov-x" aria-label={`Tirar ${a.numero_serie} da movimentação`} title="Tirar da movimentação" onClick={() => tirar(a.id)}>
                          <X size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="ti-mov-vazio">
                  <strong>Nenhum equipamento escolhido.</strong>
                  Traga tudo o que está com uma pessoa ou busque pelo número de série.
                </div>
              )}
            </div>
          )}
        </Secao>

        <Secao titulo="2. Para onde vai">
          <div className="ti-stack">
            <p className="ti-muted">Responsável atual: <b>{resumoAtual}</b></p>
            <div className="ti-fld">
              <label htmlFor="tm-para">Novo responsável</label>
              <ListaSuspensa
                id="tm-para"
                valor={para}
                onChange={(v) => { setPara(v); mexeu(); }}
                opcoes={pessoasOpcoes}
                vazio="Ninguém novo (só mudar a situação)"
                placeholderOutro="e-mail@phdengenharia.eng.br"
              />
              {novoResp && !respValido && (
                <span className="ti-mov-err" role="status">Digite um e-mail completo, como nome@phdengenharia.eng.br.</span>
              )}
              {novoResp && respValido && nomeDe(novoResp) !== novoResp && <span className="ti-hint">{nomeDe(novoResp)}</span>}
            </div>
            <div className="ti-fgrid">
              <div className="ti-fld">
                <label htmlFor="tm-sit">Nova situação</label>
                <select id="tm-sit" className="ti-inp" value={situacao} onChange={(e) => { setSituacao(e.target.value); mexeu(); }}>
                  <option value="">{novoResp ? 'Em utilização (padrão)' : 'Manter a atual'}</option>
                  {SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="ti-fld">
                <label htmlFor="tm-data">Data da movimentação</label>
                <input
                  id="tm-data"
                  type="date"
                  className="ti-inp"
                  value={data}
                  aria-describedby={data > hoje ? 'tm-data-aviso' : undefined}
                  onChange={(e) => { setData(e.target.value); mexeu(); }}
                />
                {data > hoje && <span id="tm-data-aviso" className="ti-mov-warn">A data está no futuro. Confira antes de seguir.</span>}
              </div>
            </div>
            <div className="ti-fld">
              <label htmlFor="tm-obs">Observação da movimentação <span className="ti-mov-opc">(opcional)</span></label>
              <textarea
                id="tm-obs"
                className="ti-inp"
                rows={3}
                value={obs}
                onChange={(e) => { setObs(e.target.value); setResultado(null); }}
                placeholder="Ex.: troca por defeito na tela; chamado 1234"
              />
            </div>

            {escolhidos.length > 0 && novoResp && respValido && (
              <ImpactoTermo trocam={trocam.length} pendentes={pendentesNovo.length} nome={nomeDe(novoResp)} situacao={situacaoFinal} />
            )}

            <div className="ti-mov-acoes">
              <button type="button" className="ti-btn" onClick={() => navigate('/ti/painel')}>Voltar ao painel</button>
              <button
                type="button"
                className="ti-btn primary"
                disabled={!!erro || carregando}
                aria-describedby={erro ? 'tm-falta' : undefined}
                onClick={() => setRevisando(true)}
              >
                Revisar movimentação <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
            {erro && !resultado && <p id="tm-falta" className="ti-mov-falta">{erro}</p>}
          </div>
        </Secao>
      </div>

      {revisando && !erro && (
        <section className="ti-card ti-mov-rev" tabIndex={-1} ref={revisaoRef} aria-labelledby="tm-rev-t">
          <div className="ti-card-h">
            <h2 id="tm-rev-t">3. Revisão</h2>
            <span className="ti-card-nota">{equip(escolhidos.length)} em {fmtDate(data)}</span>
          </div>

          {(semMudanca.length > 0 || atuais.length > 1) && (
            <div className="ti-note warn ti-mov-aviso">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                {atuais.length > 1 && <>Os equipamentos vêm de {plural(atuais.length, 'pessoa', 'pessoas')} diferentes. </>}
                {semMudanca.length > 0 && (
                  <>{equip(semMudanca.length)} não {semMudanca.length === 1 ? 'muda' : 'mudam'} nada (mesma pessoa e mesma situação), mas {semMudanca.length === 1 ? 'ganha' : 'ganham'} uma linha no histórico.</>
                )}
              </span>
            </div>
          )}

          <ul className="ti-mov-rl">
            {efeitos.map((e) => (
              <li key={e.a.id} className={`ti-mov-ri ${!e.trocaPessoa && !e.mudaSit ? 'igual' : ''}`}>
                <div className="ti-mov-rq">
                  <b>{e.a.numero_serie}</b>
                  <span>{[e.a.tipo, e.a.modelo].filter(Boolean).join(' · ') || '—'}</span>
                </div>
                <Mudanca rotulo="Responsável" de={nomeAtual(e.a.responsavel)} para={nomeAtual(e.respDepois)} muda={e.trocaPessoa} />
                <Mudanca rotulo="Situação" de={e.a.situacao || '—'} para={e.sitDepois || '—'} muda={e.mudaSit} />
                <Mudanca
                  rotulo="Termo"
                  de={e.a.situacao_termo || '—'}
                  para={e.termoDepois || '—'}
                  muda={e.trocaPessoa && e.a.situacao_termo !== 'Sem termo'}
                />
              </li>
            ))}
          </ul>

          {obs.trim() && <p className="ti-muted ti-mt">Observação: {obs.trim()}</p>}
          {novoResp && trocam.length > 0 && (
            <div className="ti-mt">
              <ImpactoTermo trocam={trocam.length} pendentes={pendentesNovo.length} nome={nomeDe(novoResp)} situacao={situacaoFinal} />
            </div>
          )}
          {falha && (
            <div className="ti-note crit ti-mt" role="alert">
              <span>Não foi possível gravar: {falha} Confira o histórico dos equipamentos antes de tentar de novo.</span>
            </div>
          )}

          <div className="ti-mov-acoes ti-mt">
            <button type="button" className="ti-btn" disabled={salvando} onClick={() => setRevisando(false)}>Ajustar</button>
            <button type="button" className="ti-btn primary" disabled={salvando} aria-busy={salvando} onClick={confirmar}>
              <Check size={15} aria-hidden="true" />
              {salvando ? 'Gravando…' : `Confirmar movimentação (${equip(escolhidos.length)})`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Uma coluna da revisão: valor de antes → depois, com destaque só quando muda. */
function Mudanca({
  rotulo, de, para, muda,
}) {
  return (
    <div className={`ti-mov-mu ${muda ? 'muda' : ''}`}>
      <span className="ti-mov-ml">{rotulo}</span>
      {muda ? (
        <span className="ti-mov-mv">
          <s className="de">{de}</s>
          <ArrowRight size={13} aria-hidden="true" />
          <span className="ti-mov-sr">passa a</span>
          <b>{para}</b>
        </span>
      ) : (
        <span className="ti-mov-mv igual">{para} <em>(sem mudança)</em></span>
      )}
    </div>
  );
}

/** O que a troca de pessoa faz no termo: é o efeito que a tela não pode esconder. */
function ImpactoTermo({
  trocam, pendentes, nome, situacao,
}) {
  if (!trocam) {
    return (
      <div className="ti-note ti-mov-imp">
        <FileSignature size={16} aria-hidden="true" />
        <span>{nome} já é o responsável. O termo dos equipamentos fica como está.</span>
      </div>
    );
  }
  return (
    <div className="ti-note ti-mov-imp">
      <FileSignature size={16} aria-hidden="true" />
      <div>
        <b>O que acontece com o termo</b>
        <ul>
          <li>
            O termo {trocam === 1 ? 'do equipamento' : `de ${equip(trocam)}`} volta para &quot;Sem termo&quot;: o anterior cobria outra pessoa.
          </li>
          {pendentes > 0 ? (
            <li>
              <Mail size={13} aria-hidden="true" /> {nome} passa a ter termo pendente em Termos e recebe um e-mail por dia até aceitar.
            </li>
          ) : (
            <li>
              Com a situação &quot;{situacao}&quot;, {nome} não recebe termo para aceitar. O termo só é pedido para equipamento em utilização.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
