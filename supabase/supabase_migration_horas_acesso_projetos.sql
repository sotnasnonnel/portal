-- ============================================================================
-- Controle de Horas — ACESSO A PROJETOS por pessoa (seletor do apontamento)
-- ----------------------------------------------------------------------------
-- Até aqui, quais projetos apareciam no seletor de "Apontar" era decidido SÓ
-- pela herança de área: a pessoa vê os projetos da sua equipe + os das equipes
-- de todos os gestores acima dela na árvore (public.horas_gerencias_visiveis,
-- de supabase_migration_horas_projetos_heranca.sql), e o admin do módulo vê
-- todas. Na prática isso dá 18 projetos por pessoa em média (máx. 101 de 174),
-- sem nenhuma forma de ajustar caso a caso.
--
-- Agora existe uma EXCEÇÃO por (projeto, pessoa), mantida em
-- /horas/config/projetos. A regra de área continua sendo o PADRÃO — a exceção
-- é que decide quando existe:
--
--   sem linha em horas_projeto_acesso -> vale a herança de área (como sempre foi)
--   permitido = false                 -> a pessoa NÃO vê, mesmo sendo da área
--   permitido = true                  -> a pessoa VÊ, mesmo fora da área
--
-- Ou seja: dá para tirar um projeto de alguém da equipe E para conceder um
-- projeto pontual a quem está fora dela.
--
-- ESCOPO: isto é o SELETOR do apontamento, não uma fronteira de segurança.
-- horas_projetos segue com SELECT livre (as telas de Registros/Dashboard
-- precisam resolver o NOME de qualquer projeto que apareça no histórico), e o
-- insert de apontamento continua checando só o colaborador — quem chamasse a
-- API na mão ainda conseguiria apontar num projeto oculto. Bloquear isso
-- exigiria um trigger no insert, que quebraria apontamento legítimo em
-- andamento quando um acesso fosse revogado no meio; ficou de fora de propósito.
--
-- Aditivo e idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Quem configura o Controle de Horas (lista nominal)
--    Renomeia pode_configurar_campos_apontamento(), de
--    supabase_migration_horas_campos_por_equipe.sql: o mesmo trio agora
--    responde por DUAS telas de configuração (campos do apontamento e acesso a
--    projetos), então o nome preso a "campos" virou mentira.
--    Espelho de UI: CONFIG_HORAS_EMAILS em src/modules/horas/lib/roles.js.
-- ----------------------------------------------------------------------------
create or replace function app_private.pode_configurar_horas()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
    'marcus.guimaraes@phdengenharia.eng.br',  -- Marcus Guimarães
    'lennon.santos@phdengenharia.eng.br',     -- Lennon Santos
    'vinicius.costa@phdengenharia.eng.br'     -- Vinicius Costa
  )
$$;
revoke all on function app_private.pode_configurar_horas() from public;
grant execute on function app_private.pode_configurar_horas() to authenticated;

-- A policy dos campos passa a chamar a função nova, e a antiga sai de cena.
drop policy if exists horas_campos_write on public.horas_campos_apontamento;
create policy horas_campos_write on public.horas_campos_apontamento
for all to authenticated
using (app_private.pode_configurar_horas())
with check (app_private.pode_configurar_horas());

drop function if exists app_private.pode_configurar_campos_apontamento();

-- ----------------------------------------------------------------------------
-- 2) As exceções
-- ----------------------------------------------------------------------------
create table if not exists public.horas_projeto_acesso (
  projeto_id     uuid not null references public.horas_projetos(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  -- true = concedido (mesmo fora da área); false = bloqueado (mesmo da área).
  -- Voltar ao padrão da área é APAGAR a linha, não gravar um valor.
  permitido      boolean not null,
  definido_por   uuid references public.colaboradores(id) on delete set null,
  definido_em    timestamptz not null default now(),
  primary key (projeto_id, colaborador_id)
);

-- O seletor consulta pela PESSOA (todas as exceções dela); a tela consulta pelo
-- PROJETO, que a chave primária já cobre.
create index if not exists horas_projeto_acesso_colab_idx
  on public.horas_projeto_acesso (colaborador_id);

comment on table public.horas_projeto_acesso is
  'Exceções à herança de área no seletor de projetos do apontamento. Sem linha = vale a área. Mantida em /horas/config/projetos.';

alter table public.horas_projeto_acesso enable row level security;

-- Ninguém precisa ler esta tabela direto: as duas RPCs abaixo são SECURITY
-- DEFINER. Só o trio que configura enxerga e escreve.
drop policy if exists horas_projeto_acesso_all on public.horas_projeto_acesso;
create policy horas_projeto_acesso_all on public.horas_projeto_acesso
for all to authenticated
using (app_private.pode_configurar_horas())
with check (app_private.pode_configurar_horas());

-- ----------------------------------------------------------------------------
-- 3) O seletor do apontamento: ids dos projetos que ESTA pessoa pode escolher.
--    Substitui o par (horas_gerencias_visiveis + filtro no front) — o filtro
--    agora é do banco, não da tela.
-- ----------------------------------------------------------------------------
create or replace function public.horas_projetos_visiveis()
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id
  from public.horas_projetos p
  left join public.horas_projeto_acesso a
         on a.projeto_id = p.id
        and a.colaborador_id = app_private.my_colaborador_id()
  where coalesce(
          a.permitido,
          p.gerencia_id in (select g from public.horas_gerencias_visiveis() g)
        )
$$;
revoke all on function public.horas_projetos_visiveis() from public;
revoke execute on function public.horas_projetos_visiveis() from anon;
grant execute on function public.horas_projetos_visiveis() to authenticated;

-- ----------------------------------------------------------------------------
-- 4) A tela de configuração: todas as pessoas ativas com a situação delas em
--    UM projeto. `por_area` é o padrão herdado, `override` a exceção (null =
--    não há) e `efetivo` o que vale hoje — a caixa que a tela marca.
--    Devolve vazio para quem não configura (é SECURITY DEFINER e expõe a
--    empresa inteira).
-- ----------------------------------------------------------------------------
create or replace function public.horas_acesso_projeto(p_projeto uuid)
returns table (
  colaborador_id uuid,
  nome           text,
  funcao         text,
  equipe         text,
  por_area       boolean,
  override       boolean,
  efetivo        boolean
)
language sql stable security definer set search_path = '' as $$
  with recursive
  proj as (
    select id, gerencia_id from public.horas_projetos where id = p_projeto
  ),
  -- A cadeia de superiores de CADA pessoa (a RPC do seletor faz o mesmo, mas
  -- só para quem chamou; aqui é a empresa toda de uma vez).
  chain as (
    select c.id as colab_id, c.id as node_id, c.superior_id, 0 as depth
    from public.colaboradores c
    where c.ativo is distinct from false
    union all
    select ch.colab_id, s.id, s.superior_id, ch.depth + 1
    from public.colaboradores s
    join chain ch on s.id = ch.superior_id
    where ch.depth < 60
  ),
  -- Mesma regra de horas_gerencias_visiveis(): área de um gestor da minha
  -- cadeia, ou a minha própria área, ou ser admin do módulo (que vê todas).
  ve_por_area as (
    select distinct ch.colab_id
    from chain ch
    join public.horas_gerencias g on g.gestor_id = ch.node_id
    join proj p on p.gerencia_id = g.id
    union
    select c.id
    from public.colaboradores c
    join proj p on p.gerencia_id = c.horas_gerencia_id
    union
    select c.id
    from public.colaboradores c
    where c.perfil = 'admin' or c.horas_role = 'admin'
  )
  select
    c.id,
    c.nome,
    c.funcao,
    g.nome,
    (c.id in (select colab_id from ve_por_area)),
    a.permitido,
    coalesce(a.permitido, c.id in (select colab_id from ve_por_area))
  from public.colaboradores c
  left join public.horas_gerencias g on g.id = c.horas_gerencia_id
  left join public.horas_projeto_acesso a
         on a.projeto_id = p_projeto and a.colaborador_id = c.id
  where c.ativo is distinct from false
    and app_private.pode_configurar_horas()
  order by c.nome
$$;
revoke all on function public.horas_acesso_projeto(uuid) from public;
revoke execute on function public.horas_acesso_projeto(uuid) from anon;
grant execute on function public.horas_acesso_projeto(uuid) to authenticated;

-- ============================================================================
-- Depois de aplicar:
--   1. get_advisors(security) — nada novo em horas_*.
--   2. /horas/config/projetos: escolhe o projeto, marca/desmarca as pessoas.
--      Quem nasce marcado é quem já via pela área; o que difere do padrão fica
--      sinalizado como "concedido"/"bloqueado", com um clique para voltar ao
--      padrão (que APAGA a exceção).
--   3. Nada muda para quem não tem exceção: 0 linhas na tabela = comportamento
--      idêntico ao de antes.
--
-- Reverter:
--   drop function public.horas_acesso_projeto(uuid);
--   drop function public.horas_projetos_visiveis();
--   drop table public.horas_projeto_acesso;
--   (a tela volta a filtrar por horas_gerencias_visiveis, que continua de pé)
-- ============================================================================
