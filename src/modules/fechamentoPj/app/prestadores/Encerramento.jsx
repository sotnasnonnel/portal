import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Aviso, Campo, Carregando, Badge } from '../components/ui';
import { calcularEncerramento, validarEncerramento, statusEncerramento } from '../../lib/calculo';
import { competenciaRotulo, dataBr, fmtBRL, ultimoDiaCompetencia } from '../../lib/formato';
import {
  envelopesDoPrestador, registrarEncerramento, cancelarEncerramento, salvarPrestador, auditar,
} from '../../lib/dados';
import { hojeIso, recalcularEnvelopeDoPrestador, ROTA_FOLHA } from './comum';

const noMes = (iso, competencia) => Boolean(iso) && iso >= competencia && iso <= ultimoDiaCompetencia(competencia);

/**
 * Encerramento de contrato na competência aberta: grava o encerramento, põe a
 * data fim (e a situação) no cadastro e recalcula o envelope do mês.
 */
export default function Encerramento({ prestador, onFechar, onConcluido }) {
  const {
    competencia, competenciaAtual, aberta, competencias = [], setCompetencia, config, rateios, encerramentos = [],
    centrosMapa, recarregar, notificar,
  } = useFechamentoPj();
  const vigente = encerramentos.find((e) => e.prestador_id === prestador.id) || null;
  const competenciaAberta = competencias.find((c) => c.status === 'aberta') || null;

  const [envelope, setEnvelope] = useState(undefined);
  const [erroCarga, setErroCarga] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(() => {
    const fim = noMes(prestador.data_fim, competencia) ? prestador.data_fim : (competencia ? ultimoDiaCompetencia(competencia) : '');
    return {
      data_calculo: hojeIso(),
      data_encerramento: fim,
      data_pagamento: competenciaAtual?.data_pagamento || '',
      data_ultimo_movimento: fim,
      motivo: config?.motivos_encerramento?.[0] || '',
      prazo_determinado: false,
      indenizacao: false,
      observacao: '',
    };
  });

  const podeRegistrar = aberta && !vigente;

  useEffect(() => {
    if (!podeRegistrar) return undefined;
    let vivo = true;
    (async () => {
      try {
        const lista = await envelopesDoPrestador(prestador.id);
        if (vivo) setEnvelope(lista.find((e) => e.competencia === competencia) || null);
      } catch (e) {
        if (vivo) { setErroCarga(e.message); setEnvelope(null); }
      }
    })();
    return () => { vivo = false; };
  }, [podeRegistrar, prestador.id, competencia]);

  const set = (campo, valor) => setDados((d) => {
    const novo = { ...d, [campo]: valor };
    // O último movimento acompanha o encerramento, como no fluxo antigo; dá para ajustar depois.
    if (campo === 'data_encerramento') novo.data_ultimo_movimento = valor;
    if (campo === 'prazo_determinado' && valor && prestador.data_fim) {
      novo.data_encerramento = prestador.data_fim;
      novo.data_ultimo_movimento = prestador.data_fim;
    }
    return novo;
  });

  const eventos = useMemo(() => (envelope?.eventos || []).map((e) => ({ ...e, valor: Number(e.valor) })), [envelope]);
  const validacao = podeRegistrar ? validarEncerramento({ dados, prestador, competencia }) : null;
  const calculo = useMemo(() => (podeRegistrar && dados.data_encerramento
    ? calcularEncerramento({ dados, prestador, competencia, config, eventos })
    : null), [podeRegistrar, dados, prestador, competencia, config, eventos]);

  async function salvar() {
    if (validacao) { setErro(validacao); return; }
    setErro('');
    setSalvando(true);
    try {
      const status = statusEncerramento(dados.data_encerramento, hojeIso());
      const novo = await registrarEncerramento({
        prestador_id: prestador.id,
        competencia,
        data_calculo: dados.data_calculo,
        data_encerramento: dados.data_encerramento,
        data_pagamento: dados.data_pagamento,
        data_ultimo_movimento: dados.data_ultimo_movimento,
        motivo: dados.motivo.trim(),
        observacao: dados.observacao.trim() || null,
        prazo_determinado: dados.prazo_determinado,
        indenizacao: dados.indenizacao,
        indenizacao_percentual: calculo.indenizacaoPercentual,
        dias_ativos: calculo.diasAtivos,
        divisor: calculo.divisor,
        valor_proporcional: calculo.valorProporcional,
        valor_indenizacao: calculo.valorIndenizacao,
        descontos: calculo.descontos,
        status,
      });
      const atualizado = await salvarPrestador({
        id: prestador.id, data_fim: dados.data_encerramento, situacao: status === 'encerrado' ? 'desligado' : 'ativo',
      });
      let recalculado = false;
      try {
        recalculado = await recalcularEnvelopeDoPrestador({
          prestador: atualizado, competencia, config, rateios, encerramentos: [...encerramentos, novo], centrosMapa,
          origem: 'Recálculo automático após encerramento contratual',
        });
      } catch (e) {
        notificar(`Encerramento gravado, mas o envelope não foi recalculado: ${e.message}`, 'alerta');
      }
      await auditar('Encerramento contratual registrado',
        `${prestador.nome} • ${dataBr(dados.data_encerramento)} • ${calculo.diasAtivos}/${calculo.divisor} dias • proporcional ${fmtBRL(calculo.valorProporcional)}${recalculado ? ' • envelope recalculado' : ''}`,
        { competencia, prestadorId: prestador.id });
      await recarregar();
      notificar(recalculado ? 'Encerramento registrado e envelope recalculado.' : 'Encerramento registrado.');
      onConcluido?.(novo, atualizado);
    } catch (e) {
      setErro(e.message || 'Não foi possível registrar o encerramento.');
      await recarregar();
    } finally {
      setSalvando(false);
    }
  }

  let corpo;
  if (!aberta) {
    corpo = (
      <Aviso tipo="alerta" acao={competenciaAberta && (
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setCompetencia(competenciaAberta.competencia)}>
          Ver {competenciaRotulo(competenciaAberta.competencia)}
        </button>
      )}>
        O encerramento é registrado na competência aberta. A competência em exibição
        ({competenciaRotulo(competencia)}) {competencia ? 'está fechada' : 'não existe'}.
        {competenciaAberta ? ` Troque para ${competenciaRotulo(competenciaAberta.competencia)} para continuar.` : ' Abra uma competência na Folha do mês.'}
      </Aviso>
    );
  } else if (vigente) {
    corpo = (
      <Aviso tipo="alerta">
        Este prestador já tem um encerramento <Badge tipo="encerramento" valor={vigente.status} /> em {dataBr(vigente.data_encerramento)}.
        Cancele-o na aba Encerramentos antes de registrar outro.
      </Aviso>
    );
  } else if (envelope === undefined) {
    corpo = <Carregando texto="Carregando o envelope do mês…" />;
  } else {
    const motivos = config?.motivos_encerramento || [];
    corpo = (
      <>
        <div className="pj-pares">
          <div className="pj-par"><small>Situação atual</small><b><Badge tipo="situacao" valor={prestador.situacao} /></b></div>
          <div className="pj-par"><small>Competência</small><b>{competenciaRotulo(competencia)}</b></div>
          <div className="pj-par"><small>Início do contrato</small><b>{dataBr(prestador.data_inicio)}</b></div>
          <div className="pj-par"><small>Dias ativos</small><b>{calculo ? `${calculo.diasAtivos}/${calculo.divisor}` : '—'}</b></div>
        </div>
        {erroCarga && <Aviso tipo="erro">{erroCarga}</Aviso>}
        {!envelope && !erroCarga && (
          <Aviso tipo="info">O prestador não tem envelope em {competenciaRotulo(competencia)}: o encerramento é gravado sem descontos e sem recálculo.</Aviso>
        )}

        <div className="pj-secao-titulo">Dados do encerramento</div>
        <div className="pj-form-grid">
          <Campo rotulo="Data de cálculo" obrigatorio>
            <input className="form-input" type="date" value={dados.data_calculo} onChange={(e) => set('data_calculo', e.target.value)} />
          </Campo>
          <Campo rotulo="Data de encerramento" obrigatorio>
            <input className="form-input" type="date" value={dados.data_encerramento} min={competencia} max={ultimoDiaCompetencia(competencia)}
              onChange={(e) => set('data_encerramento', e.target.value)} />
          </Campo>
          <Campo rotulo="Data de pagamento" obrigatorio>
            <input className="form-input" type="date" value={dados.data_pagamento} onChange={(e) => set('data_pagamento', e.target.value)} />
          </Campo>
          <Campo rotulo="Data do último movimento" obrigatorio>
            <input className="form-input" type="date" value={dados.data_ultimo_movimento} max={dados.data_encerramento || undefined}
              onChange={(e) => set('data_ultimo_movimento', e.target.value)} />
          </Campo>
          <Campo rotulo="Motivo do encerramento" obrigatorio largura="largo">
            <select className="form-select" value={dados.motivo} onChange={(e) => set('motivo', e.target.value)}>
              {!motivos.includes(dados.motivo) && <option value={dados.motivo}>{dados.motivo || 'Selecione'}</option>}
              {motivos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Campo>
        </div>
        <div className="pjp-subtotal">
          <label className="pj-check">
            <input type="checkbox" checked={dados.prazo_determinado} onChange={(e) => set('prazo_determinado', e.target.checked)} />
            Contrato com prazo determinado{prestador.data_fim ? ` (término ${dataBr(prestador.data_fim)})` : ''}
          </label>
          <label className="pj-check">
            <input type="checkbox" checked={dados.indenizacao} onChange={(e) => set('indenizacao', e.target.checked)} />
            Aplicar indenização contratual ({Number(config?.indenizacao_percentual) || 0}%)
          </label>
        </div>
        <Campo rotulo="Observação">
          <textarea className="form-input" rows={2} value={dados.observacao} onChange={(e) => set('observacao', e.target.value)} />
        </Campo>

        {calculo && (
          <>
            <div className="pj-secao-titulo">Memória do cálculo</div>
            <div className="pj-memoria">
              {`${fmtBRL(calculo.valorBase)} ÷ ${calculo.divisor} dias × ${calculo.diasAtivos} dias = ${fmtBRL(calculo.valorProporcional)}\n`}
              {`Indenização: ${dados.indenizacao ? `${fmtBRL(calculo.valorBase)} × ${calculo.indenizacaoPercentual}% = ${fmtBRL(calculo.valorIndenizacao)}` : 'não aplicada'}\n`}
              {`Descontos do envelope: ${fmtBRL(calculo.descontos)}\n`}
              {`Líquido do encerramento: ${fmtBRL(calculo.liquido)}`}
            </div>
          </>
        )}
        <p className="form-hint">
          Fora do escopo: FGTS, HomologNet, seguro-desemprego e aviso-prévio (não se aplicam a prestador PJ).
        </p>
        {validacao && <Aviso tipo="alerta">{validacao}</Aviso>}
      </>
    );
  }

  return (
    <Modal titulo="Encerramento do contrato PJ" subtitulo={`${prestador.codigo} - ${prestador.nome}`} largura="md"
      onFechar={onFechar} bloqueado={salvando}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Fechar</button>
          {podeRegistrar && (
            <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando || envelope === undefined || Boolean(validacao)}>
              <Calculator size={18} /> {salvando ? 'Gravando…' : 'Calcular e salvar encerramento'}
            </button>
          )}
        </>
      )}>
      {corpo}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </Modal>
  );
}

/** Cancela um encerramento vigente: volta a data fim e a situação e recalcula o envelope. */
export function CancelarEncerramento({ encerramento, prestador, onFechar, onConcluido }) {
  const {
    competencias = [], config, rateios, encerramentos = [], centrosMapa, user, recarregar, notificar,
  } = useFechamentoPj();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const comp = competencias.find((c) => c.competencia === encerramento.competencia);
  const abertaDoEncerramento = comp?.status === 'aberta';

  async function confirmar() {
    setErro('');
    setSalvando(true);
    try {
      await cancelarEncerramento(encerramento.id, user?.id);
      const atualizado = await salvarPrestador({ id: prestador.id, data_fim: null, situacao: 'ativo' });
      let recalculado = false;
      try {
        recalculado = await recalcularEnvelopeDoPrestador({
          prestador: atualizado, competencia: encerramento.competencia, config, rateios,
          encerramentos: encerramentos.filter((e) => e.id !== encerramento.id), centrosMapa,
          origem: 'Recálculo automático após cancelamento do encerramento',
        });
      } catch (e) {
        notificar(`Encerramento cancelado, mas o envelope não foi recalculado: ${e.message}`, 'alerta');
      }
      await auditar('Encerramento contratual cancelado',
        `${prestador.nome} • encerramento de ${dataBr(encerramento.data_encerramento)}${recalculado ? ' • envelope recalculado' : ''}`,
        { competencia: encerramento.competencia, prestadorId: prestador.id });
      await recarregar();
      notificar('Encerramento cancelado.');
      onConcluido?.();
    } catch (e) {
      setErro(e.message || 'Não foi possível cancelar o encerramento.');
      await recarregar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Cancelar encerramento" subtitulo={prestador.nome} largura="sm" onFechar={onFechar} bloqueado={salvando}
      rodape={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Voltar</button>
          <button type="button" className="btn btn-danger" onClick={confirmar} disabled={salvando || !abertaDoEncerramento}>
            {salvando ? 'Cancelando…' : 'Cancelar encerramento'}
          </button>
        </>
      )}>
      {abertaDoEncerramento ? (
        <p>
          O encerramento de {dataBr(encerramento.data_encerramento)} ({encerramento.motivo}) será cancelado. O cadastro volta a
          ficar ativo, sem data de término, e o envelope de {competenciaRotulo(encerramento.competencia)} é recalculado sem o proporcional.
        </p>
      ) : (
        <Aviso tipo="alerta">
          A competência {competenciaRotulo(encerramento.competencia)} está fechada: reabra-a na <Link to={ROTA_FOLHA}>Folha do mês</Link> antes
          de cancelar este encerramento.
        </Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </Modal>
  );
}
