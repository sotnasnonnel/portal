import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Wrench } from 'lucide-react';
import { getSolicitacaoFin } from '../../../../../config/financeiro';
import FormCartaoVirtual from '../components/FormCartaoVirtual';
import FormAumentoLimite from '../components/FormAumentoLimite';

// Cada tipo tem seu formulário (os campos divergem).
const FORMS = {
  'cartao-virtual': FormCartaoVirtual,
  'aumento-limite': FormAumentoLimite,
};

// Container da rota :tipo. Resolve o slug no registro; se 'pronto' renderiza o
// formulário do tipo, senão o placeholder.
export default function NovaSolicitacaoFin() {
  const { tipo } = useParams();
  const navigate = useNavigate();
  const sol = getSolicitacaoFin(tipo);

  // Slug inexistente: volta ao hub.
  if (!sol) return <Navigate to="/financeiro/solicitacoes/nova" replace />;

  const Icon = sol.icon;
  const Form = sol.status === 'pronto' ? FORMS[sol.slug] : null;

  return (
    <div className="fin-page">
      <button type="button" className="fin-back" onClick={() => navigate('/financeiro/solicitacoes/nova')}>
        <ArrowLeft size={16} /> Voltar para solicitações
      </button>
      <h1 className="fin-title"><Icon size={26} /> {sol.label}</h1>

      {Form ? (
        <Form sol={sol} />
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
