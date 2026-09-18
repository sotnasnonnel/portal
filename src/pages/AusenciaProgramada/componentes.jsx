import { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';
import {
  SITUACAO_LABEL, badgeClasse, diasCorridos, fimPorDias, fmtDataBr, periodoSugerido,
  rotuloPeriodo, situacaoPeriodo, statusLabel, validarPedido, diaISO,
} from '../../config/ausenciaProgramada';

// `icone` chega como elemento pronto (<CalendarDays size={22} />): o projeto não
// usa eslint-plugin-react, e um componente recebido por prop seria acusado de
// variável não usada.
export function StatCard({ tom, icone, valor, rotulo, data = false, ativo = false, onClick }) {
  return (
    <div className={`stat-card ${tom} ${ativo ? 'is-active' : ''}`} onClick={onClick}>
      <div className="stat-card-header">
        <div className="stat-card-icon">{icone}</div>
      </div>
      <div className={`stat-card-value ${data ? 'ap-stat-data' : ''}`}>{valor}</div>
      <div className="stat-card-label">{rotulo}</div>
    </div>
  );
}

export function StatusBadge({ s }) {
  return (
    <>
      <span className={`badge ${badgeClasse(s)}`}>{statusLabel(s)}</span>
      {s.fora_do_prazo && s.status !== 'cancelada' && <span className="ap-tag-prazo">Fora do prazo</span>}
    </>
  );
}

export function SituacaoPeriodo({ periodo }) {
  const sit = situacaoPeriodo(periodo);
  if (!sit) return null;
  return <span className={`ap-situacao ap-situacao--${sit}`}>{SITUACAO_LABEL[sit]}</span>;
}

export function Alerta({ tipo = 'info', children }) {
  const Icone = tipo === 'info' || tipo === 'ok' ? Info : AlertTriangle;
  return (
    <div className={`ap-alerta ap-alerta--${tipo}`}>
      <Icone size={16} />
      <div>{children}</div>
    </div>
  );
}

function Modal({ titulo, onClose, bloqueado = false, children, rodape }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !bloqueado) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, bloqueado]);

  return (
    <div className="modal-overlay" onClick={() => !bloqueado && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button className="modal-close" onClick={onClose} disabled={bloqueado} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {rodape && <div className="modal-footer">{rodape}</div>}
      </div>
    </div>
  );
}

// Motivo obrigatório (reprovação, cancelamento pelo gestor/RH) ou opcional.
export function ModalMotivo({
  titulo, descricao, rotulo, confirmar, obrigatorio = true, perigo = true, onClose, onConfirm,
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function enviar() {
    if (obrigatorio && !motivo.trim()) return setErro('Informe o motivo.');
    setErro('');
    setSalvando(true);
    try {
      await onConfirm(motivo.trim());
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo={titulo}
      onClose={onClose}
      bloqueado={salvando}
      rodape={(
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Voltar</button>
          <button className={`btn ${perigo ? 'btn-danger' : 'btn-primary'}`} onClick={enviar} disabled={salvando}>
            {salvando ? 'Salvando...' : confirmar}
          </button>
        </>
      )}
    >
      {descricao && <p className="ap-modal-sub">{descricao}</p>}
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <div className="form-group">
        <label className="form-label">{rotulo}{obrigatorio ? '' : ' (opcional)'}</label>
        <textarea className="form-input" rows={3} value={motivo}
          onChange={(e) => setMotivo(e.target.value)} autoFocus />
      </div>
    </Modal>
  );
}

// Novo pedido ou edição de rascunho. `periodos` são os MEUS períodos (com
// saldo calculado); `minhas` são as minhas solicitações, para a sobreposição.
export function ModalPedido({ periodos, minhas, rascunho = null, aprovador, onClose, onSalvar }) {
  const hoje = diaISO();
  const [inicio, setInicio] = useState(rascunho?.data_inicio || '');
  const [modo, setModo] = useState('dias');
  const [qtd, setQtd] = useState(rascunho ? String(rascunho.dias) : '');
  const [fimManual, setFimManual] = useState(rascunho?.data_fim || '');
  const [periodoId, setPeriodoId] = useState(rascunho?.periodo_id || '');
  const [observacao, setObservacao] = useState(rascunho?.observacao || '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fim = modo === 'dias' ? fimPorDias(inicio, qtd) : fimManual;

  // Sugere o período de data limite mais próxima assim que a data de início
  // é escolhida — a pessoa ainda pode trocar.
  const sugerido = useMemo(() => (inicio ? periodoSugerido(periodos, inicio) : null), [periodos, inicio]);
  const periodoEscolhido = periodos.find((p) => p.id === periodoId) || null;
  const periodoAtivo = periodoEscolhido || sugerido;

  // Na edição de um rascunho, o saldo do período não conta o próprio rascunho
  // (rascunho não reserva saldo), então o saldo da lista já está certo.
  const validacao = validarPedido({
    periodo: periodoAtivo, inicio, fim, idAtual: rascunho?.id, outras: minhas, hoje,
  });

  // Períodos que ainda fazem sentido escolher: com saldo e dentro da data limite
  // (o fora do prazo continua possível — o aviso aparece).
  const opcoes = periodos.filter((p) => p.saldo > 0 || p.id === periodoId);

  async function salvar(enviar) {
    if (enviar && !validacao.ok) return setErro('Corrija os pontos acima antes de enviar.');
    if (!enviar && (!inicio || !fim || !periodoAtivo)) {
      return setErro('Para guardar o rascunho, informe o período, a data de início e o fim.');
    }
    setErro('');
    setSalvando(true);
    try {
      await onSalvar({
        id: rascunho?.id || null,
        periodoId: periodoAtivo.id,
        inicio,
        fim,
        observacao: observacao.trim(),
        enviar,
      });
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  const mostrarValidacao = Boolean(inicio && fim);

  return (
    <Modal
      titulo={rascunho ? `Rascunho #${rascunho.numero}` : 'Nova ausência programada'}
      onClose={onClose}
      bloqueado={salvando}
      rodape={(
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Fechar</button>
          <button className="btn btn-secondary" onClick={() => salvar(false)} disabled={salvando}>
            Guardar rascunho
          </button>
          <button className="btn btn-primary" onClick={() => salvar(true)}
            disabled={salvando || (mostrarValidacao && !validacao.ok)}>
            {salvando ? 'Enviando...' : 'Enviar para aprovação'}
          </button>
        </>
      )}
    >
      <p className="ap-modal-sub">
        {aprovador
          ? <>O pedido vai para <strong>{aprovador.nome}</strong>, seu gestor direto.</>
          : 'Não encontramos seu gestor direto no cadastro: o pedido será decidido pelo RH.'}
      </p>

      <div className="ap-form-linha">
        <div className="form-group">
          <label className="form-label">Data de início</label>
          <input className="form-input" type="date" min={hoje} value={inicio}
            onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="form-group">
          <div className="ap-modo" role="tablist">
            <button type="button" className={`filter-chip ${modo === 'dias' ? 'active' : ''}`}
              onClick={() => setModo('dias')}>Quantidade de dias</button>
            <button type="button" className={`filter-chip ${modo === 'fim' ? 'active' : ''}`}
              onClick={() => { setModo('fim'); if (!fimManual && fim) setFimManual(fim); }}>Data fim</button>
          </div>
          {modo === 'dias' ? (
            <input className="form-input" type="number" min={1} step={1} value={qtd}
              placeholder="Ex.: 14" onChange={(e) => setQtd(e.target.value)} />
          ) : (
            <input className="form-input" type="date" min={inicio || hoje} value={fimManual}
              onChange={(e) => { setFimManual(e.target.value); setQtd(String(diasCorridos(inicio, e.target.value) || '')); }} />
          )}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Período de referência</label>
        <select className="form-select" value={periodoAtivo?.id || ''} onChange={(e) => setPeriodoId(e.target.value)}>
          <option value="" disabled>Escolha o período</option>
          {opcoes.map((p) => (
            <option key={p.id} value={p.id}>
              {rotuloPeriodo(p)} · saldo {p.saldo} dia(s) · data limite {fmtDataBr(p.data_limite)}
            </option>
          ))}
        </select>
        <div className="form-hint">
          Dias corridos. Dá para dividir o saldo em mais de um pedido (ex.: 14 + 7).
        </div>
      </div>

      {mostrarValidacao && (
        <div className="ap-resumo-pedido">
          <span>De <strong>{fmtDataBr(inicio)}</strong> a <strong>{fmtDataBr(fim)}</strong></span>
          <span><strong>{validacao.dias}</strong> dia(s)</span>
          {periodoAtivo && (
            <span>Saldo depois do pedido: <strong>{Math.max(0, periodoAtivo.saldo - validacao.dias)}</strong></span>
          )}
        </div>
      )}

      {mostrarValidacao && validacao.erros.length > 0 && (
        <Alerta tipo="erro">
          <ul>{validacao.erros.map((m) => <li key={m}>{m}</li>)}</ul>
        </Alerta>
      )}
      {mostrarValidacao && validacao.avisos.map((m) => <Alerta key={m} tipo="aviso">{m}</Alerta>)}

      <div className="form-group">
        <label className="form-label">Observação (opcional)</label>
        <textarea className="form-input" rows={2} value={observacao}
          onChange={(e) => setObservacao(e.target.value)} />
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
    </Modal>
  );
}

// RH: corrige um período ou cadastra um novo (`periodo` null + `colaborador`).
export function ModalPeriodo({ periodo = null, colaborador = null, onClose, onSalvar }) {
  const novo = !periodo;
  const [f, setF] = useState(() => ({
    inicio_periodo: periodo?.inicio_periodo || colaborador?.data_admissao || '',
    fim_periodo: periodo?.fim_periodo || '',
    data_inicial: periodo?.data_inicial || '',
    data_limite: periodo?.data_limite || '',
    dias_direito: String(periodo?.dias_direito ?? 21),
    dias_ajuste: String(periodo?.dias_ajuste ?? 0),
    ajuste_motivo: periodo?.ajuste_motivo || '',
    observacao: periodo?.observacao || '',
  }));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  // No cadastro, a janela segue a regra padrão a partir do início do período.
  function preencherPadrao() {
    if (!f.inicio_periodo) return;
    const [y, m, d] = f.inicio_periodo.split('-');
    const mais = (n) => `${Number(y) + n}-${m}-${d}`;
    setF((x) => ({ ...x, fim_periodo: mais(1), data_inicial: mais(1), data_limite: mais(2) }));
  }

  async function salvar() {
    const direito = Number(f.dias_direito);
    const ajuste = Number(f.dias_ajuste || 0);
    if (!f.inicio_periodo || !f.fim_periodo || !f.data_inicial || !f.data_limite) {
      return setErro('Preencha as quatro datas.');
    }
    if (f.fim_periodo <= f.inicio_periodo) return setErro('O fim do período deve ser depois do início.');
    if (f.data_limite < f.data_inicial) return setErro('A data limite não pode ser anterior à data inicial.');
    if (!Number.isInteger(direito) || direito < 0) return setErro('Dias de direito inválidos.');
    if (!Number.isInteger(ajuste)) return setErro('O ajuste deve ser um número inteiro (pode ser negativo).');
    if (ajuste !== 0 && !f.ajuste_motivo.trim()) return setErro('Informe o motivo do ajuste.');
    setErro('');
    setSalvando(true);
    try {
      await onSalvar({
        ...(novo ? { colaborador_id: colaborador.id } : {}),
        inicio_periodo: f.inicio_periodo,
        fim_periodo: f.fim_periodo,
        data_inicial: f.data_inicial,
        data_limite: f.data_limite,
        dias_direito: direito,
        dias_ajuste: ajuste,
        ajuste_motivo: ajuste !== 0 ? f.ajuste_motivo.trim() : null,
        observacao: f.observacao.trim() || null,
      });
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  const nome = periodo?.colaborador_nome || colaborador?.nome;

  return (
    <Modal
      titulo={novo ? 'Cadastrar período' : 'Corrigir período'}
      onClose={onClose}
      bloqueado={salvando}
      rodape={(
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Voltar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      )}
    >
      <p className="ap-modal-sub">
        {nome}
        {periodo && <> · saldo atual {periodo.saldo} dia(s)</>}
      </p>

      <div className="ap-form-linha">
        <div className="form-group">
          <label className="form-label">Início do período</label>
          <input className="form-input" type="date" value={f.inicio_periodo}
            onChange={set('inicio_periodo')} onBlur={() => novo && !f.fim_periodo && preencherPadrao()} />
        </div>
        <div className="form-group">
          <label className="form-label">Fim do período</label>
          <input className="form-input" type="date" value={f.fim_periodo} onChange={set('fim_periodo')} />
        </div>
        <div className="form-group">
          <label className="form-label">Data inicial (pode usar a partir de)</label>
          <input className="form-input" type="date" value={f.data_inicial} onChange={set('data_inicial')} />
        </div>
        <div className="form-group">
          <label className="form-label">Data limite</label>
          <input className="form-input" type="date" value={f.data_limite} onChange={set('data_limite')} />
        </div>
        <div className="form-group">
          <label className="form-label">Dias de direito</label>
          <input className="form-input" type="number" min={0} step={1} value={f.dias_direito} onChange={set('dias_direito')} />
        </div>
        <div className="form-group">
          <label className="form-label">Ajuste de saldo (+/−)</label>
          <input className="form-input" type="number" step={1} value={f.dias_ajuste} onChange={set('dias_ajuste')} />
        </div>
      </div>

      {Number(f.dias_ajuste || 0) !== 0 && (
        <div className="form-group">
          <label className="form-label">Motivo do ajuste</label>
          <input className="form-input" value={f.ajuste_motivo} onChange={set('ajuste_motivo')}
            placeholder="Ex.: saldo do período anterior levado para este" />
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Observação (opcional)</label>
        <textarea className="form-input" rows={2} value={f.observacao} onChange={set('observacao')} />
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
    </Modal>
  );
}
