import {
  STATUS, updateReimbursementStatus, notifyApprover, notifyRequesterDecision,
} from "./reimbursements.js";
import { enviarPdfAoCliente } from "./envioCliente.js";
import { deveEnviarAoCliente } from "../lib/envioCliente.js";

// Decisão do gestor sobre um reembolso/adiantamento, com tudo que vem depois
// dela. Morava no detalhe do pedido; saiu para cá quando nasceu a central de
// Aprovações, que precisa gravar e avisar do mesmo jeito.
//
// Devolve { error } ou { salvo, segundaAlcada }. `segundaAlcada` = a aprovação
// deste gestor não encerrou o pedido (gatilho reembolso_segunda_alcada): ele
// voltou para análise com o aprovador de cima, que é quem recebe o aviso.
export async function decidirReembolso({ reembolso, aprovar, actor, note = null, approvedAmount = null }) {
  const next = aprovar ? STATUS.APROVADO : STATUS.REPROVADO;
  const { data: salvo, error } = await updateReimbursementStatus(
    reembolso.id, next, actor, note, approvedAmount, reembolso.kind,
  );
  if (error) return { error };

  if (aprovar && salvo?.status === STATUS.EM_ANALISE) {
    notifyApprover(reembolso.id);
    return { salvo, segundaAlcada: true };
  }
  // Retorno para quem pediu: e-mail com o desfecho (e, no reembolso aprovado,
  // a data em que o pagamento cai). Não bloqueia o fluxo se falhar.
  notifyRequesterDecision(reembolso.id);
  // Reembolso cobrado do cliente: o PDF fica anexado para o Financeiro. Sem
  // await — se falhar, o banco já marcou o pedido como pendente e o Financeiro
  // gera de novo pelo painel do detalhe.
  if (deveEnviarAoCliente({ ...reembolso, status: next })) {
    enviarPdfAoCliente(reembolso.id);
  }
  return { salvo, segundaAlcada: false };
}
