-- Migration: reembolso_envio_cliente (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- NÃO APLICADO. Escrito em 14/09/2026 com a conexão do Supabase fora do ar.
--
-- O PEDIDO (Alinne, Financeiro)
--
--   "Sempre que um reembolso marcado como 'será reembolsado pelo cliente' for
--    solicitado, o PDF gerado pela plataforma deve ir automaticamente para o meu
--    e-mail, para eu seguir com o controle e a cobrança junto ao cliente."
--
-- DECISÕES (com o Marcus, 14/09/2026)
--
--   * O envio acontece na APROVAÇÃO, não na solicitação. O PDF usa valor
--     aprovado (que pode ter desconto) e data de pagamento, que não existem
--     antes da decisão — e pedido reprovado não se cobra do cliente.
--   * Só REEMBOLSO. No adiantamento o valor real só fecha na prestação de
--     contas; o PDF da aprovação não seria o valor a cobrar.
--   * O PDF é gerado no NAVEGADOR de quem aprova, pelo mesmo código do botão
--     "Gerar PDF" — uma cópia no servidor divergiria no nome do arquivo, que é
--     padrão exigido pelo cliente.
--
-- POR QUE EXISTE UM REGISTRO
--
-- Depender do navegador tem um preço: se a aba fechar no meio, o e-mail não
-- sai. Numa cobrança, envio perdido calado é dinheiro que não volta. Então o
-- BANCO decide o que precisa ser enviado — por gatilho, sem depender do front
-- — e o registro só vira 'enviado' quando a função de e-mail confirma. O que
-- sobrar 'pendente' ou 'falhou' aparece para o Financeiro reenviar.
--
-- SEM CARGA RETROATIVA, de propósito: os aprovados reembolsáveis anteriores a
-- este arquivo NÃO entram como pendentes. Entrariam todos de uma vez na lista
-- de pendências, e um "reenviar tudo" despejaria meses de PDFs numa caixa de
-- entrada. Se o Financeiro quiser o passado, é uma decisão à parte.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Registro: um por pedido
-- ----------------------------------------------------------------------------
create table if not exists public.reembolso_envios_cliente (
  reimbursement_id uuid primary key
    references public.reembolso_reimbursements(id) on delete cascade,

  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'falhou')),
  tentativas int not null default 0,
  ultimo_erro text,

  enviado_em timestamptz,
  enviado_para text,
  -- O PDF exatamente como foi mandado, no bucket. Se o cliente contestar o
  -- valor, é este arquivo — e não um PDF regerado depois — que vale.
  pdf_path text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- A lista de pendências do Financeiro filtra por situação.
create index if not exists reembolso_envios_cliente_status
  on public.reembolso_envios_cliente (status, atualizado_em)
  where status <> 'enviado';

-- ----------------------------------------------------------------------------
-- 2) Gatilho: todo aprovado reembolsável nasce pendente
--
-- A regra é a MESMA de deveEnviarAoCliente (src/modules/reembolso/lib/
-- envioCliente.js). Os `::text` cobrem status e kind serem enum ou texto.
--
-- Reaprovação (reprovou, voltou, aprovou de novo) reabre como pendente: o valor
-- aprovado pode ter mudado, e o PDF antigo já não é o que se cobra.
--
-- SECURITY DEFINER: quem aprova é o gestor, que não tem (nem deve ter) escrita
-- nesta tabela.
-- ----------------------------------------------------------------------------
create or replace function reembolso_private.marcar_envio_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status::text = 'aprovado'
     and old.status::text is distinct from 'aprovado'
     and new.billable_to_client is true
     and coalesce(new.kind::text, 'reembolso') = 'reembolso'
  then
    insert into public.reembolso_envios_cliente (reimbursement_id, status)
    values (new.id, 'pendente')
    on conflict (reimbursement_id) do update
      set status = 'pendente', ultimo_erro = null, atualizado_em = now();
  end if;
  return new;
end;
$$;

drop trigger if exists reembolso_marcar_envio_cliente on public.reembolso_reimbursements;
create trigger reembolso_marcar_envio_cliente
  after update of status on public.reembolso_reimbursements
  for each row execute function reembolso_private.marcar_envio_cliente();

-- ----------------------------------------------------------------------------
-- 3) RLS: só o admin lê. Ninguém escreve pelo front.
--
-- Escrita só pelo gatilho (definer) e pela função de envio (service role). Um
-- registro que o próprio navegador pudesse marcar como 'enviado' não serviria
-- para provar que o e-mail saiu.
-- ----------------------------------------------------------------------------
alter table public.reembolso_envios_cliente enable row level security;

drop policy if exists reembolso_envios_cliente_select on public.reembolso_envios_cliente;
create policy reembolso_envios_cliente_select on public.reembolso_envios_cliente
  for select to authenticated
  using (reembolso_private.is_admin());

-- ============================================================================
-- 4) Bucket dos PDFs enviados
--
-- PRIVADO: o PDF traz nome, valores e as notas fiscais do colaborador.
-- A pasta é o id do pedido, e a policy exige que quem sobe o arquivo ENXERGUE
-- aquele pedido (can_view: solicitante, gestor dele ou admin). Sem isso qualquer
-- logado poderia gravar um PDF na pasta de um pedido alheio.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reembolso-pdf-cliente', 'reembolso-pdf-cliente', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists reembolso_pdf_cliente_insert on storage.objects;
create policy reembolso_pdf_cliente_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reembolso-pdf-cliente'
    and reembolso_private.can_view(((storage.foldername(name))[1])::uuid)
  );

-- O upload usa upsert (reenvio regrava o arquivo), e upsert precisa de UPDATE.
drop policy if exists reembolso_pdf_cliente_update on storage.objects;
create policy reembolso_pdf_cliente_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'reembolso-pdf-cliente'
    and reembolso_private.can_view(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists reembolso_pdf_cliente_select on storage.objects;
create policy reembolso_pdf_cliente_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reembolso-pdf-cliente'
    and reembolso_private.can_view(((storage.foldername(name))[1])::uuid)
  );

notify pgrst, 'reload schema';
