-- ============================================================================
-- Controle de Horas — EQUIPES ancoradas na liderança do organograma
-- ----------------------------------------------------------------------------
-- Problema: a migração "uma área por gestor" criou 1 área para CADA
-- colaboradores.perfil='gestor' (29 áreas). Mas o portal tem muito mais
-- "gestores" do que a empresa tem LÍDERES DE EQUIPE reais. Resultado: uma
-- mesma equipe do organograma virava várias áreas no Horas.
--   Ex.: no organograma, André e Vinicius são a MESMA equipe (gerente do
--        Vinicius = André). No portal ambos são perfil='gestor', então cada
--        um ganhou área própria — e a equipe do André ficou fragmentada.
--
-- Decisão (validada com o organograma): a "equipe/área" do Horas é ancorada
-- nos LÍDERES REAIS. São 12, identificados no organograma (campo `gerente`) e
-- resolvidos 1:1 para gestores ativos no portal (ids abaixo, conferidos).
--   Cada pessoa passa a pertencer à área do líder MAIS PRÓXIMO subindo a
--   árvore colaboradores.superior_id (a árvore do portal, que é completa e
--   confiável — não dependemos do vínculo por nome em runtime).
--
-- Config (projetos/atividades): além do líder dono, qualquer gestor/
-- coordenador que PERTENÇA à equipe pode manter a área (ex.: Vinicius mantém
-- a área do André). Ver pode_gerir_gerencia no fim.
--
-- Reversível (snapshot em horas_gerencia_bkp_lideranca). Idempotente.
-- Ver também: supabase_migration_horas_area_por_gestor.sql (o modelo antigo) e
-- supabase_migration_horas_projetos_heranca.sql (herança de projetos p/ cima).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Snapshot dos vínculos atuais (captura só na 1ª execução).
-- ----------------------------------------------------------------------------
create table if not exists public.horas_gerencia_bkp_lideranca as
select id as colaborador_id, horas_gerencia_id, now() as snapshot_em
from public.colaboradores;

-- ----------------------------------------------------------------------------
-- 1) Re-vincular cada pessoa ativa à área do LÍDER mais próximo (subindo a
--    árvore). Quem não tem líder na cadeia (executivos no topo) fica como está.
-- ----------------------------------------------------------------------------
with recursive leads(id) as (
  values
    ('0e3d897c-93ea-4868-b6c2-cbbe7e2aedc7'::uuid), -- Paulo Paiva  (PAULO CEZAR DE PAIVA NETO)
    ('cc0a1e8e-64d4-463b-a970-ca2d81fe9ddc'::uuid), -- Bruno Azevedo (BRUNO ALBERTO AZEVEDO)
    ('73eb06b9-f073-4843-a446-bbbd1b619c0f'::uuid), -- Leonardo Drumond
    ('56b78f2a-ebe4-4ba7-ba56-11d101cd03c4'::uuid), -- Ivano Cruz
    ('0d09456b-16f5-4b8c-a820-24f2de7708a7'::uuid), -- Eduardo Eler
    ('f0e7b62f-53eb-49d6-87b1-7df524bc33b2'::uuid), -- Tulio Morais (TULIO RAFAEL DE MORAIS NEIVA)
    ('057a1ee2-8280-4bec-91ac-388175f2f070'::uuid), -- André Guimarães
    ('26e914c2-5057-43a9-9efc-96ca2e4bf88f'::uuid), -- Henrique Santos
    ('62275900-e9be-4800-a490-1dc63eb03f9e'::uuid), -- Pedro Morais
    ('1f6fda3d-2175-4956-9e1d-205b87796251'::uuid), -- Daniela Sebrian
    ('554ec9c1-c4fb-4b5a-b4a6-040c835acca5'::uuid), -- Lucas Ferraz
    ('db9635af-ad70-4679-9cfa-7be97978204b'::uuid)  -- Pedro Nery
),
walk as (
  select c.id as colab_id, c.id as node_id, c.superior_id, 0 as depth
  from public.colaboradores c where c.ativo
  union all
  select w.colab_id, s.id, s.superior_id, w.depth + 1
  from walk w
  join public.colaboradores s on s.id = w.superior_id
  where w.depth < 60 and w.node_id not in (select id from leads) -- não sobe acima de um líder
),
nearest as (
  select colab_id, node_id as lead_id,
         row_number() over (partition by colab_id order by depth) as rn
  from walk where node_id in (select id from leads)
)
update public.colaboradores c
set horas_gerencia_id = g.id
from nearest n
join public.horas_gerencias g on g.gestor_id = n.lead_id
where n.rn = 1 and n.colab_id = c.id
  and c.horas_gerencia_id is distinct from g.id;

-- ----------------------------------------------------------------------------
-- 2) Aposentar as áreas de sub-gestores que ficaram VAZIAS (sem colaboradores
--    e sem apontamentos). Mantém: as 12 áreas dos líderes, a "Gerência Geral"
--    (gestor_id null, tem projetos) e qualquer área ainda em uso.
-- ----------------------------------------------------------------------------
delete from public.horas_gerencias g
where g.gestor_id is not null
  and g.id not in (
    '99d111b9-5b6e-4566-9eb3-0d409f0d82de', -- Paulo
    'a905f944-a9e7-42e4-8302-c015752e714a', -- Bruno
    '3e654abb-d8ac-480c-84ea-188312bcdcf5', -- Leonardo
    '3bf9e49e-7bbd-4208-9a21-0d2a58aec08b', -- Ivano
    '51eaa717-f4ee-43b7-b7f0-64e6f13ee077', -- Eduardo
    '57a0ab58-d4c3-472c-8665-65ec9077365c', -- Tulio
    '57b43840-6cd0-4b98-8d5a-d801cedf59df', -- André
    '731e4bb8-bb4f-4a92-868b-c7d2b92be5f7', -- Henrique
    '6d86dd41-bc2a-4a45-ae49-15b5f956be53', -- Pedro Morais
    '7784f40d-fdf1-493b-a984-b21c7b48c926', -- Daniela
    'c966c59b-88f7-414b-bf90-e4ad0632165b', -- Lucas
    '6d46052d-ae58-450e-931b-0fdcb634e8ca'  -- Pedro Nery
  )
  and not exists (select 1 from public.colaboradores c where c.horas_gerencia_id = g.id)
  and not exists (select 1 from public.horas_apontamentos a where a.gerencia_id = g.id);

-- ----------------------------------------------------------------------------
-- 3) Config: líder dono OU qualquer gestor/coordenador que pertença à equipe.
-- ----------------------------------------------------------------------------
create or replace function app_private.pode_gerir_gerencia(p_gerencia uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_admin()
      or app_private.is_portal_super_admin()
      or exists (
        select 1 from public.horas_gerencias g
        where g.id = p_gerencia and g.gestor_id = app_private.my_colaborador_id()
      )
      or (
        app_private.my_horas_role() in ('gestor', 'coordenador')
        and p_gerencia is not null
        and p_gerencia = app_private.my_horas_gerencia()
      )
$$;

-- ============================================================================
-- Reverter (se preciso):
--   update public.colaboradores c set horas_gerencia_id = b.horas_gerencia_id
--   from public.horas_gerencia_bkp_lideranca b where b.colaborador_id = c.id;
--   (as áreas apagadas eram vazias; recriar só se necessário.)
-- ============================================================================
