import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, RotateCcw, Paperclip } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { getReenvioConfig } from '../../../config/reenvio';
import { UFS } from '../../../config/mapeamento';
import { DEPARTAMENTOS } from '../../../config/novaVaga';
import { numeroParaMascara, maskCurrencyInput } from '../../../utils/currencyMask';
import { useAnexos } from './useAnexos';
import '../../../components/UI/Components.css';

// Um só renderizador para os tipos de campo que aparecem nos schemas das
// requisições. Reaproveita os CAMPOS_* / validar* / montarPayload* dos configs,
// então a regra de cada requisição não é reimplementada aqui — só a UI de edição.
const MOEDA = new Set(['moeda']);

const visiveis = (cfg, form) =>
  (cfg.camposVisiveis ? cfg.camposVisiveis(form) : cfg.campos);

export default function EditarReenviarModal({ sol, funcoes = [], onClose, onReenviar }) {
  const cfg = getReenvioConfig(sol?.tipo);
  const [form, setForm] = useState(null);
  const [faltando, setFaltando] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Anexos existentes que o solicitante mantém (os que ele remover saem daqui);
  // os novos entram pelo hook useAnexos. Só para tipos com bucket.
  const [existentes, setExistentes] = useState([]);
  const inicialAnexosRef = useRef([]);   // snapshot p/ saber quais foram removidos
  const anexos = useAnexos({ bucket: cfg?.bucket || 'tmp', maxMb: 10 });

  const set = (id, v) => setForm((p) => ({ ...p, [id]: v }));
  const removerExistente = (path) => setExistentes((prev) => prev.filter((a) => a.path !== path));

  useEffect(() => {
    if (!cfg || !sol) return undefined;
    let vivo = true;
    (async () => {
      let base = {};
      if (cfg.modo === 'detalhe') {
        const { data } = await supabase.from(cfg.tabela).select('*').eq('solicitacao_id', sol.id).maybeSingle();
        base = data || {};
        if (cfg.bucket && vivo) {
          const arr = Array.isArray(base.anexos) ? base.anexos : [];
          inicialAnexosRef.current = arr;
          setExistentes(arr);
        }
      } else {
        base = sol; // envelope: os campos moram na própria solicitação
      }
      // Normaliza cada campo para o formato que o input espera.
      const inicial = {};
      for (const c of cfg.campos) {
        const v = base[c.id];
        if (MOEDA.has(c.tipo)) inicial[c.id] = v == null ? '' : numeroParaMascara(Number(v));
        else if (c.tipo === 'checkbox') inicial[c.id] = Array.isArray(v) ? v : [];
        else if (c.tipo === 'bool') inicial[c.id] = typeof v === 'boolean' ? v : null;
        else if (c.tipo === 'check') inicial[c.id] = v === true;
        else if (c.tipo === 'date') inicial[c.id] = v ? String(v).slice(0, 10) : '';
        else inicial[c.id] = v == null ? '' : String(v);
      }
      if (vivo) setForm(inicial);
    })();
    return () => { vivo = false; };
  }, [cfg, sol]);

  const listaCampos = useMemo(() => (cfg && form ? visiveis(cfg, form) : []), [cfg, form]);

  if (!cfg) return null;

  const salvar = async () => {
    setErro('');
    const falta = (cfg.validar ? cfg.validar(form) : []).map((c) => c.id);
    setFaltando(falta);
    if (falta.length) return;

    setSalvando(true);
    let novos = [];
    try {
      // Sobe os anexos novos ANTES de gravar; a lista final = mantidos + novos.
      if (cfg.bucket) novos = await anexos.enviar();
      const detalhe = cfg.modo === 'detalhe'
        ? { ...cfg.montarPayload(form), ...(cfg.bucket ? { anexos: [...existentes, ...novos] } : {}) }
        : null;

      const funcaoAlvo = cfg.funcaoAlvoDe ? cfg.funcaoAlvoDe(form) : null;
      await onReenviar({
        solicitacaoId: sol.id,
        tipo: sol.tipo,
        colaboradorId: sol.colaborador_id || null,
        funcaoAlvo,
        foraDoQuadro: cfg.foraDoQuadro || false,
        detalheTabela: cfg.modo === 'detalhe' ? cfg.tabela : null,
        detalhe,
        envelopePatch: cfg.modo === 'envelope' ? cfg.montarPatch(form) : null,
      });

      // Sucesso: remove do bucket os anexos que o solicitante tirou (best-effort).
      if (cfg.bucket) {
        const mantidos = new Set(existentes.map((a) => a.path));
        const removidos = (Array.isArray(inicialAnexosRef.current) ? inicialAnexosRef.current : [])
          .filter((a) => !mantidos.has(a.path)).map((a) => a.path);
        if (removidos.length) await supabase.storage.from(cfg.bucket).remove(removidos).catch(() => {});
      }
      onClose(true);
    } catch (e) {
      console.error(e);
      // Falhou depois de subir os novos: apaga-os para não deixar órfãos.
      if (novos.length) await supabase.storage.from(cfg.bucket).remove(novos.map((a) => a.path)).catch(() => {});
      setErro(e.message || 'Erro ao reenviar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const renderCampo = (c) => {
    const v = form[c.id];
    const err = faltando.includes(c.id);
    const cls = `form-input${err ? ' input-erro' : ''}`;
    if (MOEDA.has(c.tipo)) {
      return <input className={cls} inputMode="decimal" value={v ?? ''}
        onChange={(e) => set(c.id, maskCurrencyInput(e.target.value))} placeholder="0,00" />;
    }
    if (c.tipo === 'textarea') {
      return <textarea className={cls} rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
        value={v ?? ''} onChange={(e) => set(c.id, e.target.value)} />;
    }
    if (c.tipo === 'bool') {
      return (
        <div style={{ display: 'flex', gap: 12 }}>
          {[['Sim', true], ['Não', false]].map(([lab, val]) => (
            <label key={lab} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={v === val} onChange={() => set(c.id, val)} /> {lab}
            </label>
          ))}
        </div>
      );
    }
    if (c.tipo === 'check') {
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={v === true} onChange={(e) => set(c.id, e.target.checked)} />
          {c.textoCheck || 'Sim'}
        </label>
      );
    }
    if (c.tipo === 'checkbox') {
      const arr = Array.isArray(v) ? v : [];
      const toggle = (opt) => set(c.id, arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]);
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(c.opcoes || []).map((opt) => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={arr.includes(opt)} onChange={() => toggle(opt)} /> {opt}
            </label>
          ))}
        </div>
      );
    }
    if (c.tipo === 'radio') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(c.opcoes || []).map((opt) => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="radio" name={c.id} checked={v === opt} onChange={() => set(c.id, opt)} /> {opt}
            </label>
          ))}
        </div>
      );
    }
    if (c.tipo === 'select' || c.tipo === 'uf' || c.tipo === 'departamento' || c.tipo === 'funcao') {
      // Garante o valor atual na lista mesmo que não esteja mais nas opções oficiais.
      const base = c.tipo === 'uf' ? UFS
        : c.tipo === 'departamento' ? DEPARTAMENTOS
          : c.tipo === 'funcao' ? funcoes
            : (c.opcoes || []);
      const opts = v && !base.includes(v) ? [v, ...base] : base;
      return (
        <select className={`form-select${err ? ' input-erro' : ''}`} value={v ?? ''} onChange={(e) => set(c.id, e.target.value)}>
          <option value="">{c.placeholder || 'Selecione...'}</option>
          {opts.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    return <input className={cls} type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'}
      value={v ?? ''} onChange={(e) => set(c.id, e.target.value)} />;
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <span className="modal-title">Editar e reenviar — {cfg.titulo}</span>
          <button className="modal-close" onClick={() => onClose(false)}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {sol.devolucao_motivo && (
            <div className="sol-card-resumo tom-devolvida" style={{ marginBottom: 'var(--space-md)' }}>
              Motivo da devolução: {sol.devolucao_motivo}
            </div>
          )}
          {erro && <div className="sol-card-resumo tom-reprovada" style={{ marginBottom: 'var(--space-md)' }}>{erro}</div>}
          {!form ? (
            <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
          ) : (
            <>
              {listaCampos.map((c) => (
                <div key={c.id} className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">{c.label}{c.obrigatorio && <span className="required"> *</span>}</label>
                  {renderCampo(c)}
                  {faltando.includes(c.id) && <span className="contratacao-erro">{c.label}</span>}
                </div>
              ))}

              {cfg.bucket && (
                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">Anexos</label>
                  {existentes.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-sm)' }}>
                      {existentes.map((a) => (
                        <li key={a.path} style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Paperclip size={14} /> <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome || 'Anexo'}</span>
                          <button type="button" className="btn btn-ghost btn-sm" title="Remover anexo" onClick={() => removerExistente(a.path)}><X size={14} /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <input ref={anexos.inputRef} className="form-input" type="file" multiple
                    onChange={(e) => anexos.adicionar(e.target.files)} />
                  {anexos.arquivos.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-sm) 0 0' }}>
                      {anexos.arquivos.map((f, i) => (
                        <li key={`${f.name}-${i}`} style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Paperclip size={14} /> <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                          <button type="button" className="btn btn-ghost btn-sm" title="Remover" onClick={() => anexos.remover(i)}><X size={14} /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {anexos.erro && <span className="contratacao-erro">{anexos.erro}</span>}
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginTop: 4 }}>
                    Os anexos atuais são mantidos; remova os que não quiser e/ou adicione novos.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => onClose(false)}>Cancelar</button>
          <button className="btn btn-primary" disabled={salvando || !form} onClick={salvar}>
            {salvando ? <><Loader2 size={16} className="animate-spin" /> Reenviando...</> : <><RotateCcw size={16} /> Reenviar para aprovação</>}
          </button>
        </div>
      </div>
    </div>
  );
}
