import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, Check, User, Ban, Headset, CalendarDays, MinusCircle, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ehTimeMobilizacao, rotuloFluxo, STATUS_PROCESSO,
} from '../../../../config/mobilizacao';
import { semaforoDias } from '../../../../utils/semaforo';
import {
  buscarProcesso, listarEtapasDoProcesso, listarEventos, listarTime,
  moverEtapa, assumirEtapa, definirResponsavelEtapa, definirDataReal,
  definirDataBase, cancelarProcesso,
} from '../../lib/mobilizacao';
import { podeMover, podeEditar, progresso } from '../../lib/painelEtapas';
import { rotuloStatus, ehEncerrada } from '../../lib/statusEtapa';

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '');

const TEXTO_EVENTO = {
  criado: 'Processo aberto',
  status: 'Situação da etapa alterada',
  concluida: 'Etapa concluída',
  atribuido: 'Responsável alterado',
  cancelado: 'Processo cancelado',
  carga: 'Carga da planilha',
};

export default function ProcessoMob() {
  const { id } = useParams();
  const { user, modules } = useAuth();
  const navigate = useNavigate();
  const souTime = ehTimeMobilizacao(modules);

  const [processo, setProcesso] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [time, setTime] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [trocando, setTrocando] = useState(null);   // id da etapa com o seletor aberto

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [p, e, h] = await Promise.all([
        buscarProcesso(id), listarEtapasDoProcesso(id), listarEventos(id),
      ]);
      setProcesso(p);
      setEtapas(e);
      setEventos(h);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  // O time só é carregado quando alguém abre o seletor: é uma RPC a mais que a
  // maioria das visitas não precisa.
  useEffect(() => {
    if (trocando && !time.length) listarTime().then(setTime).catch(() => {});
  }, [trocando, time.length]);

  /**
   * Toda ação recarrega o processo inteiro em vez de remendar o estado.
   *
   * É uma consulta a mais, mas o gatilho no banco mexe em coisas que a tela não
   * tem como prever: o prazo das etapas dependentes, o progresso, o status do
   * processo e o histórico. Adivinhar isso no cliente seria a primeira fonte de
   * divergência entre o que a tela mostra e o que está gravado.
   */
  const acao = async (chave, fn) => {
    setOcupado(chave);
    setErro('');
    try {
      await fn();
      await carregar();
      setTrocando(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado('');
    }
  };

  if (carregando) {
    return <div className="mob-page"><div className="mob-vazio"><Loader2 size={20} className="mob-spin" /> Carregando…</div></div>;
  }
  if (!processo) {
    return (
      <div className="mob-page">
        <button type="button" className="mob-back" onClick={() => navigate('/mobilizacao/processos')}>
          <ArrowLeft size={15} /> Processos
        </button>
        <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro || 'Processo não encontrado.'}</div>
      </div>
    );
  }

  const pr = progresso(processo);
  const encerrado = processo.status !== 'em_andamento';

  return (
    <div className="mob-page mob-page-wide">
      <button type="button" className="mob-back" onClick={() => navigate('/mobilizacao/processos')}>
        <ArrowLeft size={15} /> Processos
      </button>

      <h1 className="mob-title">#{processo.numero} · {processo.titulo}</h1>
      <p className="mob-sub">
        {rotuloFluxo(processo.fluxo)} · <span className={`mob-pill tom-${processo.status}`}>
          {STATUS_PROCESSO[processo.status]}
        </span>
      </p>

      {erro && <div className="mob-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {/* Catálogo vazio não é erro: é o estado real enquanto o fluxo não foi
          cadastrado. Mas precisa aparecer, senão o processo fica mudo. */}
      {pr.total === 0 && (
        <div className="mob-aviso tom-alerta">
          <AlertCircle size={16} />
          Este processo nasceu sem etapas — o catálogo do fluxo {rotuloFluxo(processo.fluxo)} está vazio.
          Cadastre os passos em Catálogo e SLAs e abra o processo de novo.
        </div>
      )}

      <section className="mob-card">
        <h2 className="mob-card-tit">Resumo</h2>
        <div className="mob-grid2">
          <Campo rot="Profissional" val={processo.profissional_nome} />
          <Campo rot="Cliente PHD" val={processo.cliente_phd} />
          <Campo rot="Cliente final" val={processo.cliente_final} />
          <Campo rot="Empresa PHD" val={processo.empresa_phd} />
          <Campo rot="Local da obra" val={processo.local_obra} />
          <Campo rot="Cód. CT" val={processo.cod_ct} />
          <Campo rot="Cód. PHD" val={processo.cod_phd} />
          <Campo rot="Contrato" val={processo.contrato} />
          <Campo rot="COO PHD" val={processo.coo_phd} />
          <Campo rot="Gerente PHD" val={processo.ger_phd} />
          <Campo rot="Responsável" val={processo.responsavelNome} />
          <Campo rot="Aberto em" val={dataHora(processo.criado_em)} />
        </div>

        <div className="mob-prog" style={{ marginTop: 8 }}>
          <div className="mob-prog-barra">
            <div className="mob-prog-fill" style={{ width: `${pr.pct}%` }} />
          </div>
          <span className="mob-prog-txt">{pr.feitas} de {pr.total} passos</span>
        </div>

        {processo.origem_chamado_id && (
          <p className="mob-campo-dica" style={{ marginTop: 10 }}>
            <Headset size={13} style={{ verticalAlign: '-2px' }} />{' '}
            Aberto pelo{' '}
            <Link to={`/administrativo/chamado/${processo.origem_chamado_id}`}>
              chamado do Administrativo
            </Link>.
          </p>
        )}

        {/* A data-base é de onde partem as etapas raiz. Desmobilização nasce
            sem ela (o chamado não tem data de início), e sem data-base o
            processo inteiro fica sem prazo — daí o destaque. */}
        {souTime && !encerrado && (
          <div className="mob-campo" style={{ maxWidth: 260, marginTop: 12 }}>
            <label htmlFor="mob-data-base">
              <CalendarDays size={13} style={{ verticalAlign: '-2px' }} /> Data-base do processo
            </label>
            <input
              id="mob-data-base"
              type="date"
              defaultValue={processo.data_base || ''}
              disabled={ocupado === 'data_base'}
              onChange={(ev) => acao('data_base', () => definirDataBase(processo.id, ev.target.value))}
            />
            <span className="mob-campo-dica">
              Mudar aqui reprojeta os prazos das etapas que ainda não aconteceram.
            </span>
          </div>
        )}
      </section>

      <section className="mob-card">
        <h2 className="mob-card-tit">Passo a passo</h2>

        {!etapas.length ? (
          <p className="mob-campo-dica">Sem etapas.</p>
        ) : (
          <div className="mob-etapas">
            {etapas.map((e) => {
              const editavel = !encerrado && podeEditar(e, { meuId: user?.id, souTime });
              const bloqueio = podeMover(e, 'concluida', etapas);
              const tom = semaforoDias(e.dias_atraso);
              const atrasada = tom === 'vencido' && !ehEncerrada(e.status);

              return (
                <article key={e.id}
                  className={`mob-etapa ${ehEncerrada(e.status) ? 'is-concluida' : ''} ${atrasada ? 'is-atrasada' : ''}`}>
                  <span className="mob-etapa-ord">
                    {ehEncerrada(e.status) ? <Check size={14} /> : e.ordem}
                  </span>

                  <div className="mob-etapa-txt">
                    <div className="mob-etapa-tit">{e.titulo}</div>
                    {e.descricao && <div className="mob-campo-dica" style={{ margin: '2px 0 0' }}>{e.descricao}</div>}

                    <div className="mob-etapa-meta">
                      <span>{rotuloStatus(e.status)}</span>
                      <span>Previsto: {dataBr(e.data_prevista)}</span>
                      {e.data_real && <span>Real: {dataBr(e.data_real)}</span>}
                      {e.dias_atraso !== null && e.dias_atraso !== undefined && (
                        <span className={`mob-prazo tom-${tom}`}>
                          {e.dias_atraso > 0 ? `${e.dias_atraso}d de atraso` : `${Math.abs(e.dias_atraso)}d de folga`}
                        </span>
                      )}
                      {e.responsavelNome
                        ? <span title={e.responsavelNome}><User size={11} /> {e.responsavelNome}</span>
                        : <span className="mob-cartao-sem-dono">sem responsável</span>}
                      {e.sla_dias_uteis !== null && <span>SLA {e.sla_dias_uteis} d.ú.</span>}
                    </div>

                    {trocando === e.id && (
                      <div className="mob-campo" style={{ maxWidth: 280, marginTop: 8 }}>
                        <label htmlFor={`mob-resp-${e.id}`}>Responsável pela etapa</label>
                        <select id={`mob-resp-${e.id}`} defaultValue={e.responsavel_id || ''}
                          onChange={(ev) => acao(`resp-${e.id}`, () => definirResponsavelEtapa(e.id, ev.target.value))}>
                          <option value="">— Sem responsável —</option>
                          {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="mob-etapa-acoes">
                    {editavel && !ehEncerrada(e.status) && (
                      <>
                        {e.status === 'pendente' && (
                          <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm"
                            disabled={!!ocupado}
                            onClick={() => acao(`and-${e.id}`, () => moverEtapa(e.id, 'em_andamento'))}>
                            Começar
                          </button>
                        )}
                        <button type="button" className="mob-btn mob-btn-primary mob-btn-sm"
                          disabled={!!ocupado || !bloqueio.ok}
                          title={bloqueio.ok ? 'Marca a etapa como concluída hoje' : bloqueio.motivo}
                          onClick={() => acao(`ok-${e.id}`, () => moverEtapa(e.id, 'concluida'))}>
                          <Check size={14} /> Concluir
                        </button>
                        <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm"
                          disabled={!!ocupado}
                          title="A etapa não se aplica a este processo"
                          onClick={() => acao(`na-${e.id}`, () => moverEtapa(e.id, 'dispensada'))}>
                          <MinusCircle size={14} /> Não se aplica
                        </button>
                      </>
                    )}

                    {editavel && ehEncerrada(e.status) && (
                      <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm"
                        disabled={!!ocupado}
                        title="Reabre a etapa e apaga a data real"
                        onClick={() => acao(`re-${e.id}`, () => moverEtapa(e.id, 'em_andamento'))}>
                        <RotateCcw size={14} /> Reabrir
                      </button>
                    )}

                    {/* A etapa que aconteceu ontem e ninguém marcou: sem isto, a
                        data real seria sempre a de hoje e o indicador de prazo
                        ficaria bonito por acidente. */}
                    {editavel && ehEncerrada(e.status) && (
                      <input type="date" className="mob-btn-sm" aria-label="Data real"
                        defaultValue={e.data_real || ''}
                        onChange={(ev) => acao(`dt-${e.id}`, () => definirDataReal(e.id, ev.target.value))}
                        style={{ height: 32, padding: '0 8px', border: '1px solid var(--m-border)', borderRadius: 8 }} />
                    )}

                    {!encerrado && souTime && (
                      <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm" disabled={!!ocupado}
                        onClick={() => setTrocando(trocando === e.id ? null : e.id)}>
                        Responsável
                      </button>
                    )}
                    {!encerrado && !souTime && e.responsavel_id !== user?.id && !ehEncerrada(e.status) && (
                      <button type="button" className="mob-btn mob-btn-ghost mob-btn-sm" disabled={!!ocupado}
                        onClick={() => acao(`as-${e.id}`, () => assumirEtapa(e.id, user.id))}>
                        Assumir
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {souTime && !encerrado && (
        <section className="mob-card">
          <h2 className="mob-card-tit">Encerrar</h2>
          <p className="mob-campo-dica">
            Cancelar marca o processo como encerrado sem concluir os passos que faltam. Não apaga nada.
          </p>
          <button type="button" className="mob-btn mob-btn-ghost" disabled={!!ocupado}
            onClick={() => acao('cancelar', () => cancelarProcesso(processo.id, 'Cancelado pelo time'))}>
            <Ban size={15} /> Cancelar processo
          </button>
        </section>
      )}

      <section className="mob-card">
        <h2 className="mob-card-tit">Histórico</h2>
        {!eventos.length ? (
          <p className="mob-campo-dica">Sem movimentação registrada.</p>
        ) : (
          <div className="mob-linha-tempo">
            {eventos.map((ev) => (
              <div key={ev.id} className="mob-evento">
                <span className="mob-evento-quando">{dataHora(ev.created_at)}</span>
                <span className="mob-evento-txt">
                  {TEXTO_EVENTO[ev.tipo] || ev.tipo}
                  {ev.dados?.etapa ? ` — ${ev.dados.etapa}` : ''}
                  {ev.de || ev.para ? ` (${ev.deNome || '—'} → ${ev.paraNome || '—'})` : ''}
                  {/* Autor nulo é honesto: carga da planilha e correção no banco
                      não têm sessão de usuário. */}
                  {ev.autorNome ? ` · ${ev.autorNome}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Campo({ rot, val }) {
  return (
    <div className="mob-campo">
      <label>{rot}</label>
      <span style={{ fontSize: 'var(--font-size-sm)' }}>{val || '—'}</span>
    </div>
  );
}
