-- Migration: Feed — marcar pessoas (@) e aviso de posts novos (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (20/10/2026):
--   - "@" marca a pessoa. Quem é marcado recebe aviso no sino (notificacoes,
--     módulo 'feed', tipo 'mencao'). Só quem é marcado: post novo NÃO vai para
--     o sino de ninguém.
--   - Post novo aparece só onde se entra no feed (o ícone da Home), como um
--     contador do que chegou desde a última visita (colaboradores.feed_visto_em).
--
-- Marcação: `mencoes` = [{ id, nome }]. `nome` é o texto que entrou depois do
-- "@" no post ("@Lennon Santos"); a tela realça esse trecho. O banco confere
-- que cada id é colaborador ativo, tira repetidos e quem escreveu, e corta em 10.
--
-- Pré-requisito: supabase_migration_feed.sql. Aplicar ANTES do deploy do front.
-- ============================================================================

alter table public.feed_posts       add column if not exists mencoes jsonb not null default '[]'::jsonb;
alter table public.feed_comentarios add column if not exists mencoes jsonb not null default '[]'::jsonb;
alter table public.colaboradores    add column if not exists feed_visto_em timestamptz;

-- Limpa a lista que veio da tela: só ativos, sem repetir, sem o próprio autor,
-- no máximo 10; o nome mostrado fica com até 60 caracteres.
create or replace function app_private.feed_mencoes_validas(p_mencoes jsonb, p_autor uuid)
 returns jsonb language sql stable security definer set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome)), '[]'::jsonb)
    from (
      select distinct on (c.id) c.id, left(btrim(coalesce(m->>'nome', '')), 60) as nome
        from jsonb_array_elements(case when jsonb_typeof(p_mencoes) = 'array' then p_mencoes else '[]'::jsonb end) m
        join public.colaboradores c
          on c.id::text = m->>'id' and c.ativo is distinct from false
       where c.id <> p_autor and btrim(coalesce(m->>'nome', '')) <> ''
       limit 10
    ) x
$$;

-- Aviso no sino para cada marcado. Comentário usa o id do comentário como
-- referência, para cada marcação ser um aviso próprio.
create or replace function app_private.feed_avisar_mencoes(
  p_mencoes jsonb, p_autor uuid, p_post uuid, p_ref uuid, p_texto text, p_em_comentario boolean)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_nome text := (select split_part(initcap(lower(c.nome)), ' ', 1) from public.colaboradores c where c.id = p_autor);
  v_m jsonb;
begin
  for v_m in select * from jsonb_array_elements(p_mencoes) loop
    perform app_private.notificar(
      (v_m->>'id')::uuid, 'feed', 'mencao',
      v_nome || case when p_em_comentario then ' marcou você num comentário' else ' marcou você num post' end,
      left(p_texto, 140),
      '/feed?post=' || p_post::text,
      p_ref);
  end loop;
end $$;

-- ---- Busca de pessoas para o "@" ---------------------------------------------
create or replace function public.feed_pessoas(p_busca text)
 returns table(id uuid, nome text, funcao text)
 language plpgsql stable security definer set search_path to ''
as $$
declare
  v_termo text := lower(btrim(coalesce(p_busca, '')));
  -- Sem a extensão unaccent no banco: tira os acentos à mão.
  v_de   constant text := 'áàâãäéèêëíìîïóòôõöúùûüç';
  v_para constant text := 'aaaaaeeeeiiiiooooouuuuc';
begin
  if app_private.feed_eu() is null then
    raise exception 'Só colaboradores ativos usam o feed.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select c.id, c.nome, c.funcao
    from public.colaboradores c
   where c.ativo is distinct from false and c.auth_id is not null
     and (v_termo = '' or translate(lower(c.nome), v_de, v_para) like '%' || translate(v_termo, v_de, v_para) || '%')
   order by (translate(lower(c.nome), v_de, v_para) like translate(v_termo, v_de, v_para) || '%') desc, c.nome
   limit 8;
end $$;

-- ---- Postar e comentar com marcação -------------------------------------------
drop function if exists public.feed_postar(text, jsonb);
create or replace function public.feed_postar(p_texto text, p_midia jsonb default '[]'::jsonb, p_mencoes jsonb default '[]'::jsonb)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare
  v_eu      uuid := app_private.feed_eu();
  v_texto   text := btrim(coalesce(p_texto, ''));
  v_midia   jsonb := coalesce(p_midia, '[]'::jsonb);
  v_mencoes jsonb;
  v_item    jsonb;
  v_id      uuid;
begin
  if v_eu is null then
    raise exception 'Só colaboradores ativos postam.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(v_midia) <> 'array' or jsonb_array_length(v_midia) > 5 then
    raise exception 'No máximo 5 fotos por post.';
  end if;
  if v_texto = '' and jsonb_array_length(v_midia) = 0 then
    raise exception 'Escreva algo ou escolha uma foto.';
  end if;
  if char_length(v_texto) > 3000 then
    raise exception 'O texto passou de 3.000 caracteres.';
  end if;
  for v_item in select * from jsonb_array_elements(v_midia) loop
    if coalesce(v_item->>'path', '') not like v_eu::text || '/%'
       or (v_item ? 'thumb' and coalesce(v_item->>'thumb', '') not like v_eu::text || '/%') then
      raise exception 'Foto inválida.';
    end if;
  end loop;
  if (select count(*) from public.feed_posts f
       where f.autor_id = v_eu and f.criado_em > now() - interval '1 day') >= 20 then
    raise exception 'Limite de 20 posts por dia. Volte amanhã!';
  end if;
  v_mencoes := app_private.feed_mencoes_validas(p_mencoes, v_eu);
  insert into public.feed_posts (autor_id, texto, midia, mencoes)
  values (v_eu, v_texto, v_midia, v_mencoes)
  returning feed_posts.id into v_id;
  perform app_private.feed_avisar_mencoes(v_mencoes, v_eu, v_id, v_id, v_texto, false);
  return v_id;
end $$;

drop function if exists public.feed_comentar(uuid, text, uuid);
create or replace function public.feed_comentar(p_post uuid, p_texto text, p_pai uuid default null, p_mencoes jsonb default '[]'::jsonb)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare
  v_eu      uuid := app_private.feed_eu();
  v_texto   text := btrim(coalesce(p_texto, ''));
  v_pai     uuid := p_pai;
  v_mencoes jsonb;
  v_id      uuid;
begin
  if v_eu is null or not exists (
    select 1 from public.feed_posts p
     where p.id = p_post and not p.excluido and not p.oculto) then
    raise exception 'Post não encontrado.';
  end if;
  if v_texto = '' or char_length(v_texto) > 1000 then
    raise exception 'O comentário precisa ter de 1 a 1.000 caracteres.';
  end if;
  if v_pai is not null then
    select coalesce(m.pai_id, m.id) into v_pai
      from public.feed_comentarios m where m.id = p_pai and m.post_id = p_post;
    if v_pai is null then raise exception 'Comentário não encontrado.'; end if;
  end if;
  if (select count(*) from public.feed_comentarios m
       where m.autor_id = v_eu and m.criado_em > now() - interval '1 day') >= 100 then
    raise exception 'Limite de 100 comentários por dia. Volte amanhã!';
  end if;
  v_mencoes := app_private.feed_mencoes_validas(p_mencoes, v_eu);
  insert into public.feed_comentarios (post_id, autor_id, pai_id, texto, mencoes)
  values (p_post, v_eu, v_pai, v_texto, v_mencoes)
  returning feed_comentarios.id into v_id;
  update public.feed_posts p
     set comentarios = (select count(*) from public.feed_comentarios m where m.post_id = p_post and not m.excluido)
   where p.id = p_post;
  perform app_private.feed_avisar_mencoes(v_mencoes, v_eu, p_post, v_id, v_texto, true);
  return v_id;
end $$;

-- ---- Listas devolvem as marcações (e o feed abre num post só) -----------------
drop function if exists public.feed_listar(timestamptz, uuid, integer);
create or replace function public.feed_listar(
  p_cursor_em timestamptz default null, p_cursor_id uuid default null, p_limite integer default 20, p_post uuid default null)
 returns table(
  id uuid, autor_id uuid, autor_nome text, autor_funcao text, moldura text, titulo text,
  texto text, midia jsonb, mencoes jsonb, curtidas integer, comentarios integer, curti boolean,
  fixado boolean, oculto boolean, oculto_motivo text, editado_em timestamptz, criado_em timestamptz)
 language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu  uuid := app_private.feed_eu();
  v_mod boolean := app_private.feed_moderador();
begin
  if v_eu is null then
    raise exception 'Só colaboradores ativos veem o feed.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select p.id, p.autor_id, c.nome, c.funcao, pp.moldura, pp.titulo,
         p.texto, p.midia, p.mencoes, p.curtidas, p.comentarios,
         exists (select 1 from public.feed_curtidas k where k.post_id = p.id and k.colaborador_id = v_eu),
         p.fixado, p.oculto, case when v_mod or p.autor_id = v_eu then p.oculto_motivo end,
         p.editado_em, p.criado_em
    from public.feed_posts p
    join public.colaboradores c on c.id = p.autor_id
    left join public.pontos_perfil pp on pp.colaborador_id = p.autor_id
   where not p.excluido
     and (not p.oculto or v_mod or p.autor_id = v_eu)
     and (p_post is null or p.id = p_post)
     and (p_post is not null or p_cursor_em is null
          or (not p.fixado and (p.criado_em, p.id) < (p_cursor_em, p_cursor_id)))
   order by (p_cursor_em is null and p.fixado) desc, p.criado_em desc, p.id desc
   limit least(greatest(coalesce(p_limite, 20), 1), 50);
end $$;

drop function if exists public.feed_comentarios_listar(uuid);
create or replace function public.feed_comentarios_listar(p_post uuid)
 returns table(
  id uuid, pai_id uuid, autor_id uuid, autor_nome text, moldura text, titulo text,
  texto text, mencoes jsonb, oculto boolean, excluido boolean, editado_em timestamptz, criado_em timestamptz)
 language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu  uuid := app_private.feed_eu();
  v_mod boolean := app_private.feed_moderador();
begin
  if v_eu is null or not exists (
    select 1 from public.feed_posts p
     where p.id = p_post and not p.excluido and (not p.oculto or v_mod or p.autor_id = v_eu)) then
    raise exception 'Post não encontrado.';
  end if;
  return query
  select m.id, m.pai_id, m.autor_id, c.nome, pp.moldura, pp.titulo,
         case when m.excluido or (m.oculto and not v_mod and m.autor_id <> v_eu) then null else m.texto end,
         m.mencoes, m.oculto, m.excluido, m.editado_em, m.criado_em
    from public.feed_comentarios m
    join public.colaboradores c on c.id = m.autor_id
    left join public.pontos_perfil pp on pp.colaborador_id = m.autor_id
   where m.post_id = p_post
     and (not m.excluido
          or exists (select 1 from public.feed_comentarios r where r.pai_id = m.id and not r.excluido))
     and (not m.oculto or v_mod or m.autor_id = v_eu
          or exists (select 1 from public.feed_comentarios r where r.pai_id = m.id and not r.excluido))
   order by m.criado_em, m.id
   limit 1000;
end $$;

-- ---- Posts novos desde a última visita (só o ícone do feed mostra) -----------
create or replace function public.feed_novidades()
 returns integer language sql stable security definer set search_path to ''
as $$
  select count(*)::int
    from public.feed_posts p, public.colaboradores c
   where c.id = app_private.feed_eu()
     and not p.excluido and not p.oculto and p.autor_id <> c.id
     and p.criado_em > coalesce(c.feed_visto_em, now() - interval '7 days')
$$;

create or replace function public.feed_marcar_visto()
 returns void language sql security definer set search_path to ''
as $$
  update public.colaboradores set feed_visto_em = now() where id = app_private.feed_eu()
$$;

revoke all on function
  public.feed_pessoas(text), public.feed_postar(text, jsonb, jsonb), public.feed_comentar(uuid, text, uuid, jsonb),
  public.feed_listar(timestamptz, uuid, integer, uuid), public.feed_comentarios_listar(uuid),
  public.feed_novidades(), public.feed_marcar_visto()
  from public, anon;
grant execute on function
  public.feed_pessoas(text), public.feed_postar(text, jsonb, jsonb), public.feed_comentar(uuid, text, uuid, jsonb),
  public.feed_listar(timestamptz, uuid, integer, uuid), public.feed_comentarios_listar(uuid),
  public.feed_novidades(), public.feed_marcar_visto()
  to authenticated;

-- ============================================================================
-- @todos e diretório do "@" (20/10/2026, pedido do usuário). Já aplicado.
--   - @todos ({ id: 'todos', nome: 'todos' }) avisa todo colaborador ativo com
--     acesso ao portal (138 pessoas em 20/10/2026). Só quem é RH (rh_dp) ou
--     admin do portal pode usar: para os demais, a marcação é descartada em
--     silêncio e o post sai normal.
--   - feed_diretorio(): a lista inteira de uma vez, para a tela filtrar na hora.
-- As versões abaixo SUBSTITUEM feed_mencoes_validas e feed_avisar_mencoes de cima.
-- ============================================================================
create or replace function app_private.feed_pode_todos()
 returns boolean language sql stable security definer set search_path to ''
as $$ select app_private.feed_moderador() or app_private.is_rh_dp() $$;
grant execute on function app_private.feed_pode_todos() to authenticated;

create or replace function app_private.feed_mencoes_validas(p_mencoes jsonb, p_autor uuid)
 returns jsonb language sql stable security definer set search_path to ''
as $$
  select coalesce(jsonb_agg(x.j), '[]'::jsonb) from (
    select jsonb_build_object('id', 'todos', 'nome', 'todos') as j
     where app_private.feed_pode_todos()
       and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_mencoes) = 'array' then p_mencoes else '[]'::jsonb end) m
                    where m->>'id' = 'todos')
    union all
    select jsonb_build_object('id', y.id, 'nome', y.nome) from (
      select distinct on (c.id) c.id, left(btrim(coalesce(m->>'nome', '')), 60) as nome
        from jsonb_array_elements(case when jsonb_typeof(p_mencoes) = 'array' then p_mencoes else '[]'::jsonb end) m
        join public.colaboradores c
          on c.id::text = m->>'id' and c.ativo is distinct from false
       where c.id <> p_autor and btrim(coalesce(m->>'nome', '')) <> ''
       limit 10
    ) y
  ) x
$$;

create or replace function app_private.feed_avisar_mencoes(
  p_mencoes jsonb, p_autor uuid, p_post uuid, p_ref uuid, p_texto text, p_em_comentario boolean)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_nome   text := (select split_part(initcap(lower(c.nome)), ' ', 1) from public.colaboradores c where c.id = p_autor);
  v_titulo text := v_nome || case when p_em_comentario then ' marcou você num comentário' else ' marcou você num post' end;
  v_href   text := '/feed?post=' || p_post::text;
  v_m      jsonb;
begin
  if p_mencoes @> '[{"id": "todos"}]'::jsonb then
    insert into public.notificacoes (destinatario_id, modulo, tipo, titulo, descricao, href, referencia_id)
    select c.id, 'feed', 'mencao', v_nome || ' marcou todo mundo da PHD', left(p_texto, 140), v_href, p_ref
      from public.colaboradores c
     where c.ativo is distinct from false and c.auth_id is not null and c.id <> p_autor;
    return;
  end if;
  for v_m in select * from jsonb_array_elements(p_mencoes) loop
    perform app_private.notificar((v_m->>'id')::uuid, 'feed', 'mencao', v_titulo, left(p_texto, 140), v_href, p_ref);
  end loop;
end $$;

create or replace function public.feed_diretorio()
 returns table(id uuid, nome text, funcao text)
 language plpgsql stable security definer set search_path to ''
as $$
begin
  if app_private.feed_eu() is null then
    raise exception 'Só colaboradores ativos usam o feed.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select c.id, c.nome, c.funcao from public.colaboradores c
   where c.ativo is distinct from false and c.auth_id is not null
   order by c.nome;
end $$;

create or replace function public.feed_pode_marcar_todos()
 returns boolean language sql stable security definer set search_path to ''
as $$ select app_private.feed_pode_todos() $$;

revoke all on function public.feed_diretorio(), public.feed_pode_marcar_todos() from public, anon;
grant execute on function public.feed_diretorio(), public.feed_pode_marcar_todos() to authenticated;
