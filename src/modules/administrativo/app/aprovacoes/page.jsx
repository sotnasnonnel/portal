import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Check, X, Loader2, AlertCircle, Paperclip } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { getClasse, getServico } from '../../../../config/administrativo';
import { rotuloDoCampo, formatarValorCampo } from '../novo/formularios/schemas';
import { contextoDoChamado } from '../../lib/rotulos';
import { listarAprovacoesPendentes, decidirChamado } from '../../lib/chamados';

const dataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : '—');

export default function AprovacoesAdm() {
  const { user } = useAuth();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [decidindo, setDecidindo] = useState('');       // id do chamado em processamento
  const [justificativas, setJustificativas] = useState({});

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setCarregando(true);
    setErro('');
    try {
      setLinhas(await listarAprovacoesPendentes(user.id));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const decidir = async (chamado, aprovar) => {
    const justificativa = justificativas[chamado.id] || '';
    // Reprovar sem dizer por quê deixa o solicitante sem saber o que corrigir.
    if (!aprovar && !justificativa.trim()) {
      setErro(`Explique o motivo para reprovar o chamado #${chamado.numero}.`);
      return;
    }
    setDecidindo(chamado.id);
    setErro('');
    try {
      await decidirChamado({
        chamadoId: chamado.id, etapaId: chamado.etapaId, aprovar, justificativa,
      });
      setLinhas((atual) => atual.filter((c) => c.id !== chamado.id));
    } catch (e) {
      setErro(e.message);
    } finally {
      setDecidindo('');
    }
  };

  return (
    <div className="adm-page adm-page-wide">
      <h1 className="adm-title"><ClipboardCheck size={24} /> Aprovações</h1>
      <p className="adm-sub">
        Chamados abertos pela sua equipe que dependem da sua liberação.
        O prazo de atendimento só começa a contar depois da aprovação.
      </p>

      {erro && <div className="adm-aviso tom-erro"><AlertCircle size={16} /> {erro}</div>}

      {carregando ? (
        <div className="adm-vazio"><Loader2 size={20} className="adm-spin" /> Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="adm-vazio">Nenhum chamado esperando a sua aprovação.</div>
      ) : (
        linhas.map((c) => {
          const cls = getClasse(c.classe);
          const srv = getServico(c.classe, c.servico);
          const campos = Object.entries(c.campos || {});
          const ocupado = decidindo === c.id;
          return (
            <div key={c.id} className="adm-card adm-aprov">
              <div className="adm-aprov-cab">
                <div>
                  <h2>#{c.numero} · {srv?.label || c.assunto}</h2>
                  <small>
                    {[
                      contextoDoChamado({
                        classeLabel: cls?.label || c.classe,
                        assunto: srv?.label || c.assunto,
                      }),
                      c.solicitanteNome || 'Solicitante',
                      `aberto em ${dataHora(c.criado_em)}`,
                    ].filter(Boolean).join(' · ')}
                  </small>
                </div>
              </div>

              <p className="adm-aprov-desc">{c.descricao}</p>

              {campos.length > 0 && (
                // O rótulo cadastrado vive na config do serviço; aqui a própria
                // chave já é legível (ela é derivada do rótulo).
                <dl className="adm-aprov-campos">
                  {campos.map(([chave, valor]) => (
                    <div key={chave}>
                      <dt>{rotuloDoCampo(c.classe, c.servico, chave)}</dt>
                      <dd>{formatarValorCampo(c.classe, c.servico, chave, valor)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {(c.anexos || []).length > 0 && (
                <p className="adm-campo-dica">
                  <Paperclip size={14} /> {c.anexos.length} anexo(s) no chamado
                </p>
              )}

              <div className="adm-campo">
                <label htmlFor={`just-${c.id}`}>Observação (obrigatória para reprovar)</label>
                <textarea
                  id={`just-${c.id}`}
                  className="adm-textarea adm-textarea-curto"
                  value={justificativas[c.id] || ''}
                  onChange={(e) => setJustificativas((j) => ({ ...j, [c.id]: e.target.value }))}
                  placeholder="Motivo da reprovação, ou uma observação para o time do Administrativo."
                />
              </div>

              <div className="adm-acoes">
                <button type="button" className="adm-btn adm-btn-primary"
                  disabled={ocupado} onClick={() => decidir(c, true)}>
                  {ocupado ? <Loader2 size={16} className="adm-spin" /> : <Check size={16} />} Aprovar
                </button>
                <button type="button" className="adm-btn adm-btn-recusa"
                  disabled={ocupado} onClick={() => decidir(c, false)}>
                  <X size={16} /> Reprovar
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
