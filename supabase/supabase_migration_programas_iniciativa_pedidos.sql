-- ============================================================================
-- Pedido de uma iniciativa da Inovação para uma obra.
-- (Aplicada no portal_phd em 2026-08-28.)
--
-- A iniciativa mora no backoffice (view portal_inovacao_iniciativas), então
-- aqui guardamos o id DELA mais o título COPIADO: sem FK possível entre bancos,
-- e um pedido que perde o nome quando a Inovação renomeia a ferramenta vira
-- registro ilegível. O título é o que aquela pessoa pediu, naquele dia.
--
-- A obra é o código do organograma (obra_cod_phd), escolhido de lista — o mesmo
-- que o Cartão Virtual do Financeiro usa. Digitado à mão, nenhum relatório por
-- obra fecharia depois.
-- ============================================================================

create table if not exists public.programas_iniciativa_pedidos (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint generated always as identity,

  iniciativa_id     text not null,
  iniciativa_titulo text not null,

  obra_cod_phd      text not null,
  justificativa     text not null,

  status            text not null default 'recebido'
                      check (status in ('recebido', 'em_analise', 'aprovado', 'recusado', 'implantado')),
  -- Resposta da Inovação. Obrigatória para recusar é regra de tela, não do
  -- banco: recusa sem motivo é o tipo de coisa que volta como pergunta.
  resposta          text,

  solicitante_id    uuid not null references public.colaboradores(id) on delete restrict,
  criado_em         timestamptz not null default now(),
  respondido_em     timestamptz,
  respondido_por    uuid references public.colaboradores(id) on delete set null
);

create index if not exists programas_ini_pedidos_solicitante_idx
  on public.programas_iniciativa_pedidos (solicitante_id);
create index if not exists programas_ini_pedidos_criado_idx
  on public.programas_iniciativa_pedidos (criado_em desc);

alter table public.programas_iniciativa_pedidos enable row level security;

-- Ler: o que é meu; o admin do módulo vê a fila inteira.
drop policy if exists programas_ini_pedidos_select on public.programas_iniciativa_pedidos;
create policy programas_ini_pedidos_select on public.programas_iniciativa_pedidos
  for select to authenticated
  using (solicitante_id = app_private.my_colaborador_id() or app_private.is_programas_admin());

-- Pedir: em nome próprio. Sem o with check, daria para abrir pedido no nome de
-- outra pessoa e a fila da Inovação viraria terra de ninguém.
drop policy if exists programas_ini_pedidos_insert on public.programas_iniciativa_pedidos;
create policy programas_ini_pedidos_insert on public.programas_iniciativa_pedidos
  for insert to authenticated
  with check (solicitante_id = app_private.my_colaborador_id());

-- Responder é do admin do módulo: quem pede não decide o próprio pedido.
drop policy if exists programas_ini_pedidos_update on public.programas_iniciativa_pedidos;
create policy programas_ini_pedidos_update on public.programas_iniciativa_pedidos
  for update to authenticated
  using (app_private.is_programas_admin())
  with check (app_private.is_programas_admin());

-- Excluir: o autor enquanto ninguém tratou (desistiu), e o admin sempre.
drop policy if exists programas_ini_pedidos_delete on public.programas_iniciativa_pedidos;
create policy programas_ini_pedidos_delete on public.programas_iniciativa_pedidos
  for delete to authenticated
  using (
    (solicitante_id = app_private.my_colaborador_id() and status = 'recebido')
    or app_private.is_programas_admin()
  );

-- Aviso no sino para quem pediu, quando a Inovação responde. Mesmo formato do
-- que já existe para ideia e indicação (app_private.notif_prog_ideia).
create or replace function app_private.notif_prog_iniciativa_pedido()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.status is not distinct from old.status then return null; end if;
  perform app_private.notificar(new.solicitante_id, 'programas', 'andamento',
    format('Seu pedido #%s: %s', coalesce(new.numero::text, ''), new.status),
    new.iniciativa_titulo || ' — ' || new.obra_cod_phd,
    '/programas/iniciativas', new.id);
  return null;
end $fn$;

drop trigger if exists trg_notif_prog_iniciativa_pedido on public.programas_iniciativa_pedidos;
create trigger trg_notif_prog_iniciativa_pedido
  after update on public.programas_iniciativa_pedidos
  for each row execute function app_private.notif_prog_iniciativa_pedido();
