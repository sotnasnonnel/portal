-- Migration: contato do cliente em três campos e Código CT na desmobilização (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido de 27/10/2026, em duas partes:
--
-- 1) CONTATO DO CLIENTE. O chamado de mobilização passou a pedir nome,
--    telefone e e-mail do contato (contato_nome, contato_telefone,
--    contato_email) no lugar do texto livre `contato_cliente`. Os três viajam
--    para `mobilizacao_processos.campos`, como o antigo já viajava. O antigo
--    continua sendo copiado: chamado aberto antes do deploy do front ainda o
--    tem, e reprocessar um desses não pode perder o contato.
--
-- 2) CÓDIGO CT NA DESMOBILIZAÇÃO. O formulário de desmobilização não pergunta
--    projeto (é de quem SAI), e as 10 desmobilizações nasceram sem Código CT,
--    obra e cliente. Agora o processo herda esses dados da última mobilização
--    do profissional — a obra de onde ele está saindo. O que o chamado trouxer
--    vale mais que o herdado.
--
--    "Última" = a mobilização de pessoa mais recente e FINALIZADA, achada pelo
--    id do profissional ou, nos da planilha (que só têm nome), pelo nome.
--    Finalizada porque é onde a pessoa está de fato: na movimentação, a
--    mobilização para a obra nova nasce junto com a desmobilização da antiga
--    (o Pedro Gabriel, 358 e 360 em 26/10), e herdar dela poria a obra nova na
--    saída. Ordena pela data-base, porque os 124 da planilha têm o mesmo
--    criado_em (o dia da carga).
--
--    Sem mobilização finalizada, o processo nasce sem obra, como antes (o
--    Pietro e o Jefferson, 194 e 309).
--
-- APLIQUE ANTES DO DEPLOY DO FRONT: o front novo manda o contato nos três campos
-- e para de mandar `contato_cliente`. Com a função antiga, o processo de quem
-- abrir chamado nesse intervalo nasce sem contato (o chamado guarda, o processo
-- não). A ordem inversa é segura: o front antigo não manda os campos novos, e a
-- função só os copia quando existem.
--
-- Para derrubar: recrie app_private.mob_dados_do_chamado como em
-- supabase_migration_mobilizacao_data_base_ausencia.sql. Os processos
-- preenchidos na parte final ficam como estão (o histórico registra o que mudou).

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
  -- Só a desmobilização herda: as outras trazem o projeto no próprio chamado.
  ultima as (
    select m.cod_phd, m.cod_ct, m.local_obra, m.cliente_phd, m.cliente_final,
           m.empresa_phd, m.coo_phd
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
                           'contato_cliente',     nullif(btrim(coalesce(p_campos ->> 'contato_cliente', '')), ''),
                           'contato_nome',        nullif(btrim(coalesce(p_campos ->> 'contato_nome', '')), ''),
                           'contato_telefone',    nullif(btrim(coalesce(p_campos ->> 'contato_telefone', '')), ''),
                           'contato_email',       nullif(btrim(coalesce(p_campos ->> 'contato_email', '')), ''),
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

-- Desmobilizações que já existem: mesma herança, da última mobilização ANTERIOR
-- a cada uma. Só preenche o que está vazio, e registra no histórico.
with alvo as (
  select d.id,
         m.cod_phd, m.cod_ct, m.local_obra, m.cliente_phd, m.cliente_final, m.empresa_phd, m.coo_phd
    from public.mobilizacao_processos d
    cross join lateral (
      select m.*
        from public.mobilizacao_processos m
       where m.fluxo = 'mobilizacao_pessoa'
         and m.status = 'finalizado'
         and m.criado_em < d.criado_em
         and (m.profissional_id = d.profissional_id
              or upper(m.profissional_nome) = upper(d.profissional_nome))
       order by m.data_base desc nulls last, m.criado_em desc
       limit 1
    ) m
   where d.fluxo = 'desmobilizacao_pessoa'
     and d.cod_phd is null and d.cod_ct is null
),
feito as (
  update public.mobilizacao_processos d
     set cod_phd       = a.cod_phd,
         cod_ct        = a.cod_ct,
         local_obra    = coalesce(d.local_obra, a.local_obra),
         cliente_phd   = coalesce(d.cliente_phd, a.cliente_phd),
         cliente_final = coalesce(d.cliente_final, a.cliente_final),
         empresa_phd   = coalesce(d.empresa_phd, a.empresa_phd),
         coo_phd       = coalesce(d.coo_phd, a.coo_phd)
    from alvo a
   where d.id = a.id
  returning d.id, d.cod_phd, d.local_obra
)
insert into public.mobilizacao_eventos (processo_id, tipo, de, para, dados)
select f.id, 'corrigido', null, concat_ws(' · ', f.cod_phd, f.local_obra),
       jsonb_build_object('campo', 'Código CT e obra (da última mobilização)')
  from feito f
 where f.cod_phd is not null or f.local_obra is not null;
