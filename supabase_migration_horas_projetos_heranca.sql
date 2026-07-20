-- ============================================================================
-- Controle de Horas — herança de PROJETOS pela cadeia de gestores
-- ----------------------------------------------------------------------------
-- Problema: ao apontar, a pessoa só via os projetos da ÚNICA área a que está
-- vinculada (horas_gerencia_id = a área do seu gestor MAIS PRÓXIMO). Quando há
-- um sub-gestor entre a pessoa e o gestor "de cima", ela ficava presa na área
-- do sub-gestor (muitas vezes vazia) e não enxergava os projetos cadastrados
-- pelo gestor acima.
--   Ex.: André (gestor) -> Vinicius (gestor) -> Milena.
--        Milena caía na "Equipe Vinicius" (0 projetos) e não via os do André.
--
-- Decisão: ao apontar, a pessoa passa a ver os projetos da SUA área MAIS os de
-- todas as áreas dos gestores ACIMA dela na árvore (colaboradores.superior_id).
--
-- A visibilidade de APONTAMENTOS (dashboards/registros) NÃO muda — continua pela
-- subárvore (app_private.descendentes). Aqui só ampliamos a lista de projetos
-- oferecida no apontamento.
--
-- horas_projetos já tem SELECT `using(true)`, então o cliente pode ler os
-- projetos; o que faltava era saber QUAIS áreas entram na cadeia. Isso exige
-- subir a árvore por superior_id, que a RLS de colaboradores bloqueia para o
-- usuário comum — daí a RPC SECURITY DEFINER abaixo (espelha descendentes()).
--
-- Aditivo e idempotente.
-- ============================================================================

-- Áreas (horas_gerencias) visíveis ao chamador ao apontar:
--   - a área à qual ele está diretamente vinculado (horas_gerencia_id); e
--   - toda área cujo dono (gestor_id) seja ele mesmo ou qualquer ancestral dele
--     na árvore de superiores.
create or replace function public.horas_gerencias_visiveis()
returns setof uuid
language sql stable security definer set search_path = '' as $$
  with recursive chain as (
    -- o próprio colaborador
    select c.id, c.superior_id, 0 as depth
    from public.colaboradores c
    where c.id = app_private.my_colaborador_id()
    union all
    -- sobe por superior_id (depth cap evita laço em caso de ciclo)
    select p.id, p.superior_id, ch.depth + 1
    from public.colaboradores p
    join chain ch on p.id = ch.superior_id
    where ch.depth < 60
  )
  select g.id
  from public.horas_gerencias g
  where g.gestor_id in (select id from chain)
  union
  select c.horas_gerencia_id
  from public.colaboradores c
  where c.id = app_private.my_colaborador_id()
    and c.horas_gerencia_id is not null
$$;
revoke all on function public.horas_gerencias_visiveis() from public;
revoke execute on function public.horas_gerencias_visiveis() from anon;  -- concedido por padrão
grant execute on function public.horas_gerencias_visiveis() to authenticated;

-- ============================================================================
-- Depois de aplicar: em /horas/apontar a pessoa passa a ver os projetos da sua
-- área e das áreas dos gestores acima dela. O apontamento é gravado na área
-- DONA do projeto escolhido (atribuição correta por projeto).
-- ============================================================================
