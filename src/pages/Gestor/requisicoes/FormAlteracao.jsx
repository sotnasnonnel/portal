import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Loader2, User, AlertTriangle } from 'lucide-react';
import { formatarMoeda } from '../../../utils/formatters';
import { supabase } from '../../../services/supabase';
import { useRequisicaoForm } from './useRequisicaoForm';
import CurrencyInput from '../../../components/CurrencyInput';
import { parseCurrency } from '../../../utils/currencyMask';
import '../../../components/UI/Components.css';
import '../Gestor.css';

const OUTRO = '__outro__';

const FORM_VAZIO = {
  colaborador_id: '', salario_proposto: '', funcao_proposta: '', funcao_outro: '', justificativa: '',
};

export default function FormAlteracao() {
  const navigate = useNavigate();
  const { user, equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComFluxo } = useRequisicaoForm();
  const [form, setForm] = useState(FORM_VAZIO);
  const [colSel, setColSel] = useState(null);
  const [erro, setErro] = useState('');
  const [funcoes, setFuncoes] = useState([]);
  const [loadingFuncoes, setLoadingFuncoes] = useState(true);

  const semFluxo = fluxoOk === false;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('funcoes').select('id, nome').order('nome');
      if (vivo) { setFuncoes(data || []); setLoadingFuncoes(false); }
    })();
    return () => { vivo = false; };
  }, []);

  const onColab = (e) => {
    const id = e.target.value;
    setColSel(equipe.find((c) => c.id === id) || null);
    setForm((p) => ({ ...p, colaborador_id: id, salario_proposto: '' }));
  };

  // Resolve a função final; com "Outro", cadastra na lista oficial (duplicata é ignorada pelo índice único).
  const resolverFuncao = async () => {
    if (form.funcao_proposta !== OUTRO) return form.funcao_proposta || null;
    const nome = form.funcao_outro.trim().toUpperCase();
    if (!nome) return null;
    const { error } = await supabase.from('funcoes').insert([{ nome, origem: 'requisicao' }]);
    if (error && error.code !== '23505') throw error;
    return nome;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.colaborador_id || !form.justificativa) return;
    const temValor = form.salario_proposto !== '';
    const temFuncao = form.funcao_proposta === OUTRO ? !!form.funcao_outro.trim() : !!form.funcao_proposta;
    if (!temValor && !temFuncao) {
      setErro('Preencha pelo menos uma alteração: novo valor ou nova função.');
      return;
    }
    setSubmitting(true);
    try {
      const funcaoFinal = await resolverFuncao();
      await criarComFluxo('aumento_salario', '', {
        tipo: 'aumento_salario',
        gestor_id: user.id,
        colaborador_id: form.colaborador_id,
        salario_proposto: temValor ? parseCurrency(form.salario_proposto) : null,
        funcao_proposta: funcaoFinal,
        justificativa: form.justificativa,
        status: 'pendente',
      });
      navigate('/gestor/solicitacoes/nova', { state: { sucesso: 'Requisição enviada com sucesso!' } });
    } catch (err) {
      console.error(err);
      if (err.message === 'SEM_FLUXO') {
        alert('O administrador ainda não configurou o fluxo de aprovação para você neste tipo de requisição. Solicite a configuração ao DP.');
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
          <div className="table-header-title"><TrendingUp size={18} /> Alteração de Cargo / Função</div>
          {semFluxo && (
            <span className="badge inativo" title="Fluxo de aprovação não configurado">
              <AlertTriangle size={13} /> Fluxo não configurado
            </span>
          )}
        </div>

        <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Colaborador <span className="required">*</span></label>
            {loadingEquipe ? <div>Carregando...</div> : (
              <select className="form-select" value={form.colaborador_id} onChange={onColab} required>
                <option value="">Selecione o colaborador...</option>
                {equipe.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.funcao || 'Sem função'}</option>
                ))}
              </select>
            )}
          </div>

          {colSel && (
            <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <User size={16} color="var(--color-text-muted)" />
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Valor atual: <strong>{formatarMoeda(colSel.salario)}</strong>
              </span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Função atual: <strong>{colSel.funcao || '—'}</strong>
              </span>
            </div>
          )}

          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
            Preencha apenas o que deseja alterar (pelo menos um dos campos abaixo).
          </p>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Novo valor (R$)</label>
            <CurrencyInput placeholder="Ex: 9.500,00"
              value={form.salario_proposto}
              onChange={(v) => setForm((p) => ({ ...p, salario_proposto: v }))} />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Nova função</label>
            <select className="form-select" value={form.funcao_proposta} disabled={loadingFuncoes}
              onChange={(e) => setForm((p) => ({ ...p, funcao_proposta: e.target.value, funcao_outro: '' }))}>
              <option value="">{loadingFuncoes ? 'Carregando funções...' : 'Sem alteração de função'}</option>
              {funcoes.map((f) => (
                <option key={f.id} value={f.nome}>{f.nome}</option>
              ))}
              <option value={OUTRO}>Outro (informar nova função)</option>
            </select>
          </div>

          {form.funcao_proposta === OUTRO && (
            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">Nome da nova função <span className="required">*</span></label>
              <input className="form-input" type="text" placeholder="Ex: ANALISTA DE PROJETOS"
                value={form.funcao_outro}
                onChange={(e) => setForm((p) => ({ ...p, funcao_outro: e.target.value }))}
                required />
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                A função informada será adicionada à lista oficial.
              </span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Justificativa <span className="required">*</span></label>
            <textarea className="form-input" rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Descreva os motivos da requisição..."
              value={form.justificativa}
              onChange={(e) => setForm((p) => ({ ...p, justificativa: e.target.value }))}
              required />
          </div>

          {erro && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>
              <AlertTriangle size={14} /> {erro}
            </div>
          )}
          {semFluxo && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>
              O administrador ainda não configurou o fluxo de aprovação deste tipo para você. Solicite a configuração ao DP.
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={submitting || semFluxo} style={{ width: '100%' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
            {submitting ? 'Enviando...' : 'Enviar Requisição'}
          </button>
        </form>
      </div>
    </>
  );
}
