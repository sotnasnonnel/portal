import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import {
  VALIDACAO_LABEL, calcularFinanceiro, calcularTempo, notaFacilidade, pendencias,
} from '../../lib/roi';

/**
 * Parecer da equipe de Inovação sobre uma ficha de ROI. Só ficha validada entra
 * no ranking.
 *
 * Os números calculados ficam à vista no próprio modal: validar é conferir
 * esses três valores contra as evidências, e abrir a ficha inteira para isso
 * seria o caminho longo. A ficha completa fica a um link.
 */

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const fmtPct = (r) => (r.estado !== 'ok' ? '—' : r.reducao === null ? 'n.a.' : pct.format(r.reducao));

export default function ValidarFichaModal({ ficha, registro, onFechar, onValidar }) {
  const [validacao, setValidacao] = useState(ficha.validacao === 'pendente' ? 'validada' : ficha.validacao);
  const [parecer, setParecer] = useState(ficha.parecer || '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !salvando) onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar, salvando]);

  const faltam = pendencias(ficha);

  const enviar = async (e) => {
    e.preventDefault();
    if (validacao === 'recusada' && !parecer.trim()) {
      setErro('Escreva o motivo da recusa: é o que o autor vai ler para corrigir a ficha.');
      return;
    }
    if (validacao === 'validada' && faltam) {
      setErro(`A ficha ainda tem ${faltam} pendência(s) de preenchimento. Ficha incompleta não entra no ranking.`);
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onValidar({ validacao, parecer });
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };

  return (
    <div className="pg-modal-overlay" onClick={() => !salvando && onFechar()}>
      <form
        className="pg-modal pg-classificar-modal" onClick={(e) => e.stopPropagation()}
        onSubmit={enviar} role="dialog" aria-modal="true" aria-label="Validar ficha de ROI"
      >
        <div className="pg-modal-cab">
          <h2>Validar ficha de ROI</h2>
          <button type="button" className="pg-modal-x" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="pg-modal-corpo">
          <p className="pg-pedir-alvo">#{registro.numero} — {registro.titulo}</p>
          <p className="pg-campo-dica">
            {registro.autorNome || 'Autor não identificado'} · {registro.setor} ·{' '}
            <Link className="pg-link" to={`/programas/ideias/${registro.id}/roi`}>abrir a ficha completa</Link>
          </p>

          <dl className="pg-valores pg-roi-metricas">
            <div><dt>Redução de custo</dt><dd>{fmtPct(calcularFinanceiro(ficha))}</dd></div>
            <div><dt>Redução de tempo</dt><dd>{fmtPct(calcularTempo(ficha))}</dd></div>
            <div>
              <dt>Facilidade</dt>
              <dd>{notaFacilidade(ficha).completa ? `${notaFacilidade(ficha).nota}/8` : '—'}</dd>
            </div>
          </dl>

          {erro && <div className="pg-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

          <div className="pg-campo pg-roi-depois">
            <label>Parecer</label>
            <div className="pg-chips">
              {['validada', 'recusada', 'pendente'].map((s) => (
                <button
                  key={s} type="button"
                  className={`pg-chip ${validacao === s ? 'is-on' : ''}`}
                  aria-pressed={validacao === s}
                  onClick={() => setValidacao(s)}
                >
                  {VALIDACAO_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="pg-campo">
            <label htmlFor="vf-parecer">
              Comentário{validacao === 'recusada'
                ? <span className="req">*</span>
                : <span className="opc">(opcional)</span>}
            </label>
            <textarea
              id="vf-parecer" className="pg-textarea" value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              placeholder="O que foi conferido, ou o que precisa ser corrigido."
            />
          </div>
        </div>

        <div className="pg-modal-pe">
          <button type="button" className="pg-btn pg-btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="pg-btn pg-btn-primary" disabled={salvando}>
            {salvando ? <Loader2 size={15} className="pg-spin" /> : <CheckCircle2 size={15} />}
            {salvando ? 'Salvando…' : 'Salvar parecer'}
          </button>
        </div>
      </form>
    </div>
  );
}
