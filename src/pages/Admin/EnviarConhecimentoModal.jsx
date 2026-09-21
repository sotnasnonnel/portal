import { useEffect, useMemo, useState } from 'react';
import { X, Send, Loader2, CheckCircle2, Clock } from 'lucide-react';
import SearchSelect from '../../components/UI/SearchSelect';
import { enviarCiencia, listarPossiveisDestinatarios } from '../../services/desligamentoCiencia';

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

// Modal do DP: escolhe quem recebe o aviso de um desligamento (ADM, TI...).
// Sem fluxo automático de propósito — o desligamento pode ser confidencial,
// então a lista é decidida caso a caso. O destinatário não vê a justificativa.
export default function EnviarConhecimentoModal({ sol, onClose, onEnviado }) {
  const [pessoas, setPessoas] = useState([]);
  const [escolhidos, setEscolhidos] = useState([]);
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarPossiveisDestinatarios()
      .then(setPessoas)
      .catch(() => setErro('Não foi possível carregar os colaboradores.'));
  }, []);

  const jaAvisados = useMemo(() => sol.ciencias || [], [sol.ciencias]);
  const nomePorId = useMemo(() => Object.fromEntries(pessoas.map((p) => [p.id, p.nome])), [pessoas]);

  // Fora da lista: o próprio desligado, quem já foi avisado e quem já está escolhido.
  const opcoes = useMemo(() => {
    const fora = new Set([sol.colaborador_id, ...jaAvisados.map((c) => c.destinatario_id), ...escolhidos]);
    return pessoas
      .filter((p) => !fora.has(p.id))
      .map((p) => ({ value: p.id, label: p.funcao ? `${p.nome} — ${p.funcao}` : p.nome }));
  }, [pessoas, sol.colaborador_id, jaAvisados, escolhidos]);

  const enviar = async () => {
    if (!escolhidos.length) return;
    setEnviando(true);
    setErro('');
    try {
      await enviarCiencia(sol.id, escolhidos, observacao.trim());
      onEnviado?.();
    } catch (e) {
      setErro(e?.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '100%' }}>
        <div className="modal-header">
          <span className="modal-title">Enviar para conhecimento</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Desligamento de <strong>{sol.colaborador?.nome || '—'}</strong>. Quem você escolher recebe um aviso no portal e
            por e-mail com o nome, a função e a data prevista, para organizar o recolhimento.
            A justificativa e a iniciativa <strong>não</strong> são enviadas.
          </p>

          {sol.status === 'pendente' && (
            <div className="sol-card-resumo tom-devolvida" style={{ marginBottom: 'var(--space-md)' }}>
              Esta requisição ainda está em andamento. Se ela for cancelada, quem foi avisado recebe outro aviso para desconsiderar.
            </div>
          )}

          {jaAvisados.length > 0 && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div className="form-label">Já avisados</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {jaAvisados.map((c) => (
                  <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)' }}>
                    {c.ciente_em
                      ? <CheckCircle2 size={15} color="var(--color-success)" />
                      : <Clock size={15} color="var(--color-text-muted)" />}
                    <span>{c.destinatario?.nome || '—'}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {c.ciente_em ? `ciente em ${fmt(c.ciente_em)}` : `enviado em ${fmt(c.enviado_em)}, aguardando ciência`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
            <label className="form-label">Adicionar pessoas <span className="required">*</span></label>
            <SearchSelect
              value=""
              onChange={(id) => id && setEscolhidos((prev) => [...prev, id])}
              options={opcoes}
              placeholder="Buscar colaborador…"
              ariaLabel="Adicionar pessoa ao aviso"
              searchThreshold={0}
            />
            {escolhidos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--space-sm)' }}>
                {escolhidos.map((id) => (
                  <button key={id} type="button" className="filter-chip active"
                    title="Remover" onClick={() => setEscolhidos((prev) => prev.filter((x) => x !== id))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {nomePorId[id]} <X size={13} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Observação (opcional)</label>
            <textarea
              className="form-input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Ex.: recolher notebook e celular até o último dia; bloquear acessos na data."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          {erro && <div className="contratacao-erro" style={{ marginTop: 'var(--space-sm)' }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" disabled={!escolhidos.length || enviando} onClick={enviar}>
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {enviando ? 'Enviando...' : `Enviar${escolhidos.length ? ` (${escolhidos.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
