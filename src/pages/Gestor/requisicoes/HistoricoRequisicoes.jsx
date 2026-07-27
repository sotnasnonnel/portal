import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, FileText, RotateCcw, UserPlus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { resumoAndamento } from '../../../config/aprovacao';
import { getReenvioConfig } from '../../../config/reenvio';
import { prefillNovaVagaDeMapeamento } from '../../../config/mapeamento';
import FluxoTimeline from '../../../components/Solicitacoes/FluxoTimeline';
import ModalRespostas, { DETALHE, buscarRespostas } from './ModalRespostas';
import EditarReenviarModal from './EditarReenviarModal';
import { useRequisicaoForm } from './useRequisicaoForm';
import '../../../components/UI/Components.css';
import '../Gestor.css';

const TOM_BADGE = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Concluída', badge: 'aprovada' },
  reprovada: { label: 'Reprovada', badge: 'inativo' },
  devolvida: { label: 'Devolvida p/ ajustes', badge: 'pendente' },
};

const SELECT = `
  id, numero, tipo, status, colaborador_id, justificativa, salario_proposto, funcao_proposta,
  devolucao_motivo, reenvios, created_at,
  colaborador:colaborador_id ( nome ),
  etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em )
`;

/** Histórico das requisições de um tipo, abertas pelo próprio gestor. */
export default function HistoricoRequisicoes({ req }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { reenviarRequisicao } = useRequisicaoForm();
  const [gerando, setGerando] = useState(null);
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verRespostas, setVerRespostas] = useState(null);
  const [editando, setEditando] = useState(null);   // solicitação em edição/reenvio
  const [funcoes, setFuncoes] = useState([]);

  const carregar = useCallback(async () => {
    if (!user?.id || !req?.tipoDb) return;
    setLoading(true);
    const { data } = await supabase
      .from('solicitacoes_rh')
      .select(SELECT)
      .eq('tipo', req.tipoDb)
      .eq('gestor_id', user.id)
      .order('created_at', { ascending: false });
    setLista(data || []);
    setLoading(false);
  }, [user, req]);

  useEffect(() => { (async () => { await carregar(); })(); }, [carregar]);

  // Lista de funções só quando o tipo em edição precisa (Nova Vaga / Alteração).
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('funcoes').select('nome').order('nome');
      if (vivo) setFuncoes((data || []).map((f) => f.nome));
    })();
    return () => { vivo = false; };
  }, []);

  const abrirRespostas = async (sol) => setVerRespostas(await buscarRespostas(sol));

  // Gera uma Nova Vaga a partir de um Mapeamento aprovado (Feature 2): leva os
  // dados do mapeamento para o formulário de Nova Vaga já pré-preenchido, com
  // vínculo de origem. A Nova Vaga segue a própria cadeia de aprovação (§5).
  const gerarNovaVaga = async (sol) => {
    setGerando(sol.id);
    try {
      const r = await buscarRespostas(sol);
      navigate('/gestor/solicitacoes/nova/nova-vaga', {
        state: {
          origemMapeamento: {
            solicitacaoId: sol.id,
            numero: sol.numero,
            prefill: prefillNovaVagaDeMapeamento(r?.dados || {}),
          },
        },
      });
    } catch (e) {
      console.error(e);
      alert('Não foi possível carregar o mapeamento. Tente novamente.');
    } finally {
      setGerando(null);
    }
  };

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-header-title"><History size={16} /> Histórico — {req.label}</div>
      </div>
      {loading ? (
        <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>
          Você ainda não abriu nenhuma requisição deste tipo.
        </div>
      ) : (
        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {lista.map((s) => {
            const resumo = resumoAndamento(s, s.etapas);
            const tomB = TOM_BADGE[resumo.tom] || TOM_BADGE.pendente;
            const podeReenviar = s.status === 'devolvida' && !!getReenvioConfig(s.tipo);
            return (
              <div key={s.id} className="sol-card">
                <div className="sol-card-top">
                  <div>
                    <div className="sol-card-colab">{s.colaborador?.nome || '—'}</div>
                    <div className="sol-card-tipo">
                      {s.numero != null && `#${s.numero} · `}Aberta em {new Date(s.created_at).toLocaleDateString('pt-BR')}
                      {s.reenvios > 0 && <span className="sol-card-iniciativa"> · reenviada {s.reenvios}×</span>}
                    </div>
                  </div>
                  <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
                </div>

                {s.justificativa && <div className="sol-card-just">{s.justificativa}</div>}

                <div className={`sol-card-resumo tom-${resumo.tom}`}>{resumo.texto}</div>
                {s.status === 'devolvida' && s.devolucao_motivo && (
                  <div className="sol-card-just" style={{ borderLeftColor: 'var(--color-warning)' }}>
                    <strong>Ajuste pedido:</strong> {s.devolucao_motivo}
                  </div>
                )}

                <FluxoTimeline etapas={s.etapas} />

                <div className="sol-card-actions">
                  {DETALHE[s.tipo] && (
                    <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                      <FileText size={14} /> Ver respostas
                    </button>
                  )}
                  {podeReenviar && (
                    <button className="btn btn-warning btn-sm" onClick={() => setEditando(s)}>
                      <RotateCcw size={14} /> Editar e reenviar
                    </button>
                  )}
                  {s.tipo === 'mapeamento' && s.status === 'concluida' && (
                    <button className="btn btn-primary btn-sm" disabled={gerando === s.id} onClick={() => gerarNovaVaga(s)}>
                      <UserPlus size={14} /> {gerando === s.id ? 'Abrindo...' : 'Gerar Nova Vaga'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalRespostas respostas={verRespostas} onClose={() => setVerRespostas(null)} />

      {editando && (
        <EditarReenviarModal
          sol={editando}
          funcoes={funcoes}
          onReenviar={reenviarRequisicao}
          onClose={(reenviou) => { setEditando(null); if (reenviou) carregar(); }}
        />
      )}
    </div>
  );
}
