-- Migration: data-base do processo começa na volta do profissional ausente
-- (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Reporte da Edijane (07/10/2026), processo #140 / chamado #190: o Jeferson
-- estava em Ausência Programada (31/08 a 29/09) quando o gerente aprovou o
-- chamado (25/09), e o processo nasceu com data-base 25/09 — os prazos
-- correram enquanto ele estava fora.
--
-- Agora a data-base é o MAIOR entre o dia em que o processo nasce e o dia
-- seguinte ao fim da ausência (Folga de Campo ou Ausência Programada aprovadas,
-- encadeadas, via app_private.ausente_ate) do profissional. Mesma régua do SLA
-- do chamado (adm_sla_da_ausencia), que também começa no dia seguinte à volta.
--
-- Só muda a linha 'data_base' de mob_dados_do_chamado; o resto é cópia do
-- corpo aplicado por supabase_migration_mobilizacao_ct_lideranca.sql.
-- Não depende de deploy do front. Só afeta processos NOVOS; o #140 foi
-- corrigido à parte (bloco no fim).
--
-- Para derrubar: reaplicar mob_dados_do_chamado de
-- supabase_migration_mobilizacao_ct_lideranca.sql.
-- ============================================================================

create or replace function app_private.mob_dados_do_chamado(p_campos jsonb, p_solicitante uuid)
returns jsonb language sql stable set search_path to '' as $function$
  with base as (
    select
      nullif(btrim(coalesce(p_campos ->> 'projeto', '')), '') as projeto,
      nullif(btrim(coalesce(p_campos ->> 'cc', '')), '')      as cc,
      nullif(btrim(coalesce(p_campos ->> 'gestor', '')), '')  as coordenador,
      case when p_campos ->> 'profissional_id' ~* '^[0-9a-f-]{36}$'
           then (p_campos ->> 'profissional_id')::uuid end   as profissional
  ),
  lider as (
    select coalesce(
      (select g.nome from public.colaboradores c
         join public.colaboradores g on g.id = c.superior_id
        where upper(c.nome) = upper(b.coordenador)
        order by c.ativo desc nulls last limit 1),
      (select g.nome from public.colaboradores p
         join public.colaboradores c on c.id = p.superior_id
         join public.colaboradores g on g.id = c.superior_id
        where p.id = b.profissional)
    ) as gerente
    from base b
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'profissional_id',   nullif(p_campos ->> 'profissional_id', ''),
    'profissional_nome', nullif(btrim(coalesce(p_campos ->> 'profissional', '')), ''),
    'local_obra',        nullif(btrim(coalesce(p_campos ->> 'local_obra', '')), ''),
    'cod_phd',           b.projeto,
    'cod_ct',            upper(coalesce(
                           substring(b.projeto from '^([A-Za-z0-9]+-CT[0-9]+)'),
                           substring(b.cc from '^([A-Za-z0-9]+-CT[0-9]+)'))),
    'coo_phd',           b.coordenador,
    'ger_phd',           l.gerente,
    'cliente_phd',       nullif(btrim(coalesce(p_campos ->> 'cliente', '')), ''),
    'cliente_final',     nullif(btrim(coalesce(p_campos ->> 'cliente_final', '')), ''),
    'empresa_phd',       nullif(btrim(coalesce(p_campos ->> 'empresa_phd', '')), ''),
    'campos',            nullif(jsonb_strip_nulls(jsonb_build_object(
                           'contato_cliente',     nullif(btrim(coalesce(p_campos ->> 'contato_cliente', '')), ''),
                           'data_inicio_cliente', nullif(p_campos ->> 'data_inicio_cliente', ''),
                           'data_desmobilizacao', nullif(p_campos ->> 'data_desmobilizacao', ''),
                           'treinamentos',        nullif(btrim(coalesce(p_campos ->> 'treinamentos', '')), ''),
                           'centro_custo',        b.cc
                         )), '{}'::jsonb),
    -- Ausente hoje: a data-base vai para o dia seguinte à volta.
    'data_base',         to_char(greatest(
                           current_date,
                           app_private.ausente_ate(b.profissional, current_date) + 1
                         ), 'YYYY-MM-DD'),
    'solicitante_id',    p_solicitante::text,
    'movimento',         nullif(p_campos ->> 'movimento', '')
  ))
  from base b cross join lider l
$function$;

-- Correção do #140 (aplicada à parte, 07/10/2026). O gatilho de data-base
-- reprojeta só as etapas que ainda não aconteceram.
-- update public.mobilizacao_processos set data_base = '2026-09-30' where numero = 140;
