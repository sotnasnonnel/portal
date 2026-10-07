-- Migration: rascunho no Reembolso/Adiantamento
-- (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido da Jakeline (06/10/2026): salvar o pedido e mandar para aprovação
-- depois, para ir lançando os gastos durante o mês.
--
--   - Novo status 'rascunho'. Só o solicitante vê o rascunho: gestor e admin
--     não o enxergam (RLS), então ele não entra em fila, contagem nem painel.
--   - O solicitante pode excluir o próprio rascunho (o resto continua só admin).
--   - Rascunho -> em análise avisa o aprovador no sino, como o pedido novo.
--   - Gestor que envia o próprio rascunho: aprovado direto, e a segunda alçada
--     vale igual ao pedido criado já enviado. Sem notificar o próprio gestor de
--     "aprovado" e sem entrar na fila de envio ao cliente — o pedido criado já
--     aprovado também não entra (o gatilho de envio é só de UPDATE).
--
-- Aplicar ANTES do deploy do front. Não quebra o front atual: ele nunca grava
-- 'rascunho'.
--
-- Para derrubar: recriar as policies/funções abaixo sem as condições de
-- 'rascunho' (o valor do enum fica; Postgres não remove valor de enum).
-- ============================================================================

alter type public.reembolso_status add value if not exists 'rascunho';

begin;

-- ----------------------------------------------------------------------------
-- 1) Visibilidade: rascunho é só do solicitante
-- ----------------------------------------------------------------------------
drop policy if exists reembolso_reimb_select on public.reembolso_reimbursements;
create policy reembolso_reimb_select on public.reembolso_reimbursements
  for select using (
    requester_id = auth.uid()
    or (status::text <> 'rascunho'
        and (manager_id = auth.uid() or first_manager_id = auth.uid() or reembolso_private.is_admin()))
  );

drop policy if exists reembolso_reimb_update on public.reembolso_reimbursements;
create policy reembolso_reimb_update on public.reembolso_reimbursements
  for update using (
    requester_id = auth.uid()
    or (status::text <> 'rascunho' and (manager_id = auth.uid() or reembolso_private.is_admin()))
  )
  with check (
    requester_id = auth.uid() or manager_id = auth.uid()
    or first_manager_id = auth.uid() or reembolso_private.is_admin()
  );

drop policy if exists reembolso_reimb_delete on public.reembolso_reimbursements;
create policy reembolso_reimb_delete on public.reembolso_reimbursements
  for delete using (
    reembolso_private.is_admin()
    or (requester_id = auth.uid() and status::text = 'rascunho')
  );

create or replace function reembolso_private.can_view(rid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from reembolso_reimbursements r
    where r.id = rid
      and ( r.requester_id = auth.uid()
            or (r.status::text <> 'rascunho'
                and ( r.manager_id = auth.uid()
                      or r.first_manager_id = auth.uid()
                      or reembolso_private.is_admin() )) )
  );
$$;

-- ----------------------------------------------------------------------------
-- 2) Segunda alçada também quando o gestor envia o próprio rascunho
--    (antes: só a partir de 'em_analise').
-- ----------------------------------------------------------------------------
create or replace function reembolso_private.segunda_alcada()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  quem_aprovou uuid;
  sup uuid;
  sup_nome text;
begin
  if tg_op = 'UPDATE' and new.status::text = 'em_analise' and old.status::text <> 'em_analise' then
    new.first_manager_id := null;
    new.first_decided_by_name := null;
    new.first_decided_at := null;
    new.first_approved_amount := null;
    return new;
  end if;

  if new.status::text <> 'aprovado' then return new; end if;
  if tg_op = 'UPDATE' and (old.status::text not in ('em_analise', 'rascunho') or old.first_manager_id is not null) then
    return new;
  end if;
  if tg_op = 'INSERT' and new.first_manager_id is not null then return new; end if;

  quem_aprovou := coalesce(
    case when tg_op = 'UPDATE' then old.manager_id else new.manager_id end,
    new.requester_id);

  select s.aprovador_id, coalesce(p.display_name, p.full_name)
    into sup, sup_nome
    from reembolso_segunda_alcada s
    join reembolso_profiles p on p.id = s.aprovador_id
   where s.gestor_id = quem_aprovou;
  if sup is null or sup = new.requester_id then return new; end if;

  new.first_manager_id := quem_aprovou;
  new.first_decided_by_name := new.decided_by_name;
  new.first_decided_at := coalesce(new.decided_at, now());
  new.first_approved_amount := new.approved_amount;

  new.status := 'em_analise';
  new.manager_id := sup;
  new.manager_name := sup_nome;
  new.decided_by_id := null;
  new.decided_by_name := null;
  new.decided_at := null;
  new.approved_amount := null;
  if coalesce(new.kind::text, 'reembolso') = 'reembolso' then new.payment_date := null; end if;
  new.accountability_status := null;

  if tg_op = 'UPDATE' then
    perform app_private.notificar(
      app_private.colab_por_auth(sup), 'reembolso', 'sua_vez',
      format('%s de %s aguarda sua aprovação (já aprovado por %s)',
             case when new.kind = 'adiantamento' then 'Adiantamento' else 'Reembolso' end,
             coalesce(new.requester_name, 'colaborador'),
             coalesce(new.first_decided_by_name, 'gestor')),
      new.code,
      case when new.kind = 'adiantamento' then '/adiantamentos/' else '/reembolsos/' end || new.id,
      new.id);
  end if;
  return new;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 3) Sino: rascunho enviado avisa o aprovador; autoaprovação não avisa ninguém
-- ----------------------------------------------------------------------------
create or replace function app_private.notif_reembolso_status()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare destino uuid; rota text; rotulo text;
begin
  if new.status = old.status then return null; end if;
  rota := case when new.kind = 'adiantamento' then '/adiantamentos/' else '/reembolsos/' end || new.id;
  rotulo := case when new.kind = 'adiantamento' then 'Adiantamento' else 'Reembolso' end;

  if old.status::text = 'rascunho' then
    -- Com segunda alçada o gatilho dela já avisou o aprovador de cima.
    if new.status::text = 'em_analise' and new.manager_id is not null and new.first_manager_id is null then
      perform app_private.notificar(app_private.colab_por_auth(new.manager_id), 'reembolso', 'sua_vez',
        format('%s de %s aguarda sua aprovação', rotulo, coalesce(new.requester_name, 'colaborador')),
        new.code, rota, new.id);
    end if;
    return null;
  end if;

  destino := app_private.colab_por_auth(new.requester_id);
  if new.status = 'aprovado' then
    perform app_private.notificar(destino, 'reembolso', 'concluida',
      format('%s %s aprovado', rotulo, coalesce(new.code, '')),
      case when new.approved_amount is not null and new.approved_amount < new.total
        then 'Aprovado com desconto — confira o valor aprovado.' else null end,
      rota, new.id);
  elsif new.status in ('reprovado', 'cancelado') then
    perform app_private.notificar(destino, 'reembolso', 'reprovada',
      format('%s %s %s', rotulo, coalesce(new.code, ''), new.status),
      new.decision_note, rota, new.id);
  end if;
  return null;
end $function$;

-- ----------------------------------------------------------------------------
-- 4) Envio ao cliente: rascunho autoaprovado segue o pedido criado aprovado
-- ----------------------------------------------------------------------------
create or replace function reembolso_private.marcar_envio_cliente()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if new.status::text = 'aprovado'
     and old.status::text is distinct from 'aprovado'
     and old.status::text is distinct from 'rascunho'
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
$function$;

commit;
