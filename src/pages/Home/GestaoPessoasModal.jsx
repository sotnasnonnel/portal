import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, X, ArrowRight } from 'lucide-react';
import { areasGestaoPessoas } from '../../components/Layout/nav';
import { useAuth } from '../../contexts/AuthContext';
import './SolucoesModal.css';
import './ProgramasModal.css';
import './GestaoPessoasModal.css';

/**
 * Escolha de área da Gestão de Pessoas, aberta pelo card da Home.
 *
 * Mesmo desenho do FinanceiroModal e do HorasModal: Colaboradores,
 * Requisições, Consultas, Horas Extras, Fechamento PJ e Ausência Programada são
 * rotinas diferentes,
 * então a escolha acontece antes de entrar, e o menu lá dentro mostra só a
 * área escolhida (areaDaRota em components/Layout/nav.js).
 *
 * As áreas saem de navSections, filtradas pelo perfil e pelos acessos de quem
 * está logado: cada pessoa vê só os cards que já teria no menu.
 */
export default function GestaoPessoasModal({ onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const areas = areasGestaoPessoas({ perfil: user?.perfil, user });

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
        className="solmodal progmodal gpmodal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gpmodal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="solmodal-head">
          <span className="solmodal-head-icon">
            <Users size={20} />
          </span>
          <div className="solmodal-head-txt">
            <h2 id="gpmodal-titulo">Gestão de Pessoas</h2>
            <p>Cada rotina do DP no seu espaço. Escolha por onde quer começar.</p>
          </div>
          <button type="button" className="solmodal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="solmodal-body">
          <div className="progmodal-grid" data-n={areas.length}>
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
