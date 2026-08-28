import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Loader2, Paperclip, X } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { useRequisicaoForm } from './useRequisicaoForm';
import { useAnexos } from './useAnexos';
import {
  CAMPOS_MAPEAMENTO, UFS, estadoInicialMapeamento, validarMapeamento, montarPayloadMapeamento,
} from '../../../config/mapeamento';
import '../../../components/UI/Components.css';
import '../Gestor.css';
import './Requisicoes.css';

const OUTRO = '__outro__';
const BUCKET = 'mapeamento-anexos';
const ANEXO_MAX_MB = 10;
const ANEXO_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';

export default function FormMapeamento() {
  const navigate = useNavigate();
  const { submitting, setSubmitting, criarComDetalhe } = useRequisicaoForm();
  const [form, setForm] = useState(estadoInicialMapeamento);
  const [funcaoOutro, setFuncaoOutro] = useState('');
  const [faltando, setFaltando] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [loadingFuncoes, setLoadingFuncoes] = useState(true);
  const anexos = useAnexos({ bucket: BUCKET, maxMb: ANEXO_MAX_MB });

  const set = (id, valor) => setForm((p) => ({ ...p, [id]: valor }));

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('funcoes').select('id, nome').order('nome');
      if (vivo) { setFuncoes(data || []); setLoadingFuncoes(false); }
    })();
    return () => { vivo = false; };
  }, []);

  // Com "Outro", cadastra a função na lista oficial (duplicata é ignorada pelo índice único).
  const resolverFuncao = async () => {
    if (form.funcao !== OUTRO) return form.funcao;
    const nome = funcaoOutro.trim().toUpperCase();
    const { error } = await supabase.from('funcoes').insert([{ nome, origem: 'requisicao' }]);
    if (error && error.code !== '23505') throw error;
    return nome;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const falta = validarMapeamento(form).map((c) => c.id);
    if (form.funcao === OUTRO && !funcaoOutro.trim() && !falta.includes('funcao')) falta.push('funcao');
    setFaltando(falta);
    if (falta.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setSubmitting(true);
    let enviados = [];
    try {
      const funcaoFinal = await resolverFuncao();
      enviados = await anexos.enviar();

      const payload = { ...montarPayloadMapeamento(form), funcao: funcaoFinal };
      try {
        await criarComDetalhe({
          tipo: 'mapeamento',
          justificativa: `Mapeamento: ${funcaoFinal} — ${form.cidade.trim()}/${form.estado}`,
          tabela: 'mapeamentos',
          detalhe: { ...payload, anexos: enviados },
        });
      } catch (err) {
        // Não deixa arquivos órfãos no bucket se a criação falhar.
        if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados.map((a) => a.path));
        throw err;
      }

      navigate('/gestor/solicitacoes/nova', { state: { sucesso: 'Mapeamento enviado com sucesso!' } });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao enviar o mapeamento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCampo = (c) => {
    const val = form[c.id];
    if (c.tipo === 'funcao') {
      return (
        <>
          <select className="form-select" value={val} disabled={loadingFuncoes}
            onChange={(e) => { set(c.id, e.target.value); setFuncaoOutro(''); }}>
            <option value="">{loadingFuncoes ? 'Carregando funções...' : 'Selecione a função...'}</option>
            {funcoes.map((f) => (
              <option key={f.id} value={f.nome}>{f.nome}</option>
            ))}
            <option value={OUTRO}>Outro (informar nova função)</option>
          </select>
          {val === OUTRO && (
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <input className="form-input" type="text" placeholder="Ex: ANALISTA DE PROJETOS"
                value={funcaoOutro} onChange={(e) => setFuncaoOutro(e.target.value)} />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                A função informada será adicionada à lista oficial.
              </span>
            </div>
          )}
        </>
      );
    }
    if (c.tipo === 'select') {
      return (
        <select className="form-select" value={val} onChange={(e) => set(c.id, e.target.value)}>
          <option value="">{c.placeholder || 'Selecione...'}</option>
          {c.opcoes.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (c.tipo === 'uf') {
      return (
        <select className="form-select" value={val} onChange={(e) => set(c.id, e.target.value)}>
          <option value="">Selecione o estado...</option>
          {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      );
    }
    if (c.tipo === 'textarea') {
      return (
        <textarea className="form-input" rows={4} style={{ resize: 'vertical', fontFamily: 'inherit' }}
          value={val} onChange={(e) => set(c.id, e.target.value)} />
      );
    }
    return (
      <input className="form-input"
        type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'}
        min={c.tipo === 'number' ? 0 : undefined}
        step={c.tipo === 'number' ? '0.01' : undefined}
        value={val} onChange={(e) => set(c.id, e.target.value)} />
    );
  };

  return (
    <>
      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title"><ClipboardList size={18} /> Mapeamento — Avaliação de Candidatos / Projetos</div>
        </div>

        <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
          {faltando.length > 0 && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-lg)' }}>
              Preencha os campos obrigatórios destacados ({faltando.length}).
            </div>
          )}

          {CAMPOS_MAPEAMENTO.map((c) => (
            <div key={c.id} className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">
                {c.n}. {c.label}{c.obrigatorio && <span className="required"> *</span>}
              </label>
              {renderCampo(c)}
              {faltando.includes(c.id) && <span className="contratacao-erro">Obrigatório</span>}
            </div>
          ))}

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">{CAMPOS_MAPEAMENTO.length + 1}. Anexar arquivos</label>
            <input ref={anexos.inputRef} className="form-input" type="file" multiple accept={ANEXO_ACCEPT}
              onChange={(e) => anexos.adicionar(e.target.files)} />
            {anexos.arquivos.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-sm) 0 0' }}>
                {anexos.arquivos.map((f, i) => (
                  <li key={`${f.name}-${i}`} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Paperclip size={14} /> <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => anexos.remover(i)} title="Remover anexo"><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            {anexos.erro && <span className="contratacao-erro">{anexos.erro}</span>}
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
              Você pode anexar vários arquivos. PDF, Word, Excel ou imagem — até {ANEXO_MAX_MB} MB cada.
            </span>
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
            {submitting ? 'Enviando...' : 'Enviar Mapeamento'}
          </button>
        </form>
      </div>
    </>
  );
}
