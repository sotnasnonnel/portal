import { useState, useEffect } from 'react';
import { RotateCcw, Pencil } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { podeEditarRequisicao, podeResponderRequisicao } from '../../../config/reenvio';
import { useRequisicaoForm } from './useRequisicaoForm';
import EditarReenviarModal from './EditarReenviarModal';

/** Etapa reprovada = a de maior ordem entre as reprovadas (é a que reabre). */
const etapaReprovadaDe = (etapas) => (etapas || [])
  .filter((e) => e.status === 'reprovada')
  .sort((a, b) => (b.ordem || 0) - (a.ordem || 0))[0] || null;

/**
 * Só é montado com o modal ABERTO. O `useRequisicaoForm` puxa equipe e fluxo do
 * gestor, e a lista de funções é outra consulta: se isso morasse no componente
 * de botões, cada card de uma listagem dispararia as três.
 */
function ModalEdicao({ sol, modo, onFechar }) {
  const { responderRequisicao, editarRequisicao } = useRequisicaoForm();
  const [funcoes, setFuncoes] = useState([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('funcoes').select('nome').order('nome');
      if (vivo) setFuncoes((data || []).map((f) => f.nome));
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <EditarReenviarModal
      sol={sol}
      modo={modo}
      funcoes={funcoes}
      etapaReprovada={modo === 'responder' ? etapaReprovadaDe(sol.etapas) : null}
      // Responder volta a quem reprovou; Editar recomeça a cadeia inteira,
      // recalculando a alçada com o conteúdo novo (funcaoAlvo/foraDoQuadro vêm
      // do modal, já a partir do formulário editado).
      onSalvar={modo === 'editar'
        ? ((p) => editarRequisicao({ ...p, tipo: sol.tipo, colaboradorId: sol.colaborador_id || null }))
        : responderRequisicao}
      onClose={onFechar}
    />
  );
}

/**
 * Ações do SOLICITANTE sobre a própria requisição — "Editar requisição"
 * (em andamento; recomeça a cadeia) e "Responder" (reprovada; volta a quem
 * reprovou). Componente único porque precisa aparecer em todo lugar onde ele
 * abre a requisição: Histórico e Aprovar/Acompanhar. Some sozinho para quem não
 * é o solicitante e nos status em que a ação não cabe.
 */
export default function AcoesEditarRequisicao({ sol, onFeito }) {
  const { user } = useAuth();
  const [modo, setModo] = useState(null);

  const podeResponder = podeResponderRequisicao(sol, user?.id);
  const podeEditar = podeEditarRequisicao(sol, user?.id);
  if (!podeResponder && !podeEditar) return null;

  return (
    <>
      {podeResponder && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setModo('responder')}>
          <RotateCcw size={14} /> Responder
        </button>
      )}
      {podeEditar && (
        <button type="button" className="btn btn-warning btn-sm" onClick={() => setModo('editar')}
          title="Editar a requisição — ela volta para o início da cadeia de aprovação">
          <Pencil size={14} /> Editar requisição
        </button>
      )}
      {modo && (
        <ModalEdicao sol={sol} modo={modo}
          onFechar={(salvou) => { setModo(null); if (salvou) onFeito?.(); }} />
      )}
    </>
  );
}
