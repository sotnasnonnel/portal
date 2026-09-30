-- Migration: Adicional de Ausências (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do André (29/09/2026): registrar os dias ADICIONAIS combinados entre o
-- gestor e a equipe (folga dada por um projeto, por exemplo). Não é o controle
-- de ausência nem a Folga de Campo: é crédito de dias, por projeto, que depois
-- de aprovado soma no saldo da Ausência Programada.
--
-- Regras (decididas com o usuário em 30/09/2026):
--   - Só coordenador e gestor registram, e só para a própria equipe (quem está
--     abaixo deles no organograma, em qualquer nível). Nunca para si mesmo.
--   - Um registro por colaborador E projeto; a mesma pessoa pode ter vários.
--   - Aprova o superior de QUEM REGISTROU (subindo a árvore se ele não tem
--     login). RH/admin também decide. Sem superior, fica com o RH.
--   - Aprovado, o crédito entra no período EM USO do colaborador: data inicial
--     já chegou e data limite ainda não passou (o que vence primeiro, se houver
--     dois). Os dias vencem junto com o período.
--
-- O SALDO muda em TRÊS lugares, e precisa mudar nos três, senão uma tela mostra
-- um número e outra mostra outro:
--   1. app_private.ausencia_saldo       — trava do pedido (ausencia_salvar) e
--                                          da correção de tirados;
--   2. public.ausencia_periodos_listar  — painéis; ganha a coluna dias_adicionais;
--   3. public.ausencia_resumo_do_colaborador — aviso antes de tirar do controle.
-- As versões abaixo partem das que estão em
-- supabase_migration_ausencia_programada.sql (1) e
-- supabase_migration_ausencia_fora_do_controle.sql (2 e 3), só somando os
-- adicionais. Se alguma delas foi alterada no banco depois disso, conferir
-- antes de aplicar.
--
-- ORDEM DE DEPLOY: esta migração ANTES do front. O front novo chama as RPCs
-- ausencia_adicional_*; o front antigo continua funcionando com ela (a coluna
-- nova em ausencia_periodos_listar é ignorada).
--
-- Para derrubar: drop das funções ausencia_adicional_*, do gatilho e da tabela,
-- e reaplicar as três funções de saldo a partir dos arquivos citados acima.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Registros
-- ----------------------------------------------------------------------------
create table if not exists public.ausencia_adicionais (
  id              uuid primary key default gen_random_uuid(),
  numero          bigint,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  registrado_por  uuid not null references public.colaboradores(id),
  aprovador_id    uuid references public.colaboradores(id),
  -- Projeto da lista do portal (o mesmo do Horas) quando existe; o NOME vai
  -- sempre, porque obra nova ainda não cadastrada não pode travar o registro.
  projeto_id      uuid references public.horas_projetos(id) on delete set null,
  projeto_nome    text not null,
  dias            int not null,
  observacao      text,
  status          text not null default 'pendente'
                    check (status in ('pendente', 'aprovada', 'reprovada', 'cancelada')),
  -- Preenchido na aprovação: o período em uso, onde o crédito entra.
  periodo_id      uuid references public.ausencia_periodos(id) on delete restrict,
  motivo_reprovacao   text,
  motivo_cancelamento text,
  decidido_em     timestamptz,
  decidido_por    uuid references public.colaboradores(id),
  cancelado_em    timestamptz,
  cancelado_por   uuid references public.colaboradores(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  constraint aus_adic_dias check (dias > 0),
  constraint aus_adic_projeto check (nullif(trim(projeto_nome), '') is not null),
  constraint aus_adic_reprovacao check (status <> 'reprovada' or nullif(trim(motivo_reprovacao), '') is not null),
  constraint aus_adic_periodo check (status <> 'aprovada' or periodo_id is not null)
);

create sequence if not exists public.ausencia_adicionais_numero_seq
  owned by public.ausencia_adicionais.numero;
alter table public.ausencia_adicionais
  alter column numero set default nextval('public.ausencia_adicionais_numero_seq');
alter table public.ausencia_adicionais alter column numero set not null;
create unique index if not exists aus_adic_numero_key on public.ausencia_adicionais (numero);
create index if not exists aus_adic_colab_idx on public.ausencia_adicionais (colaborador_id);
create index if not exists aus_adic_aprov_idx on public.ausencia_adicionais (aprovador_id, status);
create index if not exists aus_adic_periodo_idx on public.ausencia_adicionais (periodo_id) where status = 'aprovada';

create or replace function app_private.ausencia_adicional_carimbo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists aus_adic_carimbo_trg on public.ausencia_adicionais;
create trigger aus_adic_carimbo_trg
before update on public.ausencia_adicionais
for each row execute function app_private.ausencia_adicional_carimbo();

-- RLS: só leitura direta, e só de quem tem a ver com o registro. Toda escrita
-- passa pelas RPCs abaixo (SECURITY DEFINER), que validam as regras.
alter table public.ausencia_adicionais enable row level security;
drop policy if exists aus_adic_select on public.ausencia_adicionais;
create policy aus_adic_select on public.ausencia_adicionais
for select to authenticated
using (
  app_private.is_ausencia_rh()
  or colaborador_id = app_private.my_colaborador_id()
  or registrado_por = app_private.my_colaborador_id()
  or aprovador_id = app_private.my_colaborador_id()
);

-- ----------------------------------------------------------------------------
-- 2) Helpers
-- ----------------------------------------------------------------------------
-- Aprovador: o superior de quem registrou, subindo se ele não tem login.
create or replace function app_private.ausencia_adicional_aprovador_de(p_colab uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_atual uuid;
  v_ok    uuid;
  v_depth int := 0;
begin
  select c.superior_id into v_atual from public.colaboradores c where c.id = p_colab;
  while v_atual is not null and v_depth < 60 loop
    select c.id into v_ok
    from public.colaboradores c
    where c.id = v_atual and c.ativo is distinct from false and c.auth_id is not null;
    if v_ok is not null then return v_ok; end if;
    select c.superior_id into v_atual from public.colaboradores c where c.id = v_atual;
    v_depth := v_depth + 1;
  end loop;
  return null;
end $$;
revoke all on function app_private.ausencia_adicional_aprovador_de(uuid) from public;

-- Período em uso: já pode ser usado e ainda não venceu. Havendo dois (o fim de
-- um sobrepõe o começo do outro), o que vence primeiro.
create or replace function app_private.ausencia_periodo_em_uso(p_colab uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.ausencia_periodos p
   where p.colaborador_id = p_colab
     and p.data_inicial <= current_date and p.data_limite >= current_date
   order by p.data_limite, p.inicio_periodo
   limit 1
$$;
revoke all on function app_private.ausencia_periodo_em_uso(uuid) from public;

-- Quem pode registrar: coordenador ou gestor.
create or replace function app_private.pode_registrar_adicional()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores c
     where c.id = app_private.my_colaborador_id()
       and c.perfil in ('gestor', 'coordenador')
  )
$$;
revoke all on function app_private.pode_registrar_adicional() from public;
grant execute on function app_private.pode_registrar_adicional() to authenticated;

-- Dias adicionais APROVADOS que caíram num período.
create or replace function app_private.ausencia_adicionais_do_periodo(p_periodo uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(a.dias), 0)::int
    from public.ausencia_adicionais a
   where a.periodo_id = p_periodo and a.status = 'aprovada'
$$;
revoke all on function app_private.ausencia_adicionais_do_periodo(uuid) from public;
grant execute on function app_private.ausencia_adicionais_do_periodo(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) O saldo passa a contar os adicionais (os três lugares)
-- ----------------------------------------------------------------------------
create or replace function app_private.ausencia_saldo(p_periodo uuid, p_ignorar uuid default null)
returns integer language sql stable security definer set search_path = '' as $$
  select p.dias_direito + p.dias_ajuste + app_private.ausencia_adicionais_do_periodo(p.id) - coalesce((
    select sum(s.dias)::int
    from public.ausencia_solicitacoes s
    where s.periodo_id = p.id
      and s.status in ('pendente', 'aprovada')
      and s.id is distinct from p_ignorar
  ), 0)
  from public.ausencia_periodos p
  where p.id = p_periodo
$$;

-- Muda o formato do retorno (coluna nova no fim): drop + create.
drop function if exists public.ausencia_periodos_listar(text);
create function public.ausencia_periodos_listar(p_escopo text default 'meus')
returns table (
  id uuid, colaborador_id uuid, colaborador_nome text, colaborador_funcao text,
  colaborador_formato text, superior_nome text,
  inicio_periodo date, fim_periodo date, data_inicial date, data_limite date,
  dias_direito int, dias_ajuste int, ajuste_motivo text, observacao text, origem text,
  dias_tirados int, dias_agendados int, dias_pendentes int, saldo int,
  dias_adicionais int
)
language sql stable security definer set search_path = '' as $$
  with me as (select app_private.my_colaborador_id() as id)
  select p.id, p.colaborador_id, c.nome, c.funcao, c.formato, sup.nome,
         p.inicio_periodo, p.fim_periodo, p.data_inicial, p.data_limite,
         p.dias_direito, p.dias_ajuste, p.ajuste_motivo, p.observacao, p.origem,
         coalesce(u.tirados, 0), coalesce(u.agendados, 0), coalesce(u.pendentes, 0),
         p.dias_direito + p.dias_ajuste + ad.dias
           - coalesce(u.tirados, 0) - coalesce(u.agendados, 0) - coalesce(u.pendentes, 0),
         ad.dias
  from public.ausencia_periodos p
  join public.colaboradores c on c.id = p.colaborador_id
  left join public.colaboradores sup on sup.id = c.superior_id
  left join lateral (
    select
      sum(s.dias) filter (where s.status = 'aprovada' and s.data_fim < current_date)::int  as tirados,
      sum(s.dias) filter (where s.status = 'aprovada' and s.data_fim >= current_date)::int as agendados,
      sum(s.dias) filter (where s.status = 'pendente')::int                                as pendentes
    from public.ausencia_solicitacoes s
    where s.periodo_id = p.id
  ) u on true
  cross join lateral (select app_private.ausencia_adicionais_do_periodo(p.id) as dias) ad
  cross join me
  where (p_escopo = 'meus' or c.ausencia_fora_do_controle is not true)
    and case p_escopo
          when 'meus'   then p.colaborador_id = me.id
          when 'equipe' then p.colaborador_id in (select app_private.descendentes(me.id))
          when 'todos'  then app_private.is_ausencia_rh()
          else false
        end
  order by c.nome, p.inicio_periodo desc
$$;
revoke all on function public.ausencia_periodos_listar(text) from public;
revoke execute on function public.ausencia_periodos_listar(text) from anon;
grant execute on function public.ausencia_periodos_listar(text) to authenticated;

create or replace function public.ausencia_resumo_do_colaborador(p_colaborador uuid)
returns table (periodos int, pedidos int, saldo int)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.ausencia_periodos p where p.colaborador_id = p_colaborador),
    (select count(*)::int from public.ausencia_solicitacoes s
      where s.colaborador_id = p_colaborador and s.status in ('pendente', 'aprovada')),
    coalesce((
      select sum(app_private.ausencia_saldo(p.id))::int
        from public.ausencia_periodos p where p.colaborador_id = p_colaborador
    ), 0)
  where app_private.is_ausencia_rh()
$$;
revoke all on function public.ausencia_resumo_do_colaborador(uuid) from public;
revoke execute on function public.ausencia_resumo_do_colaborador(uuid) from anon;
grant execute on function public.ausencia_resumo_do_colaborador(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) Leitura
-- ----------------------------------------------------------------------------
-- p_escopo: 'meus' (registrei ou são meus dias) | 'aprovar' | 'todos' (RH).
create or replace function public.ausencia_adicional_listar(p_escopo text default 'meus')
returns table (
  id uuid, numero bigint, status text,
  colaborador_id uuid, colaborador_nome text, colaborador_funcao text,
  registrado_por uuid, registrado_por_nome text,
  aprovador_id uuid, aprovador_nome text,
  projeto_id uuid, projeto_nome text, dias int, observacao text,
  periodo_id uuid, periodo_inicio date, periodo_fim date,
  motivo_reprovacao text, motivo_cancelamento text,
  decidido_em timestamptz, decidido_por_nome text, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with me as (select app_private.my_colaborador_id() as id)
  select a.id, a.numero, a.status,
         a.colaborador_id, c.nome, c.funcao,
         a.registrado_por, r.nome,
         a.aprovador_id, ap.nome,
         a.projeto_id, a.projeto_nome, a.dias, a.observacao,
         a.periodo_id, p.inicio_periodo, p.fim_periodo,
         a.motivo_reprovacao, a.motivo_cancelamento,
         a.decidido_em, d.nome, a.created_at
  from public.ausencia_adicionais a
  join public.colaboradores c on c.id = a.colaborador_id
  join public.colaboradores r on r.id = a.registrado_por
  left join public.colaboradores ap on ap.id = a.aprovador_id
  left join public.colaboradores d on d.id = a.decidido_por
  left join public.ausencia_periodos p on p.id = a.periodo_id
  cross join me
  where case p_escopo
          when 'meus'    then a.registrado_por = me.id or a.colaborador_id = me.id
          when 'aprovar' then a.aprovador_id = me.id
                              or (a.aprovador_id is null and app_private.is_ausencia_rh())
          when 'todos'   then app_private.is_ausencia_rh()
          else false
        end
  order by a.created_at desc
$$;
revoke all on function public.ausencia_adicional_listar(text) from public;
revoke execute on function public.ausencia_adicional_listar(text) from anon;
grant execute on function public.ausencia_adicional_listar(text) to authenticated;

-- Para quem EU posso registrar: a minha equipe, em qualquer nível.
create or replace function public.ausencia_adicional_equipe()
returns table (id uuid, nome text, funcao text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.funcao
    from public.colaboradores c
   where app_private.pode_registrar_adicional()
     and c.id in (select app_private.descendentes(app_private.my_colaborador_id()))
     and c.ativo is distinct from false
   order by c.nome
$$;
revoke all on function public.ausencia_adicional_equipe() from public;
revoke execute on function public.ausencia_adicional_equipe() from anon;
grant execute on function public.ausencia_adicional_equipe() to authenticated;

-- ----------------------------------------------------------------------------
-- 5) Escrita
-- ----------------------------------------------------------------------------
create or replace function public.ausencia_adicional_registrar(
  p_colaborador uuid,
  p_projeto_id uuid,
  p_projeto_nome text,
  p_dias int,
  p_observacao text default null
)
returns table (id uuid, numero bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_me   uuid := app_private.my_colaborador_id();
  v_nome text := nullif(trim(p_projeto_nome), '');
  v_id   uuid;
begin
  if v_me is null then
    raise exception 'Seu usuário não está vinculado a um colaborador.';
  end if;
  if not app_private.pode_registrar_adicional() then
    raise exception 'Só coordenadores e gestores registram dias adicionais.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_colaborador is null then
    raise exception 'Escolha o colaborador.';
  end if;
  if p_colaborador = v_me then
    raise exception 'Não é possível registrar dias adicionais para você mesmo.';
  end if;
  if p_colaborador not in (select app_private.descendentes(v_me)) then
    raise exception 'Este colaborador não é da sua equipe.';
  end if;
  -- Projeto da lista: o nome vem do cadastro, não do que o front mandou.
  if p_projeto_id is not null then
    select hp.nome into v_nome from public.horas_projetos hp where hp.id = p_projeto_id;
    if v_nome is null then raise exception 'Projeto não encontrado.'; end if;
  end if;
  if v_nome is null then
    raise exception 'Informe o projeto.';
  end if;
  if p_dias is null or p_dias < 1 then
    raise exception 'Informe a quantidade de dias adicionais (1 ou mais).';
  end if;

  insert into public.ausencia_adicionais as a
    (colaborador_id, registrado_por, aprovador_id, projeto_id, projeto_nome, dias, observacao)
  values
    (p_colaborador, v_me, app_private.ausencia_adicional_aprovador_de(v_me),
     p_projeto_id, v_nome, p_dias, nullif(trim(p_observacao), ''))
  returning a.id into v_id;

  return query select a.id, a.numero from public.ausencia_adicionais a where a.id = v_id;
end $$;
revoke all on function public.ausencia_adicional_registrar(uuid, uuid, text, int, text) from public;
revoke execute on function public.ausencia_adicional_registrar(uuid, uuid, text, int, text) from anon;
grant execute on function public.ausencia_adicional_registrar(uuid, uuid, text, int, text) to authenticated;

-- Decisão: o aprovador ou o RH. Aprovar grava o período em uso; sem período em
-- uso não há onde o crédito entrar, e a aprovação é recusada com o motivo.
create or replace function public.ausencia_adicional_decidir(p_id uuid, p_aprovar boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me      uuid := app_private.my_colaborador_id();
  v_reg     public.ausencia_adicionais;
  v_periodo uuid;
begin
  select * into v_reg from public.ausencia_adicionais a where a.id = p_id for update;
  if v_reg.id is null then
    raise exception 'Registro não encontrado.';
  end if;
  if not (v_reg.aprovador_id = v_me or app_private.is_ausencia_rh()) then
    raise exception 'Você não é o responsável por este registro.';
  end if;
  if v_reg.registrado_por = v_me or v_reg.colaborador_id = v_me then
    raise exception 'Não é possível decidir um registro seu.';
  end if;
  if v_reg.status <> 'pendente' then
    raise exception 'Este registro não está pendente de aprovação.';
  end if;
  if not p_aprovar and nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo da reprovação.';
  end if;

  if p_aprovar then
    v_periodo := app_private.ausencia_periodo_em_uso(v_reg.colaborador_id);
    if v_periodo is null then
      raise exception 'O colaborador não tem período em uso na Ausência Programada. Peça ao RH para cadastrar o período antes de aprovar.';
    end if;
  end if;

  update public.ausencia_adicionais a
     set status            = case when p_aprovar then 'aprovada' else 'reprovada' end,
         periodo_id        = v_periodo,
         motivo_reprovacao = case when p_aprovar then null else trim(p_motivo) end,
         decidido_em       = now(),
         decidido_por      = v_me
   where a.id = p_id;
end $$;
revoke all on function public.ausencia_adicional_decidir(uuid, boolean, text) from public;
revoke execute on function public.ausencia_adicional_decidir(uuid, boolean, text) from anon;
grant execute on function public.ausencia_adicional_decidir(uuid, boolean, text) to authenticated;

-- Cancelamento: quem registrou desiste do que ainda está pendente; o RH cancela
-- pendente ou aprovado (aprovado cancelado sai do saldo), sempre com motivo.
create or replace function public.ausencia_adicional_cancelar(p_id uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me  uuid := app_private.my_colaborador_id();
  v_reg public.ausencia_adicionais;
  v_rh  boolean := app_private.is_ausencia_rh();
begin
  select * into v_reg from public.ausencia_adicionais a where a.id = p_id for update;
  if v_reg.id is null then
    raise exception 'Registro não encontrado.';
  end if;
  if v_reg.status not in ('pendente', 'aprovada') then
    raise exception 'Só é possível cancelar um registro pendente ou aprovado.';
  end if;
  if v_reg.status = 'aprovada' and not v_rh then
    raise exception 'O registro já foi aprovado. Peça o cancelamento ao RH.';
  end if;
  if not (v_rh or v_reg.registrado_por = v_me) then
    raise exception 'Você não pode cancelar este registro.';
  end if;
  if v_rh and v_reg.registrado_por <> v_me and nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  update public.ausencia_adicionais a
     set status              = 'cancelada',
         motivo_cancelamento = nullif(trim(p_motivo), ''),
         cancelado_em        = now(),
         cancelado_por       = v_me
   where a.id = p_id;
end $$;
revoke all on function public.ausencia_adicional_cancelar(uuid, text) from public;
revoke execute on function public.ausencia_adicional_cancelar(uuid, text) from anon;
grant execute on function public.ausencia_adicional_cancelar(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Notificações (módulo 'dp') — por gatilho, como no resto do portal
-- ----------------------------------------------------------------------------
create or replace function app_private.notif_ausencia_adicional()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  quem  text;
  resumo text;
begin
  if tg_op = 'UPDATE' and new.status = old.status then return null; end if;
  select nome into quem from colaboradores where id = new.colaborador_id;
  resumo := format('%s · %s dia(s) · %s', quem, new.dias, new.projeto_nome);

  if new.status = 'pendente' then
    perform app_private.notificar(new.aprovador_id, 'dp', 'sua_vez',
      format('Adicional de ausência #%s aguarda sua aprovação', new.numero), resumo,
      '/adicional-ausencias/aprovacoes', new.id);
  elsif new.status = 'aprovada' then
    perform app_private.notificar(new.registrado_por, 'dp', 'concluida',
      format('Adicional de ausência #%s aprovado', new.numero), resumo,
      '/adicional-ausencias', new.id);
    -- O colaborador ganhou dias: ele precisa saber que o saldo mudou.
    perform app_private.notificar(new.colaborador_id, 'dp', 'concluida',
      format('Você ganhou %s dia(s) adicional(is) de ausência', new.dias), new.projeto_nome,
      '/ausencia-programada', new.id);
  elsif new.status = 'reprovada' then
    perform app_private.notificar(new.registrado_por, 'dp', 'reprovada',
      format('Adicional de ausência #%s reprovado', new.numero), new.motivo_reprovacao,
      '/adicional-ausencias', new.id);
  elsif new.status = 'cancelada' and tg_op = 'UPDATE' and old.status = 'aprovada' then
    perform app_private.notificar(new.colaborador_id, 'dp', 'reprovada',
      format('Adicional de ausência #%s cancelado', new.numero),
      coalesce(new.motivo_cancelamento, resumo), '/ausencia-programada', new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_notif_ausencia_adicional on public.ausencia_adicionais;
create trigger trg_notif_ausencia_adicional
after insert or update of status on public.ausencia_adicionais
for each row execute function app_private.notif_ausencia_adicional();

notify pgrst, 'reload schema';
