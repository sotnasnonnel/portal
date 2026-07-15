import { Link } from 'react-router-dom';
import { SOLICITACOES_FIN } from '../../../../../config/financeiro';

// Hub em grade das solicitações do Financeiro (espelha RequisicoesHub do DP).
export default function FinanceiroHub() {
  return (
    <div className="fin-page">
      <h1 className="fin-title">Solicitações disponíveis</h1>
      <p className="fin-sub">Escolha o tipo de solicitação que deseja abrir.</p>

      <div className="fin-hub-grid">
        {SOLICITACOES_FIN.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.slug} to={`/financeiro/solicitacoes/nova/${s.slug}`} className="fin-hub-card">
              <span className="fin-hub-icon"><Icon size={26} /></span>
              <span className="fin-hub-label">{s.label}</span>
              {s.status === 'em_breve' && <span className="fin-hub-badge">Em breve</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
