import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, X, ArrowRight } from 'lucide-react';
import { AREAS_HORAS } from '../../config/horas';
import './SolucoesModal.css';
import './ProgramasModal.css';

/**
 * Escolha de área da Gestão de Horas, aberta pelo card "Gestão de Horas" da Home.
 *
 * Mesmo desenho do FinanceiroModal: o card levava direto para o apontamento e
 * empurrava as horas extras para dentro da sidebar, onde quem só queria pedir
 * uma hora extra não achava. Como as duas rotinas se resolvem em telas
 * diferentes, a escolha acontece antes de entrar.
 *
 * Reusa a casca do SolucoesModal (overlay, cartão, cabeçalho, fechar) e a grade
 * do ProgramasModal, sem estilo próprio — é a mesma pergunta ("por onde
 * começar?") que os outros cards já fazem.
 *
 * Sem filtro por acesso: o módulo é aberto a todos os logados, então as duas
 * áreas sempre aparecem.
 */
export default function HorasModal({ onClose }) {
  const navigate = useNavigate();

  // Esc fecha e a página atrás não rola enquanto o popup está aberto.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAnterior;
    };
  }, [onClose]);

  return (
    <div className="solmodal-overlay" onClick={onClose}>
      <div
        className="solmodal progmodal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="horasmodal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="solmodal-head">
          <span className="solmodal-head-icon">
            <Clock size={20} />
          </span>
          <div className="solmodal-head-txt">
            <h2 id="horasmodal-titulo">Gestão de Horas</h2>
            <p>O tempo do dia a dia ou um pedido de hora extra. Escolha por onde quer começar.</p>
          </div>
          <button type="button" className="solmodal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="solmodal-body">
          <div className="progmodal-grid">
            {AREAS_HORAS.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.slug}
                  type="button"
                  className="progmodal-card"
                  onClick={() => navigate(a.href)}
                >
                  <span className="progmodal-card-icon"><Icon size={24} /></span>
                  <strong>{a.label}</strong>
                  <span className="progmodal-card-desc">{a.desc}</span>
                  <span className="progmodal-card-cta">{a.cta} <ArrowRight size={15} /></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
