import { supabase } from '../../../../services/supabase';
import { buscarFluxoFin } from '../../../../config/aprovacaoFinanceiro';
import { avaliarAlcada } from '../../../../config/alcadas';
import {
  resolverPapeis, montarEtapasAlcada, registrarAuditoria, PapelNaoAtribuidoError,
} from '../../../../services/alcadas';
import { getTermos } from '../../../../config/financeiroTermos';
import { notificarAprovadorFin } from '../../../../services/notificarAprovadorFin';

/**
 * Cria a solicitação do Financeiro: envelope + etapas (atômico, com delete
 * compensatório se as etapas falharem). Lança 'SEM_FLUXO' se o solicitante não
 * tem cadeia configurada para o tipo.
 *
 * A cadeia final tem 4 trechos, nesta ordem:
 *   1. cadeia configurada em Fluxos (hierarquia do solicitante);
 *   2. aprovadores exigidos pela ALÇADA (faixa de valor + modificadores);
 *   3. pareceres bloqueantes (hoje: Jurídico, por cláusula atípica);
 *   4. execução do Financeiro.
 *
 * Cartão Virtual e Aumento de Limite são despesa/limite: enquadram na tabela
 * de Compras e Despesas (§2.1 do Documento de Alçadas).
 */
export async function criarSolicitacaoFin({ tipoDb, solicitanteId, envelope }) {
  const { fluxo, erro } = await buscarFluxoFin(solicitanteId, tipoDb);
  if (erro) throw new Error('Erro ao consultar o fluxo de aprovação. Tente novamente.');
  if (!fluxo) throw new Error('SEM_FLUXO');

  // --- 1. classificação obrigatória (§6, pilar 1) ---
  const valor = Number(envelope.valor) || 0;
  if (!envelope.categoria) throw new Error('Classifique a categoria da despesa antes de enviar.');
  if (envelope.dentro_orcamento == null) {
    throw new Error('Informe se a despesa está dentro ou fora do orçamento aprovado.');
  }

  // --- 2. motor de alçadas decide QUE PAPÉIS precisam aprovar ---
  const modificadores = envelope.dentro_orcamento === false ? ['fora_orcamento'] : [];
  const gatilhos = envelope.categoria === 'capex' ? ['capex_relevante'] : [];
  const decisao = avaliarAlcada({ tabela: 'compras', valor, modificadores, gatilhos });

  // --- 3. papéis -> pessoas; lacuna bloqueia a criação (§6, pilar 3) ---
  const [alcada, parecer] = await Promise.all([
    resolverPapeis(solicitanteId, decisao.papeis),
    resolverPapeis(solicitanteId, decisao.pareceres),
  ]);
  const lacunas = [...alcada.lacunas, ...parecer.lacunas];
  if (lacunas.length) throw new PapelNaoAtribuidoError(lacunas);

  // --- 4. cadeia configurada em Fluxos (nomes via RPC, a RLS esconde superiores) ---
  const chainIds = (Array.isArray(fluxo.aprovadores) ? fluxo.aprovadores : [])
    .map((x) => (x || '').toString().trim()).filter(Boolean);
  let etapasCadeia = [];
  if (chainIds.length) {
    const { data: cols, error: e } = await supabase.rpc('nomes_colaboradores', { p_ids: chainIds });
    if (e) throw e;
    const nomePorId = Object.fromEntries((cols || []).map((c) => [c.id, c.nome]));
    etapasCadeia = chainIds.map((id) => {
      const nome = nomePorId[id];
      if (!nome) throw new Error(`Aprovador sem nome resolvido (id ${id}). Recarregue e tente de novo.`);
      return { aprovadorId: id, nome, papel: null };
    });
  }

  // --- 5. envelope, já carimbado com a decisão de alçada (trilha de auditoria) ---
  const { data: sol, error: eSol } = await supabase
    .from('solicitacoes_financeiro')
    .insert([{
      ...envelope,
      tipo: tipoDb,
      solicitante_id: solicitanteId,
      status: 'pendente',
      alcada_tabela: decisao.tabela,
      alcada_nivel_base: decisao.nivelBase,
      alcada_nivel_final: decisao.nivelFinal,
      alcada_modificadores: decisao.modificadores,
      alcada_gatilhos: decisao.gatilhos,
      alcada_excecoes: decisao.excecoes,
    }])
    .select('id, numero').single();
  if (eSol) throw eSol;

  try {
    const linhas = montarEtapasAlcada({
      solicitacaoId: sol.id,
      etapasCadeia,
      etapasAlcada: alcada.etapas,
      etapasParecer: parecer.etapas,
      criadorId: solicitanteId,
    });
    const { error: eEt } = await supabase.from('solicitacoes_financeiro_etapas').insert(linhas);
    if (eEt) throw eEt;
  } catch (err) {
    await supabase.from('solicitacoes_financeiro').delete().eq('id', sol.id);
    throw err;
  }

  // --- 6. trilha de auditoria (§6, pilar 4): a classificação e a alçada aplicada ---
  registrarAuditoria({
    modulo: 'financeiro',
    solicitacao_id: sol.id,
    numero: sol.numero,
    tipo: tipoDb,
    evento: 'classificacao',
    ator_id: solicitanteId,
    valor,
    alcada_tabela: decisao.tabela,
    nivel_base: decisao.nivelBase,
    nivel_final: decisao.nivelFinal,
    excecoes: decisao.excecoes,
    observacao: `Categoria ${envelope.categoria} · ${envelope.dentro_orcamento ? 'dentro' : 'FORA'} do orçamento · nível ${decisao.nivelFinal} (${decisao.rotuloNivel})`,
  });
  // §6, pilar 5 — exceção gera alerta à diretoria.
  if (decisao.alertaDiretoria) {
    registrarAuditoria({
      modulo: 'financeiro',
      solicitacao_id: sol.id,
      numero: sol.numero,
      tipo: tipoDb,
      evento: 'excecao',
      ator_id: solicitanteId,
      valor,
      alcada_tabela: decisao.tabela,
      nivel_base: decisao.nivelBase,
      nivel_final: decisao.nivelFinal,
      excecoes: decisao.excecoes,
      observacao: decisao.excecoes.join(' | '),
    });
  }

  // Log de auditoria do aceite dos termos (quem + quando + qual termo).
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
