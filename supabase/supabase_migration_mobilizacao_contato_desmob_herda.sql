-- Migration: desmobilização herda o contato do cliente; chamado 61 (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Continuação de supabase_migration_mobilizacao_contato_ct_desmob.sql
-- (27/10/2026).
--
-- 1) A desmobilização já herdava Código CT, obra e cliente da última
--    mobilização FINALIZADA do profissional (a obra de onde ele sai). Agora
--    herda também o contato do setor do cliente — os três campos novos e o
--    texto livre antigo. O que o chamado trouxer vale mais que o herdado.
--    Nenhuma das 10 desmobilizações existentes ganha contato: todas saem de
--    mobilizações da planilha, que não tem contato.
--
-- 2) O chamado 61 tinha contato e o processo não recebeu (foi aberto antes de
--    o gatilho copiar o campo). Copia, com registro no histórico.
--
-- Sem pré-requisito de deploy.
--
-- Para derrubar: recrie app_private.mob_dados_do_chamado como em
-- supabase_migration_mobilizacao_contato_ct_desmob.sql.

create or replace function app_private.mob_dados_do_chamado(p_campos jsonb, p_solicitante uuid)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  with base as (
    select
      nullif(btrim(coalesce(p_campos ->> 'projeto', '')), '') as projeto,
      nullif(btrim(coalesce(p_campos ->> 'cc', '')), '')      as cc,
      nullif(btrim(coalesce(p_campos ->> 'gestor', '')), '')  as coordenador,
      nullif(btrim(coalesce(p_campos ->> 'profissional', '')), '') as nome,
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
  ),
  -- Só a desmobilização herda: as outras trazem projeto e contato no próprio
  -- chamado.
  ultima as (
    select m.cod_phd, m.cod_ct, m.local_obra, m.cliente_phd, m.cliente_final,
           m.empresa_phd, m.coo_phd, m.campos
      from base b
      join public.mobilizacao_processos m
        on m.fluxo = 'mobilizacao_pessoa'
       and m.status = 'finalizado'
       and (m.profissional_id = b.profissional
            or (b.nome is not null and upper(m.profissional_nome) = upper(b.nome)))
     where p_campos ->> 'movimento' = 'Desmobilização'
     order by m.data_base desc nulls last, m.criado_em desc
     limit 1
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'profissional_id',   nullif(p_campos ->> 'profissional_id', ''),
    'profissional_nome', b.nome,
    'local_obra',        coalesce(nullif(btrim(coalesce(p_campos ->> 'local_obra', '')), ''), u.local_obra),
    'cod_phd',           coalesce(b.projeto, u.cod_phd),
    'cod_ct',            coalesce(upper(coalesce(
                           substring(b.projeto from '^([A-Za-z0-9]+-CT[0-9]+)'),
                           substring(b.cc from '^([A-Za-z0-9]+-CT[0-9]+)'))), u.cod_ct),
    'coo_phd',           coalesce(b.coordenador, u.coo_phd),
    'ger_phd',           l.gerente,
    'cliente_phd',       coalesce(nullif(btrim(coalesce(p_campos ->> 'cliente', '')), ''), u.cliente_phd),
    'cliente_final',     coalesce(nullif(btrim(coalesce(p_campos ->> 'cliente_final', '')), ''), u.cliente_final),
    'empresa_phd',       coalesce(nullif(btrim(coalesce(p_campos ->> 'empresa_phd', '')), ''), u.empresa_phd),
    'campos',            nullif(jsonb_strip_nulls(jsonb_build_object(
                           'contato_cliente',     coalesce(nullif(btrim(coalesce(p_campos ->> 'contato_cliente', '')), ''), u.campos ->> 'contato_cliente'),
                           'contato_nome',        coalesce(nullif(btrim(coalesce(p_campos ->> 'contato_nome', '')), ''), u.campos ->> 'contato_nome'),
                           'contato_telefone',    coalesce(nullif(btrim(coalesce(p_campos ->> 'contato_telefone', '')), ''), u.campos ->> 'contato_telefone'),
                           'contato_email',       coalesce(nullif(btrim(coalesce(p_campos ->> 'contato_email', '')), ''), u.campos ->> 'contato_email'),
                           'data_inicio_cliente', nullif(p_campos ->> 'data_inicio_cliente', ''),
                           'data_desmobilizacao', nullif(p_campos ->> 'data_desmobilizacao', ''),
                           'treinamentos',        nullif(btrim(coalesce(p_campos ->> 'treinamentos', '')), ''),
                           'centro_custo',        b.cc
                         )), '{}'::jsonb),
    'data_base',         to_char(greatest(
                           current_date,
                           app_private.ausente_ate(b.profissional, current_date) + 1
                         ), 'YYYY-MM-DD'),
    'solicitante_id',    p_solicitante::text,
    'movimento',         nullif(p_campos ->> 'movimento', '')
  ))
  from base b
  cross join lider l
  left join ultima u on true
$function$;

-- Contato que ficou no chamado e não chegou ao processo (só o 61, em 27/10/2026).
with feito as (
  update public.mobilizacao_processos p
     set campos = coalesce(p.campos, '{}'::jsonb)
                  || jsonb_build_object('contato_cliente', btrim(c.campos ->> 'contato_cliente'))
    from public.chamados_adm c
   where c.id = p.origem_chamado_id
     and nullif(btrim(c.campos ->> 'contato_cliente'), '') is not null
     and p.campos ->> 'contato_cliente' is null
     and p.campos ->> 'contato_nome' is null
  returning p.id, p.campos ->> 'contato_cliente' as contato
)
insert into public.mobilizacao_eventos (processo_id, tipo, de, para, dados)
select f.id, 'corrigido', null, f.contato, jsonb_build_object('campo', 'Contato no cliente (do chamado)')
  from feito f;
