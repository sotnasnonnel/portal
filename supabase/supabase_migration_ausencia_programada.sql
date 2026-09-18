-- Migration: ausencia_programada (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- AUSÊNCIA PROGRAMADA — card novo da Gestão de Pessoas.
-- Briefing: referencia/alinhamento_ausencia_programada.txt
-- Planilha de origem: referencia/Controle de Ausência SC e PJ Consolidado 1.xlsx
--
-- Nomenclatura obrigatória na interface: ausência programada, ausência, saldo,
-- data limite, período. A palavra "férias" não aparece na interface.
--
-- Decisões (2026-09-17):
--  * Tabelas NOVAS. O legado (ciclos_ausencia, telas /usuario e
--    /gestor/ausencia) fica com cadeado e sai depois do piloto: guardava um
--    agendamento só por período, com status em texto livre e sem aprovador.
--  * Qualquer modalidade usa (CLT, PJ, Sócio Cotista, Diretoria).
--  * Dias CORRIDOS: fim = início + dias - 1, como na planilha.
--  * APROVADOR = superior direto (colaboradores.superior_id), resolvido no
--    envio. Se ele estiver inativo ou sem login, sobe a árvore — mesma regra de
--    horas_extras_meu_aprovador(). O RH/admin também decide (reserva para quem
--    não tem ninguém acima).
--  * Fora da data limite: AVISA e deixa enviar (o gestor decide). Antes da data
--    inicial do período: BLOQUEIA (período aquisitivo ainda não completo).
--  * Saldo do período = dias_direito + dias_ajuste - (pendentes + aprovadas).
--    Pendente já reserva saldo, para dois pedidos em paralelo não gastarem o
--    mesmo dia.
--  * "Concluída" não é gravada: é a aprovada cujo fim já passou (a tela deriva).
--  * Todas as ESCRITAS do colaborador e do gestor passam por RPC com a regra
--    explícita e erro legível. A escrita direta nas tabelas é só do RH
--    (importação e correção). Um UPDATE barrado pela RLS não gera erro — por
--    isso o fluxo não depende dele.
--  * Não há pg_cron neste projeto: o alerta de vencimento (3 meses antes da
--    data limite) é gerado por ausencia_gerar_alertas(), idempotente, chamada
--    quando alguém abre o módulo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Helpers
-- ----------------------------------------------------------------------------
-- RH da ausência programada: acompanha todos, importa e corrige períodos.
create or replace function app_private.is_ausencia_rh()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_rh_dp()
      or app_private.is_admin()
      or app_private.is_portal_super_admin()
$$;
revoke all on function app_private.is_ausencia_rh() from public;
grant execute on function app_private.is_ausencia_rh() to authenticated;

-- Quem decide a ausência de um colaborador: o superior direto ou, se ele não
-- consegue entrar no portal, o primeiro acima dele que consegue.
create or replace function app_private.ausencia_aprovador_de(p_colab uuid)
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
    if v_ok is not null then
      return v_ok;
    end if;
    select c.superior_id into v_atual from public.colaboradores c where c.id = v_atual;
    v_depth := v_depth + 1;
  end loop;
  return null;
end $$;
revoke all on function app_private.ausencia_aprovador_de(uuid) from public;

-- ----------------------------------------------------------------------------
-- 1) Períodos (saldo por período de referência)
-- ----------------------------------------------------------------------------
create table if not exists public.ausencia_periodos (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  -- Período aquisitivo: começa no aniversário da data de referência (admissão
  -- ou mudança de modalidade) e dura um ano.
  inicio_periodo  date not null,
  fim_periodo     date not null,
  -- Janela de uso: a partir de data_inicial, até data_limite.
  data_inicial    date not null,
  data_limite     date not null,
  dias_direito    int  not null default 21 check (dias_direito >= 0),
  -- Correção do RH (sobra levada de outro período, acerto de planilha...).
  -- Pode ser negativa. Sempre com motivo.
  dias_ajuste     int  not null default 0,
  ajuste_motivo   text,
  observacao      text,
  origem          text not null default 'automatico'
                    check (origem in ('automatico', 'importacao', 'manual')),
  -- Carimbo do alerta de vencimento (evita avisar duas vezes).
  alerta_vencimento_em timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  atualizado_por  uuid references public.colaboradores(id),
  constraint aus_per_datas check (fim_periodo > inicio_periodo and data_limite >= data_inicial),
  constraint aus_per_ajuste_motivo check (dias_ajuste = 0 or nullif(trim(ajuste_motivo), '') is not null),
  constraint aus_per_unico unique (colaborador_id, inicio_periodo)
);
create index if not exists ausencia_periodos_limite_idx on public.ausencia_periodos (data_limite);

-- ----------------------------------------------------------------------------
-- 2) Solicitações
-- ----------------------------------------------------------------------------
create table if not exists public.ausencia_solicitacoes (
  id              uuid primary key default gen_random_uuid(),
  numero          bigint,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  periodo_id      uuid not null references public.ausencia_periodos(id) on delete restrict,
  aprovador_id    uuid references public.colaboradores(id),
  data_inicio     date not null,
  data_fim        date not null,
  dias            int generated always as (data_fim - data_inicio + 1) stored,
  observacao      text,
  status          text not null default 'rascunho'
                    check (status in ('rascunho', 'pendente', 'aprovada', 'reprovada', 'cancelada')),
  -- Snapshot do envio: o fim passava da data limite do período.
  fora_do_prazo   boolean not null default false,
  origem          text not null default 'portal' check (origem in ('portal', 'importacao')),
  motivo_reprovacao   text,
  motivo_cancelamento text,
  enviado_em      timestamptz,
  decidido_em     timestamptz,
  decidido_por    uuid references public.colaboradores(id),
  cancelado_em    timestamptz,
  cancelado_por   uuid references public.colaboradores(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  constraint aus_sol_datas check (data_fim >= data_inicio),
  constraint aus_sol_reprovacao check (status <> 'reprovada' or nullif(trim(motivo_reprovacao), '') is not null)
);

create sequence if not exists public.ausencia_solicitacoes_numero_seq
  owned by public.ausencia_solicitacoes.numero;
alter table public.ausencia_solicitacoes
  alter column numero set default nextval('public.ausencia_solicitacoes_numero_seq');
alter table public.ausencia_solicitacoes alter column numero set not null;
create unique index if not exists ausencia_solic_numero_key on public.ausencia_solicitacoes (numero);
create index if not exists ausencia_solic_colab_idx on public.ausencia_solicitacoes (colaborador_id, data_inicio);
create index if not exists ausencia_solic_aprov_idx on public.ausencia_solicitacoes (aprovador_id, status);
create index if not exists ausencia_solic_periodo_idx on public.ausencia_solicitacoes (periodo_id);

-- Solicitação sempre no período do próprio colaborador (vale também para a
-- escrita direta do RH).
create or replace function app_private.ausencia_sol_confere_periodo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.ausencia_periodos p
    where p.id = new.periodo_id and p.colaborador_id = new.colaborador_id
  ) then
    raise exception 'O período informado não pertence a este colaborador.';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists ausencia_sol_confere_periodo_trg on public.ausencia_solicitacoes;
create trigger ausencia_sol_confere_periodo_trg
before insert or update on public.ausencia_solicitacoes
for each row execute function app_private.ausencia_sol_confere_periodo();

create or replace function app_private.ausencia_per_carimbo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- O carimbo do alerta (ausencia_gerar_alertas) não é edição de ninguém.
  if new.alerta_vencimento_em is distinct from old.alerta_vencimento_em then
    return new;
  end if;
  new.updated_at := now();
  new.atualizado_por := app_private.my_colaborador_id();
  return new;
end $$;
drop trigger if exists ausencia_per_carimbo_trg on public.ausencia_periodos;
create trigger ausencia_per_carimbo_trg
before update on public.ausencia_periodos
for each row execute function app_private.ausencia_per_carimbo();

-- ----------------------------------------------------------------------------
-- 3) Saldo
-- ----------------------------------------------------------------------------
-- Dias que o período ainda tem, sem contar a solicitação p_ignorar (a que está
-- sendo editada/enviada).
create or replace function app_private.ausencia_saldo(p_periodo uuid, p_ignorar uuid default null)
returns int language sql stable security definer set search_path = '' as $$
  select p.dias_direito + p.dias_ajuste - coalesce((
    select sum(s.dias)::int
    from public.ausencia_solicitacoes s
    where s.periodo_id = p.id
      and s.status in ('pendente', 'aprovada')
      and s.id is distinct from p_ignorar
  ), 0)
  from public.ausencia_periodos p
  where p.id = p_periodo
$$;
revoke all on function app_private.ausencia_saldo(uuid, uuid) from public;

-- ============================================================================
-- 4) RLS — leitura por escopo; escrita direta só do RH
-- ============================================================================
alter table public.ausencia_periodos     enable row level security;
alter table public.ausencia_solicitacoes enable row level security;

drop policy if exists ausencia_periodos_select on public.ausencia_periodos;
create policy ausencia_periodos_select on public.ausencia_periodos
for select to authenticated
using (
  app_private.is_ausencia_rh()
  or colaborador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

drop policy if exists ausencia_periodos_rh on public.ausencia_periodos;
create policy ausencia_periodos_rh on public.ausencia_periodos
for all to authenticated
using ( app_private.is_ausencia_rh() )
with check ( app_private.is_ausencia_rh() );

drop policy if exists ausencia_solic_select on public.ausencia_solicitacoes;
create policy ausencia_solic_select on public.ausencia_solicitacoes
for select to authenticated
using (
  app_private.is_ausencia_rh()
  or colaborador_id = app_private.my_colaborador_id()
  or aprovador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

drop policy if exists ausencia_solic_rh on public.ausencia_solicitacoes;
create policy ausencia_solic_rh on public.ausencia_solicitacoes
for all to authenticated
using ( app_private.is_ausencia_rh() )
with check ( app_private.is_ausencia_rh() );

-- ============================================================================
-- 5) RPCs de leitura (com nomes resolvidos — o RH sem perfil admin não lê
--    colaboradores da empresa toda pela RLS)
-- ============================================================================

-- p_escopo: 'meus' | 'equipe' (subárvore de quem chama) | 'todos' (só RH).
create or replace function public.ausencia_periodos_listar(p_escopo text default 'meus')
returns table (
  id uuid, colaborador_id uuid, colaborador_nome text, colaborador_funcao text,
  colaborador_formato text, superior_nome text,
  inicio_periodo date, fim_periodo date, data_inicial date, data_limite date,
  dias_direito int, dias_ajuste int, ajuste_motivo text, observacao text, origem text,
  dias_tirados int, dias_agendados int, dias_pendentes int, saldo int
)
language sql stable security definer set search_path = '' as $$
  with me as (select app_private.my_colaborador_id() as id)
  select p.id, p.colaborador_id, c.nome, c.funcao, c.formato, sup.nome,
         p.inicio_periodo, p.fim_periodo, p.data_inicial, p.data_limite,
         p.dias_direito, p.dias_ajuste, p.ajuste_motivo, p.observacao, p.origem,
         coalesce(u.tirados, 0), coalesce(u.agendados, 0), coalesce(u.pendentes, 0),
         p.dias_direito + p.dias_ajuste
           - coalesce(u.tirados, 0) - coalesce(u.agendados, 0) - coalesce(u.pendentes, 0)
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
  cross join me
  where case p_escopo
          when 'meus'   then p.colaborador_id = me.id
          when 'equipe' then p.colaborador_id in (select app_private.descendentes(me.id))
          when 'todos'  then app_private.is_ausencia_rh()
          else false
        end
  order by c.nome, p.inicio_periodo
$$;
revoke all on function public.ausencia_periodos_listar(text) from public;
revoke execute on function public.ausencia_periodos_listar(text) from anon;
grant execute on function public.ausencia_periodos_listar(text) to authenticated;

-- p_escopo: 'meus' | 'aprovar' (onde sou o aprovador) | 'equipe' | 'todos' (RH).
create or replace function public.ausencia_solicitacoes_listar(p_escopo text default 'meus')
returns table (
  id uuid, numero bigint, status text, origem text, fora_do_prazo boolean,
  colaborador_id uuid, colaborador_nome text, colaborador_funcao text,
  aprovador_id uuid, aprovador_nome text,
  periodo_id uuid, inicio_periodo date, fim_periodo date, data_inicial date, data_limite date,
  saldo_periodo int,
  data_inicio date, data_fim date, dias int, observacao text,
  motivo_reprovacao text, motivo_cancelamento text,
  enviado_em timestamptz, decidido_em timestamptz, decidido_por_nome text,
  cancelado_em timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with me as (select app_private.my_colaborador_id() as id)
  select s.id, s.numero, s.status, s.origem, s.fora_do_prazo,
         s.colaborador_id, c.nome, c.funcao,
         s.aprovador_id, a.nome,
         s.periodo_id, p.inicio_periodo, p.fim_periodo, p.data_inicial, p.data_limite,
         app_private.ausencia_saldo(p.id),
         s.data_inicio, s.data_fim, s.dias, s.observacao,
         s.motivo_reprovacao, s.motivo_cancelamento,
         s.enviado_em, s.decidido_em, d.nome,
         s.cancelado_em, s.created_at
  from public.ausencia_solicitacoes s
  join public.colaboradores c on c.id = s.colaborador_id
  join public.ausencia_periodos p on p.id = s.periodo_id
  left join public.colaboradores a on a.id = s.aprovador_id
  left join public.colaboradores d on d.id = s.decidido_por
  cross join me
  where case p_escopo
          when 'meus'    then s.colaborador_id = me.id
          when 'aprovar' then s.status <> 'rascunho'
                              and (s.aprovador_id = me.id
                                   or (s.aprovador_id is null and app_private.is_ausencia_rh()))
          when 'equipe'  then s.status <> 'rascunho'
                              and s.colaborador_id in (select app_private.descendentes(me.id))
          when 'todos'   then s.status <> 'rascunho' and app_private.is_ausencia_rh()
          else false
        end
  order by s.data_inicio desc, s.numero desc
$$;
revoke all on function public.ausencia_solicitacoes_listar(text) from public;
revoke execute on function public.ausencia_solicitacoes_listar(text) from anon;
grant execute on function public.ausencia_solicitacoes_listar(text) to authenticated;

-- Quem vai decidir a MINHA ausência (para a tela mostrar antes do envio).
create or replace function public.ausencia_meu_aprovador()
returns table (id uuid, nome text, email text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.email
  from public.colaboradores c
  where c.id = app_private.ausencia_aprovador_de(app_private.my_colaborador_id())
$$;
revoke all on function public.ausencia_meu_aprovador() from public;
revoke execute on function public.ausencia_meu_aprovador() from anon;
grant execute on function public.ausencia_meu_aprovador() to authenticated;

-- Colaboradores ativos SEM nenhum período (o RH precisa cadastrar o saldo).
create or replace function public.ausencia_sem_periodo()
returns table (id uuid, nome text, funcao text, formato text, data_admissao date)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.funcao, c.formato, c.data_admissao
  from public.colaboradores c
  where app_private.is_ausencia_rh()
    and c.ativo is distinct from false
    and c.auth_id is not null
    and not exists (select 1 from public.ausencia_periodos p where p.colaborador_id = c.id)
  order by c.nome
$$;
revoke all on function public.ausencia_sem_periodo() from public;
revoke execute on function public.ausencia_sem_periodo() from anon;
grant execute on function public.ausencia_sem_periodo() to authenticated;

-- ============================================================================
-- 6) RPCs de escrita
-- ============================================================================

-- Cria ou edita um pedido do PRÓPRIO colaborador. p_enviar = true manda para
-- aprovação (valida saldo, data inicial e sobreposição); false guarda rascunho.
-- Devolve o id e se o pedido saiu fora do prazo (aviso para a tela).
create or replace function public.ausencia_salvar(
  p_id uuid,
  p_periodo uuid,
  p_inicio date,
  p_fim date,
  p_observacao text default null,
  p_enviar boolean default true
)
returns table (id uuid, numero bigint, fora_do_prazo boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_me     uuid := app_private.my_colaborador_id();
  v_per    public.ausencia_periodos;
  v_atual  public.ausencia_solicitacoes;
  v_dias   int;
  v_saldo  int;
  v_fora   boolean;
  v_id     uuid;
begin
  if v_me is null then
    raise exception 'Seu usuário não está vinculado a um colaborador.';
  end if;
  if p_inicio is null or p_fim is null then
    raise exception 'Informe a data de início e a data fim.';
  end if;
  if p_fim < p_inicio then
    raise exception 'A data fim não pode ser anterior à data de início.';
  end if;

  select * into v_per from public.ausencia_periodos p where p.id = p_periodo;
  if v_per.id is null or v_per.colaborador_id <> v_me then
    raise exception 'Período de referência inválido.';
  end if;

  if p_id is not null then
    select * into v_atual from public.ausencia_solicitacoes s where s.id = p_id for update;
    if v_atual.id is null or v_atual.colaborador_id <> v_me then
      raise exception 'Solicitação não encontrada.';
    end if;
    if v_atual.status <> 'rascunho' then
      raise exception 'Só é possível editar uma solicitação em rascunho.';
    end if;
  end if;

  v_dias := p_fim - p_inicio + 1;
  v_fora := p_fim > v_per.data_limite;

  if p_enviar then
    if p_inicio < current_date then
      raise exception 'A data de início não pode estar no passado.';
    end if;
    if p_inicio < v_per.data_inicial then
      raise exception 'Este período só pode ser usado a partir de %.', to_char(v_per.data_inicial, 'DD/MM/YYYY');
    end if;
    -- Trava o período: dois envios simultâneos não gastam o mesmo saldo.
    perform 1 from public.ausencia_periodos p where p.id = v_per.id for update;
    v_saldo := app_private.ausencia_saldo(v_per.id, p_id);
    if v_dias > v_saldo then
      raise exception 'Saldo insuficiente: o período tem % dia(s) disponível(is) e o pedido usa %.', greatest(v_saldo, 0), v_dias;
    end if;
    if exists (
      select 1 from public.ausencia_solicitacoes s
      where s.colaborador_id = v_me
        and s.status in ('pendente', 'aprovada')
        and s.id is distinct from p_id
        and s.data_inicio <= p_fim and s.data_fim >= p_inicio
    ) then
      raise exception 'Já existe uma ausência pendente ou aprovada que se sobrepõe a essas datas.';
    end if;
  end if;

  if p_id is null then
    insert into public.ausencia_solicitacoes as s
      (colaborador_id, periodo_id, data_inicio, data_fim, observacao, status,
       fora_do_prazo, aprovador_id, enviado_em)
    values
      (v_me, v_per.id, p_inicio, p_fim, nullif(trim(p_observacao), ''),
       case when p_enviar then 'pendente' else 'rascunho' end,
       v_fora,
       case when p_enviar then app_private.ausencia_aprovador_de(v_me) end,
       case when p_enviar then now() end)
    returning s.id into v_id;
  else
    update public.ausencia_solicitacoes s
       set periodo_id    = v_per.id,
           data_inicio   = p_inicio,
           data_fim      = p_fim,
           observacao    = nullif(trim(p_observacao), ''),
           fora_do_prazo = v_fora,
           status        = case when p_enviar then 'pendente' else 'rascunho' end,
           aprovador_id  = case when p_enviar then app_private.ausencia_aprovador_de(v_me) end,
           enviado_em    = case when p_enviar then now() end
     where s.id = p_id;
    v_id := p_id;
  end if;

  return query
    select s.id, s.numero, s.fora_do_prazo from public.ausencia_solicitacoes s where s.id = v_id;
end $$;
revoke all on function public.ausencia_salvar(uuid, uuid, date, date, text, boolean) from public;
revoke execute on function public.ausencia_salvar(uuid, uuid, date, date, text, boolean) from anon;
grant execute on function public.ausencia_salvar(uuid, uuid, date, date, text, boolean) to authenticated;

create or replace function public.ausencia_excluir_rascunho(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.ausencia_solicitacoes s
   where s.id = p_id
     and s.status = 'rascunho'
     and s.colaborador_id = app_private.my_colaborador_id();
  if not found then
    raise exception 'Rascunho não encontrado.';
  end if;
end $$;
revoke all on function public.ausencia_excluir_rascunho(uuid) from public;
revoke execute on function public.ausencia_excluir_rascunho(uuid) from anon;
grant execute on function public.ausencia_excluir_rascunho(uuid) to authenticated;

-- Decisão: o aprovador do pedido ou o RH. Reprovar exige motivo.
create or replace function public.ausencia_decidir(p_id uuid, p_aprovar boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me  uuid := app_private.my_colaborador_id();
  v_sol public.ausencia_solicitacoes;
begin
  select * into v_sol from public.ausencia_solicitacoes s where s.id = p_id for update;
  if v_sol.id is null then
    raise exception 'Solicitação não encontrada.';
  end if;
  if not (v_sol.aprovador_id = v_me or app_private.is_ausencia_rh()) then
    raise exception 'Você não é o aprovador desta solicitação.';
  end if;
  if v_sol.colaborador_id = v_me then
    raise exception 'Não é possível decidir a própria ausência.';
  end if;
  if v_sol.status <> 'pendente' then
    raise exception 'Esta solicitação não está pendente de aprovação.';
  end if;
  if not p_aprovar and nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo da reprovação.';
  end if;

  update public.ausencia_solicitacoes s
     set status            = case when p_aprovar then 'aprovada' else 'reprovada' end,
         motivo_reprovacao = case when p_aprovar then null else trim(p_motivo) end,
         decidido_em       = now(),
         decidido_por      = v_me
   where s.id = p_id;
end $$;
revoke all on function public.ausencia_decidir(uuid, boolean, text) from public;
revoke execute on function public.ausencia_decidir(uuid, boolean, text) from anon;
grant execute on function public.ausencia_decidir(uuid, boolean, text) to authenticated;

-- Cancelamento (devolve o saldo):
--  * o colaborador cancela o próprio pedido pendente, ou o aprovado que ainda
--    não começou;
--  * o aprovador e o RH cancelam pendente ou aprovado, com motivo.
create or replace function public.ausencia_cancelar(p_id uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me   uuid := app_private.my_colaborador_id();
  v_sol  public.ausencia_solicitacoes;
  v_dono boolean;
  v_gest boolean;
begin
  select * into v_sol from public.ausencia_solicitacoes s where s.id = p_id for update;
  if v_sol.id is null then
    raise exception 'Solicitação não encontrada.';
  end if;
  if v_sol.status not in ('pendente', 'aprovada') then
    raise exception 'Só é possível cancelar uma solicitação pendente ou aprovada.';
  end if;

  v_dono := v_sol.colaborador_id = v_me;
  v_gest := v_sol.aprovador_id = v_me or app_private.is_ausencia_rh();

  if not (v_dono or v_gest) then
    raise exception 'Você não pode cancelar esta solicitação.';
  end if;
  if not v_gest and v_sol.status = 'aprovada' and v_sol.data_inicio <= current_date then
    raise exception 'A ausência já começou. Peça o cancelamento ao seu gestor ou ao RH.';
  end if;
  if not v_dono and nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  update public.ausencia_solicitacoes s
     set status              = 'cancelada',
         motivo_cancelamento = nullif(trim(p_motivo), ''),
         cancelado_em        = now(),
         cancelado_por       = v_me
   where s.id = p_id;
end $$;
revoke all on function public.ausencia_cancelar(uuid, text) from public;
revoke execute on function public.ausencia_cancelar(uuid, text) from anon;
grant execute on function public.ausencia_cancelar(uuid, text) to authenticated;

-- Gera os períodos que faltam, continuando a cadeia do último período.
--  * Quem já tem período: cria os seguintes até o que está em aquisição hoje.
--  * Quem NÃO tem nenhum: só gera sozinho se a admissão é do último ano
--    (colaborador novo, bloqueado até completar o período). Para os antigos,
--    gerar 21 dias por ano desde a admissão inventaria saldo — esses ficam na
--    lista "sem período" para o RH cadastrar.
-- p_colaborador null = eu. Outra pessoa, ou 'todos' (p_todos), só o RH.
create or replace function public.ausencia_gerar_periodos(p_colaborador uuid default null, p_todos boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_me     uuid := app_private.my_colaborador_id();
  v_rh     boolean := app_private.is_ausencia_rh();
  v_colab  record;
  v_base   date;
  v_criados int := 0;
  v_guarda int;
begin
  if (p_todos or (p_colaborador is not null and p_colaborador <> v_me)) and not v_rh then
    raise exception 'Apenas o RH gera períodos de outros colaboradores.';
  end if;

  for v_colab in
    select c.id, c.data_admissao
    from public.colaboradores c
    where c.ativo is distinct from false
      and (p_todos or c.id = coalesce(p_colaborador, v_me))
  loop
    select max(p.fim_periodo) into v_base from public.ausencia_periodos p where p.colaborador_id = v_colab.id;
    if v_base is null then
      if v_colab.data_admissao is null or v_colab.data_admissao < (current_date - interval '1 year')::date then
        continue;
      end if;
      v_base := v_colab.data_admissao;
    end if;

    v_guarda := 0;
    while v_base <= current_date and v_guarda < 5 loop
      insert into public.ausencia_periodos
        (colaborador_id, inicio_periodo, fim_periodo, data_inicial, data_limite, origem)
      values
        (v_colab.id, v_base, (v_base + interval '1 year')::date,
         (v_base + interval '1 year')::date, (v_base + interval '2 years')::date, 'automatico')
      on conflict (colaborador_id, inicio_periodo) do nothing;
      if found then
        v_criados := v_criados + 1;
      end if;
      v_base := (v_base + interval '1 year')::date;
      v_guarda := v_guarda + 1;
    end loop;
  end loop;

  return v_criados;
end $$;
revoke all on function public.ausencia_gerar_periodos(uuid, boolean) from public;
revoke execute on function public.ausencia_gerar_periodos(uuid, boolean) from anon;
grant execute on function public.ausencia_gerar_periodos(uuid, boolean) to authenticated;

-- ============================================================================
-- 7) Notificações (modulo 'dp') — criadas por gatilho, como no resto do portal
-- ============================================================================
create or replace function app_private.notif_ausencia()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  quem    text;
  periodo text;
begin
  if tg_op = 'UPDATE' and new.status = old.status then return null; end if;
  select nome into quem from colaboradores where id = new.colaborador_id;
  periodo := format('%s a %s (%s dia(s))',
    to_char(new.data_inicio, 'DD/MM/YYYY'), to_char(new.data_fim, 'DD/MM/YYYY'), new.dias);

  if new.status = 'pendente' then
    perform app_private.notificar(new.aprovador_id, 'dp', 'sua_vez',
      format('Ausência programada #%s aguarda sua aprovação', new.numero),
      format('%s · %s%s', quem, periodo, case when new.fora_do_prazo then ' · fora do prazo' else '' end),
      '/ausencia-programada/aprovacoes', new.id);
  elsif new.status = 'aprovada' and new.origem = 'portal' then
    perform app_private.notificar(new.colaborador_id, 'dp', 'concluida',
      format('Ausência programada #%s aprovada', new.numero), periodo,
      '/ausencia-programada', new.id);
  elsif new.status = 'reprovada' then
    perform app_private.notificar(new.colaborador_id, 'dp', 'reprovada',
      format('Ausência programada #%s reprovada', new.numero), new.motivo_reprovacao,
      '/ausencia-programada', new.id);
  elsif new.status = 'cancelada' and tg_op = 'UPDATE' then
    if new.cancelado_por = new.colaborador_id then
      -- O colaborador desistiu: o gestor precisa saber (a agenda da equipe mudou).
      perform app_private.notificar(new.aprovador_id, 'dp', 'andamento',
        format('Ausência programada #%s cancelada por %s', new.numero, quem), periodo,
        '/ausencia-programada/aprovacoes', new.id);
    else
      perform app_private.notificar(new.colaborador_id, 'dp', 'reprovada',
        format('Ausência programada #%s cancelada', new.numero),
        coalesce(new.motivo_cancelamento, periodo), '/ausencia-programada', new.id);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists trg_notif_ausencia on public.ausencia_solicitacoes;
create trigger trg_notif_ausencia
after insert or update of status on public.ausencia_solicitacoes
for each row execute function app_private.notif_ausencia();

-- Alerta de vencimento: saldo > 0 e data limite nos próximos 3 meses. Avisa o
-- gestor direto e o próprio colaborador, uma vez por período.
create or replace function public.ausencia_gerar_alertas()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_qtd int := 0;
  v_gestor uuid;
begin
  for r in
    select p.id, p.colaborador_id, p.data_limite, c.nome,
           app_private.ausencia_saldo(p.id) as saldo
    from public.ausencia_periodos p
    join public.colaboradores c on c.id = p.colaborador_id
    where p.alerta_vencimento_em is null
      and p.data_limite >= current_date
      and p.data_limite <= (current_date + interval '3 months')::date
      and c.ativo is distinct from false
    for update of p skip locked
  loop
    if r.saldo > 0 then
      v_gestor := app_private.ausencia_aprovador_de(r.colaborador_id);
      perform app_private.notificar(v_gestor, 'dp', 'andamento',
        format('Saldo de ausência vencendo: %s', r.nome),
        format('%s dia(s) com data limite em %s', r.saldo, to_char(r.data_limite, 'DD/MM/YYYY')),
        '/ausencia-programada/equipe', null);
      perform app_private.notificar(r.colaborador_id, 'dp', 'andamento',
        'Seu saldo de ausência programada está perto da data limite',
        format('%s dia(s) para usar até %s', r.saldo, to_char(r.data_limite, 'DD/MM/YYYY')),
        '/ausencia-programada', null);
      update public.ausencia_periodos p set alerta_vencimento_em = now() where p.id = r.id;
      v_qtd := v_qtd + 1;
    end if;
  end loop;
  return v_qtd;
end $$;
revoke all on function public.ausencia_gerar_alertas() from public;
revoke execute on function public.ausencia_gerar_alertas() from anon;
grant execute on function public.ausencia_gerar_alertas() to authenticated;

notify pgrst, 'reload schema';
