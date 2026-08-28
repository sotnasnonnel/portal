import { supabase } from '../../../../services/supabase';
import {
  montarEtapasAlcada, registrarAuditoria, PapelNaoAtribuidoError,
} from '../../../../services/alcadas';
import {
  montarCadeiaFin, ehTopoDaHierarquiaFin, SemAprovadorFinError, PapelForaDaCadeiaFinError,
} from './cadeiaFin';
import { getTermos } from '../../../../config/financeiroTermos';
import { notificarAprovadorFin } from '../../../../services/notificarAprovadorFin';

/**
 * Cria a solicitação do Financeiro: envelope + etapas (atômico, com delete
 * compensatório se as etapas falharem).
 *
 * A cadeia final tem 3 trechos, nesta ordem (a mesma do módulo Administrativo):
 *   1. cabeça da cadeia — escada do organograma (superior direto → gerente),
 *      ou a exceção cadastrada em Fluxos quando existir;
 *   2. aprovadores exigidos pela ALÇADA (faixa de valor, TABELA_ADMINISTRATIVO);
 *   3. execução do Financeiro.
 *
 * Quem monta os trechos 1 e 2 é `montarCadeiaFin` — o mesmo caminho da prévia
 * que o solicitante vê antes de enviar.
 */
export async function criarSolicitacaoFin({ tipoDb, solicitanteId, envelope }) {
  const valor = Number(envelope.valor) || 0;

  // --- 1. cadeia efetiva de hoje (organograma/fluxo + faixa de valor) ---
  const { cabeca, decisao, etapasAlcada, lacunas, foraDaCadeia } = await montarCadeiaFin({
    solicitanteId, tipo: tipoDb, valor,
  });

  // Lacuna de papel bloqueia (§6, pilar 3); papel resolvido FORA da cadeia da
  // pessoa bloqueia também — seguir mandaria o pedido a um gestor de outra área.
  if (lacunas.length) throw new PapelNaoAtribuidoError(lacunas);
  if (foraDaCadeia.length) throw new PapelForaDaCadeiaFinError(foraDaCadeia);

  const etapasCadeia = cabeca.pessoas.map((p) => ({ aprovadorId: p.id, nome: p.nome, papel: null }));

  // Sem ninguém na cabeça e sem papel de faixa, a solicitação iria direto para a
  // execução — aprovação nenhuma. Só o topo da hierarquia pode seguir assim.
  if (!etapasCadeia.length && !etapasAlcada.length && !(await ehTopoDaHierarquiaFin(solicitanteId))) {
    throw new SemAprovadorFinError();
  }

  // --- 2. envelope, já carimbado com a decisão de alçada (trilha de auditoria) ---
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
      etapasAlcada,
      criadorId: solicitanteId,
    });
    const { error: eEt } = await supabase.from('solicitacoes_financeiro_etapas').insert(linhas);
    if (eEt) throw eEt;
  } catch (err) {
    await supabase.from('solicitacoes_financeiro').delete().eq('id', sol.id);
    throw err;
  }

  // --- 3. trilha de auditoria (§6, pilar 4): a classificação e a alçada aplicada ---
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
    observacao: `Cadeia por ${cabeca.origem === 'cadastro' ? 'fluxo cadastrado' : 'organograma'}`
      + ` · nível ${decisao.nivelFinal} (${decisao.rotuloNivel})`,
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
