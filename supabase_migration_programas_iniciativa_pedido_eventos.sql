-- ============================================================================
-- Andamento do pedido de iniciativa: uma linha por passo, append-only.
-- (Aplicada no portal_phd em 2026-08-28.)
--
-- Sem isto, o pedido só mostra ONDE está — e a pergunta de quem pediu é
-- "andou?". A coluna status responde a primeira; só o histórico responde a
-- segunda, e é ele que diz quanto tempo o pedido passou em cada etapa.
--
-- Mesma forma do programas_ideias_eventos, que já existe. A diferença é que
-- aqui o evento é gravado por TRIGGER, e não pelo cliente: a resposta e a
-- mudança de status saem de um update só, e depender do navegador para
-- registrar o passo deixaria buraco no histórico sempre que a aba fechasse no
-- meio.
-- ============================================================================

create table if not exists public.programas_iniciativa_pedido_eventos (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.programas_iniciativa_pedidos(id) on delete cascade,
  tipo       text not null check (tipo in ('criado', 'status', 'resposta')),
  autor_id   uuid references public.colaboradores(id) on delete set null,
  de         text,
  para       text,
  resposta   text,
  criado_em  timestamptz not null default now()
);

create index if not exists programas_ini_pedido_eventos_idx
  on public.programas_iniciativa_pedido_eventos (pedido_id, criado_em);

alter table public.programas_iniciativa_pedido_eventos enable row level security;

-- Quem enxerga o pedido enxerga o andamento dele. A subconsulta repete a regra
-- do pai de propósito: uma policy que libera o histórico de todo mundo
-- entregaria, pelo texto das respostas, o que a fila do vizinho está pedindo.
drop policy if exists programas_ini_pedido_eventos_select on public.programas_iniciativa_pedido_eventos;
create policy programas_ini_pedido_eventos_select on public.programas_iniciativa_pedido_eventos
  for select to authenticated
  using (exists (
    select 1 from public.programas_iniciativa_pedidos p
     where p.id = pedido_id
       and (p.solicitante_id = app_private.my_colaborador_id() or app_private.is_programas_admin())
  ));

-- Ninguém escreve daqui: quem grava é o trigger (SECURITY DEFINER). Histórico
-- que o cliente pode escrever à mão não é histórico.

create or replace function app_private.prog_pedido_evento()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare autor uuid := app_private.my_colaborador_id();
begin
  if tg_op = 'INSERT' then
    insert into programas_iniciativa_pedido_eventos (pedido_id, tipo, autor_id, para)
    values (new.id, 'criado', new.solicitante_id, new.status);
    return null;
  end if;

  -- Um update pode mudar as duas coisas; cada uma vira seu passo, porque
  -- "mudou para aprovado" e "escreveu a resposta" são leituras diferentes.
  if new.status is distinct from old.status then
    insert into programas_iniciativa_pedido_eventos (pedido_id, tipo, autor_id, de, para, resposta)
    values (new.id, 'status', autor, old.status, new.status, new.resposta);
  elsif new.resposta is distinct from old.resposta then
    insert into programas_iniciativa_pedido_eventos (pedido_id, tipo, autor_id, resposta)
    values (new.id, 'resposta', autor, new.resposta);
  end if;
  return null;
end $fn$;

drop trigger if exists trg_prog_pedido_evento_ins on public.programas_iniciativa_pedidos;
create trigger trg_prog_pedido_evento_ins
  after insert on public.programas_iniciativa_pedidos
  for each row execute function app_private.prog_pedido_evento();

drop trigger if exists trg_prog_pedido_evento_upd on public.programas_iniciativa_pedidos;
create trigger trg_prog_pedido_evento_upd
  after update on public.programas_iniciativa_pedidos
  for each row execute function app_private.prog_pedido_evento();
