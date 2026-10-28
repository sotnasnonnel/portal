-- Migration: Avisos do portal (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (28/10/2026): um lugar de avisos no portal, no molde das
-- notícias do SharePoint da Comunicação. Todo colaborador ativo publica.
--
-- O aviso tem duas partes:
--   - Banner no padrão "TEMPLATE MANCHETE COMUNICAÇÃO INTERNA.pptx": o portal
--     desenha (pages/Avisos/BannerAviso.jsx) a partir da manchete, do
--     subtítulo e do fundo (laranja, azul ou uma foto). Nada de imagem pronta.
--   - Corpo em blocos, como as web parts do SharePoint: texto formatado,
--     imagem, botão com link e anexo. Os blocos são DADO (jsonb), não HTML:
--     o front desenha cada tipo, e nenhum texto vira marcação crua.
--
-- Decisões (28/10/2026): publica direto, sem aprovação. Editam e excluem só o
-- autor e o super admin (app_private.avisos_moderador) — pedido do usuário:
-- "quem tiver publicado, e eu posso excluir todos". Os admins do DP não.
--
-- Acesso:
--   - A tabela fica com RLS ligada e SEM policy: tudo passa pelas RPCs abaixo
--     (security definer), como no Feed.
--   - Quem é quem: app_private.feed_eu() (colaborador ativo logado, a mesma
--     regra do Feed) e app_private.avisos_moderador() (só o super admin).
--   - Excluir é lógico (excluido = true). Os arquivos ficam no bucket.
--   - Arquivos: bucket privado `avisos-midia`, pasta = id de quem subiu. Lê o
--     dono da pasta, a moderação, ou qualquer ativo quando o arquivo está num
--     aviso no ar. Cada um só grava e apaga na própria pasta.
--
-- Ordem: aplicar ANTES do deploy do front.
-- ============================================================================

-- ---- Tabela -------------------------------------------------------------------

create table if not exists public.avisos (
  id          uuid primary key default gen_random_uuid(),
  autor_id    uuid not null references public.colaboradores(id),
  -- Manchete do banner. **trecho** sai em negrito e _trecho_ em itálico.
  manchete    text not null,
  subtitulo   text not null default '',
  fundo       text not null default 'laranja',
  -- Só com fundo = 'foto': caminho dentro do bucket avisos-midia.
  foto_path   text,
  -- [{ tipo: 'texto', texto } | { tipo: 'imagem', path, width, height, legenda? }
  --  | { tipo: 'botao', rotulo, url } | { tipo: 'anexo', path, nome, tamanho }]
  blocos      jsonb not null default '[]'::jsonb,
  excluido    boolean not null default false,
  editado_em  timestamptz,
  criado_em   timestamptz not null default now(),
  constraint avisos_manchete_tam check (char_length(btrim(manchete)) between 1 and 160),
  constraint avisos_subtitulo_tam check (char_length(subtitulo) <= 160),
  constraint avisos_fundo check (fundo in ('laranja', 'azul', 'foto')),
  constraint avisos_foto check ((fundo = 'foto') = (foto_path is not null)),
  constraint avisos_blocos_lista check (jsonb_typeof(blocos) = 'array' and jsonb_array_length(blocos) <= 40)
);
create index if not exists avisos_linha_idx on public.avisos (criado_em desc, id desc) where not excluido;

alter table public.avisos enable row level security;
revoke all on public.avisos from anon, authenticated;

-- Moderação dos avisos: só o super admin (diferente do Feed, onde o admin do
-- DP também modera).
create or replace function app_private.avisos_moderador()
 returns boolean language sql stable security definer set search_path to ''
as $$
  select app_private.is_portal_super_admin()
$$;
grant execute on function app_private.avisos_moderador() to authenticated;

-- ---- Arquivos de um aviso -----------------------------------------------------

-- Todos os caminhos do bucket que um aviso usa: a foto do fundo e os blocos de
-- imagem e anexo.
create or replace function app_private.avisos_arquivos(p_foto text, p_blocos jsonb)
 returns text[] language sql immutable set search_path to ''
as $$
  select coalesce(array_agg(x), '{}') from (
    select p_foto as x where p_foto is not null
    union all
    select b->>'path' from jsonb_array_elements(coalesce(p_blocos, '[]'::jsonb)) b
     where b->>'tipo' in ('imagem', 'anexo')
  ) t
$$;

-- Confere os blocos antes de gravar. Devolve a mensagem do primeiro problema,
-- ou null. O front valida igual (config/avisos.js); aqui é a palavra final.
create or replace function app_private.avisos_problema_blocos(p_blocos jsonb)
 returns text language plpgsql immutable set search_path to ''
as $$
declare
  b jsonb;
begin
  for b in select * from jsonb_array_elements(p_blocos) loop
    case b->>'tipo'
      when 'texto' then
        if char_length(coalesce(b->>'texto', '')) > 5000 then
          return 'Bloco de texto com mais de 5000 caracteres.';
        end if;
      when 'imagem' then
        if coalesce(b->>'path', '') = '' then return 'Imagem sem arquivo.'; end if;
        if char_length(coalesce(b->>'legenda', '')) > 200 then return 'Legenda com mais de 200 caracteres.'; end if;
      when 'anexo' then
        if coalesce(b->>'path', '') = '' then return 'Anexo sem arquivo.'; end if;
        if char_length(coalesce(b->>'nome', '')) not between 1 and 200 then return 'Anexo sem nome.'; end if;
      when 'botao' then
        if char_length(btrim(coalesce(b->>'rotulo', ''))) not between 1 and 60 then
          return 'Botão sem texto (ou com mais de 60 caracteres).';
        end if;
        -- Só http(s) ou caminho do próprio portal: nada de javascript: e afins.
        if coalesce(b->>'url', '') !~* '^(https?://|/)' or char_length(b->>'url') > 1000 then
          return 'O link do botão precisa começar com http://, https:// ou /.';
        end if;
      else
        return 'Bloco de tipo desconhecido.';
    end case;
  end loop;
  return null;
end $$;

-- ---- Lista e leitura ----------------------------------------------------------

-- Página de avisos, do mais novo para o mais antigo. Cursor: (criado_em, id)
-- do último da página anterior. `resumo` é o começo do primeiro bloco de texto.
create or replace function public.avisos_listar(
  p_cursor_em timestamptz default null, p_cursor_id uuid default null, p_limite integer default 12)
 returns table(
  id uuid, autor_id uuid, autor_nome text, manchete text, subtitulo text, fundo text,
  foto_path text, resumo text, pode_editar boolean, editado_em timestamptz, criado_em timestamptz)
 language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu  uuid := app_private.feed_eu();
  v_mod boolean := app_private.avisos_moderador();
begin
  if v_eu is null then
    raise exception 'Só colaboradores ativos veem os avisos.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select a.id, a.autor_id, c.nome, a.manchete, a.subtitulo, a.fundo, a.foto_path,
         left((select b->>'texto' from jsonb_array_elements(a.blocos) b
                where b->>'tipo' = 'texto' and btrim(b->>'texto') <> '' limit 1), 240),
         (a.autor_id = v_eu or v_mod), a.editado_em, a.criado_em
    from public.avisos a
    join public.colaboradores c on c.id = a.autor_id
   where not a.excluido
     and (p_cursor_em is null or (a.criado_em, a.id) < (p_cursor_em, p_cursor_id))
   order by a.criado_em desc, a.id desc
   limit least(greatest(coalesce(p_limite, 12), 1), 50);
end $$;

create or replace function public.avisos_obter(p_id uuid)
 returns table(
  id uuid, autor_id uuid, autor_nome text, manchete text, subtitulo text, fundo text,
  foto_path text, blocos jsonb, pode_editar boolean, editado_em timestamptz, criado_em timestamptz)
 language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu  uuid := app_private.feed_eu();
  v_mod boolean := app_private.avisos_moderador();
begin
  if v_eu is null then
    raise exception 'Só colaboradores ativos veem os avisos.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select a.id, a.autor_id, c.nome, a.manchete, a.subtitulo, a.fundo, a.foto_path, a.blocos,
         (a.autor_id = v_eu or v_mod), a.editado_em, a.criado_em
    from public.avisos a
    join public.colaboradores c on c.id = a.autor_id
   where a.id = p_id and not a.excluido;
end $$;

-- ---- Publicar, editar, apagar -------------------------------------------------

-- Sem p_id, publica um aviso novo; com p_id, edita (autor ou moderação).
-- Arquivo novo tem de estar na pasta de quem salva; arquivo que o aviso já
-- usava pode ficar (a moderação edita aviso dos outros sem mexer nas fotos).
create or replace function public.avisos_salvar(
  p_id uuid, p_manchete text, p_subtitulo text, p_fundo text, p_foto_path text, p_blocos jsonb)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare
  v_eu     uuid := app_private.feed_eu();
  v_mod    boolean := app_private.avisos_moderador();
  v_antigo public.avisos%rowtype;
  v_ja     text[] := '{}';
  v_path   text;
  v_prob   text;
  v_id     uuid;
begin
  if v_eu is null then
    raise exception 'Só colaboradores ativos publicam avisos.' using errcode = 'insufficient_privilege';
  end if;
  p_blocos := coalesce(p_blocos, '[]'::jsonb);
  if jsonb_typeof(p_blocos) <> 'array' then
    raise exception 'Blocos inválidos.' using errcode = 'invalid_parameter_value';
  end if;
  v_prob := app_private.avisos_problema_blocos(p_blocos);
  if v_prob is not null then
    raise exception '%', v_prob using errcode = 'invalid_parameter_value';
  end if;
  if p_fundo <> 'foto' then p_foto_path := null; end if;
  if p_fundo = 'foto' and coalesce(p_foto_path, '') = '' then
    raise exception 'Escolha a foto do fundo.' using errcode = 'invalid_parameter_value';
  end if;

  if p_id is not null then
    select * into v_antigo from public.avisos a where a.id = p_id and not a.excluido for update;
    if not found then
      raise exception 'Aviso não encontrado.' using errcode = 'no_data_found';
    end if;
    if v_antigo.autor_id <> v_eu and not v_mod then
      raise exception 'Só quem publicou edita este aviso.' using errcode = 'insufficient_privilege';
    end if;
    v_ja := app_private.avisos_arquivos(v_antigo.foto_path, v_antigo.blocos);
  else
    -- Freio contra enxurrada: 10 avisos por pessoa em 24 h.
    if (select count(*) from public.avisos a
         where a.autor_id = v_eu and a.criado_em > now() - interval '24 hours') >= 10 then
      raise exception 'Limite de 10 avisos por dia. Tente amanhã.' using errcode = 'check_violation';
    end if;
  end if;

  foreach v_path in array app_private.avisos_arquivos(p_foto_path, p_blocos) loop
    if not (v_path like v_eu::text || '/%' or v_path = any (v_ja)) then
      raise exception 'Arquivo fora da sua pasta.' using errcode = 'insufficient_privilege';
    end if;
  end loop;

  if p_id is null then
    insert into public.avisos (autor_id, manchete, subtitulo, fundo, foto_path, blocos)
    values (v_eu, btrim(p_manchete), btrim(coalesce(p_subtitulo, '')), p_fundo, p_foto_path, p_blocos)
    returning avisos.id into v_id;
  else
    update public.avisos a
       set manchete = btrim(p_manchete), subtitulo = btrim(coalesce(p_subtitulo, '')),
           fundo = p_fundo, foto_path = p_foto_path, blocos = p_blocos, editado_em = now()
     where a.id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end $$;

create or replace function public.avisos_excluir(p_id uuid)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_eu  uuid := app_private.feed_eu();
  v_mod boolean := app_private.avisos_moderador();
begin
  update public.avisos a set excluido = true
   where a.id = p_id and not a.excluido and (a.autor_id = v_eu or v_mod);
  if not found then
    raise exception 'Só quem publicou pode excluir este aviso.' using errcode = 'insufficient_privilege';
  end if;
end $$;

revoke all on function
  public.avisos_listar(timestamptz, uuid, integer), public.avisos_obter(uuid),
  public.avisos_salvar(uuid, text, text, text, text, jsonb), public.avisos_excluir(uuid)
  from public, anon;
grant execute on function
  public.avisos_listar(timestamptz, uuid, integer), public.avisos_obter(uuid),
  public.avisos_salvar(uuid, text, text, text, text, jsonb), public.avisos_excluir(uuid)
  to authenticated;

-- ---- Arquivos -----------------------------------------------------------------

-- 20 MB: o anexo (um PDF de apresentação) é o que pesa; as imagens chegam
-- reduzidas pelo navegador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avisos-midia', 'avisos-midia', false, 20971520, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'text/plain', 'text/csv'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ler acompanha o aviso: a própria pasta (o arquivo que subiu e ainda não foi
-- salvo), a moderação, ou arquivo de aviso no ar. Aviso apagado tira o
-- arquivo do ar para os outros.
create or replace function app_private.avisos_midia_visivel(p_name text)
 returns boolean language sql stable security definer set search_path to ''
as $$
  select app_private.feed_eu() is not null and (
       split_part(p_name, '/', 1) = app_private.feed_eu()::text
    or app_private.avisos_moderador()
    or exists (select 1 from public.avisos a
                where not a.excluido and p_name = any (app_private.avisos_arquivos(a.foto_path, a.blocos))))
$$;
grant execute on function app_private.avisos_midia_visivel(text) to authenticated;

drop policy if exists avisos_midia_select on storage.objects;
create policy avisos_midia_select on storage.objects for select to authenticated
  using (bucket_id = 'avisos-midia' and app_private.avisos_midia_visivel(name));

drop policy if exists avisos_midia_insert on storage.objects;
create policy avisos_midia_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avisos-midia'
              and (storage.foldername(name))[1] = app_private.feed_eu()::text);

drop policy if exists avisos_midia_delete on storage.objects;
create policy avisos_midia_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avisos-midia'
         and (storage.foldername(name))[1] = app_private.feed_eu()::text);
