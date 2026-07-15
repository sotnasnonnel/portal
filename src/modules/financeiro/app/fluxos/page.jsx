import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Workflow, Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2, Check,
  User, ShieldCheck, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../services/supabase';
import { TIPO_LABEL_FIN, EXECUTORES_FIN } from '../../../../config/aprovacaoFinanceiro';
import SearchSelect from '../components/SearchSelect';
import '../../../../components/UI/Components.css';

const TIPOS = ['cartao_virtual', 'aumento_limite'];
const iniciais = (nome) => (nome || '?').split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();
const nomesExecutoras = EXECUTORES_FIN.map((e) => e.nome.split(' ')[0]).join(' / ');

// Tela de configuração das cadeias de aprovação do Financeiro (só admin do
// Financeiro). Cada solicitante (coordenador/gestor) tem uma cadeia por tipo,
// que termina sempre na execução do Financeiro (Daniela / Alessandra).
export default function FinanceiroFluxos() {
  const { modules } = useAuth();
  const [pool, setPool] = useState([]);
  const [fluxos, setFluxos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [solicitanteId, setSolicitanteId] = useState('');
  const [tipoSel, setTipoSel] = useState('cartao_virtual');
  const [cadeia, setCadeia] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState('');

  const nomePorId = Object.fromEntries(pool.map((c) => [c.id, c.nome]));
  const idsAtivos = new Set(pool.map((c) => c.id));
  const solicitantes = pool.filter((c) => c.perfil === 'coordenador' || c.perfil === 'gestor');
  const solicitante = pool.find((c) => c.id === solicitanteId);

  const linhaDe = (gid, tipo) => fluxos.find((x) => x.solicitante_id === gid && x.tipo === tipo);
  const configurado = (gid, tipo) => !!linhaDe(gid, tipo);
  const cadeiaInicial = (gid, tipo) => {
    const linha = linhaDe(gid, tipo);
    return Array.isArray(linha?.aprovadores) ? [...linha.aprovadores] : [];
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: fls }] = await Promise.all([
      supabase.rpc('financeiro_colaboradores_pool'),
      supabase.from('solicitacoes_financeiro_fluxos').select('solicitante_id, tipo, aprovadores'),
    ]);
    setPool(p || []);
    setFluxos(fls || []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!solicitanteId) { setCadeia([]); return; }
    setCadeia(cadeiaInicial(solicitanteId, tipoSel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitanteId, tipoSel, fluxos]);

  const setEtapa = (idx, valor) => setCadeia((prev) => prev.map((v, i) => (i === idx ? valor : v)));
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
        .from('solicitacoes_financeiro_fluxos')
        .upsert(
          { solicitante_id: solicitanteId, tipo: tipoSel, aprovadores, updated_at: new Date().toISOString() },
          { onConflict: 'solicitante_id,tipo' },
        );
      if (error) throw error;
      setSucesso(`Fluxo salvo: ${TIPO_LABEL_FIN[tipoSel]} — ${solicitante?.nome || ''}`);
      setTimeout(() => setSucesso(''), 5000);
      await carregar();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar o fluxo. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (modules?.financeiro !== 'admin') return <Navigate to="/financeiro/dashboard" replace />;

  return (
    <div className="fin-page">
      <h1 className="fin-title"><Workflow size={26} /> Fluxos de Aprovação</h1>
      <p className="fin-sub">
        Monte a cadeia de aprovação de cada solicitante por tipo. Parte do solicitante, passa por
        cada aprovador na ordem e termina sempre na execução do Financeiro ({nomesExecutoras}).
      </p>

      {sucesso && <div className="fin-success" style={{ marginBottom: 16 }}><Check size={16} /> {sucesso}</div>}

      {loading ? (
        <div className="fin-empty">Carregando...</div>
      ) : (
        <>
          <div className="form-group" style={{ maxWidth: 460 }}>
            <label className="form-label">Solicitante (coordenador/gestor)</label>
            <SearchSelect
              value={solicitanteId}
              onChange={setSolicitanteId}
              placeholder="Selecione o solicitante..."
              options={solicitantes.map((g) => ({
                value: g.id,
                label: `${configurado(g.id, tipoSel) ? '✅' : '⚠️'} ${g.nome}`,
              }))}
            />
          </div>

          {solicitanteId && (
            <>
              <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
                {TIPOS.map((t) => (
                  <button key={t} type="button" className={`fin-chip ${tipoSel === t ? 'active' : ''}`} onClick={() => setTipoSel(t)}>
                    {configurado(solicitanteId, t) ? '✅' : '⚠️'} {TIPO_LABEL_FIN[t]}
                  </button>
                ))}
              </div>

              <div className="fin-fluxo-card">
                <div className="fin-fluxo-canvas">
                  <div className="fin-fluxo-node fin-fluxo-start">
                    <div className="fin-fluxo-avatar"><User size={15} /></div>
                    <div><span className="fin-fluxo-role">Solicitante</span><span className="fin-fluxo-name">{solicitante?.nome || '—'}</span></div>
                  </div>

                  {cadeia.map((id, idx) => (
                    <div key={idx} className="fin-fluxo-seg">
                      <ChevronRight className="fin-fluxo-arrow" size={18} />
                      <div className="fin-fluxo-node fin-fluxo-step">
                        <div className="fin-fluxo-num">{idx + 1}</div>
                        <div className="fin-fluxo-avatar">{id ? iniciais(nomePorId[id]) : '—'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="fin-fluxo-role">Aprovação {idx + 1}</span>
                          <select className="form-select" style={{ marginTop: 4 }} value={id || ''} onChange={(e) => setEtapa(idx, e.target.value)}>
                            <option value="">Selecionar...</option>
                            {pool.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.perfil === 'admin' ? ' (Admin)' : ''}</option>)}
                          </select>
                        </div>
                        <div className="fin-fluxo-tools">
                          <button type="button" title="Subir" disabled={idx === 0} onClick={() => moverEtapa(idx, -1)}><ArrowUp size={13} /></button>
                          <button type="button" title="Descer" disabled={idx === cadeia.length - 1} onClick={() => moverEtapa(idx, 1)}><ArrowDown size={13} /></button>
                          <button type="button" title="Remover" className="del" onClick={() => removeEtapa(idx)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="fin-fluxo-seg">
                    <ChevronRight className="fin-fluxo-arrow" size={18} />
                    <button type="button" className="fin-fluxo-add" onClick={addEtapa}><Plus size={15} /> Aprovador</button>
                  </div>

                  <div className="fin-fluxo-seg">
                    <ChevronRight className="fin-fluxo-arrow" size={18} />
                    <div className="fin-fluxo-node fin-fluxo-end">
                      <div className="fin-fluxo-avatar"><ShieldCheck size={15} /></div>
                      <div><span className="fin-fluxo-role">Execução</span><span className="fin-fluxo-name">Financeiro ({nomesExecutoras})</span></div>
                    </div>
                  </div>
                </div>

                <div className="fin-fluxo-foot">
                  <span className="fin-fluxo-hint">
                    {cadeia.filter(Boolean).length === 0
                      ? 'Sem aprovadores — vai direto para a execução do Financeiro.'
                      : `${cadeia.filter(Boolean).length} etapa(s) de aprovação antes da execução.`}
                  </span>
                  <button type="button" className="btn btn-primary btn-sm" disabled={salvando} onClick={salvar}>
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
