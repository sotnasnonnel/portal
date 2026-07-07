import { useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, FilePlus2, History } from 'lucide-react';
import { getRequisicao } from '../../../config/requisicoes';
import FormDesligamento from './FormDesligamento';
import FormAlteracao from './FormAlteracao';
import FormContratacao from './FormContratacao';
import FormMapeamento from './FormMapeamento';
import FormAjudaCusto from './FormAjudaCusto';
import FormNovaVaga from './FormNovaVaga';
import HistoricoRequisicoes from './HistoricoRequisicoes';
import EmConstrucao from './EmConstrucao';
import '../Gestor.css';
import './Requisicoes.css';

// Mapeia slug -> componente de formulário (apenas requisições 'pronto').
const FORMS = {
  desligamento: FormDesligamento,
  alteracao: FormAlteracao,
  'formulario-contratacao': FormContratacao,
  mapeamento: FormMapeamento,
  'ajuda-custo': FormAjudaCusto,
  'nova-vaga': FormNovaVaga,
};

export default function NovaRequisicao() {
  const { tipo } = useParams();
  const navigate = useNavigate();
  const req = getRequisicao(tipo);
  const [aba, setAba] = useState('nova');

  // Trocar de requisição volta para a aba do formulário (reset durante o render,
  // padrão recomendado pelo React em vez de setState dentro de useEffect).
  const [tipoAnterior, setTipoAnterior] = useState(tipo);
  if (tipo !== tipoAnterior) {
    setTipoAnterior(tipo);
    setAba('nova');
  }

  // Slug inexistente: volta ao hub.
  if (!req) return <Navigate to="/gestor/solicitacoes/nova" replace />;

  const Icon = req.icon;

  const Form = req.status === 'pronto' ? FORMS[req.slug] : null;

  return (
    <div className="gestor-page animate-fade-in-up">
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-md)' }}
        onClick={() => navigate('/gestor/solicitacoes/nova')}>
        <ArrowLeft size={16} /> Voltar para requisições
      </button>
      <h1 className="page-title"><Icon size={28} /> {req.label}</h1>

      {Form ? (
        <>
          <div className="req-tabs">
            <button type="button" className={`req-tab ${aba === 'nova' ? 'active' : ''}`} onClick={() => setAba('nova')}>
              <FilePlus2 size={15} /> Nova requisição
            </button>
            <button type="button" className={`req-tab ${aba === 'historico' ? 'active' : ''}`} onClick={() => setAba('historico')}>
              <History size={15} /> Histórico
            </button>
          </div>
          {aba === 'nova' ? <Form /> : <HistoricoRequisicoes req={req} />}
        </>
      ) : (
        <EmConstrucao label={req.label} />
      )}
    </div>
  );
}
