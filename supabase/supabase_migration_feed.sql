-- Migration: Feed do portal — fase 1 (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (20/10/2026): um feed interno, no molde do feed do selink
-- (C:\Users\Lennon\Desktop\Devs\selink, selink-api/app/api/v1/feed.py). De lá
-- veio o desenho; o código é outro: lá era FastAPI, aqui é RPC + RLS.
--
-- Fase 1: post com texto e até 5 fotos, curtidas, comentários com UMA
-- resposta de profundidade, denúncia, ocultar e fixar (admin).
-- Decisões (20/10/2026): todo colaborador ativo posta; sem vídeo por ora.
--
-- Acesso:
--   - As quatro tabelas ficam com RLS ligada e SEM policy: tudo passa pelas
--     RPCs abaixo (security definer), que conferem quem é quem. Os contadores
--     (curtidas, comentarios) só mudam por elas.
--   - Moderador = admin do portal ou super admin (app_private.feed_moderador).
--   - Excluir é lógico (excluido = true). As fotos ficam no bucket.
--   - Fotos: bucket privado `feed-midia`, pasta = id do colaborador. Lê quem
--     vê o post (app_private.feed_midia_visivel); cada um só grava e apaga na
--     própria pasta. Post apagado deixa a foto no bucket, mas ninguém além do
--     autor e da moderação a abre mais.
--
-- Ordem: aplicar ANTES do deploy do front.
-- Já aplicada em 20/10/2026.
-- ============================================================================

-- ---- Tabelas ------------------------------------------------------------------

create table if not exists public.feed_posts (
  id            uuid primary key default gen_random_uuid(),
  autor_id      uuid not null references public.colaboradores(id),
  texto         text not null default '',
  -- [{ path, width, height }] — path dentro do bucket feed-midia.
  midia         jsonb not null default '[]'::jsonb,
  curtidas      integer not null default 0,
  comentarios   integer not null default 0,
  fixado        boolean not null default false,
  oculto        boolean not null default false,
  oculto_motivo text,
  oculto_por    uuid references public.colaboradores(id),
  oculto_em     timestamptz,
  excluido      boolean not null default false,
  editado_em    timestamptz,
  criado_em     timestamptz not null default now(),
  constraint feed_posts_texto_tam check (char_length(texto) <= 3000),
  constraint feed_posts_midia_lista check (jsonb_typeof(midia) = 'array' and jsonb_array_length(midia) <= 5),
  constraint feed_posts_nao_vazio check (btrim(texto) <> '' or jsonb_array_length(midia) > 0)
);
create index if not exists feed_posts_linha_idx on public.feed_posts (criado_em desc, id desc) where not excluido;
create index if not exists feed_posts_autor_idx on public.feed_posts (autor_id, criado_em desc);

create table if not exists public.feed_comentarios (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.feed_posts(id) on delete cascade,
  autor_id    uuid not null references public.colaboradores(id),
  -- Resposta: sempre aponta para um comentário de primeiro nível.
  pai_id      uuid references public.feed_comentarios(id) on delete cascade,
  texto       text not null,
  oculto      boolean not null default false,
  excluido    boolean not null default false,
  editado_em  timestamptz,
  criado_em   timestamptz not null default now(),
  constraint feed_comentarios_texto_tam check (char_length(btrim(texto)) between 1 and 1000)
);
create index if not exists feed_comentarios_post_idx on public.feed_comentarios (post_id, criado_em);
create index if not exists feed_comentarios_autor_idx on public.feed_comentarios (autor_id, criado_em desc);

create table if not exists public.feed_curtidas (
  post_id        uuid not null references public.feed_posts(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id),
  criado_em      timestamptz not null default now(),
  primary key (post_id, colaborador_id)
);

create table if not exists public.feed_denuncias (
  id             uuid primary key default gen_random_uuid(),
  alvo_tipo      text not null check (alvo_tipo in ('post', 'comentario')),
  alvo_id        uuid not null,
  denunciante_id uuid not null references public.colaboradores(id),
  motivo         text check (char_length(motivo) <= 500),
  status         text not null default 'pendente' check (status in ('pendente', 'descartada', 'ocultada')),
  decidido_por   uuid references public.colaboradores(id),
  decidido_em    timestamptz,
  criado_em      timestamptz not null default now(),
  unique (alvo_tipo, alvo_id, denunciante_id)
);
create index if not exists feed_denuncias_pendentes_idx on public.feed_denuncias (criado_em) where status = 'pendente';

alter table public.feed_posts       enable row level security;
alter table public.feed_comentarios enable row level security;
alter table public.feed_curtidas    enable row level security;
alter table public.feed_denuncias   enable row level security;
revoke all on public.feed_posts, public.feed_comentarios, public.feed_curtidas, public.feed_denuncias
  from anon, authenticated;

-- ---- Quem é quem --------------------------------------------------------------

-- Colaborador ativo logado (null para quem não tem cadastro ou está inativo).
create or replace function app_private.feed_eu()
 returns uuid language sql stable security definer set search_path to ''
as $$
  select c.id from public.colaboradores c
   where c.auth_id = (select auth.uid()) and c.ativo is distinct from false
   limit 1
$$;

create or replace function app_private.feed_moderador()
 returns boolean language sql stable security definer set search_path to ''
as $$
  select app_private.is_admin() or app_private.is_portal_super_admin()
$$;

grant execute on function app_private.feed_eu(), app_private.feed_moderador() to authenticated;

-- ---- Linha do tempo -----------------------------------------------------------

-- Página do feed. Sem cursor: os fixados vêm primeiro e depois os mais novos.
-- Com cursor (criado_em, id do último post NÃO fixado da página anterior): só
-- os não fixados mais antigos que ele. Oculto aparece só para o autor e para
-- o moderador (com a marca), para o autor entender o que houve.
create or replace function public.feed_listar(
  p_cursor_em timestamptz default null, p_cursor_id uuid default null, p_limite integer default 20)
 returns table(
  id uuid, autor_id uuid, autor_nome text, autor_funcao text, moldura text, titulo text,
  texto text, midia jsonb, curtidas integer, comentarios integer, curti boolean,
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
         p.texto, p.midia, p.curtidas, p.comentarios,
         exists (select 1 from public.feed_curtidas k where k.post_id = p.id and k.colaborador_id = v_eu),
         p.fixado, p.oculto, case when v_mod or p.autor_id = v_eu then p.oculto_motivo end,
         p.editado_em, p.criado_em
    from public.feed_posts p
    join public.colaboradores c on c.id = p.autor_id
    left join public.pontos_perfil pp on pp.colaborador_id = p.autor_id
   where not p.excluido
     and (not p.oculto or v_mod or p.autor_id = v_eu)
     and (p_cursor_em is null
          or (not p.fixado and (p.criado_em, p.id) < (p_cursor_em, p_cursor_id)))
   order by (p_cursor_em is null and p.fixado) desc, p.criado_em desc, p.id desc
   limit least(greatest(coalesce(p_limite, 20), 1), 50);
end $$;

-- ---- Posts --------------------------------------------------------------------

create or replace function public.feed_postar(p_texto text, p_midia jsonb default '[]'::jsonb)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare
  v_eu    uuid := app_private.feed_eu();
  v_texto text := btrim(coalesce(p_texto, ''));
  v_midia jsonb := coalesce(p_midia, '[]'::jsonb);
  v_item  jsonb;
  v_id    uuid;
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
  -- Foto só da própria pasta: ninguém publica arquivo de outra pessoa.
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
  insert into public.feed_posts (autor_id, texto, midia)
  values (v_eu, v_texto, v_midia)
  returning feed_posts.id into v_id;
  return v_id;
end $$;

create or replace function public.feed_editar(p_id uuid, p_texto text)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_eu    uuid := app_private.feed_eu();
  v_texto text := btrim(coalesce(p_texto, ''));
  v_post  public.feed_posts;
begin
  select * into v_post from public.feed_posts where id = p_id and not excluido;
  if v_post.id is null or v_post.autor_id is distinct from v_eu then
    raise exception 'Só quem escreveu edita o post.' using errcode = 'insufficient_privilege';
  end if;
  if v_texto = '' and jsonb_array_length(v_post.midia) = 0 then
    raise exception 'O post não pode ficar vazio.';
  end if;
  if char_length(v_texto) > 3000 then
    raise exception 'O texto passou de 3.000 caracteres.';
  end if;
  update public.feed_posts set texto = v_texto, editado_em = now() where id = p_id;
end $$;

create or replace function public.feed_excluir(p_id uuid)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_eu uuid := app_private.feed_eu();
begin
  update public.feed_posts set excluido = true
   where id = p_id and not excluido
     and (autor_id = v_eu or app_private.feed_moderador());
  if not found then
    raise exception 'Post não encontrado ou sem permissão.' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- Curte ou descurte. Devolve o estado novo e o total.
create or replace function public.feed_curtir(p_id uuid)
 returns table(curti boolean, curtidas integer)
 language plpgsql security definer set search_path to ''
as $$
declare
  v_eu  uuid := app_private.feed_eu();
  v_tem boolean;
begin
  if v_eu is null or not exists (
    select 1 from public.feed_posts p
     where p.id = p_id and not p.excluido and (not p.oculto or p.autor_id = v_eu)) then
    raise exception 'Post não encontrado.';
  end if;
  delete from public.feed_curtidas k where k.post_id = p_id and k.colaborador_id = v_eu;
  v_tem := not found;
  if v_tem then
    insert into public.feed_curtidas (post_id, colaborador_id) values (p_id, v_eu);
  end if;
  update public.feed_posts p
     set curtidas = (select count(*) from public.feed_curtidas k where k.post_id = p_id)
   where p.id = p_id;
  return query select v_tem, p.curtidas from public.feed_posts p where p.id = p_id;
end $$;

-- ---- Comentários --------------------------------------------------------------

-- Comentários de um post, do mais antigo ao mais novo. O excluído que tem
-- resposta volta como marcador (texto null), para a conversa não perder o fio.
create or replace function public.feed_comentarios_listar(p_post uuid)
 returns table(
  id uuid, pai_id uuid, autor_id uuid, autor_nome text, moldura text, titulo text,
  texto text, oculto boolean, excluido boolean, editado_em timestamptz, criado_em timestamptz)
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
         m.oculto, m.excluido, m.editado_em, m.criado_em
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

create or replace function public.feed_comentar(p_post uuid, p_texto text, p_pai uuid default null)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare
  v_eu    uuid := app_private.feed_eu();
  v_texto text := btrim(coalesce(p_texto, ''));
  v_pai   uuid := p_pai;
  v_id    uuid;
begin
  if v_eu is null or not exists (
    select 1 from public.feed_posts p
     where p.id = p_post and not p.excluido and not p.oculto) then
    raise exception 'Post não encontrado.';
  end if;
  if v_texto = '' or char_length(v_texto) > 1000 then
    raise exception 'O comentário precisa ter de 1 a 1.000 caracteres.';
  end if;
  -- Resposta de resposta vira resposta do comentário de cima: um nível só.
  if v_pai is not null then
    select coalesce(m.pai_id, m.id) into v_pai
      from public.feed_comentarios m where m.id = p_pai and m.post_id = p_post;
    if v_pai is null then raise exception 'Comentário não encontrado.'; end if;
  end if;
  if (select count(*) from public.feed_comentarios m
       where m.autor_id = v_eu and m.criado_em > now() - interval '1 day') >= 100 then
    raise exception 'Limite de 100 comentários por dia. Volte amanhã!';
  end if;
  insert into public.feed_comentarios (post_id, autor_id, pai_id, texto)
  values (p_post, v_eu, v_pai, v_texto)
  returning feed_comentarios.id into v_id;
  update public.feed_posts p
     set comentarios = (select count(*) from public.feed_comentarios m where m.post_id = p_post and not m.excluido)
   where p.id = p_post;
  return v_id;
end $$;

create or replace function public.feed_comentario_excluir(p_id uuid)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_eu   uuid := app_private.feed_eu();
  v_post uuid;
begin
  update public.feed_comentarios m set excluido = true
   where m.id = p_id and not m.excluido
     and (m.autor_id = v_eu or app_private.feed_moderador())
  returning m.post_id into v_post;
  if v_post is null then
    raise exception 'Comentário não encontrado ou sem permissão.' using errcode = 'insufficient_privilege';
  end if;
  update public.feed_posts p
     set comentarios = (select count(*) from public.feed_comentarios m where m.post_id = v_post and not m.excluido)
   where p.id = v_post;
end $$;

-- ---- Moderação ----------------------------------------------------------------

create or replace function public.feed_denunciar(p_tipo text, p_id uuid, p_motivo text default null)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_eu uuid := app_private.feed_eu();
begin
  if v_eu is null then
    raise exception 'Só colaboradores ativos denunciam.' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo not in ('post', 'comentario') then raise exception 'Tipo inválido.'; end if;
  insert into public.feed_denuncias (alvo_tipo, alvo_id, denunciante_id, motivo)
  values (p_tipo, p_id, v_eu, nullif(btrim(coalesce(p_motivo, '')), ''))
  on conflict (alvo_tipo, alvo_id, denunciante_id) do nothing;
end $$;

-- Oculta ou volta a mostrar um post/comentário. Fecha as denúncias abertas dele.
create or replace function public.feed_moderar(p_tipo text, p_id uuid, p_ocultar boolean, p_motivo text default null)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_eu uuid := app_private.feed_eu();
begin
  if not app_private.feed_moderador() then
    raise exception 'Só a moderação oculta conteúdo.' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo = 'post' then
    update public.feed_posts
       set oculto = p_ocultar,
           oculto_motivo = case when p_ocultar then nullif(btrim(coalesce(p_motivo, '')), '') end,
           oculto_por = case when p_ocultar then v_eu end,
           oculto_em = case when p_ocultar then now() end
     where id = p_id;
  elsif p_tipo = 'comentario' then
    update public.feed_comentarios set oculto = p_ocultar where id = p_id;
  else
    raise exception 'Tipo inválido.';
  end if;
  update public.feed_denuncias
     set status = case when p_ocultar then 'ocultada' else 'descartada' end,
         decidido_por = v_eu, decidido_em = now()
   where alvo_tipo = p_tipo and alvo_id = p_id and status = 'pendente';
end $$;

create or replace function public.feed_fixar(p_id uuid, p_fixar boolean)
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if not app_private.feed_moderador() then
    raise exception 'Só a moderação fixa posts.' using errcode = 'insufficient_privilege';
  end if;
  update public.feed_posts set fixado = p_fixar where id = p_id and not excluido;
end $$;

-- Fila de denúncias abertas, agrupada por alvo, com um trecho do conteúdo.
create or replace function public.feed_denuncias_listar()
 returns table(alvo_tipo text, alvo_id uuid, post_id uuid, trecho text, autor_nome text,
               denuncias integer, motivos text[], primeira_em timestamptz)
 language plpgsql stable security definer set search_path to ''
as $$
begin
  if not app_private.feed_moderador() then
    raise exception 'Só a moderação vê as denúncias.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select d.alvo_tipo, d.alvo_id,
         coalesce(p.id, m.post_id),
         left(coalesce(p.texto, m.texto, ''), 200),
         c.nome,
         count(*)::int,
         array_remove(array_agg(d.motivo), null),
         min(d.criado_em)
    from public.feed_denuncias d
    left join public.feed_posts p on d.alvo_tipo = 'post' and p.id = d.alvo_id
    left join public.feed_comentarios m on d.alvo_tipo = 'comentario' and m.id = d.alvo_id
    left join public.colaboradores c on c.id = coalesce(p.autor_id, m.autor_id)
   where d.status = 'pendente'
   group by d.alvo_tipo, d.alvo_id, p.id, m.post_id, p.texto, m.texto, c.nome
   order by min(d.criado_em);
end $$;

-- Descarta as denúncias de um alvo sem ocultá-lo.
create or replace function public.feed_denuncia_descartar(p_tipo text, p_id uuid)
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if not app_private.feed_moderador() then
    raise exception 'Só a moderação decide denúncias.' using errcode = 'insufficient_privilege';
  end if;
  update public.feed_denuncias
     set status = 'descartada', decidido_por = app_private.feed_eu(), decidido_em = now()
   where alvo_tipo = p_tipo and alvo_id = p_id and status = 'pendente';
end $$;

revoke all on function
  public.feed_listar(timestamptz, uuid, integer), public.feed_postar(text, jsonb),
  public.feed_editar(uuid, text), public.feed_excluir(uuid), public.feed_curtir(uuid),
  public.feed_comentarios_listar(uuid), public.feed_comentar(uuid, text, uuid),
  public.feed_comentario_excluir(uuid), public.feed_denunciar(text, uuid, text),
  public.feed_moderar(text, uuid, boolean, text), public.feed_fixar(uuid, boolean),
  public.feed_denuncias_listar(), public.feed_denuncia_descartar(text, uuid)
  from public, anon;
grant execute on function
  public.feed_listar(timestamptz, uuid, integer), public.feed_postar(text, jsonb),
  public.feed_editar(uuid, text), public.feed_excluir(uuid), public.feed_curtir(uuid),
  public.feed_comentarios_listar(uuid), public.feed_comentar(uuid, text, uuid),
  public.feed_comentario_excluir(uuid), public.feed_denunciar(text, uuid, text),
  public.feed_moderar(text, uuid, boolean, text), public.feed_fixar(uuid, boolean),
  public.feed_denuncias_listar(), public.feed_denuncia_descartar(text, uuid)
  to authenticated;

-- ---- Fotos --------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-midia', 'feed-midia', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ler foto acompanha a visibilidade do post: a própria pasta (inclusive a foto
-- que subiu e ainda não virou post), a moderação, ou foto de post que não foi
-- apagado nem ocultado. Sem isto, quem guardou o caminho continuaria abrindo
-- a foto de um post já tirado do ar (achado da revisão de segurança, 20/10/2026).
-- Link assinado antes de o post sair do ar vale até vencer (1 h, services/feed.js).
create or replace function app_private.feed_midia_visivel(p_name text)
 returns boolean language sql stable security definer set search_path to ''
as $$
  select app_private.feed_eu() is not null and (
       split_part(p_name, '/', 1) = app_private.feed_eu()::text
    or app_private.feed_moderador()
    or exists (select 1 from public.feed_posts p, jsonb_array_elements(p.midia) m
                where m->>'path' = p_name and not p.excluido and not p.oculto))
$$;
grant execute on function app_private.feed_midia_visivel(text) to authenticated;

drop policy if exists feed_midia_select on storage.objects;
create policy feed_midia_select on storage.objects for select to authenticated
  using (bucket_id = 'feed-midia' and app_private.feed_midia_visivel(name));

drop policy if exists feed_midia_insert on storage.objects;
create policy feed_midia_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'feed-midia'
              and (storage.foldername(name))[1] = app_private.feed_eu()::text);

drop policy if exists feed_midia_delete on storage.objects;
create policy feed_midia_delete on storage.objects for delete to authenticated
  using (bucket_id = 'feed-midia'
         and (storage.foldername(name))[1] = app_private.feed_eu()::text);

-- ---- Laterais da página (20/10/2026) -----------------------------------------
-- "Mais curtidos da semana": os posts no ar dos últimos 7 dias com mais
-- curtidas (desempate por comentários). Só os números e um trecho do texto.
create or replace function public.feed_destaques_semana(p_limite integer default 3)
 returns table(id uuid, autor_nome text, trecho text, fotos integer, curtidas integer, comentarios integer, criado_em timestamptz)
 language plpgsql stable security definer set search_path to ''
as $$
begin
  if app_private.feed_eu() is null then
    raise exception 'Só colaboradores ativos veem o feed.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select p.id, c.nome, left(p.texto, 140), jsonb_array_length(p.midia), p.curtidas, p.comentarios, p.criado_em
    from public.feed_posts p
    join public.colaboradores c on c.id = p.autor_id
   where not p.excluido and not p.oculto
     and p.criado_em > now() - interval '7 days'
     and p.curtidas > 0
   order by p.curtidas desc, p.comentarios desc, p.criado_em desc
   limit least(greatest(coalesce(p_limite, 3), 1), 10);
end $$;
revoke all on function public.feed_destaques_semana(integer) from public, anon;
grant execute on function public.feed_destaques_semana(integer) to authenticated;

-- ---- Fotos de perfil no feed (20/10/2026) ------------------------------------
-- A Edge Function fotos-aniversariantes ({ feed: ids }) só busca foto de quem
-- esta RPC confirma: o próprio leitor e quem tem post ou comentário visível.
-- Assim a função não vira um jeito de baixar a foto de qualquer colaborador.
create or replace function public.feed_autores(p_ids uuid[])
 returns setof uuid language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu  uuid := app_private.feed_eu();
  v_mod boolean := app_private.feed_moderador();
begin
  if v_eu is null then
    raise exception 'Só colaboradores ativos veem o feed.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select distinct x.id
    from unnest(p_ids[1:60]) as x(id)
   where x.id = v_eu
      or exists (select 1 from public.feed_posts p
                  where p.autor_id = x.id and not p.excluido and (not p.oculto or v_mod))
      or exists (select 1 from public.feed_comentarios m
                   join public.feed_posts p on p.id = m.post_id
                  where m.autor_id = x.id and not m.excluido and not p.excluido
                    and ((not m.oculto and not p.oculto) or v_mod));
end $$;
revoke all on function public.feed_autores(uuid[]) from public, anon;
grant execute on function public.feed_autores(uuid[]) to authenticated;

-- ---- Versão leve das fotos (20/10/2026) --------------------------------------
-- Cada foto sobe em duas versões: `path` (a grande, para a tela cheia) e
-- `thumb` (1280px em WebP, a que o feed mostra). As duas têm de estar na pasta
-- de quem posta, e as duas seguem a visibilidade do post.
create or replace function app_private.feed_midia_visivel(p_name text)
 returns boolean language sql stable security definer set search_path to ''
as $$
  select app_private.feed_eu() is not null and (
       split_part(p_name, '/', 1) = app_private.feed_eu()::text
    or app_private.feed_moderador()
    or exists (select 1 from public.feed_posts p, jsonb_array_elements(p.midia) m
                where (m->>'path' = p_name or m->>'thumb' = p_name) and not p.excluido and not p.oculto))
$$;
-- feed_postar: a checagem da pasta vale também para `thumb` (já no corpo dela,
-- mais acima neste arquivo).
