import { supabase } from '../../../../services/supabase';
import { buscarFluxoFin, montarEtapasFin, aprovadoresPorValor } from '../../../../config/aprovacaoFinanceiro';
import { getTermos } from '../../../../config/financeiroTermos';
import { notificarAprovadorFin } from '../../../../services/notificarAprovadorFin';

/**
 * Cria a solicitação do Financeiro: envelope + etapas (atômico, com delete
 * compensatório se as etapas falharem). Lança 'SEM_FLUXO' se o solicitante não
 * tem cadeia configurada para o tipo. `envelope` traz os campos do formulário.
 */
export async function criarSolicitacaoFin({ tipoDb, solicitanteId, envelope }) {
  const { fluxo, erro } = await buscarFluxoFin(solicitanteId, tipoDb);
  if (erro) throw new Error('Erro ao consultar o fluxo de aprovação. Tente novamente.');
  if (!fluxo) throw new Error('SEM_FLUXO');

  const chainIds = (Array.isArray(fluxo.aprovadores) ? fluxo.aprovadores : [])
    .map((x) => (x || '').toString().trim()).filter(Boolean);

  // Aprovadores adicionais pela FAIXA do valor (superior do solicitante para
  // valores baixos; pessoas fixas para as faixas altas). Só busca o superior
  // quando a faixa realmente precisa dele (valor <= 5000).
  const valor = Number(envelope.valor) || 0;
  let superiorId = null;
  if (valor <= 5000) {
    const { data: me } = await supabase
      .from('colaboradores').select('superior_id').eq('id', solicitanteId).maybeSingle();
    superiorId = me?.superior_id || null;
  }
  const tierIds = aprovadoresPorValor(valor, superiorId);

  // Cadeia final = configurada + faixa, sem duplicar, preservando a ordem.
  const vistos = new Set();
  const ids = [];
  for (const raw of [...chainIds, ...tierIds]) {
    const id = (raw || '').toString().trim();
    const k = id.toLowerCase();
    if (k && !vistos.has(k)) { vistos.add(k); ids.push(id); }
  }

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

  // Log de auditoria do aceite dos termos (quem + quando + qual termo).
  // Best-effort: o aceite também fica no envelope (aceite_termos_em +
  // solicitante_id); este log é o registro durável para controle.
  const { error: eLog } = await supabase.from('financeiro_termos_aceites').insert([{
    solicitacao_id: sol.id,
    colaborador_id: solicitanteId,
    tipo: tipoDb,
    titulo: getTermos(tipoDb)?.titulo ?? null,
    aceito_em: envelope.aceite_termos_em,
  }]);
  if (eLog) console.warn('[termos-aceite] log falhou:', eLog.message);

  notificarAprovadorFin(sol.id);
  window.dispatchEvent(new Event('solicitacoes_financeiro_atualizadas'));
  return sol; // { id, numero }
}
