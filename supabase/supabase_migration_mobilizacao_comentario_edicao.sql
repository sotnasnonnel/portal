-- Migration: editar comentário de etapa da Mobilização (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido: corrigir erro de digitação ou esclarecer o que ficou confuso, sem
-- apagar o que estava escrito antes — a mensagem passa a mostrar "Editada", com
-- data, hora e quem editou, e as versões anteriores ficam para consulta.
--
-- DUAS decisões que o pedido não decide, e que ficam aqui:
--
-- 1) SÓ O AUTOR edita. Editar a mensagem de outra pessoa muda o que ela disse,
--    e um processo de mobilização é registro de exame, ASO e contrato. Guardar
--    a versão antiga documenta a troca, mas não devolve o consentimento de quem
--    escreveu.
--
-- 2) O TEXTO é a única coisa editável. Anexo não se corrige: some ou entra um
--    novo, e os dois casos são um comentário novo. Deixar o jsonb editável
--    abriria a porta para apagar um documento sem rastro nenhum.
--
-- O histórico não é opcional nem é responsabilidade da tela: quem grava a
-- versão anterior é um GATILHO, como a auditoria das horas extras. Uma tela que
-- esqueça de gravar a versão é um bug silencioso; um gatilho não esquece.
--
-- Para derrubar:
--     drop trigger if exists mob_coment_versionar on public.mobilizacao_etapa_comentarios;
--     drop table if exists public.mobilizacao_etapa_comentario_versoes;
--     alter table public.mobilizacao_etapa_comentarios
--       drop column editado_em, drop column editado_por;
-- ============================================================================

alter table public.mobilizacao_etapa_comentarios
  add column if not exists editado_em  timestamptz,
  add column if not exists editado_por uuid references public.colaboradores(id);

comment on column public.mobilizacao_etapa_comentarios.editado_em is
  'Quando o texto foi editado pela última vez. NULL = nunca editado (é o que a tela usa para mostrar "Editada").';

-- ----------------------------------------------------------------------------
-- As versões anteriores. Uma linha por edição, com o texto COMO ESTAVA e o
-- período em que ele valeu — é isso que permite ler a conversa como ela era
-- quando alguém a respondeu.
-- ----------------------------------------------------------------------------
create table if not exists public.mobilizacao_etapa_comentario_versoes (
  id uuid primary key default gen_random_uuid(),
  comentario_id uuid not null
    references public.mobilizacao_etapa_comentarios(id) on delete cascade,
  texto text not null,
  -- Desde quando este texto valia: a criação do comentário, na primeira edição,
  -- e a edição anterior nas seguintes.
  vigorou_de  timestamptz not null,
  vigorou_ate timestamptz not null default now(),
  -- Quem trocou o texto — o autor, pela regra acima, mas gravado mesmo assim:
  -- a regra pode mudar, o registro do que aconteceu não.
  editado_por uuid references public.colaboradores(id)
);

create index if not exists mob_coment_versoes_coment
  on public.mobilizacao_etapa_comentario_versoes (comentario_id, vigorou_ate desc);

-- ----------------------------------------------------------------------------
-- O gatilho: arquiva a versão antiga e carimba a edição.
--
-- `editado_em` e `editado_por` são escritos AQUI, e não pela tela: mandar do
-- front o nome de quem editou é pedir para alguém mandar outro.
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_coment_versionar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Edição que não muda o texto (salvar sem alterar nada) não vira versão.
  if new.texto is not distinct from old.texto then
    new.editado_em  := old.editado_em;
    new.editado_por := old.editado_por;
    return new;
  end if;

  insert into public.mobilizacao_etapa_comentario_versoes
    (comentario_id, texto, vigorou_de, vigorou_ate, editado_por)
  values
    (old.id, old.texto, coalesce(old.editado_em, old.created_at), now(),
     app_private.my_colaborador_id());

  new.editado_em  := now();
  new.editado_por := app_private.my_colaborador_id();
  return new;
end $$;

drop trigger if exists mob_coment_versionar on public.mobilizacao_etapa_comentarios;
create trigger mob_coment_versionar
before update of texto on public.mobilizacao_etapa_comentarios
for each row execute function app_private.mob_coment_versionar();

-- ----------------------------------------------------------------------------
-- Quem edita: só o autor, e só enquanto continua enxergando a etapa.
--
-- A policy não consegue impedir que o UPDATE toque outras colunas (o Postgres
-- não filtra coluna em RLS), mas o grant abaixo consegue: `update (texto)` é o
-- único UPDATE que o papel authenticated tem nesta tabela.
-- ----------------------------------------------------------------------------
drop policy if exists mobilizacao_etapa_coment_update on public.mobilizacao_etapa_comentarios;
create policy mobilizacao_etapa_coment_update on public.mobilizacao_etapa_comentarios
  for update to authenticated
  using (
    autor_id = app_private.my_colaborador_id()
    and app_private.mob_pode_ver_etapa(etapa_id)
  )
  with check (autor_id = app_private.my_colaborador_id());

revoke update on public.mobilizacao_etapa_comentarios from authenticated;
grant update (texto) on public.mobilizacao_etapa_comentarios to authenticated;

-- As versões seguem a régua do comentário: quem lê a etapa lê o histórico dela.
-- Ninguém escreve aqui pela API — só o gatilho, que é SECURITY DEFINER.
alter table public.mobilizacao_etapa_comentario_versoes enable row level security;

drop policy if exists mob_coment_versoes_select on public.mobilizacao_etapa_comentario_versoes;
create policy mob_coment_versoes_select on public.mobilizacao_etapa_comentario_versoes
  for select to authenticated
  using (exists (
    select 1 from public.mobilizacao_etapa_comentarios c
    where c.id = comentario_id
      and app_private.mob_pode_ver_etapa(c.etapa_id)
  ));

-- PostgREST guarda o schema em cache; sem isso o front recebe
-- "Could not find the table ... in the schema cache".
notify pgrst, 'reload schema';
