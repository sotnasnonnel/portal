import { useState, useEffect } from 'react';
import { Loader2, FileText, Check, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import CurrencyInput from '../../../../../components/CurrencyInput';
import { parseCurrency } from '../../../../../utils/currencyMask';
import { CNAE_OPCOES } from '../../../../../config/financeiro';
import { getTermos } from '../../../../../config/financeiroTermos';
import { buscarFluxoFin } from '../../../../../config/aprovacaoFinanceiro';
import { criarSolicitacaoFin } from '../criarSolicitacao';
import '../../../../../components/UI/Components.css';

const estadoInicial = {
  nome_despesa: '',
  centro_custo: '',
  valor: '',
  periodo: '',
  cnae: '',
  observacao: '',
};

const OBRIGATORIOS = ['nome_despesa', 'centro_custo', 'valor', 'periodo', 'cnae'];

// Formulário compartilhado pelas solicitações do Financeiro (Cartão Virtual e
// Aumento de Limite) — mesmos campos. `sol` é o item do registro
// (config/financeiro). Persiste o envelope; as etapas de aprovação entram na
// próxima etapa (motor portado do DP).
export default function SolicitacaoFinForm({ sol }) {
  const { user } = useAuth();
  const [form, setForm] = useState(estadoInicial);
  const [aceite, setAceite] = useState(null);   // { em } quando aceito
  const [termosOpen, setTermosOpen] = useState(false);
  const [aceiteCheck, setAceiteCheck] = useState(false);
  const [faltando, setFaltando] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(null);   // { numero }
  const [fluxoOk, setFluxoOk] = useState(null);    // null = checando; true/false depois

  const termos = getTermos(sol.tipoDb);
  const set = (id, valor) => setForm((p) => ({ ...p, [id]: valor }));

  // Pré-checa se o admin configurou a cadeia de aprovação deste solicitante/tipo.
  useEffect(() => {
    if (!user?.id) return undefined;
    let vivo = true;
    (async () => {
      const { fluxo, erro } = await buscarFluxoFin(user.id, sol.tipoDb);
      if (vivo) setFluxoOk(erro ? true : !!fluxo); // erro de rede não bloqueia
    })();
    return () => { vivo = false; };
  }, [user, sol.tipoDb]);

  const semFluxo = fluxoOk === false;

  const confirmarTermos = () => {
    if (!aceiteCheck) return;
    setAceite({ em: new Date().toISOString() });
    setTermosOpen(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSucesso(null);
    const falta = OBRIGATORIOS.filter((id) => !String(form[id] ?? '').trim());
    if (form.valor && parseCurrency(form.valor) == null) falta.push('valor');
    setFaltando(falta);
    if (falta.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!aceite) { setTermosOpen(true); return; }

    setSubmitting(true);
    try {
      const sol_ = await criarSolicitacaoFin({
        tipoDb: sol.tipoDb,
        solicitanteId: user.id,
        envelope: {
          nome_despesa: form.nome_despesa.trim(),
          centro_custo: form.centro_custo.trim(),
          valor: parseCurrency(form.valor),
          periodo: form.periodo || null,
          cnae: form.cnae,
          observacao: form.observacao.trim() || null,
          aceite_termos: true,
          aceite_termos_em: aceite.em,
        },
      });
      setSucesso({ numero: sol_?.numero });
      setForm(estadoInicial);
      setAceite(null);
      setAceiteCheck(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      if (err.message === 'SEM_FLUXO') {
        setFluxoOk(false);
        alert('Ainda não há um fluxo de aprovação configurado para você neste tipo. Solicite ao Financeiro.');
      } else {
        alert(err.message || 'Erro ao enviar a solicitação. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const erro = (id) => faltando.includes(id);

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-header-title"><sol.icon size={18} /> {sol.curto}</div>
      </div>

      <form onSubmit={onSubmit} style={{ padding: 'var(--space-xl)' }}>
        {sucesso && (
          <div className="fin-success" style={{ marginBottom: 'var(--space-lg)' }}>
            <Check size={16} /> Solicitação {sucesso.numero != null ? `#${sucesso.numero} ` : ''}enviada com sucesso!
          </div>
        )}
        {faltando.length > 0 && (
          <div className="fin-aviso" style={{ marginBottom: 'var(--space-lg)' }}>
            Preencha os campos obrigatórios destacados.
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Nome da despesa/compra <span className="required">*</span></label>
          <input className="form-input" type="text" placeholder="Ex.: Material de escritório — Obra X"
            value={form.nome_despesa} onChange={(e) => set('nome_despesa', e.target.value)} />
          {erro('nome_despesa') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Centro de custo (CC) <span className="required">*</span></label>
          <input className="form-input" type="text" placeholder="Ex.: CC-1024"
            value={form.centro_custo} onChange={(e) => set('centro_custo', e.target.value)} />
          {erro('centro_custo') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Valor (R$) <span className="required">*</span></label>
          <CurrencyInput value={form.valor} onChange={(v) => set('valor', v)} placeholder="0,00" />
          {erro('valor') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Período <span className="required">*</span></label>
          <input className="form-input" type="date"
            value={form.periodo} onChange={(e) => set('periodo', e.target.value)} />
          {erro('periodo') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">CNAE <span className="required">*</span></label>
          <select className="form-select" value={form.cnae} onChange={(e) => set('cnae', e.target.value)}>
            <option value="">Selecione a categoria...</option>
            {CNAE_OPCOES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {erro('cnae') && <span className="fin-erro-campo">Obrigatório</span>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="form-label">Observação</label>
          <textarea className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Informações adicionais (opcional)"
            value={form.observacao} onChange={(e) => set('observacao', e.target.value)} />
        </div>

        {/* Termos de uso e responsabilidade */}
        <div className="fin-termos-box">
          {aceite ? (
            <div className="fin-termos-ok">
              <ShieldCheck size={16} />
              <span>Termos aceitos por <strong>{user?.nome}</strong> em {new Date(aceite.em).toLocaleString('pt-BR')}.</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTermosOpen(true)}>Rever</button>
            </div>
          ) : (
            <div className="fin-termos-pend">
              <span>É necessário ler e aceitar os <strong>Termos de Uso e Responsabilidade</strong>.</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTermosOpen(true)}>
                <FileText size={14} /> Ler os termos
              </button>
            </div>
          )}
        </div>

        {semFluxo && (
          <div className="fin-aviso" style={{ marginTop: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={15} /> O Financeiro ainda não configurou o fluxo de aprovação para você neste tipo de solicitação.
          </div>
        )}
        <button className="btn btn-primary" type="submit" disabled={submitting || semFluxo} style={{ width: '100%', marginTop: 'var(--space-lg)' }}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <sol.icon size={16} />}
          {submitting ? ' Enviando...' : ' Enviar solicitação'}
        </button>
      </form>

      {/* Popup dos Termos */}
      {termosOpen && termos && (
        <div className="modal-overlay" onClick={() => setTermosOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <span className="modal-title">{termos.titulo}</span>
              <button className="modal-close" onClick={() => setTermosOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ marginBottom: 'var(--space-md)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{termos.intro}</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {termos.itens.map(([t, txt]) => (
                  <li key={t} style={{ fontSize: 13, lineHeight: 1.5 }}><strong>{t}:</strong> {txt}</li>
                ))}
              </ul>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 'var(--space-lg)', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={aceiteCheck} onChange={(e) => setAceiteCheck(e.target.checked)} style={{ marginTop: 2 }} />
                <span>Li e estou de acordo com os termos acima.</span>
              </label>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Aceite registrado em: {user?.nome} — {new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setTermosOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!aceiteCheck} onClick={confirmarTermos}>
                <Check size={16} /> Confirmar aceite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
