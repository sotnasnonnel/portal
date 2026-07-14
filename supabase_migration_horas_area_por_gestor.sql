-- ============================================================================
-- Controle de Horas — uma ÁREA por gestor
-- ----------------------------------------------------------------------------
-- Cada "área" (horas_gerencias) passa a pertencer a um GESTOR. Os projetos e as
-- 3 atividades controladas dessa área são o que a equipe do gestor vê ao apontar.
-- Um colaborador é vinculado à área do seu gestor mais próximo (subindo a árvore
-- colaboradores.superior_id). Ver também supabase_migration_horas_hierarquia.sql.
-- ============================================================================

-- 1) Vínculo área -> gestor dono.
alter table public.horas_gerencias
  add column if not exists gestor_id uuid references public.colaboradores(id) on delete set null;

create unique index if not exists horas_gerencias_gestor_uidx
  on public.horas_gerencias(gestor_id) where gestor_id is not null;

-- 2) Config (projetos/atividades) só pelo gestor DONO da área (ou admin/super).
create or replace function app_private.pode_gerir_gerencia(p_gerencia uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_admin()
      or app_private.is_portal_super_admin()
      or exists (
        select 1 from public.horas_gerencias g
        where g.id = p_gerencia and g.gestor_id = app_private.my_colaborador_id()
      )
$$;

-- ----------------------------------------------------------------------------
-- 3) Setup de dados (idempotente) — criar uma área por gestor, vincular a equipe
--    e padronizar os 3 campos controlados em todas as áreas.
-- ----------------------------------------------------------------------------

-- 3a) Uma área por gestor (o trigger de horas_gerencias cria as 3 atividades).
insert into public.horas_gerencias (nome, gestor_id)
select 'Equipe ' || c.nome, c.id
from public.colaboradores c
where c.ativo is distinct from false and c.perfil = 'gestor'
  and not exists (select 1 from public.horas_gerencias g where g.gestor_id = c.id);

-- 3b) Vincula cada pessoa à área do seu gestor mais próximo.
with recursive walk as (
  select c.id as colab_id, c.id as node_id, c.perfil as node_perfil, c.superior_id, 0 as depth
  from public.colaboradores c
  where c.ativo is distinct from false
  union all
  select w.colab_id, p.id, p.perfil, p.superior_id, w.depth + 1
  from walk w
  join public.colaboradores p on p.id = w.superior_id
  where w.node_perfil is distinct from 'gestor' and w.depth < 60
),
nearest as (
  select colab_id, node_id as gestor_id,
         row_number() over (partition by colab_id order by depth) as rn
  from walk
  where node_perfil = 'gestor'
)
update public.colaboradores c
set horas_gerencia_id = g.id
from nearest n
join public.horas_gerencias g on g.gestor_id = n.gestor_id
where n.rn = 1 and n.colab_id = c.id;

-- 3c) Os 3 campos controlados são padrão da empresa (em todas as áreas).
--     Os PROJETOS continuam por gestor (cada um cria os seus).
update public.horas_atividades set label = 'Fase do Projeto',
       valores = array['Levantamento','Projeto Básico','Projeto Executivo','As Built'] where ordem = 0;
update public.horas_atividades set label = 'Disciplina',
       valores = array['Elétrica','Civil','Mecânica'] where ordem = 1;
update public.horas_atividades set label = 'Tipo de Esforço',
       valores = array['Cálculo','Desenho','Reunião','Revisão'] where ordem = 2;
