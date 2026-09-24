import { useEffect, useState } from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';
import {
  badgeClasse, diaISO, diasCorridos, fmtDataBr, statusLabel, validarRegistro,
} from '../../config/folgaCampo';

export function StatusBadge({ r }) {
  return <span className={`badge ${badgeClasse(r)}`}>{statusLabel(r)}</span>;
}

export function Alerta({ tipo = 'info', children }) {
  const Icone = tipo === 'info' || tipo === 'ok' ? Info : AlertTriangle;
  return (
    <div className={`fc-alerta fc-alerta--${tipo}`}>
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

// Motivo obrigatório (reprovação, cancelamento pelo responsável/RH) ou opcional.
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
      {descricao && <p className="fc-modal-sub">{descricao}</p>}
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <div className="form-group">
        <label className="form-label">{rotulo}{obrigatorio ? '' : ' (opcional)'}</label>
        <textarea className="form-input" rows={3} value={motivo}
          onChange={(e) => setMotivo(e.target.value)} autoFocus />
      </div>
    </Modal>
  );
}

// Novo registro de ausência de obra. `meus` são os meus registros, para checar
// sobreposição antes de mandar para o banco.
export function ModalRegistro({ meus, aprovador, onClose, onSalvar }) {
  const hoje = diaISO();
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [obra, setObra] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const validacao = validarRegistro({ inicio, fim, motivo, outros: meus, hoje });
  const mostrarValidacao = Boolean(inicio && fim);

  async function salvar() {
    if (!validacao.ok) return setErro('Corrija os pontos acima antes de enviar.');
    setErro('');
    setSalvando(true);
    try {
      await onSalvar({ inicio, fim, motivo: motivo.trim(), obra: obra.trim() });
    } catch (e) {
      setErro(e?.message || 'Falha ao registrar.');
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo="Nova folga de campo"
      onClose={onClose}
      bloqueado={salvando}
      rodape={(
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={salvando}>Fechar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando || !validacao.ok}>
            {salvando ? 'Enviando...' : 'Enviar para aprovação'}
          </button>
        </>
      )}
    >
      <p className="fc-modal-sub">
        {aprovador
          ? <>O registro vai para <strong>{aprovador.nome}</strong>, seu responsável direto.</>
          : 'Não encontramos seu responsável no cadastro: o registro será decidido pelo RH.'}
      </p>

      <div className="fc-form-linha">
        <div className="form-group">
          <label className="form-label">Primeiro dia fora da obra</label>
          <input className="form-input" type="date" min={hoje} value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
              // Ausência de 2 ou 3 dias é o caso comum: o fim acompanha o
              // início para não obrigar a digitar a mesma data duas vezes.
              if (!fim || fim < e.target.value) setFim(e.target.value);
            }} />
        </div>
        <div className="form-group">
          <label className="form-label">Último dia fora da obra</label>
          <input className="form-input" type="date" min={inicio || hoje} value={fim}
            onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Obra (opcional)</label>
        <input className="form-input" value={obra} onChange={(e) => setObra(e.target.value)}
          placeholder="De qual obra você vai se ausentar" />
      </div>

      <div className="form-group">
        <label className="form-label">Motivo</label>
        <textarea className="form-input" rows={3} value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por que você vai ficar fora" />
        <div className="form-hint">É o que seu responsável lê para decidir.</div>
      </div>

      {mostrarValidacao && (
        <div className="fc-resumo">
          <span>De <strong>{fmtDataBr(inicio)}</strong> a <strong>{fmtDataBr(fim)}</strong></span>
          <span><strong>{diasCorridos(inicio, fim)}</strong> dia(s) fora</span>
        </div>
      )}

      {mostrarValidacao && validacao.erros.length > 0 && (
        <Alerta tipo="erro">
          <ul>{validacao.erros.map((m) => <li key={m}>{m}</li>)}</ul>
        </Alerta>
      )}

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
    </Modal>
  );
}
