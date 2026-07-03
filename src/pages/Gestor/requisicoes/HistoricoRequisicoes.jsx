import { useState, useEffect } from 'react';
import { History, FileText } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { resumoAndamento } from '../../../config/aprovacao';
import FluxoTimeline from '../../../components/Solicitacoes/FluxoTimeline';
import ModalRespostas, { DETALHE, buscarRespostas } from './ModalRespostas';
import '../../../components/UI/Components.css';
import '../Gestor.css';

const TOM_BADGE = {
  pendente: { label: 'Em andamento', badge: 'pendente' },
  concluida: { label: 'Concluída', badge: 'aprovada' },
  reprovada: { label: 'Reprovada', badge: 'inativo' },
};

/** Histórico das requisições de um tipo, abertas pelo próprio gestor. */
export default function HistoricoRequisicoes({ req }) {
  const { user } = useAuth();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verRespostas, setVerRespostas] = useState(null);

  useEffect(() => {
    if (!user?.id || !req?.tipoDb) return undefined;
    let vivo = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('solicitacoes_rh')
        .select(`
          id, tipo, status, justificativa, created_at,
          colaborador:colaborador_id ( nome ),
          etapas:solicitacoes_rh_etapas ( id, ordem, aprovador_id, papel, tipo_etapa, status, justificativa, decidido_em )
        `)
        .eq('tipo', req.tipoDb)
        .eq('gestor_id', user.id)
        .order('created_at', { ascending: false });
      if (vivo) { setLista(data || []); setLoading(false); }
    })();
    return () => { vivo = false; };
  }, [user, req]);

  const abrirRespostas = async (sol) => setVerRespostas(await buscarRespostas(sol));

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
            return (
              <div key={s.id} className="sol-card">
                <div className="sol-card-top">
                  <div>
                    <div className="sol-card-colab">{s.colaborador?.nome || '—'}</div>
                    <div className="sol-card-tipo">
                      Aberta em {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <span className={`badge ${tomB.badge}`}>{tomB.label}</span>
                </div>

                {s.justificativa && <div className="sol-card-just">{s.justificativa}</div>}

                <div className={`sol-card-resumo tom-${resumo.tom}`}>{resumo.texto}</div>

                <FluxoTimeline etapas={s.etapas} />

                {DETALHE[s.tipo] && (
                  <div className="sol-card-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => abrirRespostas(s)}>
                      <FileText size={14} /> Ver respostas
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ModalRespostas respostas={verRespostas} onClose={() => setVerRespostas(null)} />
    </div>
  );
}
