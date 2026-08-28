-- ============================================================================
-- Controle de Horas — papéis do protótipo (usuario | gerente | diretoria) e a
-- entidade GERÊNCIA, que é o escopo em que o gerente enxerga a equipe.
-- ----------------------------------------------------------------------------
-- Antes: horas_role ∈ ('usuario','admin'); admin via TUDO, usuário via só o seu.
-- Agora, como no protótipo (referencia/controle-horas.html):
--   usuario   -> aponta e vê o PRÓPRIO tempo
--   gerente   -> aponta, e vê/administra a SUA gerência (projetos, atividades, equipe)
--   diretoria -> vê TUDO e administra todas as gerências (não aponta horas)
--
-- Cada gerência tem seus PROJETOS e 3 ATIVIDADES CONTROLADAS (rótulo editável +
-- lista de valores), escolhidas pelo colaborador ao apontar.
--
-- Aditivo: cria tabelas/colunas e substitui apenas as policies horas_*.
-- Idempotente. Rode primeiro numa BRANCH do Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Gerências e atividades controladas
-- ----------------------------------------------------------------------------
create table if not exists public.horas_gerencias (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  criado_em timestamptz not null default now()
);

-- Exatamente 3 por gerência (ordem 0..2), garantidas pelo trigger abaixo.
create table if not exists public.horas_atividades (
  id          uuid primary key default gen_random_uuid(),
  gerencia_id uuid not null references public.horas_gerencias(id) on delete cascade,
  ordem       int  not null check (ordem between 0 and 2),
  label       text not null,
  valores     text[] not null default '{}',
  unique (gerencia_id, ordem)
);

-- Projetos deixam de ser da empresa toda e passam a ser da gerência.
alter table public.horas_projetos
  add column if not exists gerencia_id uuid references public.horas_gerencias(id) on delete cascade;

alter table public.colaboradores
  add column if not exists horas_gerencia_id uuid references public.horas_gerencias(id) on delete set null;

-- gerencia_id no apontamento é um SNAPSHOT: se a pessoa mudar de gerência, o
-- histórico continua contando para a gerência em que as horas foram feitas.
alter table public.horas_apontamentos
  add column if not exists gerencia_id uuid references public.horas_gerencias(id) on delete set null,
  add column if not exists ativ        text[] not null default '{}';

alter table public.horas_timer_ativo
  add column if not exists ativ text[] not null default '{}';

create index if not exists horas_apont_gerencia_idx on public.horas_apontamentos (gerencia_id, inicio desc);
create index if not exists horas_projetos_gerencia_idx on public.horas_projetos (gerencia_id, arquivado, nome);

-- Toda gerência nasce com as 3 atividades controladas (rótulos genéricos).
create or replace function public.horas_seed_atividades()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.horas_atividades (gerencia_id, ordem, label) values
    (new.id, 0, 'Atividade Controlada 1'),
    (new.id, 1, 'Atividade Controlada 2'),
    (new.id, 2, 'Atividade Controlada 3')
  on conflict (gerencia_id, ordem) do nothing;
  return new;
end $$;
-- Função de trigger: dispara com os privilégios da dona da tabela e não deve
-- ser chamável como RPC. (O Supabase concede EXECUTE a anon/authenticated.)
revoke execute on function public.horas_seed_atividades() from public;
revoke execute on function public.horas_seed_atividades() from anon;
revoke execute on function public.horas_seed_atividades() from authenticated;

drop trigger if exists horas_gerencias_seed_ativ on public.horas_gerencias;
create trigger horas_gerencias_seed_ativ
after insert on public.horas_gerencias
for each row execute function public.horas_seed_atividades();

-- ----------------------------------------------------------------------------
-- 1) Papel: 'admin' -> 'diretoria', e o novo 'gerente'
-- ----------------------------------------------------------------------------
alter table public.colaboradores drop constraint if exists colaboradores_horas_role_check;

update public.colaboradores set horas_role = 'diretoria' where horas_role = 'admin';

alter table public.colaboradores
  add constraint colaboradores_horas_role_check
  check (horas_role in ('usuario', 'gerente', 'diretoria'));

-- ----------------------------------------------------------------------------
-- 2) Backfill: uma gerência inicial para não quebrar os dados existentes.
--    Projetos, colaboradores e apontamentos que já existiam entram nela.
-- ----------------------------------------------------------------------------
do $$
declare v_ger uuid;
begin
  if not exists (select 1 from public.horas_gerencias) then
    insert into public.horas_gerencias (nome) values ('Gerência Geral') returning id into v_ger;
    update public.horas_projetos     set gerencia_id       = v_ger where gerencia_id is null;
    update public.colaboradores      set horas_gerencia_id = v_ger where horas_gerencia_id is null;
  end if;
end $$;

-- Apontamentos antigos herdam a gerência atual do colaborador.
update public.horas_apontamentos a
set gerencia_id = c.horas_gerencia_id
from public.colaboradores c
where c.id = a.colaborador_id and a.gerencia_id is null;

-- Gerências criadas antes deste script (ou pelo backfill) também ganham as 3.
insert into public.horas_atividades (gerencia_id, ordem, label)
select g.id, o.ordem, 'Atividade Controlada ' || (o.ordem + 1)
from public.horas_gerencias g
cross join (values (0), (1), (2)) as o(ordem)
on conflict (gerencia_id, ordem) do nothing;

-- ----------------------------------------------------------------------------
-- 3) Helpers de papel (SECURITY DEFINER: evita recursão de RLS em colaboradores)
-- ----------------------------------------------------------------------------
create or replace function app_private.my_horas_role()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select horas_role from public.colaboradores where auth_id = (select auth.uid())),
    'usuario')
$$;
revoke all on function app_private.my_horas_role() from public;
grant execute on function app_private.my_horas_role() to authenticated;

create or replace function app_private.my_horas_gerencia()
returns uuid language sql stable security definer set search_path = '' as $$
  select horas_gerencia_id from public.colaboradores where auth_id = (select auth.uid())
$$;
revoke all on function app_private.my_horas_gerencia() from public;
grant execute on function app_private.my_horas_gerencia() to authenticated;

create or replace function app_private.is_horas_diretoria()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.my_horas_role() = 'diretoria'
$$;
revoke all on function app_private.is_horas_diretoria() from public;
grant execute on function app_private.is_horas_diretoria() to authenticated;

-- Compat: is_horas_admin() (usada nas policies anteriores) agora é a diretoria.
create or replace function app_private.is_horas_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.my_horas_role() = 'diretoria'
$$;
revoke all on function app_private.is_horas_admin() from public;
grant execute on function app_private.is_horas_admin() to authenticated;

-- Quem escreve a configuração de uma gerência: a diretoria (qualquer uma) ou o
-- gerente daquela gerência.
create or replace function app_private.pode_gerir_gerencia(p_gerencia uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_horas_diretoria()
      or app_private.is_portal_super_admin()
      or (app_private.my_horas_role() = 'gerente'
          and p_gerencia is not null
          and p_gerencia = app_private.my_horas_gerencia())
$$;
revoke all on function app_private.pode_gerir_gerencia(uuid) from public;
grant execute on function app_private.pode_gerir_gerencia(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) RLS
-- ----------------------------------------------------------------------------

-- horas_gerencias: todos leem (precisam do nome); só a diretoria cria/exclui.
alter table public.horas_gerencias enable row level security;

drop policy if exists horas_gerencias_select on public.horas_gerencias;
create policy horas_gerencias_select on public.horas_gerencias
for select to authenticated using ( true );

drop policy if exists horas_gerencias_write on public.horas_gerencias;
create policy horas_gerencias_write on public.horas_gerencias
for all to authenticated
using (app_private.is_horas_diretoria() or app_private.is_portal_super_admin())
with check (app_private.is_horas_diretoria() or app_private.is_portal_super_admin());

-- horas_atividades: todos leem; escreve a diretoria ou o gerente da gerência.
alter table public.horas_atividades enable row level security;

drop policy if exists horas_atividades_select on public.horas_atividades;
create policy horas_atividades_select on public.horas_atividades
for select to authenticated using ( true );

drop policy if exists horas_atividades_write on public.horas_atividades;
create policy horas_atividades_write on public.horas_atividades
for all to authenticated
using (app_private.pode_gerir_gerencia(gerencia_id))
with check (app_private.pode_gerir_gerencia(gerencia_id));

-- horas_projetos: leitura livre; escrita da diretoria ou do gerente da gerência.
drop policy if exists horas_projetos_write on public.horas_projetos;
create policy horas_projetos_write on public.horas_projetos
for all to authenticated
using (app_private.pode_gerir_gerencia(gerencia_id))
with check (app_private.pode_gerir_gerencia(gerencia_id));

-- horas_apontamentos: o próprio; a gerência (gerente); tudo (diretoria/super).
-- Inserir continua sendo só em nome próprio.
drop policy if exists horas_apont_select on public.horas_apontamentos;
create policy horas_apont_select on public.horas_apontamentos
for select to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_diretoria()
  or app_private.is_portal_super_admin()
  or (app_private.my_horas_role() = 'gerente' and gerencia_id = app_private.my_horas_gerencia())
);

drop policy if exists horas_apont_insert on public.horas_apontamentos;
create policy horas_apont_insert on public.horas_apontamentos
for insert to authenticated
with check (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_portal_super_admin()
);

drop policy if exists horas_apont_update on public.horas_apontamentos;
create policy horas_apont_update on public.horas_apontamentos
for update to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_diretoria()
  or app_private.is_portal_super_admin()
  or (app_private.my_horas_role() = 'gerente' and gerencia_id = app_private.my_horas_gerencia())
)
with check (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_diretoria()
  or app_private.is_portal_super_admin()
  or (app_private.my_horas_role() = 'gerente' and gerencia_id = app_private.my_horas_gerencia())
);

drop policy if exists horas_apont_delete on public.horas_apontamentos;
create policy horas_apont_delete on public.horas_apontamentos
for delete to authenticated
using (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_diretoria()
  or app_private.is_portal_super_admin()
  or (app_private.my_horas_role() = 'gerente' and gerencia_id = app_private.my_horas_gerencia())
);

-- ----------------------------------------------------------------------------
-- 5) RPCs de leitura/escrita de pessoas (colaboradores tem RLS restritiva)
-- ----------------------------------------------------------------------------

-- Devolve SÓ id/nome/função/papel/gerência (nunca salário/senha).
--   diretoria/super -> todos
--   gerente         -> a própria equipe + quem ainda não tem gerência (para poder incluir)
--   usuario         -> ninguém
drop function if exists public.horas_colaboradores();
create function public.horas_colaboradores()
returns table (id uuid, nome text, funcao text, horas_role text, gerencia_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.funcao, c.horas_role, c.horas_gerencia_id
  from public.colaboradores c
  where c.ativo is distinct from false
    and (
      app_private.is_horas_diretoria()
      or app_private.is_portal_super_admin()
      or (
        app_private.my_horas_role() = 'gerente'
        and (c.horas_gerencia_id = app_private.my_horas_gerencia() or c.horas_gerencia_id is null)
      )
    )
  order by c.nome
$$;
revoke all on function public.horas_colaboradores() from public;
revoke execute on function public.horas_colaboradores() from anon;  -- concedido por padrão
grant execute on function public.horas_colaboradores() to authenticated;

-- Vincula/desvincula um colaborador de uma gerência.
--   diretoria/super -> qualquer pessoa, qualquer gerência
--   gerente         -> só traz para a SUA gerência ou remove alguém DELA
-- (O PAPEL não se muda aqui: isso é feito em /portal-admin.)
create or replace function public.horas_set_gerencia(p_colaborador uuid, p_gerencia uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role  text := app_private.my_horas_role();
  v_minha uuid := app_private.my_horas_gerencia();
  v_atual uuid;
begin
  if app_private.is_portal_super_admin() or app_private.is_horas_diretoria() then
    update public.colaboradores set horas_gerencia_id = p_gerencia where id = p_colaborador;
    return;
  end if;

  if v_role <> 'gerente' or v_minha is null then
    raise exception 'Sem permissão para alterar a gerência de um colaborador.';
  end if;

  select horas_gerencia_id into v_atual from public.colaboradores where id = p_colaborador;

  if not (
    (p_gerencia = v_minha and (v_atual is null or v_atual = v_minha))  -- incluir na minha equipe
    or (p_gerencia is null and v_atual = v_minha)                      -- remover da minha equipe
  ) then
    raise exception 'Um gerente só administra a própria gerência.';
  end if;

  update public.colaboradores set horas_gerencia_id = p_gerencia where id = p_colaborador;
end $$;
revoke all on function public.horas_set_gerencia(uuid, uuid) from public;
revoke execute on function public.horas_set_gerencia(uuid, uuid) from anon;  -- concedido por padrão
grant execute on function public.horas_set_gerencia(uuid, uuid) to authenticated;

-- ---- Proteção contra excluir gerência em uso -------------------------------
-- Excluir uma gerência com apontamentos órfão o histórico dela (gerencia_id vira
-- null e some das visões de gerente). A UI barra quando há colaboradores, mas
-- isso é contornável; o trigger recusa no banco quando há colaboradores OU
-- apontamentos.
create or replace function public.horas_impede_excluir_gerencia_em_uso()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.colaboradores where horas_gerencia_id = old.id) then
    raise exception 'Realoque os colaboradores desta gerência antes de excluí-la.'
      using errcode = 'foreign_key_violation';
  end if;
  if exists (select 1 from public.horas_apontamentos where gerencia_id = old.id) then
    raise exception 'Esta gerência tem apontamentos no histórico e não pode ser excluída.'
      using errcode = 'foreign_key_violation';
  end if;
  return old;
end $$;
revoke all on function public.horas_impede_excluir_gerencia_em_uso() from public;

drop trigger if exists horas_gerencias_impede_exclusao on public.horas_gerencias;
create trigger horas_gerencias_impede_exclusao
before delete on public.horas_gerencias
for each row execute function public.horas_impede_excluir_gerencia_em_uso();

-- ============================================================================
-- Depois de aplicar:
--   1. get_advisors(security) — nenhuma rls_disabled_in_public em horas_*.
--   2. Em /portal-admin, a coluna "Controle de Horas" passa a oferecer
--      Usuário / Gerente / Diretoria. Quem era "Admin" virou "Diretoria".
--   3. Em /horas/equipe a diretoria cria as gerências reais e distribui as
--      pessoas; depois cada gerente configura projetos e atividades.
-- ============================================================================
