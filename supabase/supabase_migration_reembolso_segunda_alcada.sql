-- Migration: reembolso_segunda_alcada (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Aprovação em duas etapas no Reembolso (pedido de 16/09/2026).
--
-- Quando o gestor imediato é Diogo Soares, Paulo Paiva, Tulio Morais ou Ivano
-- Cruz, a aprovação dele não encerra o pedido: ele volta para "em análise" com
-- o Leonardo Drumond como aprovador. Só a aprovação do Leonardo vale como
-- aprovado (data de pagamento, PDF do cliente, e-mail ao solicitante).
--
-- Fica num GATILHO, e não na tela, para valer para qualquer caminho de
-- aprovação — inclusive o pedido do próprio gestor, que o formulário cria já
-- aprovado: esse também sobe para o Leonardo.
--
-- Quem sobe para quem está numa TABELA (reembolso_segunda_alcada), para trocar
-- sem mexer em código.
-- ============================================================================

create table if not exists public.reembolso_segunda_alcada (
  gestor_id uuid primary key references public.reembolso_profiles(id) on delete cascade,
  aprovador_id uuid not null references public.reembolso_profiles(id) on delete cascade,
  check (gestor_id <> aprovador_id)
);
alter table public.reembolso_segunda_alcada enable row level security;
drop policy if exists reembolso_segunda_alcada_select on public.reembolso_segunda_alcada;
create policy reembolso_segunda_alcada_select on public.reembolso_segunda_alcada
  for select to authenticated using (true);

-- 1ª etapa, gravada quando o pedido sobe. first_manager_id continua vendo o
-- pedido (RLS abaixo), mas não decide mais nada.
alter table public.reembolso_reimbursements
  add column if not exists first_manager_id uuid references public.reembolso_profiles(id),
  add column if not exists first_decided_by_name text,
  add column if not exists first_decided_at timestamptz,
  add column if not exists first_approved_amount numeric;

create or replace function reembolso_private.segunda_alcada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quem_aprovou uuid;
  sup uuid;
  sup_nome text;
begin
  -- Reenvio depois de reprovado: o pedido recomeça da 1ª etapa.
  if tg_op = 'UPDATE' and new.status::text = 'em_analise' and old.status::text <> 'em_analise' then
    new.first_manager_id := null;
    new.first_decided_by_name := null;
    new.first_decided_at := null;
    new.first_approved_amount := null;
    return new;
  end if;

  if new.status::text <> 'aprovado' then return new; end if;
  if tg_op = 'UPDATE' and (old.status::text <> 'em_analise' or old.first_manager_id is not null) then
    return new;
  end if;
  if tg_op = 'INSERT' and new.first_manager_id is not null then return new; end if;

  -- Quem está aprovando: o gestor do pedido, ou o próprio solicitante no
  -- pedido do gestor (que nasce aprovado e sem manager_id).
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
  -- reembolso: a data de pagamento sai da aprovação final. Adiantamento
  -- mantém a data que o solicitante informou.
  if coalesce(new.kind::text, 'reembolso') = 'reembolso' then new.payment_date := null; end if;
  new.accountability_status := null;

  -- Aviso no sino do Leonardo. No INSERT o gatilho de "novo pedido" já avisa.
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
$$;

drop trigger if exists reembolso_segunda_alcada on public.reembolso_reimbursements;
create trigger reembolso_segunda_alcada
  before insert or update of status on public.reembolso_reimbursements
  for each row execute function reembolso_private.segunda_alcada();

-- O gestor da 1ª etapa continua enxergando o pedido que aprovou.
create or replace function reembolso_private.can_view(rid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from reembolso_reimbursements r
    where r.id = rid
      and ( r.requester_id = auth.uid()
            or r.manager_id = auth.uid()
            or r.first_manager_id = auth.uid()
            or reembolso_private.is_admin() )
  );
$$;

drop policy if exists reembolso_reimb_select on public.reembolso_reimbursements;
create policy reembolso_reimb_select on public.reembolso_reimbursements
  for select using (
    requester_id = auth.uid() or manager_id = auth.uid()
    or first_manager_id = auth.uid() or reembolso_private.is_admin()
  );

-- Diogo, Paulo Paiva, Tulio e Ivano sobem para o Leonardo.
insert into public.reembolso_segunda_alcada (gestor_id, aprovador_id)
select g.id, l.id
  from reembolso_profiles g
  cross join (select id from reembolso_profiles where lower(email) = 'leonardo.drumond@phdengenharia.eng.br') l
 where lower(g.email) in (
   'diogo.soares@phdengenharia.eng.br',
   'paulo.paiva@phdengenharia.eng.br',
   'tulio.rafael@phdengenharia.eng.br',
   'ivano.cruz@phdengenharia.eng.br')
on conflict (gestor_id) do update set aprovador_id = excluded.aprovador_id;

notify pgrst, 'reload schema';
