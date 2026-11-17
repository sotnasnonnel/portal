import { useEffect } from 'react';
import {
  ArrowRight, FileSignature, Laptop, Monitor, Printer, Tablet, X,
} from 'lucide-react';
import './AvisoTermoTi.css';

const ICONE = { Notebook: Laptop, Monitor, Impressora: Printer, Tablet };

/**
 * Aviso de entrada (Home) para quem está com equipamento da PHD e ainda não
 * aceitou o termo de responsabilidade. Abre uma vez por sessão; "Agora não"
 * fecha, e o lembrete diário por e-mail continua até o aceite.
 */
export default function AvisoTermoTi({ ativos = [], onAceitar, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = antes;
    };
  }, [onClose]);

  const n = ativos.length;
  const mostrar = ativos.slice(0, 4);

  return (
    <div className="termo-aviso-overlay" onClick={onClose}>
      <div
        className="termo-aviso"
        role="dialog"
        aria-modal="true"
        aria-labelledby="termo-aviso-t"
        aria-describedby="termo-aviso-d"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="termo-aviso-x" onClick={onClose} aria-label="Fechar">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="termo-aviso-topo">
          <span className="termo-aviso-ic"><FileSignature size={22} aria-hidden="true" /></span>
          <span className="termo-aviso-tag">TI · Pendente</span>
        </div>
        <h2 id="termo-aviso-t">Aceite o termo de responsabilidade</h2>
        <p id="termo-aviso-d">
          Você está com {n === 1 ? 'um equipamento' : `${n} equipamentos`} da PHD e ainda não aceitou o termo.
          É rápido: leia e aceite direto no portal, sem papel.
        </p>
        <ul className="termo-aviso-lista">
          {mostrar.map((a) => {
            const Icone = ICONE[a.tipo] || Laptop;
            return (
              <li key={a.id}>
                <Icone size={16} aria-hidden="true" />
                <span className="tx">
                  <b>{[a.tipo, a.modelo].filter(Boolean).join(' · ') || 'Equipamento'}</b>
                  <span>Série {a.numero_serie}</span>
                </span>
              </li>
            );
          })}
          {n > mostrar.length && <li className="mais">e mais {n - mostrar.length}</li>}
        </ul>
        <p className="termo-aviso-nota">Até o aceite, você recebe um lembrete por e-mail todo dia.</p>
        <div className="termo-aviso-acoes">
          <button type="button" className="termo-aviso-sec" onClick={onClose}>Agora não</button>
          <button type="button" className="termo-aviso-pri" onClick={onAceitar} autoFocus>
            Ler e aceitar agora <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
