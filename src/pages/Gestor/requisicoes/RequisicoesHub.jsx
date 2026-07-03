import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { REQUISICOES } from '../../../config/requisicoes';
import '../Gestor.css';
import './Requisicoes.css';

export default function RequisicoesHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sucesso, setSucesso] = useState(location.state?.sucesso || '');

  // Limpa o state da navegação para a mensagem não reaparecer ao voltar/atualizar,
  // e some sozinha após alguns segundos.
  useEffect(() => {
    if (!location.state?.sucesso) return undefined;
    navigate('/gestor/solicitacoes/nova', { replace: true, state: null });
    const t = setTimeout(() => setSucesso(''), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title">Requisições DP</h1>
      <p className="page-subtitle">Selecione o tipo de requisição que deseja abrir.</p>

      {sucesso && (
        <div className="success-msg" style={{ marginBottom: 'var(--space-lg)' }}>
          <Check size={16} /> {sucesso}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => navigate('/gestor/solicitacoes/acompanhar')}>
            Ver andamento <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div className="requisicoes-grid">
        {REQUISICOES.map((r) => {
          const Icon = r.icon;
          return (
            <button key={r.slug} type="button" className="requisicao-card"
              onClick={() => navigate(`/gestor/solicitacoes/nova/${r.slug}`)}>
              <Icon size={26} className="requisicao-card-icon" />
              <span className="requisicao-card-text">
                <span className="requisicao-card-label">{r.label}</span>
                {r.desc && <span className="requisicao-card-desc">{r.desc}</span>}
              </span>
              {r.status === 'em_breve' && <span className="requisicao-card-badge">Em breve</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
