import { Link } from 'react-router-dom';
import { LayoutDashboard, ArrowRight } from 'lucide-react';
import { SOLICITACOES_FIN } from '../../../../config/financeiro';

// Placeholder do Dashboard do Financeiro (Parte 1: andaime). Os indicadores reais
// entram na Parte 5, quando as tabelas e as solicitações já existirem.
export default function FinanceiroDashboard() {
  return (
    <div className="fin-page">
      <h1 className="fin-title"><LayoutDashboard size={26} /> Dashboard Financeiro</h1>
      <p className="fin-sub">Visão geral das solicitações do Financeiro. (Em construção)</p>

      <div className="fin-cards">
        {SOLICITACOES_FIN.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.slug} to={`/financeiro/solicitacoes/nova/${s.slug}`} className="fin-quick">
              <span className="fin-quick-icon"><Icon size={22} /></span>
              <span className="fin-quick-body">
                <strong>{s.curto}</strong>
                <small>Abrir solicitação</small>
              </span>
              <ArrowRight size={16} className="fin-quick-arrow" />
            </Link>
          );
        })}
      </div>

      <div className="fin-empty">
        Os indicadores do financeiro aparecerão aqui.
      </div>
    </div>
  );
}
