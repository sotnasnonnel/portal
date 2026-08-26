import { Check, FileText, ShieldCheck, X } from 'lucide-react';
import { getTermosPrograma } from '../../../../config/programasTermos';

/**
 * Popup das REGRAS do programa com aceite obrigatório — o item 1 da aba
 * "Alavanca" da planilha ("obrigatório marcar como aceito para evoluir").
 *
 * O formulário só é montado depois do aceite: mostrá-lo desabilitado atrás do
 * popup convidaria a pessoa a fechar o diálogo e tentar preencher assim mesmo.
 * Mesma mecânica do TermosAceite do Financeiro, com estilo próprio do módulo.
 */
export default function TermosAlavanca({
  aceite, aberto, setAberto, marcado, setMarcado, confirmar,
}) {
  const termos = getTermosPrograma('alavanca');
  if (!termos) return null;

  return (
    <>
      <div className="pg-termos-box">
        {aceite ? (
          <div className="pg-termos-ok">
            <ShieldCheck size={16} />
            <span>Regras aceitas em {new Date(aceite).toLocaleString('pt-BR')}.</span>
            <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={() => setAberto(true)}>
              Rever regras
            </button>
          </div>
        ) : (
          <>
            <p>
              Antes de indicar, é preciso ler e aceitar as <strong>regras do programa</strong>.
              Elas definem quando a indicação é válida e como a premiação é calculada.
            </p>
            <button type="button" className="pg-btn pg-btn-primary" onClick={() => setAberto(true)}>
              <FileText size={16} /> Ler as regras
            </button>
          </>
        )}
      </div>

      {aberto && (
        <div className="pg-modal-overlay" onClick={() => setAberto(false)}>
          <div
            className="pg-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={termos.titulo}
          >
            <div className="pg-modal-cab">
              <h2>{termos.titulo}</h2>
              <button type="button" className="pg-modal-x" onClick={() => setAberto(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="pg-modal-corpo">
              <p className="pg-campo-dica" style={{ marginBottom: 14 }}>{termos.intro}</p>
              <ul className="pg-regras">
                {termos.itens.map(([titulo, texto]) => (
                  <li key={titulo}><strong>{titulo}:</strong> {texto}</li>
                ))}
              </ul>

              {!aceite && (
                <label className="pg-check">
                  <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
                  <span>Li e estou de acordo com as regras do programa Alavanca PHD.</span>
                </label>
              )}
            </div>

            <div className="pg-modal-pe">
              <button type="button" className="pg-btn pg-btn-ghost" onClick={() => setAberto(false)}>
                {aceite ? 'Fechar' : 'Cancelar'}
              </button>
              {!aceite && (
                <button type="button" className="pg-btn pg-btn-primary" disabled={!marcado} onClick={confirmar}>
                  <Check size={16} /> Confirmar aceite
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
