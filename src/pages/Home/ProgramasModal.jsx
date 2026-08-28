import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { PROGRAMAS } from '../../config/programas';
import './SolucoesModal.css';
import './ProgramasModal.css';

/**
 * Escolha de programa, aberta pelo card "Programas" da Home.
 *
 * O card levava para uma TELA que só tinha esta escolha — uma navegação
 * inteira (com sidebar, cabeçalho e volta) para dois botões. Como popup, a
 * escolha acontece sem sair da Home e leva direto ao programa.
 *
 * Reusa a casca do SolucoesModal (overlay, cartão, cabeçalho, fechar), que é
 * o popup que a Home já tinha: dois estilos de diálogo na mesma tela seriam
 * duas Homes diferentes.
 */
export default function ProgramasModal({ onClose }) {
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
        aria-labelledby="progmodal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="solmodal-head">
          <span className="solmodal-head-icon">
            <Sparkles size={20} />
          </span>
          <div className="solmodal-head-txt">
            <h2 id="progmodal-titulo">Programas</h2>
            <p>Os programas internos da PHD. Escolha por onde quer começar.</p>
          </div>
          <button type="button" className="solmodal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="solmodal-body">
          <div className="progmodal-grid">
            {PROGRAMAS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.slug}
                  type="button"
                  className="progmodal-card"
                  onClick={() => navigate(p.href)}
                >
                  <span className="progmodal-card-icon"><Icon size={24} /></span>
                  <strong>{p.label}</strong>
                  <span className="progmodal-card-desc">{p.desc}</span>
                  <span className="progmodal-card-cta">{p.cta} <ArrowRight size={15} /></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
