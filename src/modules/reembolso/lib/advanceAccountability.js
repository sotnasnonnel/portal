// Reconciliação da prestação de contas de um adiantamento.
// adiantado = total liberado (itens do pedido); comprovado = soma das notas
// de prestação (accountability_total). Tolerância de 0,001 para float.
export function reconcileAdvance({ total, accountabilityTotal }) {
  const adiantado = Number(total || 0);
  const comprovado = Number(accountabilityTotal || 0);
  const diff = adiantado - comprovado; // >0 sobra, <0 falta

  let outcome = "exato";
  let expectedSettlement = "sem_acerto";
  if (diff > 0.001) {
    outcome = "sobra";
    expectedSettlement = "devolvido";
  } else if (diff < -0.001) {
    outcome = "falta";
    expectedSettlement = "complemento_pago";
  }

  return { adiantado, comprovado, diff, outcome, expectedSettlement };
}
