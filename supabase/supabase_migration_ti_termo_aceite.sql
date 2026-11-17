-- Migration: ti_termo_aceite (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Termo de responsabilidade ACEITO PELA PRÓPRIA PESSOA no portal (17/11/2026).
--
-- Antes: o time de TI gerava o PDF ("Preparar termos"), a pessoa assinava fora
-- e a TI marcava como assinado ("Pendências de termos"). Agora as duas telas
-- viram uma só, "Termo de responsabilidade":
--
--   * a pessoa com equipamento em uso lê o termo do VÍNCULO dela e aceita;
--   * o gestor vê quem da equipe (subárvore de superior_id) já aceitou e quem
--     está pendente: isso sai de ti_ativos.situacao_termo, que ele já lê. Ele
--     NÃO lê ti_termos (tem CPF);
--   * o time de TI vê tudo, inclusive o termo aceito em PDF;
--   * quem não aceitou recebe um e-mail por dia (edge function notify-termo-ti,
--     agendada em supabase_cron_ti_termo_lembrete.sql). ti_termo_lembretes
--     guarda o envio do dia: a função não manda dois no mesmo dia.
--
-- Modelo do termo, por colaboradores.formato:
--   'PJ'                          -> PJ (comodato à contratada)
--   'Sócio Cotista', 'Diretoria'  -> Sócio Cotista
--   'CLT', vazio ou outro         -> CLT
--
-- O aceite (ti_aceitar_termo) é security definer: a pessoa não escreve em
-- ti_ativos. Ele guarda a cópia dos equipamentos, o texto aceito (versão), a
-- hora, o IP e o navegador, e marca os equipamentos como 'Assinado'.
--
-- PRÉ-REQUISITO: supabase_migration_ti.sql e supabase_migration_ti_visibilidade.sql.
-- Pode ir antes do front: só acrescenta colunas e funções.
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Colunas do aceite em ti_termos
-- ----------------------------------------------------------------------------
alter table public.ti_termos add column if not exists modelo text;
alter table public.ti_termos add column if not exists identificacao jsonb not null default '{}'::jsonb;
alter table public.ti_termos add column if not exists versao_texto text;
alter table public.ti_termos add column if not exists aceite_em timestamptz;
alter table public.ti_termos add column if not exists aceite_ip text;
alter table public.ti_termos add column if not exists aceite_user_agent text;

comment on column public.ti_termos.modelo is 'CLT, PJ ou Sócio Cotista: qual texto de termo foi usado.';
comment on column public.ti_termos.identificacao is 'Campos do quadro de identificação além de nome/CPF/e-mail: PJ {razao_social, cnpj, representante, cpf_representante}; sócio {area_atuacao}.';
comment on column public.ti_termos.aceite_em is 'Aceite eletrônico pela própria pessoa no portal (null = termo gerado em PDF pela TI, modelo antigo).';

-- ----------------------------------------------------------------------------
-- 2) Modelo pelo vínculo
-- ----------------------------------------------------------------------------
create or replace function app_private.ti_modelo_termo(p_formato text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_formato = 'PJ' then 'PJ'
    when p_formato in ('Sócio Cotista', 'Diretoria') then 'Sócio Cotista'
    else 'CLT'
  end
$$;
revoke all on function app_private.ti_modelo_termo(text) from public;
revoke execute on function app_private.ti_modelo_termo(text) from anon;
grant execute on function app_private.ti_modelo_termo(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) O que a tela precisa para montar o termo da pessoa logada.
--    CPF/razão social/CNPJ vêm preenchidos quando já existem: último termo
--    dela ou o cadastro do Fechamento PJ (pj_prestadores, pelo e-mail).
-- ----------------------------------------------------------------------------
create or replace function public.ti_meu_termo()
returns jsonb language sql stable security definer set search_path = '' as $$
  with eu as (
    select c.id, c.nome, lower(c.email) as email, c.formato, c.funcao, c.data_admissao
      from public.colaboradores c
     where c.auth_id = (select auth.uid()) and c.email is not null
     limit 1
  ),
  ultimo as (
    select t.cpf, t.identificacao
      from public.ti_termos t, eu
     where lower(t.pessoa_email) = eu.email and t.cpf is not null
     order by t.criado_em desc
     limit 1
  ),
  pj as (
    select p.razao_social, p.cnpj, p.cpf
      from public.pj_prestadores p, eu
     where lower(p.email) = eu.email
     order by p.atualizado_em desc nulls last
     limit 1
  )
  select jsonb_build_object(
    'nome', eu.nome,
    'email', eu.email,
    'vinculo', eu.formato,
    'modelo', app_private.ti_modelo_termo(eu.formato),
    'funcao', eu.funcao,
    'data_admissao', eu.data_admissao,
    'cpf', coalesce((select cpf from ultimo), (select cpf from pj)),
    'razao_social', coalesce((select identificacao->>'razao_social' from ultimo), (select razao_social from pj)),
    'cnpj', coalesce((select identificacao->>'cnpj' from ultimo), (select cnpj from pj)),
    'representante', (select identificacao->>'representante' from ultimo),
    'cpf_representante', (select identificacao->>'cpf_representante' from ultimo),
    'area_atuacao', (select identificacao->>'area_atuacao' from ultimo)
  )
  from eu
$$;
revoke all on function public.ti_meu_termo() from public;
revoke execute on function public.ti_meu_termo() from anon;
grant execute on function public.ti_meu_termo() to authenticated;

-- ----------------------------------------------------------------------------
-- 4) Aceite. Cobre TODOS os equipamentos em uso com a pessoa no momento.
-- ----------------------------------------------------------------------------
create or replace function public.ti_aceitar_termo(p_cpf text, p_ident jsonb, p_versao text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_eu record;
  v_modelo text;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_ident jsonb := coalesce(p_ident, '{}'::jsonb);
  v_ids uuid[];
  v_ativos jsonb;
  v_pendentes int;
  v_cidade text;
  v_hoje date := app_private.hoje_brasil();
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_termo public.ti_termos;
begin
  select c.id, c.nome, lower(c.email) as email, c.formato, c.data_admissao
    into v_eu
    from public.colaboradores c
   where c.auth_id = (select auth.uid()) and coalesce(c.ativo, true) and c.email is not null
   limit 1;
  if v_eu.id is null then
    raise exception 'Cadastro não encontrado.' using errcode = '42501';
  end if;
  v_modelo := app_private.ti_modelo_termo(v_eu.formato);

  if length(v_cpf) <> 11 then
    raise exception 'Informe um CPF válido.' using errcode = '22023';
  end if;
  if v_modelo = 'PJ' and (
       coalesce(trim(v_ident->>'razao_social'), '') = ''
    or length(regexp_replace(coalesce(v_ident->>'cnpj', ''), '\D', '', 'g')) <> 14
    or coalesce(trim(v_ident->>'representante'), '') = ''
    or length(regexp_replace(coalesce(v_ident->>'cpf_representante', ''), '\D', '', 'g')) <> 11
  ) then
    raise exception 'Preencha razão social, CNPJ, representante legal e CPF do representante.' using errcode = '22023';
  end if;

  select array_agg(a.id order by a.tipo, a.numero_serie),
         jsonb_agg(jsonb_build_object(
           'id', a.id, 'numero_serie', a.numero_serie, 'tipo', a.tipo, 'modelo', a.modelo,
           'descricao', a.descricao, 'configuracao', a.configuracao, 'fornecedor', a.fornecedor,
           'valor_mensal', a.valor_mensal) order by a.tipo, a.numero_serie),
         count(*) filter (where a.situacao_termo is distinct from 'Assinado'),
         max(a.cidade)
    into v_ids, v_ativos, v_pendentes, v_cidade
    from public.ti_ativos a
   where lower(trim(a.responsavel)) = v_eu.email
     and a.situacao = 'Em utilização';

  if v_ids is null then
    raise exception 'Não há equipamento em uso com você.' using errcode = '22023';
  end if;
  if v_pendentes = 0 then
    raise exception 'Seu termo já está aceito.' using errcode = '22023';
  end if;

  insert into public.ti_termos (
    pessoa_email, pessoa_nome, cpf, vinculo, modelo, identificacao, data_admissao, cidade,
    data_termo, ativos, status, data_assinatura, versao_texto, aceite_em, aceite_ip, aceite_user_agent
  ) values (
    v_eu.email, v_eu.nome,
    substr(v_cpf, 1, 3) || '.' || substr(v_cpf, 4, 3) || '.' || substr(v_cpf, 7, 3) || '-' || substr(v_cpf, 10, 2),
    v_eu.formato, v_modelo,
    jsonb_strip_nulls(jsonb_build_object(
      'razao_social', nullif(trim(v_ident->>'razao_social'), ''),
      'cnpj', nullif(trim(v_ident->>'cnpj'), ''),
      'representante', nullif(trim(v_ident->>'representante'), ''),
      'cpf_representante', nullif(trim(v_ident->>'cpf_representante'), ''),
      'area_atuacao', nullif(trim(v_ident->>'area_atuacao'), '')
    )),
    v_eu.data_admissao, coalesce(v_cidade, 'BELO HORIZONTE'),
    v_hoje, v_ativos, 'Assinado', v_hoje, nullif(trim(p_versao), ''), now(),
    left(split_part(coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1), 64),
    left(v_headers->>'user-agent', 400)
  )
  returning * into v_termo;

  update public.ti_ativos
     set situacao_termo = 'Assinado',
         data_assinatura_termo = v_hoje,
         data_envio_termo = coalesce(data_envio_termo, v_hoje)
   where id = any (v_ids);

  return to_jsonb(v_termo);
end;
$$;
revoke all on function public.ti_aceitar_termo(text, jsonb, text) from public;
revoke execute on function public.ti_aceitar_termo(text, jsonb, text) from anon;
grant execute on function public.ti_aceitar_termo(text, jsonb, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) Lembretes por e-mail: um por pessoa por dia. Escreve só a edge function
--    (service role); o time de TI lê para mostrar o último envio.
-- ----------------------------------------------------------------------------
create table if not exists public.ti_termo_lembretes (
  pessoa_email text not null,
  dia date not null,
  enviado_em timestamptz not null default now(),
  primary key (pessoa_email, dia)
);
alter table public.ti_termo_lembretes enable row level security;
revoke all on public.ti_termo_lembretes from anon;
revoke all on public.ti_termo_lembretes from authenticated;
grant select on public.ti_termo_lembretes to authenticated;
drop policy if exists ti_termo_lembretes_select on public.ti_termo_lembretes;
create policy ti_termo_lembretes_select on public.ti_termo_lembretes for select to authenticated
  using (app_private.ti_time());

notify pgrst, 'reload schema';
