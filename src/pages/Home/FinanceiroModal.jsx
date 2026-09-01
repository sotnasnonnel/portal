import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, X, ArrowRight } from 'lucide-react';
import { areasFinanceiroDe } from '../../config/financeiro';
import { useAuth } from '../../contexts/AuthContext';
import './SolucoesModal.css';
import './ProgramasModal.css';

/**
 * Escolha de área do Financeiro, aberta pelo card "Financeiro" da Home.
 *
 * Mesmo desenho do ProgramasModal: o card levava direto para os Cartões e
 * empurrava o Reembolso para dentro da sidebar, onde quem só queria reembolso
 * não achava. Como as duas rotinas não têm nada a ver uma com a outra, a
 * escolha acontece antes de entrar.
 *
 * Reusa a casca do SolucoesModal (overlay, cartão, cabeçalho, fechar) e a grade
 * do ProgramasModal, sem estilo próprio: é a mesma pergunta ("por onde começar?")
 * e a mesma resposta, então desenhá-la de dois jeitos seriam duas Homes
 * diferentes. O acento segue o laranja da marca, como no popup dos Programas —
 * o `tone` dos cards da Home é cinza para todos (ver Home.css).
 */
export default function FinanceiroModal({ onClose }) {
  const navigate = useNavigate();
  const { modules } = useAuth();
  const areas = areasFinanceiroDe(modules);

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
        aria-labelledby="finmodal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="solmodal-head">
          <span className="solmodal-head-icon">
            <CreditCard size={20} />
          </span>
          <div className="solmodal-head-txt">
            <h2 id="finmodal-titulo">Financeiro</h2>
            <p>Cartões da empresa ou dinheiro de volta no seu bolso. Escolha por onde quer começar.</p>
          </div>
          <button type="button" className="solmodal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="solmodal-body">
          <div className="progmodal-grid">
            {areas.map((a) => {
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
