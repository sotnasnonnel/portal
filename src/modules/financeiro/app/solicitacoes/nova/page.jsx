import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Wrench } from 'lucide-react';
import { getSolicitacaoFin } from '../../../../../config/financeiro';
import SolicitacaoFinForm from '../components/SolicitacaoFinForm';

// Container da rota :tipo. Resolve o slug no registro; se 'pronto' renderiza o
// formulário compartilhado (os 3 tipos usam os mesmos campos), senão o placeholder.
export default function NovaSolicitacaoFin() {
  const { tipo } = useParams();
  const navigate = useNavigate();
  const sol = getSolicitacaoFin(tipo);

  // Slug inexistente: volta ao hub.
  if (!sol) return <Navigate to="/financeiro/solicitacoes/nova" replace />;

  const Icon = sol.icon;

  return (
    <div className="fin-page">
      <button type="button" className="fin-back" onClick={() => navigate('/financeiro/solicitacoes/nova')}>
        <ArrowLeft size={16} /> Voltar para solicitações
      </button>
      <h1 className="fin-title"><Icon size={26} /> {sol.label}</h1>

      {sol.status === 'pronto' ? (
        <SolicitacaoFinForm sol={sol} />
      ) : (
        <div className="fin-construcao">
          <Wrench size={30} />
          <strong>Em construção</strong>
          <span>Esta solicitação estará disponível em breve.</span>
        </div>
      )}
    </div>
  );
}
