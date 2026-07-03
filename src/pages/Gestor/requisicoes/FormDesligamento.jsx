import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserMinus, Loader2, Building2, UserCheck } from 'lucide-react';
import { useRequisicaoForm } from './useRequisicaoForm';
import { INICIATIVA_LABEL } from '../../../config/aprovacao';
import '../../../components/UI/Components.css';
import '../Gestor.css';

export default function FormDesligamento() {
  const navigate = useNavigate();
  const { user, equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComFluxo } = useRequisicaoForm();
  const [form, setForm] = useState({ colaborador_id: '', justificativa: '', data_desligamento: '', iniciativa: '' });

  const semFluxo = fluxoOk === false;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.colaborador_id || !form.justificativa || !form.data_desligamento || !form.iniciativa) return;
    setSubmitting(true);

    let dataFormatada = form.data_desligamento;
    if (dataFormatada.includes('-')) {
      const [ano, mes, dia] = dataFormatada.split('-');
      dataFormatada = `${dia}/${mes}/${ano}`;
    }
    const justificativaComData = `Data solicitada para desligamento: ${dataFormatada}\n\nJustificativa: ${form.justificativa}`;

    try {
      await criarComFluxo('desligamento', form.iniciativa, {
        tipo: 'desligamento',
        iniciativa: form.iniciativa,
        gestor_id: user.id,
        colaborador_id: form.colaborador_id,
        justificativa: justificativaComData,
        status: 'pendente',
      });
      navigate('/gestor/solicitacoes/nova', { state: { sucesso: 'Requisição de desligamento enviada com sucesso!' } });
    } catch (err) {
      console.error(err);
      if (err.message === 'SEM_FLUXO') {
        alert('O administrador ainda não configurou o fluxo de aprovação deste tipo de desligamento para você. Solicite a configuração ao DP.');
      } else {
        alert(err.message || 'Erro ao enviar requisição. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title"><UserMinus size={18} /> Nova requisição de desligamento</div>
        </div>

        <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Colaborador a ser desligado <span className="required">*</span></label>
            {loadingEquipe ? <div>Carregando...</div> : (
              <select className="form-select" value={form.colaborador_id}
                onChange={(e) => setForm((p) => ({ ...p, colaborador_id: e.target.value }))} required>
                <option value="">Selecione o colaborador...</option>
                {equipe.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.funcao || 'Sem função'}</option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Iniciativa <span className="required">*</span></label>
            <div className="iniciativa-options">
              <button type="button"
                className={`iniciativa-option ${form.iniciativa === 'empresa' ? 'active' : ''}`}
                onClick={() => setForm((p) => ({ ...p, iniciativa: 'empresa' }))}>
                <Building2 size={18} />
                <span>{INICIATIVA_LABEL.empresa}</span>
              </button>
              <button type="button"
                className={`iniciativa-option ${form.iniciativa === 'empregado' ? 'active' : ''}`}
                onClick={() => setForm((p) => ({ ...p, iniciativa: 'empregado' }))}>
                <UserCheck size={18} />
                <span>{INICIATIVA_LABEL.empregado}</span>
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Data do Desligamento <span className="required">*</span></label>
            <input className="form-input" type="date"
              value={form.data_desligamento}
              onChange={(e) => setForm((p) => ({ ...p, data_desligamento: e.target.value }))}
              required />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Justificativa <span className="required">*</span></label>
            <textarea className="form-input" rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Descreva os motivos do desligamento..."
              value={form.justificativa}
              onChange={(e) => setForm((p) => ({ ...p, justificativa: e.target.value }))}
              required />
          </div>

          {semFluxo && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>
              O administrador ainda não configurou o fluxo de aprovação deste tipo de desligamento para você. Solicite a configuração ao DP.
            </div>
          )}
          <button className="btn btn-danger" type="submit" disabled={submitting || semFluxo} style={{ width: '100%' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
            {submitting ? 'Enviando...' : 'Enviar Requisição de Desligamento'}
          </button>
        </form>
      </div>
    </>
  );
}
