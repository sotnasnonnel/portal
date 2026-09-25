/**
 * PDF anexado automaticamente quando o reembolso é cobrado do cliente.
 *
 * Pedido da Alinne (Financeiro, 09/2026): todo reembolso marcado como
 * "reembolsável pelo cliente" precisa ter o PDF no sistema, para a cobrança
 * junto ao cliente — sem depender de alguém lembrar de gerar. Fica anexado ao
 * pedido (o Financeiro baixa pelo detalhe) e vai por e-mail para ela.
 *
 * Lógica pura, testada. A MESMA regra existe no gatilho do banco
 * (supabase_migration_reembolso_envio_cliente.sql), que é quem manda: aqui ela
 * só evita gerar um PDF que o banco não vai registrar.
 */

/**
 * O pedido entra no envio?
 *
 *  - Só APROVADO: o PDF usa o valor aprovado (que pode ter desconto) e a data de
 *    pagamento, que não existem antes da decisão. E pedido reprovado não se
 *    cobra do cliente.
 *  - Só REEMBOLSO: no adiantamento o valor real só fecha na prestação de contas,
 *    e o PDF da aprovação não seria o valor a cobrar. `kind` nulo é pedido
 *    antigo, anterior ao adiantamento — portanto reembolso.
 *  - Só `billable_to_client === true`: nulo é pedido anterior ao campo, e
 *    "não sei" não é "sim".
 */
export function deveEnviarAoCliente(r) {
  if (!r) return false;
  if (r.status !== 'aprovado') return false;
  if ((r.kind ?? 'reembolso') !== 'reembolso') return false;
  return r.billable_to_client === true;
}

/** Rótulos do registro, para a tela. No banco, 'enviado' quer dizer anexado e mandado por e-mail. */
export const SITUACAO_ENVIO = {
  pendente: { label: 'Ainda não gerado', tom: 'alerta' },
  enviado: { label: 'Anexado e enviado por e-mail', tom: 'ok' },
  falhou: { label: 'Não foi gerado', tom: 'erro' },
};
