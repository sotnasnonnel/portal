import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { podeGerarNovaVaga, mapeamentoEmAprovacao, prefillNovaVagaDeMapeamento } from '../../../config/mapeamento';

/**
 * "Gerar Nova Vaga" a partir de um Mapeamento: leva os dados para o formulário
 * de Nova Vaga já pré-preenchido, com o vínculo de origem. A Nova Vaga é uma
 * requisição nova e segue a PRÓPRIA cadeia de aprovação (§5.1).
 *
 * Componente (e não um trecho copiado em cada tela) porque o botão precisa
 * aparecer em todo lugar onde o solicitante abre um Mapeamento — Histórico,
 * Aprovar/Acompanhar e o modal "Ver respostas". Some sozinho para quem não é o
 * solicitante ou quando o mapeamento é um fim de linha (ver podeGerarNovaVaga).
 */
export default function BotaoGerarNovaVaga({ sol, className = 'btn btn-primary btn-sm', onAntesDeIr }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gerando, setGerando] = useState(false);

  if (!podeGerarNovaVaga(sol, user?.id)) return null;

  const emAprovacao = mapeamentoEmAprovacao(sol);

  const gerar = async () => {
    setGerando(true);
    try {
      // Direto na tabela de detalhe: o prefill só usa os campos do mapeamento
      // (anexos não são copiados para a vaga). Buscar por buscarRespostas() aqui
      // criaria um ciclo de import — o ModalRespostas é um dos donos do botão.
      const { data, error } = await supabase
        .from('mapeamentos').select('*').eq('solicitacao_id', sol.id).maybeSingle();
      if (error) throw error;
      onAntesDeIr?.();   // ex.: fechar o modal que estava aberto
      navigate('/gestor/solicitacoes/nova/nova-vaga', {
        state: {
          origemMapeamento: {
            solicitacaoId: sol.id,
            numero: sol.numero,
            emAprovacao,
            prefill: prefillNovaVagaDeMapeamento(data || {}),
          },
        },
      });
    } catch (e) {
      console.error(e);
      alert('Não foi possível carregar o mapeamento. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <button type="button" className={className} disabled={gerando} onClick={gerar}
      title={emAprovacao
        ? 'Abrir uma Nova Vaga com os dados deste mapeamento (ele ainda está em aprovação; a vaga passa pela própria cadeia)'
        : 'Abrir uma Nova Vaga com os dados deste mapeamento'}>
      <UserPlus size={14} /> {gerando ? 'Abrindo...' : 'Gerar Nova Vaga'}
    </button>
  );
}
