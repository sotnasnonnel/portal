-- Migration: CT, coordenador e gerente certos no processo que nasce do chamado
-- (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Reporte da Edijane (05/10/2026), chamado #200 / processo #142:
--   - "Cód. CT" do processo recebia o CENTRO DE CUSTO do chamado ("Equipe
--     PAULO CEZAR..."), não o projeto. Agora o projeto escolhido vira o
--     Cód. PHD (TERE-CT02-MIST) e o Cód. CT sai do prefixo dele (TERE-CT02),
--     como nas 124 linhas da planilha.
--   - "Gerente PHD" recebia o campo Gestor do chamado, que é o superior
--     direto do profissional, ou seja, o COORDENADOR. Agora: Gestor -> COO PHD,
--     e o Gerente é o superior desse coordenador no cadastro do portal.
--   - Nova RPC `mobilizacao_dados_do_ct`: local e cliente da última
--     mobilização daquele CT, para o formulário do chamado se preencher sozinho.
--
-- Não depende de deploy do front: o formulário antigo manda as mesmas chaves.
-- Só afeta processos NOVOS (e reprocessamentos); os já abertos ficam como estão.
--
-- Para derrubar: reaplicar mob_dados_do_chamado de
-- supabase_migration_mobilizacao_inclusao_treinamento.sql e
--     drop function if exists public.mobilizacao_dados_do_ct(text);
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Chamado -> processo
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_dados_do_chamado(p_campos jsonb, p_solicitante uuid)
returns jsonb language sql stable set search_path = '' as $$
  with base as (
    select
      nullif(btrim(coalesce(p_campos ->> 'projeto', '')), '') as projeto,
      nullif(btrim(coalesce(p_campos ->> 'cc', '')), '')      as cc,
      nullif(btrim(coalesce(p_campos ->> 'gestor', '')), '')  as coordenador,
      case when p_campos ->> 'profissional_id' ~* '^[0-9a-f-]{36}$'
           then (p_campos ->> 'profissional_id')::uuid end   as profissional
  ),
  lider as (
    -- O gerente é o superior do coordenador. Procura o coordenador pelo nome
    -- digitado (o campo é editável); se não achar, sobe dois níveis a partir
    -- do profissional.
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
    -- CT = prefixo do projeto (TERE-CT02-MIST -> TERE-CT02). Sem projeto
    -- (inclusão de treinamento), vale o CC só quando ele já é um código de CT.
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
    'data_base',         to_char(current_date, 'YYYY-MM-DD'),
    'solicitante_id',    p_solicitante::text,
    'movimento',         nullif(p_campos ->> 'movimento', '')
  ))
  from base b cross join lider l
$$;

-- ----------------------------------------------------------------------------
-- 2) Local e cliente da última mobilização do CT
--
-- Definer porque quem abre o chamado não lê mobilizacao_processos. Devolve só
-- local e clientes: nada de pessoa.
-- ----------------------------------------------------------------------------
create or replace function public.mobilizacao_dados_do_ct(p_cod_ct text)
returns table (local_obra text, cliente_phd text, cliente_final text, empresa_phd text)
language sql stable security definer set search_path = '' as $$
  select p.local_obra, p.cliente_phd, p.cliente_final, p.empresa_phd
    from public.mobilizacao_processos p
   where upper(p.cod_ct) = upper(btrim(p_cod_ct))
     and p.local_obra is not null
     and p.fluxo like 'mobilizacao%'
   order by p.criado_em desc
   limit 1
$$;
revoke all on function public.mobilizacao_dados_do_ct(text) from public;
revoke execute on function public.mobilizacao_dados_do_ct(text) from anon;
grant execute on function public.mobilizacao_dados_do_ct(text) to authenticated;

commit;

notify pgrst, 'reload schema';
