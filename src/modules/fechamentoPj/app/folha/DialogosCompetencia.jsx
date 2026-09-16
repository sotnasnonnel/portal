import { useMemo, useState } from 'react';
import {
  CalendarPlus, Lock, Unlock, Calculator, CheckCircle2, AlertTriangle, Search, UserPlus, Save,
} from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Aviso, Campo } from '../components/ui';
import {
  abrirCompetencia, fecharCompetencia, reabrirCompetencia, salvarCalendario, incluirNoMes, auditar,
} from '../../lib/dados';
import { competenciaRotulo, proximaCompetencia, dataHoraBr, normalizar, dataBr } from '../../lib/formato';
import { calendarioSugerido, deDatetimeLocal, paraDatetimeLocal } from './folhaUtil';

// Diálogos do ciclo da competência: abrir, fechar, reabrir, calendário do termo
// e incluir prestador no mês. As regras de verdade estão nas RPCs; aqui a tela
// antecipa o que dá para antecipar e mostra a mensagem do banco quando recusa.

const hojeCompetencia = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

function CamposCalendario({ valor, onChange, desabilitado }) {
  const set = (campo) => (e) => onChange({ ...valor, [campo]: e.target.value });
  return (
    <div className="pj-form-grid">
      <Campo rotulo="Envio dos termos">
        <input type="date" className="form-input" value={valor.envio} onChange={set('envio')} disabled={desabilitado} />
      </Campo>
      <Campo rotulo="Prazo para a NF">
        <input type="datetime-local" className="form-input" value={valor.prazo} onChange={set('prazo')} disabled={desabilitado} />
      </Campo>
      <Campo rotulo="Pagamento previsto">
        <input type="date" className="form-input" value={valor.pagamento} onChange={set('pagamento')} disabled={desabilitado} />
      </Campo>
    </div>
  );
}

export function DialogoAbrirCompetencia({ onFechar, onConcluido }) {
  const { competencias } = useFechamentoPj();
  const ultima = competencias[0] || null;
  const sugestao = ultima ? proximaCompetencia(ultima.competencia) : hojeCompetencia();
  const [mes, setMes] = useState(sugestao.slice(0, 7));
  const [calendario, setCalendario] = useState(() => calendarioSugerido(sugestao, ultima));
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState('');

  const iso = /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : null;
  const existe = iso && competencias.some((c) => c.competencia === iso);
  const aberta = competencias.find((c) => c.status === 'aberta');
  const fechadas = competencias.filter((c) => c.status === 'fechada');

  function trocarMes(v) {
    setMes(v);
    if (/^\d{4}-\d{2}$/.test(v)) setCalendario(calendarioSugerido(`${v}-01`, ultima));
  }

  async function confirmar() {
    if (!iso) { setErro('Informe o mês da competência.'); return; }
    setGravando(true);
    setErro('');
    try {
      const n = await abrirCompetencia(iso, {
        envioTermos: calendario.envio || null,
        prazoNf: deDatetimeLocal(calendario.prazo),
        pagamento: calendario.pagamento || null,
      });
      await onConcluido(iso, n);
    } catch (e) {
      setErro(e.message);
    } finally {
      setGravando(false);
    }
  }

  return (
    <Modal
      titulo={ultima ? 'Abrir próxima competência' : 'Abrir competência'}
      subtitulo={ultima ? `Última: ${competenciaRotulo(ultima.competencia)} (${ultima.status === 'aberta' ? 'em conferência' : 'fechada'})` : 'Primeira competência do módulo'}
      onFechar={onFechar}
      bloqueado={gravando}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={gravando}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={confirmar} disabled={gravando || !iso || existe || Boolean(aberta)}>
            <CalendarPlus size={16} /> {gravando ? 'Abrindo…' : `Abrir ${iso ? competenciaRotulo(iso) : ''}`}
          </button>
        </>
      )}
    >
      <div className="pj-folha-pilha">
        {aberta && (
          <Aviso tipo="alerta">
            A competência {competenciaRotulo(aberta.competencia)} ainda está em conferência. Feche-a antes de abrir outra.
          </Aviso>
        )}
        <Campo rotulo="Competência" obrigatorio erro={existe ? 'Esta competência já existe.' : null}>
          <input type="month" className="form-input" value={mes} onChange={(e) => trocarMes(e.target.value)} disabled={gravando} />
        </Campo>

        <div className="pj-secao-titulo">Calendário do termo</div>
        <CamposCalendario valor={calendario} onChange={setCalendario} desabilitado={gravando} />

        <div className="pj-folha-transporte">
          <div>
            <div className="pj-secao-titulo">O que é levado</div>
            <ul className="pj-folha-lista pj-folha-lista--ok">
              <li>Prestadores ativos (e quem encerra dentro do mês)</li>
              <li>Eventos do mês anterior; quem não tinha recebe o 1000 do valor contratual</li>
              <li>Cadastro, contratos, valores, rateios, benefícios e dependentes</li>
              <li>Códigos e configurações</li>
            </ul>
          </div>
          <div>
            <div className="pj-secao-titulo">O que começa do zero</div>
            <ul className="pj-folha-lista pj-folha-lista--zera">
              <li>Log de cálculo (todo envelope nasce pendente de cálculo)</li>
              <li>Termos e registro de envio</li>
              <li>Divergências e resoluções</li>
              <li>Números de NF e documento RM</li>
            </ul>
          </div>
        </div>

        {fechadas.length > 0 && (
          <Aviso tipo="sucesso">
            As competências fechadas continuam preservadas e consultáveis: {fechadas.slice(0, 6).map((c) => competenciaRotulo(c.competencia)).join(', ')}
            {fechadas.length > 6 ? ` e mais ${fechadas.length - 6}` : ''}.
          </Aviso>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}

function Cartao({ ok, titulo, texto }) {
  return (
    <div className={`pj-folha-check ${ok ? 'ok' : 'falta'}`}>
      {ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      <div><b>{titulo}</b><span>{texto}</span></div>
    </div>
  );
}

export function DialogoFecharCompetencia({ envelopes, onFechar, onCalcularPendentes, onConcluido }) {
  const { competencia } = useFechamentoPj();
  const [gravando, setGravando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState('');

  const total = envelopes.length;
  const pendentes = envelopes.filter((e) => !e.calculado_em).length;
  const divergentes = envelopes.filter((e) => e.conferencia === 'divergente').length;
  const podeFechar = total > 0 && pendentes === 0 && divergentes === 0;
  const ocupado = gravando || calculando;

  async function calcular() {
    setCalculando(true);
    setErro('');
    try {
      await onCalcularPendentes();
    } catch (e) {
      setErro(e.message);
    } finally {
      setCalculando(false);
    }
  }

  async function confirmar() {
    setGravando(true);
    setErro('');
    try {
      await fecharCompetencia(competencia);
      await onConcluido();
    } catch (e) {
      // A RPC explica por que recusou (pendentes, divergências, já fechada).
      setErro(e.message);
    } finally {
      setGravando(false);
    }
  }

  return (
    <Modal
      titulo={`Fechar competência ${competenciaRotulo(competencia)}`}
      subtitulo="Conferência para encerramento"
      onFechar={onFechar}
      bloqueado={ocupado}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={ocupado}>Cancelar</button>
          {pendentes > 0 && (
            <button type="button" className="btn btn-outline" onClick={calcular} disabled={ocupado}>
              <Calculator size={16} /> {calculando ? 'Calculando…' : `Calcular ${pendentes} pendente(s)`}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={confirmar} disabled={ocupado || !podeFechar}>
            <Lock size={16} /> {gravando ? 'Fechando…' : 'Confirmar fechamento'}
          </button>
        </>
      )}
    >
      <div className="pj-folha-pilha">
        <div className="pj-folha-checks">
          <Cartao ok={total > 0 && pendentes === 0} titulo={`${total - pendentes}/${total} envelopes calculados`}
            texto={pendentes ? `${pendentes} ainda sem cálculo.` : 'Todos com cálculo registrado.'} />
          <Cartao ok={divergentes === 0} titulo={`${divergentes} divergência(s) em aberto`}
            texto={divergentes ? 'Resolva no envelope (aba Conferência).' : 'Nenhum envelope divergente.'} />
          <Cartao ok titulo="Cadastro congelado"
            texto="Razão social, CNPJ e rateio de hoje ficam gravados no envelope. O mês não muda se o cadastro mudar depois." />
        </div>
        {!podeFechar && (
          <Aviso tipo="alerta">
            {total === 0 ? 'Não há envelopes nesta competência.' : 'Para fechar, todos os envelopes precisam estar calculados e sem divergência.'}
          </Aviso>
        )}
        <Aviso tipo="info">Com a competência fechada, termos e registro de envio continuam liberados; valores e eventos, não.</Aviso>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}

export function DialogoReabrirCompetencia({ onFechar, onConcluido }) {
  const { competencia, competenciaAtual } = useFechamentoPj();
  const [motivo, setMotivo] = useState('');
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState('');
  const historica = competenciaAtual?.origem === 'historico';
  const valido = motivo.trim().length >= 5;

  async function confirmar() {
    setGravando(true);
    setErro('');
    try {
      await reabrirCompetencia(competencia, motivo.trim());
      await onConcluido();
    } catch (e) {
      setErro(e.message);
    } finally {
      setGravando(false);
    }
  }

  return (
    <Modal
      largura="sm"
      titulo={`Reabrir competência ${competenciaRotulo(competencia)}`}
      onFechar={onFechar}
      bloqueado={gravando}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={gravando}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={confirmar} disabled={gravando || !valido || historica}>
            <Unlock size={16} /> {gravando ? 'Reabrindo…' : 'Confirmar reabertura'}
          </button>
        </>
      )}
    >
      <div className="pj-folha-pilha">
        {historica && (
          <Aviso tipo="alerta">Esta competência veio da carga histórica e não pode ser reaberta.</Aviso>
        )}
        <p className="pj-sub">
          Último fechamento: {dataHoraBr(competenciaAtual?.fechada_em)}
          {competenciaAtual?.prestadores != null ? ` · ${competenciaAtual.prestadores} envelope(s)` : ''}
        </p>
        <Campo rotulo="Motivo da reabertura" obrigatorio dica="Mínimo de 5 caracteres. Fica registrado na competência e na auditoria.">
          <textarea className="form-input" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={gravando || historica} />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}

export function DialogoCalendario({ onFechar, onConcluido }) {
  const { competencia, competenciaAtual } = useFechamentoPj();
  const [valor, setValor] = useState(() => ({
    envio: competenciaAtual?.data_envio_termos || '',
    prazo: paraDatetimeLocal(competenciaAtual?.prazo_nf),
    pagamento: competenciaAtual?.data_pagamento || '',
  }));
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setGravando(true);
    setErro('');
    try {
      await salvarCalendario(competencia, {
        data_envio_termos: valor.envio, prazo_nf: deDatetimeLocal(valor.prazo), data_pagamento: valor.pagamento,
      });
      await auditar('Calendário do termo alterado',
        `Envio ${dataBr(valor.envio)} • NF até ${valor.prazo ? dataHoraBr(deDatetimeLocal(valor.prazo)) : '—'} • pagamento ${dataBr(valor.pagamento)}`,
        { competencia });
      await onConcluido();
    } catch (e) {
      setErro(e.message);
    } finally {
      setGravando(false);
    }
  }

  return (
    <Modal
      titulo={`Calendário do termo · ${competenciaRotulo(competencia)}`}
      subtitulo="Datas que aparecem no termo para emissão da NF"
      onFechar={onFechar}
      bloqueado={gravando}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={gravando}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={salvar} disabled={gravando}>
            <Save size={16} /> {gravando ? 'Salvando…' : 'Salvar calendário'}
          </button>
        </>
      )}
    >
      <div className="pj-folha-pilha">
        <CamposCalendario valor={valor} onChange={setValor} desabilitado={gravando} />
        <Aviso tipo="info">Termos já gerados passam a mostrar as datas novas na próxima vez que forem abertos.</Aviso>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}

export function DialogoIncluirPrestador({ envelopes, onFechar, onConcluido }) {
  const { competencia, prestadores } = useFechamentoPj();
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(null);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState('');

  const fora = useMemo(() => {
    const noMes = new Set(envelopes.map((e) => e.prestador_id));
    const t = normalizar(busca);
    return prestadores
      .filter((p) => p.situacao === 'ativo' && !noMes.has(p.id))
      .filter((p) => !t || normalizar(`${p.codigo} ${p.nome} ${p.email || ''} ${p.razao_social || ''}`).includes(t));
  }, [envelopes, prestadores, busca]);

  async function confirmar() {
    if (!escolhido) return;
    setGravando(true);
    setErro('');
    try {
      await incluirNoMes(competencia, escolhido.id);
      await auditar('Prestador incluído na competência', `${escolhido.codigo} - ${escolhido.nome}`, { competencia, prestadorId: escolhido.id });
      await onConcluido(escolhido);
    } catch (e) {
      setErro(e.message);
    } finally {
      setGravando(false);
    }
  }

  return (
    <Modal
      titulo={`Incluir prestador em ${competenciaRotulo(competencia)}`}
      subtitulo="Prestadores ativos que ainda não têm envelope neste mês"
      onFechar={onFechar}
      bloqueado={gravando}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={gravando}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={confirmar} disabled={gravando || !escolhido}>
            <UserPlus size={16} /> {gravando ? 'Incluindo…' : 'Incluir no mês'}
          </button>
        </>
      )}
    >
      <div className="pj-folha-pilha">
        <div className="table-search">
          <Search size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, nome ou razão social" />
        </div>
        {fora.length === 0 ? (
          <Aviso tipo="info">Todos os prestadores ativos já estão na competência.</Aviso>
        ) : (
          <div className="pj-folha-escolha">
            {fora.map((p) => (
              <label key={p.id} className={`pj-folha-escolha-item ${escolhido?.id === p.id ? 'ativo' : ''}`}>
                <input type="radio" name="pj-incluir" checked={escolhido?.id === p.id} onChange={() => setEscolhido(p)} />
                <div>
                  <b>{p.codigo} · {p.nome}</b>
                  <div className="pj-sub">{[p.empresa, p.razao_social, p.data_inicio ? `início ${dataBr(p.data_inicio)}` : null].filter(Boolean).join(' · ')}</div>
                </div>
              </label>
            ))}
          </div>
        )}
        <Aviso tipo="info">O envelope nasce com o 1000 do valor contratual e fica pendente de cálculo.</Aviso>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}
