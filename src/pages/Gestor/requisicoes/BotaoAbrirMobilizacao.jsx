import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { podeAcessarAdm } from '../../../config/administrativo';
import { itensDaContratacao } from '../../../modules/administrativo/app/novo/formularios/mobilizacao';
import {
  OPCOES_EQUIPAMENTO, OPCOES_SOFTWARE, OPCOES_EPI,
} from '../../../modules/administrativo/app/novo/formularios/opcoes';

const ROTA_MOBILIZACAO = '/administrativo/novo/mobilizacao/mobilizacao';

/**
 * "Abrir Mobilização" a partir de uma Contratação: leva para o formulário de
 * Mobilização do Atendimento com os softwares, EPIs e a 2ª tela que foram
 * marcados na Contratação (ver itensDaContratacao). O resto — profissional,
 * projeto, cliente, datas — quem abre preenche lá: a pessoa contratada ainda
 * pode não estar no cadastro, e o chamado segue o fluxo do próprio Atendimento.
 *
 * Mesmo desenho do BotaoGerarNovaVaga: aparece só para o SOLICITANTE, e some
 * quando a Contratação foi reprovada ou cancelada.
 */
export default function BotaoAbrirMobilizacao({ sol, className = 'btn btn-outline btn-sm', onAntesDeIr }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [abrindo, setAbrindo] = useState(false);

  if (sol?.tipo !== 'formulario_contratacao') return null;
  if (sol.status === 'reprovada' || sol.status === 'cancelada') return null;
  if (!user?.id || String(sol.gestor_id || '') !== String(user.id)) return null;
  if (!podeAcessarAdm(user)) return null;

  const abrir = async () => {
    setAbrindo(true);
    try {
      const { data, error } = await supabase
        .from('formularios_contratacao')
        .select('softwares_extras, epis')
        .eq('solicitacao_id', sol.id)
        .maybeSingle();
      if (error) throw error;
      const valores = itensDaContratacao(data, {
        equipamento: OPCOES_EQUIPAMENTO, software: OPCOES_SOFTWARE, epi: OPCOES_EPI,
      });
      onAntesDeIr?.();   // ex.: fechar o modal que estava aberto
      navigate(ROTA_MOBILIZACAO, {
        state: {
          preenchido: {
            valores,
            origem: sol.numero ? `Contratação nº ${sol.numero}` : 'Contratação',
          },
        },
      });
    } catch (e) {
      console.error(e);
      alert('Não foi possível carregar a contratação. Tente novamente.');
    } finally {
      setAbrindo(false);
    }
  };

  return (
    <button type="button" className={className} disabled={abrindo} onClick={abrir}
      title="Abrir a Mobilização no Atendimento com os softwares, EPIs e equipamentos marcados nesta contratação">
      <Truck size={14} /> {abrindo ? 'Abrindo...' : 'Abrir Mobilização'}
    </button>
  );
}
