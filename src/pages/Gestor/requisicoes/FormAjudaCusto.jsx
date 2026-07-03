import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Loader2, AlertTriangle, Paperclip, X } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { useRequisicaoForm } from './useRequisicaoForm';
import {
  CAMPOS_AJUDA_CUSTO, camposVisiveisAjudaCusto, estadoInicialAjudaCusto,
  validarAjudaCusto, montarPayloadAjudaCusto,
} from '../../../config/ajudaCusto';
import { formatarData } from '../../../utils/formatters';
import CurrencyInput from '../../../components/CurrencyInput';
import '../../../components/UI/Components.css';
import '../Gestor.css';
import './Requisicoes.css';

const BUCKET = 'ajuda-custo-anexos';
const ANEXO_MAX_MB = 10;
const ANEXO_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';

const sanitizarNome = (nome) => nome
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '_'); // após NFD, acentos viram combinantes e caem aqui

export default function FormAjudaCusto() {
  const navigate = useNavigate();
  const { equipe, loadingEquipe, fluxoOk, submitting, setSubmitting, criarComDetalhe } = useRequisicaoForm();
  const [form, setForm] = useState(estadoInicialAjudaCusto);
  const [colaboradorId, setColaboradorId] = useState('');
  const [anexo, setAnexo] = useState(null);
  const [faltando, setFaltando] = useState([]);
  const [erro, setErro] = useState('');
  const [erroAnexo, setErroAnexo] = useState('');
  const fileRef = useRef(null);

  const semFluxo = fluxoOk === false;
  const set = (id, valor) => setForm((p) => ({ ...p, [id]: valor }));
  const toggleTipo = (opt) => setForm((p) => {
    const arr = Array.isArray(p.tipos) ? p.tipos : [];
    return { ...p, tipos: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
  });

  const onArquivo = (e) => {
    const f = e.target.files?.[0] || null;
    setErroAnexo('');
    if (f && f.size > ANEXO_MAX_MB * 1024 * 1024) {
      setErroAnexo(`Arquivo acima de ${ANEXO_MAX_MB} MB. Escolha um arquivo menor.`);
      e.target.value = '';
      setAnexo(null);
      return;
    }
    setAnexo(f);
  };

  const limparAnexo = () => {
    setAnexo(null);
    setErroAnexo('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    const falta = validarAjudaCusto(form).map((c) => c.id);
    if (!colaboradorId) falta.unshift('colaborador');
    setFaltando(falta);
    if (falta.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (form.data_final < form.data_inicio) {
      setErro('A Data Final não pode ser anterior à Data Início.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    let anexoPath = null;
    try {
      if (anexo) {
        anexoPath = `${crypto.randomUUID()}/${sanitizarNome(anexo.name)}`;
        const { error: eUp } = await supabase.storage.from(BUCKET).upload(anexoPath, anexo);
        if (eUp) throw new Error(`Falha ao enviar o anexo: ${eUp.message}`);
      }

      const payload = montarPayloadAjudaCusto(form);
      try {
        await criarComDetalhe({
          tipo: 'ajuda_custo',
          justificativa: `Ajuda de Custo: ${form.tipos.join(' + ')} — ${formatarData(form.data_inicio)} a ${formatarData(form.data_final)}`,
          tabela: 'ajudas_custo',
          detalhe: { ...payload, anexo_path: anexoPath, anexo_nome: anexo ? anexo.name : null },
          colaboradorId,
        });
      } catch (err) {
        // Não deixa arquivo órfão no bucket se a criação falhar.
        if (anexoPath) await supabase.storage.from(BUCKET).remove([anexoPath]);
        throw err;
      }

      navigate('/gestor/solicitacoes/nova', { state: { sucesso: 'Requisição de Ajuda de Custo enviada com sucesso!' } });
    } catch (err) {
      console.error(err);
      if (err.message === 'SEM_FLUXO') {
        alert('O administrador ainda não configurou o fluxo de aprovação para você. Solicite a configuração ao DP.');
      } else {
        alert(err.message || 'Erro ao enviar a requisição. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderCampo = (c) => {
    const val = form[c.id];
    if (c.tipo === 'checkbox') {
      return (
        <div className="contratacao-opcoes contratacao-opcoes-col">
          {c.opcoes.map((opt) => {
            const checked = Array.isArray(val) && val.includes(opt);
            return (
              <label key={opt} className={`contratacao-opcao ${checked ? 'active' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleTipo(opt)} />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      );
    }
    if (c.tipo === 'textarea') {
      return (
        <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
          value={val} onChange={(e) => set(c.id, e.target.value)} />
      );
    }
    if (c.tipo === 'moeda') {
      return <CurrencyInput value={val} onChange={(v) => set(c.id, v)} />;
    }
    return (
      <input className="form-input"
        type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'}
        min={c.tipo === 'number' ? 0 : undefined}
        step={c.tipo === 'number' ? (c.inteiro ? '1' : '0.01') : undefined}
        value={val} onChange={(e) => set(c.id, e.target.value)} />
    );
  };

  return (
    <>
      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title"><Wallet size={18} /> Ajuda de Custo</div>
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
          {erro && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-lg)' }}>
              <AlertTriangle size={14} /> {erro}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Colaborador <span className="required">*</span></label>
            {loadingEquipe ? <div>Carregando...</div> : (
              <select className="form-select" value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
                <option value="">Selecione o colaborador...</option>
                {equipe.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.funcao || 'Sem função'}</option>
                ))}
              </select>
            )}
            {faltando.includes('colaborador') && <span className="contratacao-erro">Obrigatório</span>}
          </div>

          {camposVisiveisAjudaCusto(form).map((c) => (
            <div key={c.id} className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">
                {c.label}{c.obrigatorio && <span className="required"> *</span>}
              </label>
              {renderCampo(c)}
              {faltando.includes(c.id) && <span className="contratacao-erro">Obrigatório</span>}
            </div>
          ))}

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Anexar arquivo</label>
            <input ref={fileRef} className="form-input" type="file" accept={ANEXO_ACCEPT} onChange={onArquivo} />
            {anexo && (
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: 'var(--space-sm)' }}>
                <Paperclip size={14} /> {anexo.name}
                <button type="button" className="btn btn-ghost btn-sm" onClick={limparAnexo} title="Remover anexo"><X size={14} /></button>
              </span>
            )}
            {erroAnexo && <span className="contratacao-erro">{erroAnexo}</span>}
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
              PDF, Word, Excel ou imagem — até {ANEXO_MAX_MB} MB.
            </span>
          </div>

          {semFluxo && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>
              O administrador ainda não configurou o fluxo de aprovação para você. Solicite a configuração ao DP.
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={submitting || semFluxo} style={{ width: '100%' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            {submitting ? 'Enviando...' : 'Enviar Requisição'}
          </button>
        </form>
      </div>
    </>
  );
}
