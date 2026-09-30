-- Migration: Candidatos (Gestão de Pessoas) (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do André (30/09/2026): quem está em processo de contratação não
-- existia no portal, e o RH abria passagem/hospedagem no nome de OUTRA pessoa
-- com um comentário "é para fulano". Agora o RH cadastra o candidato, ele
-- aparece nos campos de pessoa do Atendimento (decisão do usuário: TODOS os
-- serviços), e "Promover para o quadro" oficializa a contratação.
--
-- ONDE O CANDIDATO MORA — e por quê: na PRÓPRIA tabela colaboradores, com
-- `candidato = true` e `ativo = false`.
--   * Chamado, processo de mobilização e o "para quem é" apontam para
--     colaboradores com chave estrangeira. Numa tabela à parte o candidato não
--     poderia ser escolhido ali, e a promoção teria de remendar referências.
--     Aqui a promoção só ATIVA o mesmo registro: tudo que já foi lançado no nome
--     dele continua ligado.
--   * `ativo = false` faz TODA tela que lista ativos (quase todas) ignorá-lo sem
--     ser tocada. Só os lugares escolhidos passam a incluí-lo.
--   * O gestor fica em `candidato_gestor_id`, e NÃO em `superior_id`:
--     app_private.descendentes segue superior_id sem olhar `ativo`, e o
--     candidato apareceria nas telas de equipe. Vira superior na promoção.
--   * Sem e-mail até a promoção: sem e-mail, não há login a vincular.
--
-- Junto: chamados_adm_pessoas era executável pelo ANON (lista de nomes de
-- todos os funcionários sem login). Recriada só para authenticated.
--
-- ORDEM DE DEPLOY: pode ir antes do front. A coluna nova no fim de
-- chamados_adm_pessoas é ignorada pelo front antigo; candidatos só existem
-- depois que alguém os cadastrar pela tela nova.
-- ============================================================================

alter table public.colaboradores
  add column if not exists candidato boolean not null default false,
  add column if not exists candidato_gestor_id uuid references public.colaboradores(id),
  add column if not exists candidato_previsao date,
  add column if not exists candidato_obs text,
  add column if not exists candidato_criado_por uuid references public.colaboradores(id),
  add column if not exists candidato_criado_em timestamptz,
  add column if not exists promovido_em timestamptz,
  add column if not exists promovido_por uuid references public.colaboradores(id);

-- Candidato nunca é ativo nem tem login: é o que mantém as outras telas limpas.
alter table public.colaboradores drop constraint if exists colaboradores_candidato_inativo;
alter table public.colaboradores add constraint colaboradores_candidato_inativo
  check (candidato is not true or (ativo is false and auth_id is null));

comment on column public.colaboradores.candidato is
  'Pessoa em processo de contratação (tela Candidatos). Sempre ativo=false; aparece só nos campos de pessoa do Atendimento até ser promovida.';

-- ----------------------------------------------------------------------------
-- 1) Dropdowns do Atendimento: ativos + candidatos
-- ----------------------------------------------------------------------------
drop function if exists public.chamados_adm_pessoas();
create function public.chamados_adm_pessoas()
returns table (id uuid, nome text, superior_id uuid, superior_nome text, candidato boolean)
language sql stable security definer set search_path to '' as $$
  select c.id, c.nome, coalesce(c.superior_id, c.candidato_gestor_id), s.nome, c.candidato
  from public.colaboradores c
  left join public.colaboradores s on s.id = coalesce(c.superior_id, c.candidato_gestor_id)
  where c.ativo is not false or c.candidato
  order by c.nome
$$;
revoke all on function public.chamados_adm_pessoas() from public, anon;
grant execute on function public.chamados_adm_pessoas() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2) A tela Candidatos (RH = admin do DP, as mesmas pessoas do Cadastro)
-- ----------------------------------------------------------------------------
create or replace function app_private.pode_gerir_candidatos()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_admin() or app_private.is_rh_dp() or app_private.is_portal_super_admin()
$$;
revoke all on function app_private.pode_gerir_candidatos() from public;
grant execute on function app_private.pode_gerir_candidatos() to authenticated;

create or replace function public.candidatos_listar()
returns table (id uuid, nome text, funcao text, formato text, gestor_id uuid, gestor_nome text,
               previsao date, obs text, criado_em timestamptz, criado_por_nome text, chamados int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.funcao, c.formato, c.candidato_gestor_id, g.nome,
         c.candidato_previsao, c.candidato_obs, c.candidato_criado_em, cp.nome,
         (select count(*)::int from public.chamados_adm ch
           where ch.colaborador_id = c.id
              or exists (select 1 from jsonb_each_text(ch.campos) kv where kv.value = c.id::text))
  from public.colaboradores c
  left join public.colaboradores g on g.id = c.candidato_gestor_id
  left join public.colaboradores cp on cp.id = c.candidato_criado_por
  where c.candidato and app_private.pode_gerir_candidatos()
  order by c.nome
$$;
revoke all on function public.candidatos_listar() from public, anon;
grant execute on function public.candidatos_listar() to authenticated;

-- Cria (p_id null) ou edita um candidato.
create or replace function public.candidato_salvar(
  p_id uuid, p_nome text, p_funcao text default null, p_formato text default null,
  p_gestor uuid default null, p_previsao date default null, p_obs text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_id uuid;
begin
  if not app_private.pode_gerir_candidatos() then
    raise exception 'Apenas o RH cadastra candidatos.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(p_nome), '') is null then
    raise exception 'Informe o nome do candidato.';
  end if;

  if p_id is null then
    insert into public.colaboradores
      (nome, funcao, formato, ativo, candidato, candidato_gestor_id, candidato_previsao,
       candidato_obs, candidato_criado_por, candidato_criado_em, perfil)
    values
      (upper(trim(p_nome)), nullif(trim(p_funcao), ''), nullif(p_formato, ''), false, true, p_gestor, p_previsao,
       nullif(trim(p_obs), ''), v_me, now(), 'usuario')
    returning id into v_id;
    return v_id;
  end if;

  update public.colaboradores c
     set nome = upper(trim(p_nome)),
         funcao = nullif(trim(p_funcao), ''),
         formato = nullif(p_formato, ''),
         candidato_gestor_id = p_gestor,
         candidato_previsao = p_previsao,
         candidato_obs = nullif(trim(p_obs), '')
   where c.id = p_id and c.candidato
  returning c.id into v_id;
  if v_id is null then raise exception 'Candidato não encontrado.'; end if;
  return v_id;
end $$;
revoke all on function public.candidato_salvar(uuid, text, text, text, uuid, date, text) from public, anon;
grant execute on function public.candidato_salvar(uuid, text, text, text, uuid, date, text) to authenticated;

-- "Promover para o quadro": o MESMO registro vira funcionário ativo. O e-mail
-- corporativo é o que vincula o login Microsoft; o resto se completa no Cadastro.
create or replace function public.candidato_promover(
  p_id uuid, p_email text, p_data_admissao date, p_formato text, p_perfil text default 'usuario',
  p_funcao text default null, p_superior uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me    uuid := app_private.my_colaborador_id();
  v_email text := lower(nullif(trim(p_email), ''));
  v_cand  public.colaboradores;
begin
  if not app_private.pode_gerir_candidatos() then
    raise exception 'Apenas o RH promove candidatos.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_cand from public.colaboradores c where c.id = p_id and c.candidato for update;
  if v_cand.id is null then raise exception 'Candidato não encontrado.'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe o e-mail corporativo — é com ele que a pessoa entra no portal.';
  end if;
  if exists (select 1 from public.colaboradores c where lower(c.email) = v_email and c.id <> p_id) then
    raise exception 'Já existe um funcionário com esse e-mail. Se a pessoa já foi cadastrada pelo Cadastro, avise para unificarmos os dois registros.';
  end if;
  if p_data_admissao is null then raise exception 'Informe a data de admissão.'; end if;
  if nullif(p_formato, '') is null then raise exception 'Informe a modalidade.'; end if;
  if coalesce(p_perfil, 'usuario') not in ('usuario', 'coordenador', 'gestor') then
    raise exception 'Perfil inválido para promoção (admin é dado no Gerenciar acessos).';
  end if;

  update public.colaboradores c
     set candidato     = false,
         ativo         = true,
         email         = v_email,
         data_admissao = p_data_admissao,
         formato       = p_formato,
         perfil        = coalesce(p_perfil, 'usuario'),
         funcao        = coalesce(nullif(trim(p_funcao), ''), c.funcao),
         superior_id   = coalesce(p_superior, c.candidato_gestor_id),
         promovido_em  = now(),
         promovido_por = v_me
   where c.id = p_id;
end $$;
revoke all on function public.candidato_promover(uuid, text, date, text, text, text, uuid) from public, anon;
grant execute on function public.candidato_promover(uuid, text, date, text, text, text, uuid) to authenticated;

-- Desistência: some da lista. Se ninguém lançou nada no nome dele, o registro é
-- apagado; se já houver chamado, ele fica guardado (inativo, sem ser candidato)
-- para o histórico continuar mostrando o nome.
--
-- A checagem de vínculo é EXPLÍCITA: a pessoa escolhida num formulário do
-- Atendimento mora dentro de chamados_adm.campos (jsonb), sem chave
-- estrangeira. Confiar só no erro de FK deixaria apagar, e o chamado passaria a
-- mostrar um UUID no lugar do nome.
create or replace function public.candidato_descartar(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_usado boolean;
begin
  if not app_private.pode_gerir_candidatos() then
    raise exception 'Apenas o RH descarta candidatos.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.colaboradores c where c.id = p_id and c.candidato) then
    raise exception 'Candidato não encontrado.';
  end if;

  select exists (
    select 1 from public.chamados_adm ch
     where ch.colaborador_id = p_id or ch.solicitante_id = p_id or ch.atendente_id = p_id
        or exists (select 1 from jsonb_each_text(ch.campos) kv where kv.value = p_id::text)
  ) into v_usado;

  if not v_usado then
    begin
      delete from public.colaboradores c where c.id = p_id and c.candidato;
      return 'apagado';
    exception when foreign_key_violation then
      null;  -- apontado por outra tabela: cai no arquivamento abaixo
    end;
  end if;

  update public.colaboradores c set candidato = false where c.id = p_id;
  return 'arquivado';
end $$;
revoke all on function public.candidato_descartar(uuid) from public, anon;
grant execute on function public.candidato_descartar(uuid) to authenticated;

notify pgrst, 'reload schema';
