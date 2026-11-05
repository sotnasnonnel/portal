import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, X, ArrowRight } from 'lucide-react';
import { AREAS_SETOR_ADM } from '../../config/setorAdm';
import './SolucoesModal.css';
import './ProgramasModal.css';

/**
 * Escolha de área do card "Administrativo" da Home (o SETOR: Frota e
 * Alojamentos). Não confundir com AdministrativoModal, que é o do Atendimento.
 *
 * Mesmo desenho do GestaoPessoasModal: reusa a casca do SolucoesModal e a grade
 * do ProgramasModal, sem estilo próprio.
 */
export default function SetorAdmModal({ onClose }) {
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
        aria-labelledby="setoradm-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="solmodal-head">
          <span className="solmodal-head-icon">
            <Building2 size={20} />
          </span>
          <div className="solmodal-head-txt">
            <h2 id="setoradm-titulo">Administrativo</h2>
            <p>Frota e alojamentos, cada um no seu espaço. Escolha por onde quer começar.</p>
          </div>
          <button type="button" className="solmodal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="solmodal-body">
          <div className="progmodal-grid" data-n={AREAS_SETOR_ADM.length}>
            {AREAS_SETOR_ADM.map((a) => {
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
