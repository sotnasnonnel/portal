import { FileText, Check, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { getTermos } from '../../../../../config/financeiroTermos';

/**
 * Caixa de aceite + popup dos Termos de Uso. Compartilhado pelos formulários.
 * O aceite é obrigatório e registra usuário + data/hora.
 */
export default function TermosAceite({ sol, user, aceite, termosOpen, setTermosOpen, aceiteCheck, setAceiteCheck, confirmarTermos }) {
  const termos = getTermos(sol.tipoDb);

  return (
    <>
      <div className="fin-termos-box">
        {aceite ? (
          <div className="fin-termos-ok">
            <ShieldCheck size={16} />
            <span>Termos aceitos por <strong>{user?.nome}</strong> em {new Date(aceite.em).toLocaleString('pt-BR')}.</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTermosOpen(true)}>Rever</button>
          </div>
        ) : (
          <div className="fin-termos-pend">
            <span>É necessário ler e aceitar os <strong>Termos de Uso e Responsabilidade</strong>.</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setTermosOpen(true)}>
              <FileText size={14} /> Ler os termos
            </button>
          </div>
        )}
      </div>

      {termosOpen && termos && (
        <div className="modal-overlay" onClick={() => setTermosOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <span className="modal-title">{termos.titulo}</span>
              <button className="modal-close" onClick={() => setTermosOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ marginBottom: 'var(--space-md)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{termos.intro}</p>
              {/* Cláusulas marcadas com destaque saem da lista corrida: são as que
                  o solicitante mais precisa ver antes de aceitar. */}
              <ul className="fin-termos-lista">
                {termos.itens.map(([t, txt, destaque]) => (
                  <li key={t} className={destaque ? 'is-destaque' : ''}>
                    {destaque && <AlertTriangle size={13} aria-hidden="true" />}
                    <span><strong>{t}:</strong> {txt}</span>
                  </li>
                ))}
              </ul>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 'var(--space-lg)', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={aceiteCheck} onChange={(e) => setAceiteCheck(e.target.checked)} style={{ marginTop: 2 }} />
                <span>Li e estou de acordo com os termos acima.</span>
              </label>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Aceite registrado em: {user?.nome} — {new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setTermosOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!aceiteCheck} onClick={confirmarTermos}>
                <Check size={16} /> Confirmar aceite
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
