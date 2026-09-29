-- Migration: ausência do COLABORADOR do chamado (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido da Mobilização (29/09/2026), com o funcionamento definido pelo André:
--   1. Na abertura, o chamado diz para quem é: o próprio solicitante ou outra
--      pessoa. Na mobilização é o profissional; nos serviços que já perguntam
--      a pessoa (passagem, hospedagem, alojamento), é ela.
--   2. Essa pessoa é confrontada com a Folga de Campo e a Ausência Programada.
--   3. Se ela estiver (ou for ficar) ausente, o chamado e o processo de
--      mobilização mostram o período.
--   4. O SLA começa a valer na volta dela.
--
-- O item 4 reaproveita o gatilho `adm_sla_da_ausencia`, que já empurrava o
-- prazo para a volta do ATENDENTE: agora vale a volta mais tardia entre os dois.
--
-- CORREÇÃO junto: `ausente_ate` procurava a Folga de Campo em
-- `folga_campo_solicitacoes`, nome da primeira versão do módulo. A tabela que
-- existe é `folga_campo_registros`, então a folga nunca pausou prazo nenhum.
--
-- Não depende de deploy do front: a coluna nova é opcional e o front antigo
-- simplesmente não a preenche.
--
-- Para derrubar:
--     drop function if exists public.chamados_adm_ausencias(uuid[]);
--     drop function if exists public.mobilizacao_ausencias(uuid);
--     drop function if exists app_private.ausencias_no_periodo(uuid, date, date);
--     alter table public.chamados_adm drop column colaborador_id;
--     (e reaplicar supabase_migration_administrativo_sla_ausencia.sql)
-- ============================================================================

alter table public.chamados_adm
  add column if not exists colaborador_id uuid references public.colaboradores(id);

comment on column public.chamados_adm.colaborador_id is
  'Para quem é o chamado: o próprio solicitante ou outra pessoa (na mobilização, o profissional). É a ausência dela que adia o SLA e aparece no chamado.';

create index if not exists chamados_adm_colaborador_idx on public.chamados_adm (colaborador_id);

-- ----------------------------------------------------------------------------
-- 1) Até quando a pessoa está fora — agora lendo a tabela certa da folga
-- ----------------------------------------------------------------------------
create or replace function app_private.ausente_ate(p_pessoa uuid, p_dia date)
returns date language plpgsql stable security definer set search_path = '' as $$
declare
  v_fim  date;
  v_novo date;
  i int := 0;
begin
  if p_pessoa is null or p_dia is null then return null; end if;

  select max(x.data_fim) into v_fim from (
    select s.data_fim from public.ausencia_solicitacoes s
     where s.colaborador_id = p_pessoa and s.status = 'aprovada'
       and p_dia between s.data_inicio and s.data_fim
    union all
    select f.data_fim from public.folga_campo_registros f
     where f.colaborador_id = p_pessoa and f.status = 'aprovada'
       and p_dia between f.data_inicio and f.data_fim
  ) x;

  if v_fim is null then return null; end if;

  -- Emenda períodos colados (férias seguidas de folga): a pessoa volta uma vez
  -- só. O limite de 12 voltas é só para nunca girar sem fim com dado torto.
  loop
    i := i + 1;
    exit when i > 12;

    select max(x.data_fim) into v_novo from (
      select s.data_fim from public.ausencia_solicitacoes s
       where s.colaborador_id = p_pessoa and s.status = 'aprovada'
         and s.data_inicio <= v_fim + 1 and s.data_fim > v_fim
      union all
      select f.data_fim from public.folga_campo_registros f
       where f.colaborador_id = p_pessoa and f.status = 'aprovada'
         and f.data_inicio <= v_fim + 1 and f.data_fim > v_fim
    ) x;

    exit when v_novo is null;
    v_fim := v_novo;
  end loop;

  return v_fim;
end $$;
revoke all on function app_private.ausente_ate(uuid, date) from public;
revoke execute on function app_private.ausente_ate(uuid, date) from anon;
grant execute on function app_private.ausente_ate(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Períodos de ausência aprovados que tocam uma janela
--
-- Definer porque quem atende o chamado não lê as tabelas de ausência de
-- ninguém. Por isso NÃO é exposta direto: só as duas funções abaixo a chamam,
-- depois de a RLS confirmar que quem pergunta enxerga o chamado/processo.
-- Devolve só tipo e datas — motivo e observação ficam de fora.
-- ----------------------------------------------------------------------------
create or replace function app_private.ausencias_no_periodo(p_pessoa uuid, p_de date, p_ate date)
returns table (tipo text, data_inicio date, data_fim date)
language sql stable security definer set search_path = '' as $$
  select 'ausencia_programada', s.data_inicio, s.data_fim
    from public.ausencia_solicitacoes s
   where s.colaborador_id = p_pessoa and s.status = 'aprovada'
     and s.data_fim >= p_de and (p_ate is null or s.data_inicio <= p_ate)
  union all
  select 'folga_campo', f.data_inicio, f.data_fim
    from public.folga_campo_registros f
   where f.colaborador_id = p_pessoa and f.status = 'aprovada'
     and f.data_fim >= p_de and (p_ate is null or f.data_inicio <= p_ate)
  order by 2
$$;
revoke all on function app_private.ausencias_no_periodo(uuid, date, date) from public;
revoke execute on function app_private.ausencias_no_periodo(uuid, date, date) from anon;
grant execute on function app_private.ausencias_no_periodo(uuid, date, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Ausências do colaborador de cada chamado
--
-- INVOKER de propósito: a leitura de chamados_adm passa pela RLS, então só
-- volta ausência de chamado que quem pergunta já enxerga. Em lista, para a
-- fila marcar os cartões numa consulta só.
--
-- Janela: da abertura até o fechamento. Chamado aberto não tem fim — uma folga
-- já aprovada para a semana que vem também interessa a quem está atendendo.
-- ----------------------------------------------------------------------------
create or replace function public.chamados_adm_ausencias(p_chamados uuid[])
returns table (chamado_id uuid, tipo text, data_inicio date, data_fim date)
language sql stable security invoker set search_path = '' as $$
  select c.id, a.tipo, a.data_inicio, a.data_fim
    from public.chamados_adm c
    cross join lateral app_private.ausencias_no_periodo(
      c.colaborador_id,
      (c.criado_em at time zone 'America/Sao_Paulo')::date,
      (c.fechado_em at time zone 'America/Sao_Paulo')::date
    ) a
   where c.id = any(p_chamados)
     and c.colaborador_id is not null
$$;
revoke all on function public.chamados_adm_ausencias(uuid[]) from public;
revoke execute on function public.chamados_adm_ausencias(uuid[]) from anon;
grant execute on function public.chamados_adm_ausencias(uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) Ausências do profissional de um processo de mobilização
--
-- É aqui que o time da mobilização trabalha, e foi para ele o pedido. Mesma
-- lógica: invoker, janela da criação à conclusão.
-- ----------------------------------------------------------------------------
create or replace function public.mobilizacao_ausencias(p_processo uuid)
returns table (tipo text, data_inicio date, data_fim date)
language sql stable security invoker set search_path = '' as $$
  select a.tipo, a.data_inicio, a.data_fim
    from public.mobilizacao_processos p
    cross join lateral app_private.ausencias_no_periodo(
      p.profissional_id,
      (p.criado_em at time zone 'America/Sao_Paulo')::date,
      (p.concluido_em at time zone 'America/Sao_Paulo')::date
    ) a
   where p.id = p_processo
     and p.profissional_id is not null
$$;
revoke all on function public.mobilizacao_ausencias(uuid) from public;
revoke execute on function public.mobilizacao_ausencias(uuid) from anon;
grant execute on function public.mobilizacao_ausencias(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) O gatilho do SLA: vale a volta mais tardia entre atendente e colaborador
--
-- Mesmas regras de antes: só age quando o prazo NASCE, e olha a ausência no
-- dia em que ele nasce. `greatest` ignora nulo, então quem não está ausente
-- simplesmente não conta.
-- ----------------------------------------------------------------------------
create or replace function app_private.adm_sla_da_ausencia()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_volta date;
  v_dias  int;
  v_inicio timestamptz;
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.sla_vence_em is null then return new; end if;
  if tg_op = 'UPDATE' and old.sla_vence_em is not null then return new; end if;

  new.sla_inicio_em := coalesce(new.sla_inicio_em, now());

  v_volta := greatest(
    app_private.ausente_ate(new.atendente_id, v_hoje),
    app_private.ausente_ate(new.colaborador_id, v_hoje)
  );
  if v_volta is null then return new; end if;

  select cfg.sla_dias_uteis into v_dias
    from public.chamados_adm_config cfg
   where cfg.classe = new.classe and cfg.servico = new.servico;
  if coalesce(v_dias, 0) <= 0 then return new; end if;

  -- Volta no dia seguinte ao último de ausência, na hora em que o chamado
  -- entrou; a conta de dias úteis empurra para segunda se cair no fim de semana.
  v_inicio := ((v_volta + 1)::timestamp + (now() at time zone 'America/Sao_Paulo')::time)
              at time zone 'America/Sao_Paulo';

  new.sla_inicio_em := v_inicio;
  new.sla_vence_em  := app_private.adm_vence_em_dias_uteis(v_inicio, v_dias);
  return new;
end $$;

drop trigger if exists chamados_adm_sla_ausencia on public.chamados_adm;
create trigger chamados_adm_sla_ausencia
before insert or update of sla_vence_em on public.chamados_adm
for each row execute function app_private.adm_sla_da_ausencia();

-- ----------------------------------------------------------------------------
-- 6) Chamados já abertos: só onde a pessoa está nos campos, sem adivinhar
--
-- Mobilização (profissional_id), serviços com pessoa_id, e os adicionais
-- desdobrados de uma mobilização, que herdam do pai. Os demais ficam sem
-- colaborador: não há como saber se eram para o próprio solicitante. Só
-- preenche a coluna, não mexe em prazo (o gatilho só reage a sla_vence_em).
-- ----------------------------------------------------------------------------
update public.chamados_adm c
   set colaborador_id = (c.campos->>'profissional_id')::uuid
 where c.colaborador_id is null
   and c.classe = 'mobilizacao' and c.servico = 'mobilizacao'
   and c.campos->>'profissional_id' ~* '^[0-9a-f-]{36}$'
   and exists (select 1 from public.colaboradores x where x.id = (c.campos->>'profissional_id')::uuid);

update public.chamados_adm c
   set colaborador_id = (c.campos->>'pessoa_id')::uuid
 where c.colaborador_id is null
   and c.campos->>'pessoa_id' ~* '^[0-9a-f-]{36}$'
   and exists (select 1 from public.colaboradores x where x.id = (c.campos->>'pessoa_id')::uuid);

update public.chamados_adm c
   set colaborador_id = pai.colaborador_id
  from public.chamados_adm pai
 where c.origem_chamado_id = pai.id
   and c.colaborador_id is null
   and pai.classe = 'mobilizacao' and pai.colaborador_id is not null;

notify pgrst, 'reload schema';
