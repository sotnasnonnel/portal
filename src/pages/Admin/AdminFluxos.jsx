import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import {
  Workflow, Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2, Check,
  AlertTriangle, ShieldCheck, User, UserCircle2, ChevronRight,
} from 'lucide-react';
import { FLUXO_GERAL, normIniciativa, TIPOS_FLUXO, TIPO_LABEL_CURTO, APROVADOR_MAPEAMENTO, resincronizarPendentes } from '../../config/aprovacao';
import '../../components/UI/Components.css';
import './Admin.css';

const iniciais = (nome) => (nome || '?')
  .split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();

export default function AdminFluxos() {
  const [gestores, setGestores] = useState([]);
  const [pool, setPool] = useState([]);
  const [fluxos, setFluxos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [solicitanteId, setSolicitanteId] = useState('');
  const [cadeia, setCadeia] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [tipoSel, setTipoSel] = useState('aumento_salario');

  const nomePorId = Object.fromEntries(pool.map((c) => [c.id, c.nome]));
  const idsAtivos = new Set(pool.map((c) => c.id));
  const solicitante = gestores.find((g) => g.id === solicitanteId);

  // Linha salva de (gestor, tipo). iniciativa sempre ''.
  const linhaDe = (gid, tipo) =>
    fluxos.find((x) => x.solicitante_id === gid && x.tipo === tipo && normIniciativa(x.iniciativa) === '');

  // Cadeia salva ou pré-preenchimento (mapeamento → Lucas; demais → fluxo geral).
  const cadeiaInicial = (gid, tipo) => {
    const linha = linhaDe(gid, tipo);
    if (linha) return Array.isArray(linha.aprovadores) ? [...linha.aprovadores] : [];
    if (tipo === 'mapeamento') return [APROVADOR_MAPEAMENTO.id];
    const geral = linhaDe(gid, FLUXO_GERAL.tipo);
    return Array.isArray(geral?.aprovadores) ? [...geral.aprovadores] : [];
  };

  const configuradoTipo = (gid, tipo) => !!linhaDe(gid, tipo);

  const carregarBase = useCallback(async () => {
    setLoading(true);
    const [{ data: ges }, { data: aprov }, { data: fls }] = await Promise.all([
      supabase.from('colaboradores').select('id, nome').eq('perfil', 'gestor').eq('ativo', true).order('nome'),
      supabase.from('colaboradores').select('id, nome, perfil').in('perfil', ['gestor', 'admin']).eq('ativo', true).order('nome'),
      supabase.from('solicitacoes_rh_fluxos').select('solicitante_id, tipo, iniciativa, aprovadores'),
    ]);
    setGestores(ges || []);
    setPool(aprov || []);
    setFluxos(fls || []);
    setLoading(false);
  }, []);

  useEffect(() => { carregarBase(); }, [carregarBase]);

  useEffect(() => {
    if (!solicitanteId) { setCadeia([]); return; }
    setCadeia(cadeiaInicial(solicitanteId, tipoSel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitanteId, tipoSel, fluxos]);

  const setEtapa = (idx, valor) => setCadeia((prev) => {
    const arr = [...prev];
    arr[idx] = valor;
    return arr;
  });
  const addEtapa = () => setCadeia((prev) => [...prev, '']);
  const removeEtapa = (idx) => setCadeia((prev) => prev.filter((_, i) => i !== idx));
  const moverEtapa = (idx, dir) => setCadeia((prev) => {
    const arr = [...prev];
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= arr.length) return prev;
    [arr[idx], arr[alvo]] = [arr[alvo], arr[idx]];
    return arr;
  });

  const salvar = async () => {
    const aprovadores = cadeia.map((x) => (x || '').trim()).filter(Boolean);
    if (aprovadores.some((id) => !idsAtivos.has(id))) {
      alert('Há um aprovador inválido ou inativo na cadeia. Revise antes de salvar.');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('solicitacoes_rh_fluxos')
        .upsert(
          {
            solicitante_id: solicitanteId,
            tipo: tipoSel,
            iniciativa: '',
            aprovadores,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'solicitante_id,tipo,iniciativa' }
        );
      if (error) throw error;

      let extra = '';
      try {
        const n = await resincronizarPendentes(supabase, {
          solicitanteId,
          tipo: tipoSel,
          moldeIds: aprovadores,
          nomePorId,
          agora: new Date().toISOString(),
        });
        if (n > 0) {
          extra = ` · ${n} pendente(s) atualizada(s)`;
          window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
        }
      } catch (errSync) {
        console.error('Erro ao re-sincronizar pendentes:', errSync);
        extra = ' · (aviso: houve erro ao atualizar pendentes — reabra e salve de novo)';
      }

      setSucesso(`Fluxo salvo: ${TIPO_LABEL_CURTO[tipoSel]} — ${solicitante?.nome || ''}${extra}`);
      setTimeout(() => setSucesso(''), 5000);
      await carregarBase();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar o fluxo. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const temInativo = cadeia.some((id) => id && !idsAtivos.has(id));

  return (
    <div className="admin-page animate-fade-in-up">
      <h1 className="page-title"><Workflow size={28} /> Fluxos de Aprovação</h1>
      <p className="page-subtitle">
        Monte a cadeia de aprovação de cada gestor por tipo de requisição. Cada fluxo parte do
        gestor, passa por cada aprovador na ordem e termina sempre na execução do Admin (DP).
      </p>

      {sucesso && (
        <div className="success-msg" style={{ marginBottom: 'var(--space-lg)' }}>
          <Check size={16} /> {sucesso}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="table-container" style={{ marginBottom: 'var(--space-xl)' }}>
            <div className="table-header"><div className="table-header-title">Solicitante</div></div>
            <div style={{ padding: 'var(--space-lg)' }}>
              <div className="form-group" style={{ marginBottom: 0, maxWidth: 480 }}>
                <label className="form-label">Selecione o gestor solicitante <span className="required">*</span></label>
                <select className="form-select" value={solicitanteId} onChange={(e) => setSolicitanteId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {gestores.map((g) => (
                    <option key={g.id} value={g.id}>{configuradoTipo(g.id, FLUXO_GERAL.tipo) ? '✅' : '⚠️'} {g.nome}</option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
                  ✅ fluxo configurado · ⚠️ sem fluxo
                </p>
              </div>
            </div>
          </div>

          {solicitanteId && (
            <>
              <div className="filter-chips" style={{ marginBottom: 'var(--space-lg)' }}>
                {TIPOS_FLUXO.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`filter-chip ${tipoSel === t ? 'active' : ''}`}
                    onClick={() => setTipoSel(t)}
                  >
                    {configuradoTipo(solicitanteId, t) ? '✅' : '⚠️'} {TIPO_LABEL_CURTO[t]}
                  </button>
                ))}
              </div>
            <div className="fluxo-card">
              <div className="fluxo-card-head">
                <div className="fluxo-card-title"><Workflow size={18} /> Fluxo de aprovação — {TIPO_LABEL_CURTO[tipoSel]}</div>
                {temInativo && (
                  <span className="badge inativo"><AlertTriangle size={13} /> Aprovador inativo</span>
                )}
              </div>

              <div className="fluxo-canvas">
                <div className="fluxo-node fluxo-node-start" title="Quem abre a requisição">
                  <div className="fluxo-node-avatar"><User size={16} /></div>
                  <div className="fluxo-node-body">
                    <span className="fluxo-node-role">Solicitante</span>
                    <span className="fluxo-node-name">{solicitante?.nome || '—'}</span>
                  </div>
                </div>

                {cadeia.map((id, idx) => {
                  const inativo = id && !idsAtivos.has(id);
                  return (
                    <div key={idx} className="fluxo-seg">
                      <ChevronRight className="fluxo-arrow" size={20} />
                      <div className={`fluxo-node fluxo-node-step ${inativo ? 'is-inativo' : ''}`}>
                        <div className="fluxo-node-num">{idx + 1}</div>
                        <div className="fluxo-node-avatar">{id ? iniciais(nomePorId[id]) : <UserCircle2 size={16} />}</div>
                        <div className="fluxo-node-body">
                          <span className="fluxo-node-role">Aprovação {idx + 1}</span>
                          <select
                            className="fluxo-node-select"
                            value={id || ''}
                            onChange={(e) => setEtapa(idx, e.target.value)}
                          >
                            <option value="">Selecionar...</option>
                            {inativo && <option value={id}>{nomePorId[id] || 'Inativo'} (inativo)</option>}
                            {pool.map((c) => (
                              <option key={c.id} value={c.id}>{c.nome}{c.perfil === 'admin' ? ' (Admin)' : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div className="fluxo-node-tools">
                          <button type="button" title="Subir" disabled={idx === 0} onClick={() => moverEtapa(idx, -1)}><ArrowUp size={13} /></button>
                          <button type="button" title="Descer" disabled={idx === cadeia.length - 1} onClick={() => moverEtapa(idx, 1)}><ArrowDown size={13} /></button>
                          <button type="button" title="Remover" className="del" onClick={() => removeEtapa(idx)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="fluxo-seg">
                  <ChevronRight className="fluxo-arrow" size={20} />
                  <button type="button" className="fluxo-add" onClick={addEtapa} title="Adicionar aprovador">
                    <Plus size={16} /> <span>Aprovador</span>
                  </button>
                </div>

                <div className="fluxo-seg">
                  <ChevronRight className="fluxo-arrow" size={20} />
                  <div className="fluxo-node fluxo-node-end" title="Execução final (automática)">
                    <div className="fluxo-node-avatar"><ShieldCheck size={16} /></div>
                    <div className="fluxo-node-body">
                      <span className="fluxo-node-role">Execução</span>
                      <span className="fluxo-node-name">Admin (DP)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="fluxo-card-foot">
                <span className="fluxo-hint">
                  {cadeia.filter(Boolean).length === 0
                    ? 'Sem aprovadores — vai direto para a execução do Admin.'
                    : `${cadeia.filter(Boolean).length} etapa(s) de aprovação antes da execução.`}
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={salvando}
                  onClick={salvar}
                >
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar fluxo
                </button>
              </div>
            </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
