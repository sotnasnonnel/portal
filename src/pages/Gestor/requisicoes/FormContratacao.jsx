import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, AlertTriangle } from 'lucide-react';
import { useRequisicaoForm } from './useRequisicaoForm';
import { camposVisiveis, estadoInicial, validar, montarPayload } from '../../../config/formularioContratacao';
import '../../../components/UI/Components.css';
import '../Gestor.css';
import './Requisicoes.css';

export default function FormContratacao() {
  const navigate = useNavigate();
  const { fluxoOk, submitting, setSubmitting, criarFormularioContratacao } = useRequisicaoForm();
  const [form, setForm] = useState(estadoInicial);
  const [faltando, setFaltando] = useState([]);

  const semFluxo = fluxoOk === false;
  const set = (id, valor) => setForm((p) => ({ ...p, [id]: valor }));
  const toggleCheck = (id, opt) => setForm((p) => {
    const arr = Array.isArray(p[id]) ? p[id] : [];
    return { ...p, [id]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    const falta = validar(form);
    setFaltando(falta.map((c) => c.id));
    if (falta.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setSubmitting(true);
    try {
      await criarFormularioContratacao(montarPayload(form));
      navigate('/gestor/solicitacoes/nova', { state: { sucesso: 'Formulário de contratação enviado com sucesso!' } });
    } catch (err) {
      console.error(err);
      if (err.message === 'SEM_FLUXO') {
        alert('O administrador ainda não configurou o fluxo de aprovação para você. Solicite a configuração ao DP.');
      } else {
        alert(err.message || 'Erro ao enviar o formulário. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderCampo = (c) => {
    const val = form[c.id];
    if (c.tipo === 'date' || c.tipo === 'text' || c.tipo === 'number') {
      return (
        <input
          className="form-input"
          type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'}
          value={val}
          onChange={(e) => set(c.id, e.target.value)}
        />
      );
    }
    if (c.tipo === 'bool') {
      return (
        <div className="contratacao-opcoes">
          {[['Sim', true], ['Não', false]].map(([lab, v]) => (
            <label key={lab} className={`contratacao-opcao ${val === v ? 'active' : ''}`}>
              <input type="radio" name={c.id} checked={val === v} onChange={() => set(c.id, v)} />
              <span>{lab}</span>
            </label>
          ))}
        </div>
      );
    }
    if (c.tipo === 'radio') {
      return (
        <div className="contratacao-opcoes contratacao-opcoes-col">
          {c.opcoes.map((opt) => (
            <label key={opt} className={`contratacao-opcao ${val === opt ? 'active' : ''}`}>
              <input type="radio" name={c.id} checked={val === opt} onChange={() => set(c.id, opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      );
    }
    return (
      <div className="contratacao-opcoes contratacao-opcoes-col">
        {c.opcoes.map((opt) => {
          const checked = Array.isArray(val) && val.includes(opt);
          return (
            <label key={opt} className={`contratacao-opcao ${checked ? 'active' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleCheck(c.id, opt)} />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title"><FileText size={18} /> Formulário para admissão</div>
          {semFluxo && (
            <span className="badge inativo" title="Fluxo de aprovação não configurado">
              <AlertTriangle size={13} /> Fluxo não configurado
            </span>
          )}
        </div>

        <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
          {faltando.length > 0 && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-lg)' }}>
              Preencha os campos obrigatórios destacados ({faltando.length}).
            </div>
          )}

          {camposVisiveis(form).map((c) => (
            <div key={c.id} className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">
                {c.n}. {c.label}{c.obrigatorio && <span className="required"> *</span>}
              </label>
              {renderCampo(c)}
              {faltando.includes(c.id) && <span className="contratacao-erro">Obrigatório</span>}
            </div>
          ))}

          {semFluxo && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>
              O administrador ainda não configurou o fluxo de aprovação para você. Solicite a configuração ao DP.
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={submitting || semFluxo} style={{ width: '100%' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {submitting ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </>
  );
}
