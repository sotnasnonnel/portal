import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Loader2, AlertTriangle, Paperclip, X } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { useRequisicaoForm } from './useRequisicaoForm';
import {
  CAMPOS_NOVA_VAGA, SECOES_NOVA_VAGA, estadoInicialNovaVaga, validarNovaVaga, montarPayloadNovaVaga,
} from '../../../config/novaVaga';
import { UFS } from '../../../config/mapeamento';
import CurrencyInput from '../../../components/CurrencyInput';
import '../../../components/UI/Components.css';
import '../Gestor.css';
import './Requisicoes.css';

const OUTRO = '__outro__';
const BUCKET = 'vaga-anexos';
const ANEXO_MAX_MB = 10;
const ANEXO_ACCEPT = '.pdf,.png,.jpg,.jpeg';

const sanitizarNome = (nome) => nome
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '_'); // após NFD, acentos viram combinantes e caem aqui

export default function FormNovaVaga() {
  const navigate = useNavigate();
  const { fluxoOk, submitting, setSubmitting, criarComDetalhe } = useRequisicaoForm();
  const [form, setForm] = useState(estadoInicialNovaVaga);
  const [funcaoOutro, setFuncaoOutro] = useState('');
  const [departamentoOutro, setDepartamentoOutro] = useState('');
  const [anexo, setAnexo] = useState(null);
  const [faltando, setFaltando] = useState([]);
  const [erroAnexo, setErroAnexo] = useState('');
  const [funcoes, setFuncoes] = useState([]);
  const [loadingFuncoes, setLoadingFuncoes] = useState(true);
  const fileRef = useRef(null);

  const semFluxo = fluxoOk === false;
  const set = (id, valor) => setForm((p) => ({ ...p, [id]: valor }));

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('funcoes').select('id, nome').order('nome');
      if (vivo) { setFuncoes(data || []); setLoadingFuncoes(false); }
    })();
    return () => { vivo = false; };
  }, []);

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
    const falta = validarNovaVaga(form).map((c) => c.id);
    if (form.funcao === OUTRO && !funcaoOutro.trim() && !falta.includes('funcao')) falta.push('funcao');
    if (form.departamento === OUTRO && !departamentoOutro.trim() && !falta.includes('departamento')) falta.push('departamento');
    setFaltando(falta);
    if (falta.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setSubmitting(true);
    let anexoPath = null;
    try {
      const funcaoFinal = await resolverFuncao();
      const departamentoFinal = form.departamento === OUTRO ? departamentoOutro.trim() : form.departamento;

      if (anexo) {
        anexoPath = `${crypto.randomUUID()}/${sanitizarNome(anexo.name)}`;
        const { error: eUp } = await supabase.storage.from(BUCKET).upload(anexoPath, anexo);
        if (eUp) throw new Error(`Falha ao enviar o anexo: ${eUp.message}`);
      }

      const payload = { ...montarPayloadNovaVaga(form), funcao: funcaoFinal, departamento: departamentoFinal };
      try {
        await criarComDetalhe({
          tipo: 'nova_vaga',
          justificativa: `Nova Vaga: ${funcaoFinal} — ${departamentoFinal}`,
          tabela: 'vagas',
          detalhe: { ...payload, anexo_path: anexoPath, anexo_nome: anexo ? anexo.name : null },
        });
      } catch (err) {
        // Não deixa arquivo órfão no bucket se a criação falhar.
        if (anexoPath) await supabase.storage.from(BUCKET).remove([anexoPath]);
        throw err;
      }

      navigate('/gestor/solicitacoes/nova', { state: { sucesso: 'Requisição de Nova Vaga enviada com sucesso!' } });
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
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                A função informada será adicionada à lista oficial.
              </span>
            </div>
          )}
        </>
      );
    }
    if (c.tipo === 'departamento') {
      return (
        <>
          <select className="form-select" value={val}
            onChange={(e) => { set(c.id, e.target.value); setDepartamentoOutro(''); }}>
            <option value="">{c.placeholder || 'Selecione...'}</option>
            {c.opcoes.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            <option value={OUTRO}>Outro (informar)</option>
          </select>
          {val === OUTRO && (
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <input className="form-input" type="text" placeholder="Informe o departamento"
                value={departamentoOutro} onChange={(e) => setDepartamentoOutro(e.target.value)} />
            </div>
          )}
        </>
      );
    }
    if (c.tipo === 'select') {
      const opcoes = typeof c.opcoes === 'function' ? c.opcoes(form) : c.opcoes;
      return (
        <select className="form-select" value={val}
          onChange={(e) => {
            // Trocar a empresa invalida a filial dependente.
            if (c.id === 'empresa') setForm((p) => ({ ...p, empresa: e.target.value, filial: '' }));
            else set(c.id, e.target.value);
          }}
          disabled={c.id === 'filial' && !form.empresa}>
          <option value="">{c.id === 'filial' && !form.empresa ? 'Selecione a empresa primeiro' : c.placeholder || 'Selecione...'}</option>
          {opcoes.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
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
    if (c.tipo === 'textarea') {
      return (
        <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
          placeholder={c.placeholder} value={val} onChange={(e) => set(c.id, e.target.value)} />
      );
    }
    if (c.tipo === 'moeda') {
      return <CurrencyInput value={val} onChange={(v) => set(c.id, v)} />;
    }
    return (
      <input className="form-input"
        type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'}
        min={c.tipo === 'number' ? (c.inteiro ? 1 : 0) : undefined}
        step={c.tipo === 'number' ? (c.inteiro ? '1' : '0.01') : undefined}
        placeholder={c.placeholder}
        value={val} onChange={(e) => set(c.id, e.target.value)} />
    );
  };

  const renderAnexo = () => (
    <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
      <label className="form-label">Anexar currículos</label>
      <input ref={fileRef} className="form-input" type="file" accept={ANEXO_ACCEPT} onChange={onArquivo} />
      {anexo && (
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: 'var(--space-sm)' }}>
          <Paperclip size={14} /> {anexo.name}
          <button type="button" className="btn btn-ghost btn-sm" onClick={limparAnexo} title="Remover anexo"><X size={14} /></button>
        </span>
      )}
      {erroAnexo && <span className="contratacao-erro">{erroAnexo}</span>}
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
        Certifique-se de que os documentos estejam legíveis. Upload de arquivo de imagem .PNG, .JPEG e .JPG ou arquivo .PDF de até {ANEXO_MAX_MB} MB.
      </span>
    </div>
  );

  return (
    <>
      <div className="table-container">
        <div className="table-header">
          <div className="table-header-title"><UserPlus size={18} /> Nova Vaga</div>
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

          {SECOES_NOVA_VAGA.map((secao) => (
            <div key={secao}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 'var(--space-xl) 0 var(--space-md)' }}>
                {secao}
              </h3>
              {CAMPOS_NOVA_VAGA.filter((c) => c.secao === secao).map((c) => (
                <div key={c.id} className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                  <label className="form-label">
                    {c.label}{c.obrigatorio && <span className="required"> *</span>}
                  </label>
                  {renderCampo(c)}
                  {faltando.includes(c.id) && <span className="contratacao-erro">Obrigatório</span>}
                </div>
              ))}
            </div>
          ))}

          {renderAnexo()}

          {semFluxo && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>
              O administrador ainda não configurou o fluxo de aprovação para você. Solicite a configuração ao DP.
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={submitting || semFluxo} style={{ width: '100%' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {submitting ? 'Enviando...' : 'Enviar Requisição'}
          </button>
        </form>
      </div>
    </>
  );
}
