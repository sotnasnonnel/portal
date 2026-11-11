-- Migration: programas_awards (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- PHD Awards, categoria "Projetos do Ano": cadastro dos projetos no módulo
-- Programas. As perguntas são as do formulário da edição passada.
--
-- QUEM VÊ O QUÊ:
--   - todo logado cadastra (uma pessoa pode cadastrar mais de um projeto) e vê
--     só os que ele mesmo cadastrou;
--   - quem avalia (Lucas Ferraz, André Guimarães, Marcus Guimarães e Pedro Morais) vê todos. A lista repete
--     AWARDS_AVALIADORES (src/config/programas.js) DE PROPÓSITO: aquela só
--     controla o que a tela mostra, e quem protege o dado é esta. Mudou lá, muda
--     aqui. Não usa programas_role porque 'admin' dos Programas é outra gente.
--
-- PRAZO: inscrições de 16/11 a 04/12/2026, no horário de Brasília. A data repete
-- AWARDS_INSCRICOES (src/config/programas.js): prorrogar exige mudar os dois.
-- Fora do prazo, ninguém cadastra, edita ou exclui, exceto quem avalia e os admins
-- dos Programas, para poderem testar antes da abertura.
--
-- Operação ou Back office é escolha de quem cadastra (decisão do Lucas, 09/11).
-- A validação e a votação estão em supabase_migration_programas_awards_votacao.sql,
-- que redefine as policies deste arquivo: NÃO rode este de novo depois daquele.
--
-- PRÉ-REQUISITO: supabase_migration_programas.sql (is_programas_admin).
-- APLICAR ANTES DO FRONT, que grava nesta tabela.
-- CONFERIR NO PAINEL: Storage > Settings > "Global file size limit" tem que ser
-- de pelo menos 100 MB; acima disso o limite do bucket não vale sozinho.
-- Idempotente: pode rodar de novo.
-- ============================================================================

create or replace function app_private.awards_avaliador()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
    'lucas.ferraz@phdengenharia.eng.br',
    'andre.guimaraes@phdengenharia.eng.br',
    'marcus.guimaraes@phdengenharia.eng.br',
    'pedro.morais@phdengenharia.eng.br'
  )
$$;

create or replace function app_private.awards_pode_inscrever()
returns boolean language sql stable security definer set search_path = '' as $$
  select (timezone('America/Sao_Paulo', now()))::date between date '2026-11-16' and date '2026-12-04'
      or app_private.awards_avaliador()
      or app_private.is_programas_admin()
$$;

revoke all on function app_private.awards_avaliador() from public;
revoke all on function app_private.awards_pode_inscrever() from public;
revoke execute on function app_private.awards_avaliador() from anon;
revoke execute on function app_private.awards_pode_inscrever() from anon;
grant execute on function app_private.awards_avaliador() to authenticated;
grant execute on function app_private.awards_pode_inscrever() to authenticated;

create table if not exists public.programas_awards_projetos (
  id            uuid primary key default gen_random_uuid(),
  numero        integer generated always as identity,
  autor_id      uuid not null references public.colaboradores(id),
  categoria     text not null check (categoria in ('operacao', 'backoffice')),
  codigo_setor  text not null check (btrim(codigo_setor) <> ''),
  explicacao    text not null check (btrim(explicacao) <> ''),
  impacto       text not null check (btrim(impacto) <> ''),
  contribuicao  text not null check (btrim(contribuicao) <> ''),
  economia      text not null check (btrim(economia) <> ''),
  inovacoes     text not null check (btrim(inovacoes) <> ''),
  legado        text not null check (btrim(legado) <> ''),
  participantes text not null check (btrim(participantes) <> ''),
  -- {path, nome, tipo, tamanho, enviado_em}, ou null: o arquivo é um só.
  apresentacao  jsonb check (apresentacao is null or jsonb_typeof(apresentacao) = 'object'),
  criado_em     timestamptz not null default now()
);

create index if not exists programas_awards_projetos_autor_idx
  on public.programas_awards_projetos (autor_id);

alter table public.programas_awards_projetos enable row level security;
revoke all on table public.programas_awards_projetos from anon;

drop policy if exists programas_awards_select on public.programas_awards_projetos;
create policy programas_awards_select on public.programas_awards_projetos
  for select to authenticated
  using (autor_id = app_private.my_colaborador_id() or app_private.awards_avaliador());

drop policy if exists programas_awards_insert on public.programas_awards_projetos;
create policy programas_awards_insert on public.programas_awards_projetos
  for insert to authenticated
  with check (autor_id = app_private.my_colaborador_id() and app_private.awards_pode_inscrever());

drop policy if exists programas_awards_update on public.programas_awards_projetos;
create policy programas_awards_update on public.programas_awards_projetos
  for update to authenticated
  using (autor_id = app_private.my_colaborador_id() and app_private.awards_pode_inscrever())
  with check (autor_id = app_private.my_colaborador_id() and app_private.awards_pode_inscrever());

drop policy if exists programas_awards_delete on public.programas_awards_projetos;
create policy programas_awards_delete on public.programas_awards_projetos
  for delete to authenticated
  using (autor_id = app_private.my_colaborador_id() and app_private.awards_pode_inscrever());

-- ----------------------------------------------------------------------------
-- Bucket das apresentações: PRIVADO, uma pasta por colaborador. O download no
-- front sai por URL assinada. Os tipos seguem o formulário: Word, Excel, PPT, PDF,
-- imagem, vídeo e áudio.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'programas-awards', 'programas-awards', false, 104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/webm', 'video/x-matroska',
    'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/aac'
  ]
)
on conflict (id) do nothing;

drop policy if exists programas_awards_arquivo_insert on storage.objects;
create policy programas_awards_arquivo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'programas-awards'
    and (storage.foldername(name))[1] = (app_private.my_colaborador_id())::text
    and app_private.awards_pode_inscrever()
  );

drop policy if exists programas_awards_arquivo_select on storage.objects;
create policy programas_awards_arquivo_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'programas-awards'
    and ((storage.foldername(name))[1] = (app_private.my_colaborador_id())::text
         or app_private.awards_avaliador())
  );

drop policy if exists programas_awards_arquivo_delete on storage.objects;
create policy programas_awards_arquivo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'programas-awards'
    and (storage.foldername(name))[1] = (app_private.my_colaborador_id())::text
    and app_private.awards_pode_inscrever()
  );

-- PostgREST guarda o schema em cache; sem isso o front recebe
-- "Could not find the table ... in the schema cache".
notify pgrst, 'reload schema';
