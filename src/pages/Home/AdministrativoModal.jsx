import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headset, X, ArrowRight } from 'lucide-react';
import './SolucoesModal.css';
import './ProgramasModal.css';

/**
 * Escolha da área do Administrativo, aberta pelo card "Administrativo" da Home.
 *
 * Chamados, Estoque e Mobilização eram três cards soltos na Home, como se
 * fossem três assuntos sem relação — e são o mesmo time. Reunidos aqui, a Home
 * deixa de exigir que a pessoa saiba de antemão em qual dos três mora o que ela
 * precisa.
 *
 * Mesmo desenho do HorasModal e do FinanceiroModal: reusa a casca do
 * SolucoesModal (overlay, cartão, cabeçalho, fechar) e a grade do
 * ProgramasModal, sem estilo próprio.
 *
 * A lista chega JÁ FILTRADA pelo acesso (areasAdministrativoDe): Estoque e
 * Mobilização seguem em lançamento restrito, e quem não entra neles não vê a
 * opção — em vez de ver um cartão travado que não leva a lugar nenhum.
 */
export default function AdministrativoModal({ areas, onClose }) {
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
        aria-labelledby="admmodal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="solmodal-head">
          <span className="solmodal-head-icon">
            <Headset size={20} />
          </span>
          <div className="solmodal-head-txt">
            <h2 id="admmodal-titulo">Administrativo</h2>
            <p>Chamados, almoxarifado e mobilização. Escolha por onde quer começar.</p>
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
