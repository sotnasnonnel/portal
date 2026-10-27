-- Feed: vídeo no post e a lista de quem curtiu (26/10/2026)
--
-- PRÉ-REQUISITO: aplique ESTE arquivo ANTES do deploy do front. Sem ele o
-- bucket recusa o upload de vídeo (allowed_mime_types) e o feed_postar recusa
-- o `poster` do vídeo. O contrário é seguro: front antigo com este SQL
-- aplicado continua funcionando igual.
--
-- Depende de supabase_migration_feed.sql e supabase_migration_feed_mencoes.sql
-- (o feed_postar com p_mencoes nasceu lá; aqui ele é redefinido inteiro).
--
-- O QUE MUDA
--   1. O bucket feed-midia aceita vídeo (mp4/webm/mov) e o limite de arquivo
--      sobe para 50 MB. O limite é DO BUCKET, então vale para foto também: o
--      freio de 8 MB da foto passa a ser só do navegador — que de todo jeito
--      regrava toda foto em WebP reduzido antes de subir (services/feed.js).
--   2. `midia` ganha itens de vídeo: { tipo: 'video', path, poster?, width,
--      height, dur }. Item sem `tipo` continua sendo foto, então post antigo
--      não muda. No máximo um vídeo por post.
--   3. `poster` (o quadro de capa do vídeo) entra na checagem de pasta do
--      autor e na visibilidade do bucket, do mesmo jeito que o `thumb`.
--   4. feed_curtidas_listar: quem curtiu um post, para a lista que abre ao
--      clicar; e feed_curtidas_resumo, os primeiros nomes de cada post da
--      página, para a linha "Curtido por…" embaixo do card.
--   5. feed_destaques_semana separa foto de vídeo na contagem.
--   6. feed_autores passa a liberar a foto de perfil de quem curtiu um post
--      visível — senão as curtidas sairiam todas em iniciais.

-- ---- 1. Bucket: vídeo e o novo limite de tamanho ------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-midia', 'feed-midia', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
              'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---- 2. O `poster` segue a visibilidade do post -------------------------------
-- Cada vídeo sobe em dois arquivos: `path` (o vídeo) e `poster` (a capa, WebP).
-- Os dois têm de estar na pasta de quem posta, e os dois só abrem para quem vê
-- o post — a mesma regra que o `thumb` da foto já tinha.
create or replace function app_private.feed_midia_visivel(p_name text)
 returns boolean language sql stable security definer set search_path to ''
as $$
  select app_private.feed_eu() is not null and (
       split_part(p_name, '/', 1) = app_private.feed_eu()::text
    or app_private.feed_moderador()
    or exists (select 1 from public.feed_posts p, jsonb_array_elements(p.midia) m
                where (m->>'path' = p_name or m->>'thumb' = p_name or m->>'poster' = p_name)
                  and not p.excluido and not p.oculto))
$$;

-- ---- 3. Postar com vídeo ------------------------------------------------------
-- Mesma função de supabase_migration_feed_mencoes.sql, com três acréscimos: a
-- checagem de pasta cobre o `poster`, só um item pode ser vídeo, e os avisos
-- falam "arquivo" em vez de "foto". Assinatura igual, então os grants ficam.
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
    raise exception 'No máximo 5 arquivos por post.';
  end if;
  if v_texto = '' and jsonb_array_length(v_midia) = 0 then
    raise exception 'Escreva algo ou escolha uma foto ou vídeo.';
  end if;
  if char_length(v_texto) > 3000 then
    raise exception 'O texto passou de 3.000 caracteres.';
  end if;
  -- Arquivo só da própria pasta: ninguém publica mídia de outra pessoa.
  for v_item in select * from jsonb_array_elements(v_midia) loop
    if coalesce(v_item->>'path', '') not like v_eu::text || '/%'
       or (v_item ? 'thumb' and coalesce(v_item->>'thumb', '') not like v_eu::text || '/%')
       or (v_item ? 'poster' and coalesce(v_item->>'poster', '') not like v_eu::text || '/%') then
      raise exception 'Arquivo inválido.';
    end if;
  end loop;
  -- Vídeo é pesado: um por post (o navegador também segura, config/feed.js).
  if (select count(*) from jsonb_array_elements(v_midia) m where m->>'tipo' = 'video') > 1 then
    raise exception 'Só um vídeo por post.';
  end if;
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

-- ---- 4. Quem curtiu -----------------------------------------------------------
-- A lista que abre ao clicar no número de curtidas. Só de post que o leitor
-- pode ver (a mesma regra do feed_listar): post oculto ou apagado não entrega
-- quem curtiu. Mais recente primeiro, no máximo 100 — acima disso a tela
-- mostra "e mais N" a partir do total que já vem no post.
create or replace function public.feed_curtidas_listar(p_post uuid, p_limite integer default 100)
 returns table(colaborador_id uuid, nome text, funcao text, moldura text, titulo text, criado_em timestamptz)
 language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu  uuid := app_private.feed_eu();
  v_mod boolean := app_private.feed_moderador();
begin
  if v_eu is null then
    raise exception 'Só colaboradores ativos veem o feed.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.feed_posts p
                  where p.id = p_post and not p.excluido
                    and (not p.oculto or v_mod or p.autor_id = v_eu)) then
    raise exception 'Post não encontrado.';
  end if;
  return query
  select k.colaborador_id, c.nome, c.funcao, pp.moldura, pp.titulo, k.criado_em
    from public.feed_curtidas k
    join public.colaboradores c on c.id = k.colaborador_id
    left join public.pontos_perfil pp on pp.colaborador_id = k.colaborador_id
   where k.post_id = p_post
   order by k.criado_em desc
   limit least(greatest(coalesce(p_limite, 100), 1), 100);
end $$;
revoke all on function public.feed_curtidas_listar(uuid, integer) from public, anon;
grant execute on function public.feed_curtidas_listar(uuid, integer) to authenticated;

-- ---- 5. Os primeiros nomes de quem curtiu, em lote ---------------------------
-- A linha "Curtido por Você, Ana e outras 2 pessoas" embaixo de cada post. O
-- feed chega com até 21 posts, então pedir post por post seriam 21 chamadas:
-- esta RPC recebe a página inteira e devolve os primeiros curtidores de cada
-- post, com `v_eu` na frente (é o "Você" da linha).
-- A mesma regra de visibilidade do feed_listar: post oculto ou apagado não
-- entrega quem curtiu.
create or replace function public.feed_curtidas_resumo(p_posts uuid[], p_por_post integer default 3)
 returns table(post_id uuid, colaborador_id uuid, nome text, moldura text, criado_em timestamptz)
 language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu  uuid := app_private.feed_eu();
  v_mod boolean := app_private.feed_moderador();
  v_n   integer := least(greatest(coalesce(p_por_post, 3), 1), 5);
begin
  if v_eu is null then
    raise exception 'Só colaboradores ativos veem o feed.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select k.post_id, k.colaborador_id, c.nome, pp.moldura, k.criado_em
    from public.feed_posts p
    cross join lateral (
      select kk.post_id, kk.colaborador_id, kk.criado_em
        from public.feed_curtidas kk
       where kk.post_id = p.id
       order by (kk.colaborador_id = v_eu) desc, kk.criado_em desc
       limit v_n
    ) k
    join public.colaboradores c on c.id = k.colaborador_id
    left join public.pontos_perfil pp on pp.colaborador_id = k.colaborador_id
   where p.id = any(p_posts[1:50])
     and not p.excluido and (not p.oculto or v_mod or p.autor_id = v_eu);
end $$;
revoke all on function public.feed_curtidas_resumo(uuid[], integer) from public, anon;
grant execute on function public.feed_curtidas_resumo(uuid[], integer) to authenticated;

-- ---- 6. "Mais curtidos da semana": separar foto de vídeo ---------------------
-- A lateral mostra um trecho do texto e, em post sem texto, o que tem dentro.
-- Antes `fotos` era o tamanho de `midia` inteiro: post só de vídeo apareceria
-- como "1 foto". Agora `fotos` conta só foto e `videos` vem à parte.
-- A tabela de retorno muda, então precisa de drop — e com ele o grant volta.
drop function if exists public.feed_destaques_semana(integer);
create or replace function public.feed_destaques_semana(p_limite integer default 3)
 returns table(id uuid, autor_nome text, trecho text, fotos integer, videos integer,
               curtidas integer, comentarios integer, criado_em timestamptz)
 language plpgsql stable security definer set search_path to ''
as $$
begin
  if app_private.feed_eu() is null then
    raise exception 'Só colaboradores ativos veem o feed.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select p.id, c.nome, left(p.texto, 140),
         (select count(*)::integer from jsonb_array_elements(p.midia) m where m->>'tipo' is distinct from 'video'),
         (select count(*)::integer from jsonb_array_elements(p.midia) m where m->>'tipo' = 'video'),
         p.curtidas, p.comentarios, p.criado_em
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

-- ---- 7. Foto de perfil de quem curtiu ----------------------------------------
-- Mesma função de supabase_migration_feed.sql, agora liberando também quem
-- curtiu um post visível. A trava de origem continua: a Edge Function só
-- devolve foto de quem participou do feed, nunca de qualquer colaborador.
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
                    and ((not m.oculto and not p.oculto) or v_mod))
      or exists (select 1 from public.feed_curtidas k
                   join public.feed_posts p on p.id = k.post_id
                  where k.colaborador_id = x.id and not p.excluido and (not p.oculto or v_mod));
end $$;
