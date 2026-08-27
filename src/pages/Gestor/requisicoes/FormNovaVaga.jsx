import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserPlus, Loader2, AlertTriangle, Paperclip, X, ClipboardList } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { useRequisicaoForm } from './useRequisicaoForm';
import { useAnexos } from './useAnexos';
import {
  CAMPOS_NOVA_VAGA, SECOES_NOVA_VAGA, estadoInicialNovaVaga, validarNovaVaga, montarPayloadNovaVaga,
} from '../../../config/novaVaga';
import { UFS } from '../../../config/mapeamento';
import { chavePreco, formatarPreco } from '../../../config/precosItens';
import { carregarPrecosMap } from '../../../services/precosItens';
import CurrencyInput from '../../../components/CurrencyInput';
import '../../../components/UI/Components.css';
import '../Gestor.css';
import './Requisicoes.css';

const OUTRO = '__outro__';
const BUCKET = 'vaga-anexos';
const ANEXO_MAX_MB = 10;
const ANEXO_ACCEPT = '.pdf,.png,.jpg,.jpeg';

export default function FormNovaVaga() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fluxoOk, submitting, setSubmitting, criarComDetalhe } = useRequisicaoForm();
  // Origem: quando a vaga é gerada a partir de um Mapeamento aprovado, os campos
  // com correspondência já vêm preenchidos e guardamos o vínculo de origem.
  const origem = location.state?.origemMapeamento || null;
  const [form, setForm] = useState(() => ({ ...estadoInicialNovaVaga(), ...(origem?.prefill || {}) }));
  const [funcaoOutro, setFuncaoOutro] = useState('');
  const [departamentoOutro, setDepartamentoOutro] = useState('');
  const [faltando, setFaltando] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [loadingFuncoes, setLoadingFuncoes] = useState(true);
  const [precos, setPrecos] = useState({});
  const anexos = useAnexos({ bucket: BUCKET, maxMb: ANEXO_MAX_MB });

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

  // Preços dos equipamentos (configurados em Ajustes de Valores) — best-effort.
  useEffect(() => {
    let vivo = true;
    carregarPrecosMap()
      .then((mapa) => { if (vivo) setPrecos(mapa); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Rótulo da opção com o preço ao lado, quando houver (ex.: "Notebook — R$ 3.500,00").
  const rotuloEquipamento = (opt) => {
    const preco = precos[chavePreco('equipamento', opt)];
    return preco != null ? `${opt} — ${formatarPreco(preco)}` : opt;
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
    let enviados = [];
    try {
      const funcaoFinal = await resolverFuncao();
      const departamentoFinal = form.departamento === OUTRO ? departamentoOutro.trim() : form.departamento;

      enviados = await anexos.enviar();

      const payload = { ...montarPayloadNovaVaga(form), funcao: funcaoFinal, departamento: departamentoFinal };
      try {
        await criarComDetalhe({
          tipo: 'nova_vaga',
          justificativa: `Nova Vaga: ${funcaoFinal} — ${departamentoFinal}`,
          tabela: 'vagas',
          detalhe: { ...payload, anexos: enviados },
          // Nova Vaga é aumento de quadro por definição — §5.1 "vaga nova fora
          // do quadro (G&A)": aprovam o Diretor da área + Financeiro.
          funcaoAlvo: funcaoFinal,
          foraDoQuadro: true,
          origemSolicitacaoId: origem?.solicitacaoId || null,
        });
      } catch (err) {
        // Não deixa arquivos órfãos no bucket se a criação falhar.
        if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados.map((a) => a.path));
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
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
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
          {opcoes.map((opt) => (
            <option key={opt} value={opt}>{c.id === 'equipamento' ? rotuloEquipamento(opt) : opt}</option>
          ))}
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
    if (c.tipo === 'check') {
      return (
        <div className="contratacao-opcoes">
          <label className={`contratacao-opcao ${val === true ? 'active' : ''}`}>
            <input type="checkbox" checked={val === true} onChange={(e) => set(c.id, e.target.checked)} />
            <span>{c.textoCheck || 'Sim'}</span>
          </label>
        </div>
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
        Você pode anexar vários arquivos. Documentos legíveis, imagem .PNG/.JPEG/.JPG ou .PDF de até {ANEXO_MAX_MB} MB cada.
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
          {origem && (
            <div className={`sol-card-resumo ${origem.emAprovacao ? 'tom-devolvida' : 'tom-concluida'}`}
              style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <ClipboardList size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Gerada a partir do Mapeamento{origem.numero != null ? ` #${origem.numero}` : ''}. Alguns campos já vieram preenchidos — confira e complete os demais.
                {origem.emAprovacao && ' Atenção: esse mapeamento ainda está em aprovação — esta vaga passa pela própria cadeia, independente dele.'}
              </span>
            </div>
          )}
          {faltando.length > 0 && (
            <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-lg)' }}>
              Preencha os campos obrigatórios destacados ({faltando.length}).
            </div>
          )}

          {SECOES_NOVA_VAGA.map((secao) => (
            <div key={secao}>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 'var(--space-xl) 0 var(--space-md)' }}>
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
