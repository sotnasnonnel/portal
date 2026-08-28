-- Central de notificações do Portal
-- ---------------------------------------------------------------------------
-- Até aqui o portal só avisava por e-mail. Dentro do app, quem aprovava só
-- descobria que era a sua vez abrindo a tela, e quem pedia só descobria o
-- desfecho voltando lá.
--
-- Quem CRIA as notificações são GATILHOS no banco, não as telas. Duas razões:
--   1. a ação vale por qualquer caminho (tela, script, correção manual no
--      banco) — uma tela nova não tem como "esquecer" de notificar;
--   2. o cliente não precisa (nem pode) inserir notificação para outra pessoa,
--      o que fecharia a porta de forjar aviso em nome de terceiros.
--
-- Os eventos cobertos são os mesmos em todo fluxo de aprovação:
--   sua_vez    -> a etapa chegou em você
--   andamento  -> seu pedido andou (alguém aprovou e passou adiante)
--   concluida  -> desfecho positivo (aprovado/executado/pago)
--   reprovada  -> desfecho negativo (reprovado/cancelado)

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references colaboradores(id) on delete cascade,
  modulo text not null,          -- financeiro | reembolso | administrativo | dp | horas | programas
  tipo text not null,            -- sua_vez | andamento | concluida | reprovada
  titulo text not null,
  descricao text,
  href text,                     -- rota do portal para onde o clique leva
  referencia_id uuid,            -- registro de origem (etapa/solicitação/chamado)
  lida_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notificacoes_dest_idx
  on notificacoes (destinatario_id, created_at desc);
create index if not exists notificacoes_nao_lidas_idx
  on notificacoes (destinatario_id) where lida_em is null;
-- Guarda contra aviso repetido da MESMA vez: o gatilho de inserção e o de
-- decisão podem calcular a mesma etapa pendente. Vale só para 'sua_vez', que
-- referencia a etapa (estável); os demais tipos podem repetir de propósito —
-- uma ideia que anda três vezes gera três avisos.
create unique index if not exists notificacoes_vez_idx
  on notificacoes (destinatario_id, referencia_id)
  where tipo = 'sua_vez' and referencia_id is not null;

alter table notificacoes enable row level security;

drop policy if exists notificacoes_select on notificacoes;
create policy notificacoes_select on notificacoes
  for select using (destinatario_id = app_private.my_colaborador_id());

-- Update existe só para marcar como lida: a WITH CHECK impede repassar a
-- notificação para outra pessoa.
drop policy if exists notificacoes_update on notificacoes;
create policy notificacoes_update on notificacoes
  for update using (destinatario_id = app_private.my_colaborador_id())
  with check (destinatario_id = app_private.my_colaborador_id());

drop policy if exists notificacoes_delete on notificacoes;
create policy notificacoes_delete on notificacoes
  for delete using (destinatario_id = app_private.my_colaborador_id());

-- Sem policy de INSERT: só os gatilhos (security definer) criam.

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
create or replace function app_private.notificar(
  p_destinatario uuid,
  p_modulo text,
  p_tipo text,
  p_titulo text,
  p_descricao text default null,
  p_href text default null,
  p_referencia uuid default null
) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if p_destinatario is null then return; end if;
  insert into notificacoes (destinatario_id, modulo, tipo, titulo, descricao, href, referencia_id)
  values (p_destinatario, p_modulo, p_tipo, p_titulo, p_descricao, p_href, p_referencia)
  on conflict do nothing;   -- mesmo evento, mesma pessoa: avisa uma vez só
end $$;

/** Colaborador dono de um id de auth (o Reembolso guarda auth.uid, não colaborador). */
create or replace function app_private.colab_por_auth(p_auth uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from colaboradores where auth_id = p_auth limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Fluxos com ETAPAS (Financeiro, DP e Administrativo)
--    A "vez" é sempre a menor ordem ainda pendente.
-- ---------------------------------------------------------------------------

/** Financeiro: avisa quem está com a solicitação na mão agora. */
create or replace function app_private.notif_fin_vez(p_sol uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  e record;
  s record;
  destino uuid;
begin
  select * into s from solicitacoes_financeiro where id = p_sol;
  if s is null or s.status <> 'pendente' then return; end if;

  select * into e
    from solicitacoes_financeiro_etapas
   where solicitacao_id = p_sol and status = 'pendente'
     and tipo_etapa in ('aprovacao', 'execucao')
   order by ordem limit 1;
  if e is null then return; end if;

  if e.tipo_etapa = 'execucao' then
    -- Execução é de grupo: avisa todo o time do Financeiro.
    for destino in select id from colaboradores where financeiro_role = 'admin' and ativo is not false loop
      perform app_private.notificar(destino, 'financeiro', 'sua_vez',
        format('Solicitação #%s aguarda execução', coalesce(s.numero::text, '')),
        coalesce(s.nome_despesa, 'Solicitação do Financeiro'),
        '/financeiro/solicitacoes/acompanhar', e.id);
    end loop;
  elsif e.aprovador_id is not null then
    perform app_private.notificar(e.aprovador_id, 'financeiro', 'sua_vez',
      format('Solicitação #%s aguarda sua aprovação', coalesce(s.numero::text, '')),
      coalesce(s.nome_despesa, 'Solicitação do Financeiro'),
      '/financeiro/solicitacoes/acompanhar', e.id);
  end if;
end $$;

create or replace function app_private.notif_fin_etapas_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  -- Nível de STATEMENT: as etapas entram todas juntas na criação e a ordem das
  -- linhas não é garantida — linha a linha, a etapa 2 poderia se achar a "vez".
  for r in select distinct solicitacao_id from novas loop
    perform app_private.notif_fin_vez(r.solicitacao_id);
  end loop;
  return null;
end $$;

create or replace function app_private.notif_fin_etapa_decidida()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare s record; quem text;
begin
  if new.status = old.status then return null; end if;
  select * into s from solicitacoes_financeiro where id = new.solicitacao_id;
  if s is null then return null; end if;
  select nome into quem from colaboradores where id = new.aprovador_id;

  if new.status = 'aprovada' then
    -- O solicitante acompanha o andamento; o desfecho vem do gatilho da
    -- solicitação, para não avisar duas vezes a mesma coisa.
    perform app_private.notificar(s.solicitante_id, 'financeiro', 'andamento',
      format('Solicitação #%s aprovada por %s', coalesce(s.numero::text, ''), coalesce(quem, 'aprovador')),
      coalesce(s.nome_despesa, null),
      '/financeiro/solicitacoes/acompanhar', new.id);
    perform app_private.notif_fin_vez(new.solicitacao_id);
  end if;
  return null;
end $$;

create or replace function app_private.notif_fin_solicitacao()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = old.status then return null; end if;
  if new.status = 'concluida' then
    perform app_private.notificar(new.solicitante_id, 'financeiro', 'concluida',
      format('Solicitação #%s concluída', coalesce(new.numero::text, '')),
      'O Financeiro executou seu pedido.',
      '/financeiro/cartoes', new.id);
  elsif new.status = 'reprovada' then
    perform app_private.notificar(new.solicitante_id, 'financeiro', 'reprovada',
      format('Solicitação #%s reprovada', coalesce(new.numero::text, '')),
      coalesce(new.nome_despesa, null),
      '/financeiro/solicitacoes/acompanhar', new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_notif_fin_etapas_insert on solicitacoes_financeiro_etapas;
create trigger trg_notif_fin_etapas_insert
  after insert on solicitacoes_financeiro_etapas
  referencing new table as novas
  for each statement execute function app_private.notif_fin_etapas_insert();

drop trigger if exists trg_notif_fin_etapa_decidida on solicitacoes_financeiro_etapas;
create trigger trg_notif_fin_etapa_decidida
  after update of status on solicitacoes_financeiro_etapas
  for each row execute function app_private.notif_fin_etapa_decidida();

drop trigger if exists trg_notif_fin_solicitacao on solicitacoes_financeiro;
create trigger trg_notif_fin_solicitacao
  after update of status on solicitacoes_financeiro
  for each row execute function app_private.notif_fin_solicitacao();

/** DP / Requisições (solicitacoes_rh): quem abre é o gestor_id. */
create or replace function app_private.notif_rh_vez(p_sol uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare e record; s record;
begin
  select * into s from solicitacoes_rh where id = p_sol;
  if s is null or s.status <> 'pendente' then return; end if;

  select * into e from solicitacoes_rh_etapas
   where solicitacao_id = p_sol and status = 'pendente'
   order by ordem limit 1;
  if e is null or e.aprovador_id is null then return; end if;

  perform app_private.notificar(e.aprovador_id, 'dp', 'sua_vez',
    format('Requisição #%s aguarda sua aprovação', coalesce(s.numero::text, '')),
    coalesce(s.tipo, null), '/gestor/aprovacoes', e.id);
end $$;

create or replace function app_private.notif_rh_etapas_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  for r in select distinct solicitacao_id from novas loop
    perform app_private.notif_rh_vez(r.solicitacao_id);
  end loop;
  return null;
end $$;

create or replace function app_private.notif_rh_etapa_decidida()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare s record; quem text;
begin
  if new.status = old.status then return null; end if;
  select * into s from solicitacoes_rh where id = new.solicitacao_id;
  if s is null then return null; end if;
  select nome into quem from colaboradores where id = new.aprovador_id;

  if new.status = 'aprovada' then
    perform app_private.notificar(s.gestor_id, 'dp', 'andamento',
      format('Requisição #%s aprovada por %s', coalesce(s.numero::text, ''), coalesce(quem, 'aprovador')),
      coalesce(s.tipo, null), '/gestor/solicitacoes/acompanhar', new.id);
    perform app_private.notif_rh_vez(new.solicitacao_id);
  end if;
  return null;
end $$;

create or replace function app_private.notif_rh_solicitacao()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = old.status then return null; end if;
  if new.status = 'concluida' then
    perform app_private.notificar(new.gestor_id, 'dp', 'concluida',
      format('Requisição #%s concluída', coalesce(new.numero::text, '')),
      coalesce(new.tipo, null), '/gestor/solicitacoes/acompanhar', new.id);
  elsif new.status in ('reprovada', 'cancelada', 'devolvida') then
    perform app_private.notificar(new.gestor_id, 'dp', 'reprovada',
      format('Requisição #%s: %s', coalesce(new.numero::text, ''), new.status),
      coalesce(new.tipo, null), '/gestor/solicitacoes/acompanhar', new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_notif_rh_etapas_insert on solicitacoes_rh_etapas;
create trigger trg_notif_rh_etapas_insert
  after insert on solicitacoes_rh_etapas
  referencing new table as novas
  for each statement execute function app_private.notif_rh_etapas_insert();

drop trigger if exists trg_notif_rh_etapa_decidida on solicitacoes_rh_etapas;
create trigger trg_notif_rh_etapa_decidida
  after update of status on solicitacoes_rh_etapas
  for each row execute function app_private.notif_rh_etapa_decidida();

drop trigger if exists trg_notif_rh_solicitacao on solicitacoes_rh;
create trigger trg_notif_rh_solicitacao
  after update of status on solicitacoes_rh
  for each row execute function app_private.notif_rh_solicitacao();

/** Administrativo (chamados_adm). */
create or replace function app_private.notif_adm_vez(p_chamado uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare e record; c record;
begin
  select * into c from chamados_adm where id = p_chamado;
  if c is null or c.status not in ('aguardando_aprovacao') then return; end if;

  select * into e from chamados_adm_etapas
   where chamado_id = p_chamado and status = 'pendente'
   order by ordem limit 1;
  if e is null or e.aprovador_id is null then return; end if;

  perform app_private.notificar(e.aprovador_id, 'administrativo', 'sua_vez',
    format('Chamado #%s aguarda sua aprovação', coalesce(c.numero::text, '')),
    coalesce(c.assunto, null), '/administrativo/chamado/' || p_chamado, e.id);
end $$;

create or replace function app_private.notif_adm_etapas_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  for r in select distinct chamado_id from novas loop
    perform app_private.notif_adm_vez(r.chamado_id);
  end loop;
  return null;
end $$;

create or replace function app_private.notif_adm_etapa_decidida()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare c record; quem text;
begin
  if new.status = old.status then return null; end if;
  select * into c from chamados_adm where id = new.chamado_id;
  if c is null then return null; end if;
  select nome into quem from colaboradores where id = new.aprovador_id;

  if new.status = 'aprovada' then
    perform app_private.notificar(c.solicitante_id, 'administrativo', 'andamento',
      format('Chamado #%s aprovado por %s', coalesce(c.numero::text, ''), coalesce(quem, 'aprovador')),
      coalesce(c.assunto, null), '/administrativo/chamado/' || c.id, new.id);
    perform app_private.notif_adm_vez(new.chamado_id);
  end if;
  return null;
end $$;

create or replace function app_private.notif_adm_chamado()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = old.status then return null; end if;
  if new.status = 'fechado' then
    perform app_private.notificar(new.solicitante_id, 'administrativo', 'concluida',
      format('Chamado #%s foi concluído', coalesce(new.numero::text, '')),
      coalesce(new.assunto, null), '/administrativo/chamado/' || new.id, new.id);
  elsif new.status in ('reprovado', 'cancelado') then
    perform app_private.notificar(new.solicitante_id, 'administrativo', 'reprovada',
      format('Chamado #%s: %s', coalesce(new.numero::text, ''), new.status),
      coalesce(new.assunto, null), '/administrativo/chamado/' || new.id, new.id);
  elsif new.status = 'em_atendimento' and new.atendente_id is not null then
    perform app_private.notificar(new.atendente_id, 'administrativo', 'sua_vez',
      format('Chamado #%s está com você', coalesce(new.numero::text, '')),
      coalesce(new.assunto, null), '/administrativo/chamado/' || new.id, new.id);
  elsif new.status = 'aguardando_solicitante' then
    -- O Adm devolveu a bola: sem aviso, o chamado dorme esperando a pessoa.
    perform app_private.notificar(new.solicitante_id, 'administrativo', 'andamento',
      format('Chamado #%s aguarda você', coalesce(new.numero::text, '')),
      'O Administrativo precisa de uma informação sua.',
      '/administrativo/chamado/' || new.id, new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_notif_adm_etapas_insert on chamados_adm_etapas;
create trigger trg_notif_adm_etapas_insert
  after insert on chamados_adm_etapas
  referencing new table as novas
  for each statement execute function app_private.notif_adm_etapas_insert();

drop trigger if exists trg_notif_adm_etapa_decidida on chamados_adm_etapas;
create trigger trg_notif_adm_etapa_decidida
  after update of status on chamados_adm_etapas
  for each row execute function app_private.notif_adm_etapa_decidida();

drop trigger if exists trg_notif_adm_chamado on chamados_adm;
create trigger trg_notif_adm_chamado
  after update of status on chamados_adm
  for each row execute function app_private.notif_adm_chamado();

-- ---------------------------------------------------------------------------
-- 4. Reembolso — sem etapas: gestor imediato decide, Financeiro paga.
--    Os ids aqui são de AUTH (reembolso_profiles), não de colaboradores.
-- ---------------------------------------------------------------------------
create or replace function app_private.notif_reembolso_novo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare destino uuid; rota text;
begin
  if new.status <> 'em_analise' or new.manager_id is null then return null; end if;
  destino := app_private.colab_por_auth(new.manager_id);
  rota := case when new.kind = 'adiantamento' then '/adiantamentos/' else '/reembolsos/' end || new.id;
  perform app_private.notificar(destino, 'reembolso', 'sua_vez',
    format('%s de %s aguarda sua aprovação',
           case when new.kind = 'adiantamento' then 'Adiantamento' else 'Reembolso' end,
           coalesce(new.requester_name, 'colaborador')),
    coalesce(new.code, null), rota, new.id);
  return null;
end $$;

create or replace function app_private.notif_reembolso_status()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare destino uuid; rota text; rotulo text;
begin
  if new.status = old.status then return null; end if;
  destino := app_private.colab_por_auth(new.requester_id);
  rota := case when new.kind = 'adiantamento' then '/adiantamentos/' else '/reembolsos/' end || new.id;
  rotulo := case when new.kind = 'adiantamento' then 'Adiantamento' else 'Reembolso' end;

  if new.status = 'aprovado' then
    perform app_private.notificar(destino, 'reembolso', 'concluida',
      format('%s %s aprovado', rotulo, coalesce(new.code, '')),
      case when new.approved_amount is not null and new.approved_amount < new.total
        then 'Aprovado com desconto — confira o valor aprovado.' else null end,
      rota, new.id);
  elsif new.status in ('reprovado', 'cancelado') then
    perform app_private.notificar(destino, 'reembolso', 'reprovada',
      format('%s %s %s', rotulo, coalesce(new.code, ''), new.status),
      coalesce(new.decision_note, null), rota, new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_notif_reembolso_novo on reembolso_reimbursements;
create trigger trg_notif_reembolso_novo
  after insert on reembolso_reimbursements
  for each row execute function app_private.notif_reembolso_novo();

drop trigger if exists trg_notif_reembolso_status on reembolso_reimbursements;
create trigger trg_notif_reembolso_status
  after update of status on reembolso_reimbursements
  for each row execute function app_private.notif_reembolso_status();

-- ---------------------------------------------------------------------------
-- 5. Horas extras
-- ---------------------------------------------------------------------------
create or replace function app_private.notif_he_nova()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare quem text;
begin
  if new.status <> 'pendente' or new.aprovador_id is null then return null; end if;
  select nome into quem from colaboradores where id = new.colaborador_id;
  perform app_private.notificar(new.aprovador_id, 'horas', 'sua_vez',
    format('Hora extra #%s aguarda sua aprovação', coalesce(new.numero::text, '')),
    coalesce(quem, null), '/horas/extras/aprovacoes', new.id);
  return null;
end $$;

create or replace function app_private.notif_he_status()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = old.status then return null; end if;
  if new.status = 'aprovada' then
    perform app_private.notificar(new.colaborador_id, 'horas', 'concluida',
      format('Hora extra #%s aprovada', coalesce(new.numero::text, '')),
      null, '/horas/extras/minhas', new.id);
  elsif new.status in ('reprovada', 'cancelada') then
    perform app_private.notificar(new.colaborador_id, 'horas', 'reprovada',
      format('Hora extra #%s %s', coalesce(new.numero::text, ''), new.status),
      coalesce(new.motivo_reprovacao, null), '/horas/extras/minhas', new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_notif_he_nova on horas_extras_solicitacoes;
create trigger trg_notif_he_nova
  after insert on horas_extras_solicitacoes
  for each row execute function app_private.notif_he_nova();

drop trigger if exists trg_notif_he_status on horas_extras_solicitacoes;
create trigger trg_notif_he_status
  after update of status on horas_extras_solicitacoes
  for each row execute function app_private.notif_he_status();

-- ---------------------------------------------------------------------------
-- 6. Programas — o autor da ideia e quem indicou a oportunidade
-- ---------------------------------------------------------------------------
create or replace function app_private.notif_prog_ideia()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.situacao is not distinct from old.situacao then return null; end if;
  perform app_private.notificar(new.autor_id, 'programas', 'andamento',
    format('Sua ideia #%s: %s', coalesce(new.numero::text, ''), new.situacao),
    coalesce(new.titulo, null), '/programas/ideias', new.id);
  return null;
end $$;

create or replace function app_private.notif_prog_alavanca()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status is not distinct from old.status then return null; end if;
  perform app_private.notificar(new.indicado_por, 'programas', 'andamento',
    format('Sua indicação #%s: %s', coalesce(new.numero::text, ''), new.status),
    coalesce(new.oportunidade, null), '/programas/alavanca', new.id);
  return null;
end $$;

drop trigger if exists trg_notif_prog_ideia on programas_ideias;
create trigger trg_notif_prog_ideia
  after update of situacao on programas_ideias
  for each row execute function app_private.notif_prog_ideia();

drop trigger if exists trg_notif_prog_alavanca on programas_alavanca;
create trigger trg_notif_prog_alavanca
  after update of status on programas_alavanca
  for each row execute function app_private.notif_prog_alavanca();

-- ---------------------------------------------------------------------------
-- 7. Tempo real
-- ---------------------------------------------------------------------------
-- O sino escuta INSERT nesta tabela (filtrado pelo destinatário), então ela
-- precisa estar na publicação do Realtime. O `do $$` evita erro quando a
-- migração roda de novo.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table notificacoes;
  end if;
end $$;
