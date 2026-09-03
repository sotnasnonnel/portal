-- Migration: reembolso_cliente_reembolsavel (projeto bogsuuhrgvopzgcceoqz)
--
-- Reembolso e adiantamento passam a dizer, já na solicitação, se a despesa é
-- reembolsável pelo cliente (o Financeiro cobra do cliente) ou se fica como
-- custo da empresa. O formulário exige a resposta; a coluna fica nula só nos
-- pedidos anteriores a esta migration.
alter table public.reembolso_reimbursements
  add column if not exists billable_to_client boolean;

comment on column public.reembolso_reimbursements.billable_to_client is
  'Reembolsável pelo cliente? true = o cliente reembolsa; false = custo da empresa; null = pedido anterior ao campo.';
