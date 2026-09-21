-- ============================================================================
-- Requisições (DP) — "Enviar para conhecimento" no DESLIGAMENTO
-- ----------------------------------------------------------------------------
-- Pedido do André (17/09): ao receber um desligamento, o DP avisava ADM e TI
-- pessoalmente para recolherem EPIs, computador e acessórios. Não vira etapa do
-- fluxo porque o desligamento pode ser confidencial: o DP escolhe, caso a caso,
-- QUEM fica sabendo.
--
-- Decisões (confirmadas com o Washington via Marcus, 18/09):
--   - o botão existe desde a abertura (não espera a aprovação terminar);
--   - só para desligamento;
--   - quem recebe apenas confirma "Ciente" (sem checklist de tarefas);
--   - sem grupos salvos: o DP escolhe as pessoas a cada envio.
--
-- Sigilo — o que o destinatário NÃO ganha:
--   - acesso à requisição (solicitacoes_rh continua fechada para ele);
--   - justificativa e iniciativa. Ele vê só nome, função e data prevista, pela
--     RPC desligamento_ciencia_minhas, que devolve colunas escolhidas.
-- Quem tem pode_ver_desligamento = false não pode enviar nem receber.
--
-- Aditivo e idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela
-- ----------------------------------------------------------------------------
create table if not exists public.solicitacoes_rh_ciencia (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes_rh(id) on delete cascade,
  destinatario_id uuid not null references public.colaboradores(id) on delete cascade,
  enviado_por uuid references public.colaboradores(id) on delete set null,
  enviado_em timestamptz not null default now(),
  observacao text,
  ciente_em timestamptz,
  -- Marca que o e-mail saiu: a Edge Function só manda para quem ainda não
  -- recebeu, então chamar duas vezes não duplica.
  email_enviado_em timestamptz,
  constraint solic_ciencia_unica unique (solicitacao_id, destinatario_id)
);

create index if not exists solic_ciencia_dest_idx
  on public.solicitacoes_rh_ciencia (destinatario_id, enviado_em desc);

alter table public.solicitacoes_rh_ciencia enable row level security;

-- Leitura: o próprio destinatário e o DP que pode ver desligamento.
-- Escrita só pelas RPCs abaixo (security definer) — sem policy de escrita.
drop policy if exists solic_ciencia_select on public.solicitacoes_rh_ciencia;
create policy solic_ciencia_select on public.solicitacoes_rh_ciencia
for select to authenticated
using (
  destinatario_id = app_private.my_colaborador_id()
  or (app_private.is_admin() and not app_private.oculta_desligamento())
);

revoke all on public.solicitacoes_rh_ciencia from anon;
grant select on public.solicitacoes_rh_ciencia to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Enviar (DP)
-- ----------------------------------------------------------------------------
create or replace function public.desligamento_enviar_ciencia(
  p_solicitacao uuid,
  p_destinatarios uuid[],
  p_observacao text default null
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_eu uuid := app_private.my_colaborador_id();
  v_sol record;
  v_nome text;
  v_data text;
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_novos int := 0;
  r record;
begin
  if not app_private.is_admin() or app_private.oculta_desligamento() then
    raise exception 'Sem permissão para enviar avisos de desligamento.';
  end if;

  select s.id, s.numero, s.tipo, s.status, s.colaborador_id, s.justificativa
    into v_sol
    from public.solicitacoes_rh s
   where s.id = p_solicitacao;
  if v_sol.id is null then raise exception 'Requisição não encontrada.'; end if;
  if v_sol.tipo <> 'desligamento' then
    raise exception 'O envio para conhecimento vale só para desligamento.';
  end if;
  if v_sol.status = 'cancelada' then
    raise exception 'Esta requisição foi cancelada.';
  end if;

  -- O próprio desligado nunca pode ser avisado por aqui.
  if v_sol.colaborador_id = any (coalesce(p_destinatarios, '{}')) then
    raise exception 'O colaborador que será desligado não pode receber o aviso.';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_destinatarios, '{}')) d(id)
      left join public.colaboradores c on c.id = d.id
     where c.id is null or c.ativo is false or c.pode_ver_desligamento = false
  ) then
    raise exception 'Há destinatário inativo ou sem permissão para ver desligamentos.';
  end if;

  select nome into v_nome from public.colaboradores where id = v_sol.colaborador_id;
  v_data := substring(v_sol.justificativa from 'Data solicitada para desligamento: ([^\n]*)');

  for r in
    insert into public.solicitacoes_rh_ciencia (solicitacao_id, destinatario_id, enviado_por, observacao)
    select p_solicitacao, d.id, v_eu, v_obs
      from (select distinct unnest(p_destinatarios) as id) d
    on conflict (solicitacao_id, destinatario_id) do nothing
    returning id, destinatario_id
  loop
    v_novos := v_novos + 1;
    perform app_private.notificar(
      r.destinatario_id, 'dp', 'sua_vez',
      format('Desligamento de %s: para conhecimento', coalesce(v_nome, 'colaborador')),
      case when v_data is not null
        then format('Data prevista: %s. Veja o que recolher.', v_data)
        else 'Veja o que recolher.' end,
      '/conhecimento', r.id);
  end loop;

  return v_novos;
end $$;

revoke all on function public.desligamento_enviar_ciencia(uuid, uuid[], text) from public;
revoke execute on function public.desligamento_enviar_ciencia(uuid, uuid[], text) from anon;
grant execute on function public.desligamento_enviar_ciencia(uuid, uuid[], text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Ler os próprios avisos (destinatário)
-- ----------------------------------------------------------------------------
-- Devolve só o necessário para o recolhimento. `itens`: EPIs e uniformes que o
-- Estoque registrou como entregues à pessoa (saídas nominais).
create or replace function public.desligamento_ciencia_minhas()
returns table (
  id uuid,
  numero bigint,
  status text,
  colaborador_nome text,
  colaborador_funcao text,
  data_prevista text,
  enviado_por_nome text,
  enviado_em timestamptz,
  observacao text,
  ciente_em timestamptz,
  itens jsonb
)
language sql stable security definer set search_path = '' as $$
  select
    ci.id,
    s.numero,
    s.status,
    col.nome,
    col.funcao,
    substring(s.justificativa from 'Data solicitada para desligamento: ([^\n]*)'),
    env.nome,
    ci.enviado_em,
    ci.observacao,
    ci.ciente_em,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'descricao', x.descricao, 'tamanho', x.tamanho, 'quantidade', x.qtd)
             order by x.descricao)
        from (
          select it.descricao, v.tamanho, sum(-m.quantidade)::int as qtd
            from public.estoque_movimentos m
            join public.estoque_variantes v on v.id = m.variante_id
            join public.estoque_itens it on it.id = v.item_id
           where m.colaborador_id = s.colaborador_id and m.tipo = 'saida'
           group by it.descricao, v.tamanho
        ) x
    ), '[]'::jsonb)
  from public.solicitacoes_rh_ciencia ci
  join public.solicitacoes_rh s on s.id = ci.solicitacao_id
  left join public.colaboradores col on col.id = s.colaborador_id
  left join public.colaboradores env on env.id = ci.enviado_por
  where ci.destinatario_id = app_private.my_colaborador_id()
    and not app_private.oculta_desligamento()
  order by ci.enviado_em desc
$$;

revoke all on function public.desligamento_ciencia_minhas() from public;
revoke execute on function public.desligamento_ciencia_minhas() from anon;
grant execute on function public.desligamento_ciencia_minhas() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Dar ciência (destinatário)
-- ----------------------------------------------------------------------------
create or replace function public.desligamento_ciencia_marcar(p_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.solicitacoes_rh_ciencia
     set ciente_em = now()
   where id = p_id
     and destinatario_id = app_private.my_colaborador_id()
     and ciente_em is null;
  return found;
end $$;

revoke all on function public.desligamento_ciencia_marcar(uuid) from public;
revoke execute on function public.desligamento_ciencia_marcar(uuid) from anon;
grant execute on function public.desligamento_ciencia_marcar(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Cancelou depois do aviso: quem foi avisado precisa saber
-- ----------------------------------------------------------------------------
-- Só 'cancelada' é definitivo. 'reprovada' volta a andar quando o solicitante
-- responde, então não dispara aviso — a tela do destinatário mostra a situação.
create or replace function app_private.notif_ciencia_cancelada()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r record; v_nome text;
begin
  if new.tipo <> 'desligamento' or new.status is not distinct from old.status
     or new.status <> 'cancelada' then
    return null;
  end if;
  select nome into v_nome from colaboradores where id = new.colaborador_id;
  for r in select id, destinatario_id from solicitacoes_rh_ciencia where solicitacao_id = new.id loop
    perform app_private.notificar(r.destinatario_id, 'dp', 'reprovada',
      format('Desligamento de %s cancelado', coalesce(v_nome, 'colaborador')),
      'Desconsidere o aviso anterior: não há recolhimento a fazer.',
      '/conhecimento', r.id);
  end loop;
  return null;
end $$;

drop trigger if exists trg_notif_ciencia_cancelada on public.solicitacoes_rh;
create trigger trg_notif_ciencia_cancelada
  after update of status on public.solicitacoes_rh
  for each row execute function app_private.notif_ciencia_cancelada();

notify pgrst, 'reload schema';
