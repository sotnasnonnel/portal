import { useState, useEffect, useCallback } from 'react';
import { History, FileText } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { resumoAndamento, badgeDeStatus } from '../../../config/aprovacao';
import FluxoTimeline from '../../../components/Solicitacoes/FluxoTimeline';
import ModalRespostas, { DETALHE, buscarRespostas } from './ModalRespostas';
import BotaoGerarNovaVaga from './BotaoGerarNovaVaga';
import AcoesEditarRequisicao from './AcoesEditarRequisicao';
import '../../../components/UI/Components.css';
import '../Gestor.css';

const SELECT = `
  id, numero, tipo, status, gestor_id, colaborador_id, justificativa, salario_proposto, funcao_proposta,
  reenvios, edicao_motivo, edicao_em, created_at,
  colaborador:colaborador_id ( nome ),
  etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em )
`;

// Motivo da reprovação = justificativa da etapa reprovada (a de maior ordem).
const motivoReprovacao = (etapas) => (etapas || [])
  .filter((e) => e.status === 'reprovada')
  .sort((a, b) => (b.ordem || 0) - (a.ordem || 0))[0]?.justificativa || null;

/** Histórico das requisições de um tipo, abertas pelo próprio gestor. */
export default function HistoricoRequisicoes({ req }) {
  const { user } = useAuth();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verRespostas, setVerRespostas] = useState(null);
  const [solRespostas, setSolRespostas] = useState(null);   // requisição do modal aberto

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

  const abrirRespostas = async (sol) => { setSolRespostas(sol); setVerRespostas(await buscarRespostas(sol)); };

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
            const tomB = badgeDeStatus(resumo.tom);
            const motivo = s.status === 'reprovada' ? motivoReprovacao(s.etapas) : null;
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
                {motivo && (
                  <div className="sol-card-just" style={{ borderLeftColor: 'var(--color-danger)' }}>
                    <strong>Motivo da reprovação:</strong> {motivo}
                  </div>
                )}
                {s.edicao_motivo && (
                  <div className="sol-card-just" style={{ borderLeftColor: 'var(--color-warning)' }}>
                    <strong>
                      Editada{s.edicao_em ? ` em ${new Date(s.edicao_em).toLocaleDateString('pt-BR')}` : ''} — cadeia reiniciada:
                    </strong> {s.edicao_motivo}
                  </div>
                )}

                <FluxoTimeline etapas={s.etapas} />

                <div className="sol-card-actions">
                  {DETALHE[s.tipo] && (
                    <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                      <FileText size={14} /> Ver respostas
                    </button>
                  )}
                  <AcoesEditarRequisicao sol={s} onFeito={carregar} />
                  <BotaoGerarNovaVaga sol={s} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalRespostas
        respostas={verRespostas}
        sol={solRespostas}
        onClose={() => { setVerRespostas(null); setSolRespostas(null); }}
      />

    </div>
  );
}
