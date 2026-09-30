-- Migration: Humor do dia + Aniversariantes e tempo de casa (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do Lucas Ferraz (30/09/2026), trazendo o que a Feedz tinha:
--   1. cada pessoa marca como está no dia (Muito mal, Triste, Ok, Feliz,
--      Muito feliz);
--   2. uma área com os aniversariantes e o tempo de casa do mês, só para as
--      pessoas saberem (sem botão de mensagem).
--
-- Decisões do usuário (30/09/2026):
--   - O humor é visto SÓ em números agregados, sem nome: o RH vê a empresa, o
--     gestor vê a equipe (subárvore). É o que deixa a pessoa responder a
--     verdade. Ninguém — nem o RH — lê o humor individual de outra pessoa: a
--     tabela só é lida pela própria pessoa, e o resumo sai por RPC.
--   - Grupo pequeno identifica: com 2 pessoas na equipe, "1 triste" diz quem é.
--     Por isso o resumo ESCONDE a distribuição dos dias com menos de 3
--     respostas (MINIMO_ANONIMATO) — devolve só o total.
--   - Aniversário mostra só DIA e MÊS: nem ano, nem idade. A lista é visível a
--     todo logado, então a RPC nem devolve a data completa.
--
-- Sem dependência de deploy: tudo é novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Humor do dia
-- ----------------------------------------------------------------------------
create table if not exists public.humor_registros (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  dia             date not null,
  humor           smallint not null check (humor between 1 and 5),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  constraint humor_um_por_dia unique (colaborador_id, dia)
);
create index if not exists humor_dia_idx on public.humor_registros (dia);

alter table public.humor_registros enable row level security;
-- Só a própria pessoa lê o próprio registro. Nenhuma outra policy: o resumo
-- agregado sai pela RPC SECURITY DEFINER abaixo, e nada mais sai daqui.
drop policy if exists humor_proprio on public.humor_registros;
create policy humor_proprio on public.humor_registros
for select to authenticated
using (colaborador_id = app_private.my_colaborador_id());

-- "Hoje" no fuso de Brasília: às 22h o dia do servidor (UTC) já virou.
create or replace function app_private.hoje_brasil()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- Marca (ou troca) o humor de hoje.
create or replace function public.humor_registrar(p_humor int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
begin
  if v_me is null then
    raise exception 'Seu usuário não está vinculado a um colaborador.';
  end if;
  if p_humor is null or p_humor not between 1 and 5 then
    raise exception 'Humor inválido.';
  end if;
  insert into public.humor_registros (colaborador_id, dia, humor)
  values (v_me, app_private.hoje_brasil(), p_humor)
  on conflict (colaborador_id, dia)
  do update set humor = excluded.humor, updated_at = now();
end $$;
revoke all on function public.humor_registrar(int) from public;
revoke execute on function public.humor_registrar(int) from anon;
grant execute on function public.humor_registrar(int) to authenticated;

-- O que EU marquei hoje (null = ainda não marquei).
create or replace function public.humor_meu_hoje()
returns smallint language sql stable security definer set search_path = '' as $$
  select h.humor from public.humor_registros h
   where h.colaborador_id = app_private.my_colaborador_id()
     and h.dia = app_private.hoje_brasil()
$$;
revoke all on function public.humor_meu_hoje() from public;
revoke execute on function public.humor_meu_hoje() from anon;
grant execute on function public.humor_meu_hoje() to authenticated;

-- Resumo AGREGADO por dia. p_escopo: 'equipe' (subárvore de quem pede) ou
-- 'todos' (só RH/admin). Dia com menos de 3 respostas volta sem distribuição.
create or replace function public.humor_resumo(p_de date, p_ate date, p_escopo text default 'equipe')
returns table (dia date, total int, muito_mal int, triste int, ok int, feliz int, muito_feliz int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  c_minimo constant int := 3;   -- MINIMO_ANONIMATO
begin
  if p_escopo = 'todos' and not app_private.is_ausencia_rh() then
    raise exception 'Apenas o RH vê o resumo da empresa.' using errcode = 'insufficient_privilege';
  end if;
  if p_escopo not in ('equipe', 'todos') then
    raise exception 'Escopo inválido.';
  end if;
  if p_ate - p_de > 366 then
    raise exception 'Período longo demais (máximo de um ano).';
  end if;

  return query
  with base as (
    select h.dia, h.humor
      from public.humor_registros h
     where h.dia between p_de and p_ate
       and (p_escopo = 'todos'
            or h.colaborador_id in (select app_private.descendentes(v_me)))
  ), agg as (
    select b.dia, count(*)::int as total,
           count(*) filter (where b.humor = 1)::int as n1,
           count(*) filter (where b.humor = 2)::int as n2,
           count(*) filter (where b.humor = 3)::int as n3,
           count(*) filter (where b.humor = 4)::int as n4,
           count(*) filter (where b.humor = 5)::int as n5
      from base b group by b.dia
  )
  select a.dia, a.total,
         case when a.total >= c_minimo then a.n1 end,
         case when a.total >= c_minimo then a.n2 end,
         case when a.total >= c_minimo then a.n3 end,
         case when a.total >= c_minimo then a.n4 end,
         case when a.total >= c_minimo then a.n5 end
    from agg a
   order by a.dia;
end $$;
revoke all on function public.humor_resumo(date, date, text) from public;
revoke execute on function public.humor_resumo(date, date, text) from anon;
grant execute on function public.humor_resumo(date, date, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Aniversariantes e tempo de casa do mês
--
-- Devolve só o DIA (nunca o ano) e, no tempo de casa, quantos anos a pessoa
-- completa neste ano. Só quem está ativo. Tempo de casa conta a partir de 1
-- ano: quem entrou este ano está "completando 0" e não é marco.
-- ----------------------------------------------------------------------------
create or replace function public.aniversariantes_mes(p_mes int default null)
returns table (colaborador_id uuid, nome text, funcao text, tipo text, dia int, anos_casa int)
language sql stable security definer set search_path = '' as $$
  with ref as (
    select coalesce(p_mes, extract(month from app_private.hoje_brasil())::int) as mes,
           extract(year from app_private.hoje_brasil())::int as ano
  )
  select c.id, c.nome, c.funcao, 'aniversario', extract(day from c.data_nascimento)::int, null::int
    from public.colaboradores c cross join ref
   where c.ativo is distinct from false
     and c.data_nascimento is not null
     and extract(month from c.data_nascimento)::int = ref.mes
  union all
  select c.id, c.nome, c.funcao, 'tempo_casa', extract(day from c.data_admissao)::int,
         ref.ano - extract(year from c.data_admissao)::int
    from public.colaboradores c cross join ref
   where c.ativo is distinct from false
     and c.data_admissao is not null
     and extract(month from c.data_admissao)::int = ref.mes
     and ref.ano - extract(year from c.data_admissao)::int >= 1
  order by 5, 2
$$;
revoke all on function public.aniversariantes_mes(int) from public;
revoke execute on function public.aniversariantes_mes(int) from anon;
grant execute on function public.aniversariantes_mes(int) to authenticated;

notify pgrst, 'reload schema';
