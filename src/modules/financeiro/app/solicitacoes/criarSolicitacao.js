import { supabase } from '../../../../services/supabase';
import { buscarFluxoFin, montarEtapasFin } from '../../../../config/aprovacaoFinanceiro';

/**
 * Cria a solicitação do Financeiro: envelope + etapas (atômico, com delete
 * compensatório se as etapas falharem). Lança 'SEM_FLUXO' se o solicitante não
 * tem cadeia configurada para o tipo. `envelope` traz os campos do formulário.
 */
export async function criarSolicitacaoFin({ tipoDb, solicitanteId, envelope }) {
  const { fluxo, erro } = await buscarFluxoFin(solicitanteId, tipoDb);
  if (erro) throw new Error('Erro ao consultar o fluxo de aprovação. Tente novamente.');
  if (!fluxo) throw new Error('SEM_FLUXO');

  const ids = (Array.isArray(fluxo.aprovadores) ? fluxo.aprovadores : [])
    .map((x) => (x || '').toString().trim()).filter(Boolean);
  let nomePorId = {};
  if (ids.length) {
    const { data: cols, error: e } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
    if (e) throw e;
    nomePorId = Object.fromEntries((cols || []).map((c) => [c.id, c.nome]));
  }

  const { data: sol, error: eSol } = await supabase
    .from('solicitacoes_financeiro')
    .insert([{ ...envelope, tipo: tipoDb, solicitante_id: solicitanteId, status: 'pendente' }])
    .select('id, numero').single();
  if (eSol) throw eSol;

  try {
    const linhas = montarEtapasFin(sol.id, ids, solicitanteId, nomePorId);
    const { error: eEt } = await supabase.from('solicitacoes_financeiro_etapas').insert(linhas);
    if (eEt) throw eEt;
  } catch (err) {
    await supabase.from('solicitacoes_financeiro').delete().eq('id', sol.id);
    throw err;
  }

  window.dispatchEvent(new Event('solicitacoes_financeiro_atualizadas'));
  return sol; // { id, numero }
}
