-- Migration: programas_awards_video (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- PHD Awards, mudanças do Lucas em 12/11:
--
-- 1. VÍDEO OBRIGATÓRIO no cadastro (1 minuto mostrando o projeto/obra e a
--    equipe). A apresentação continua, opcional. Coluna nova `video`, no mesmo
--    formato de `apresentacao` ({path, nome, tipo, tamanho, enviado_em}), no
--    mesmo bucket. A obrigação vale para cadastro e edição pela RLS; projeto
--    cadastrado antes disto fica sem vídeo até alguém editar.
--    Vídeo de celular passa fácil de 100 MB: o bucket vai para 300 MB (a
--    apresentação continua limitada a 100 MB pela tela).
--
-- 2. TODOS OS INSCRITOS VÃO PARA A VOTAÇÃO: não há mais escolha de finalistas.
--    A tabela programas_awards_finalistas continua, agora preenchida sozinha
--    quando a votação abre (são "os projetos na votação"); assim visibilidade,
--    voto e resultado não mudam. awards_marcar_finalista sai.
--
-- A nota da comissão (30%) ainda depende dos critérios: fica para depois.
--
-- ORDEM: depois de supabase_migration_programas_awards_cerimonia.sql (esta
-- redefine awards_mudar_fase de novo). APLICAR ANTES DO FRONT.
-- CONFERIR NO PAINEL: Storage > Settings > "Global file size limit" tem que ser
-- de pelo menos 300 MB; acima dele o limite do bucket não vale sozinho.
-- Idempotente: pode rodar de novo.
-- ============================================================================

alter table public.programas_awards_projetos
  add column if not exists video jsonb check (video is null or jsonb_typeof(video) = 'object');

update storage.buckets set file_size_limit = 314572800 where id = 'programas-awards';

drop policy if exists programas_awards_insert on public.programas_awards_projetos;
create policy programas_awards_insert on public.programas_awards_projetos
  for insert to authenticated
  with check (
    autor_id = app_private.my_colaborador_id()
    and app_private.awards_pode_inscrever()
    and app_private.awards_fase() = 'validacao'
    and video is not null
  );

drop policy if exists programas_awards_update on public.programas_awards_projetos;
create policy programas_awards_update on public.programas_awards_projetos
  for update to authenticated
  using (
    autor_id = app_private.my_colaborador_id()
    and app_private.awards_pode_inscrever()
    and app_private.awards_fase() = 'validacao'
  )
  with check (
    autor_id = app_private.my_colaborador_id()
    and app_private.awards_pode_inscrever()
    and app_private.awards_fase() = 'validacao'
    and video is not null
  );

-- O vídeo de quem está na votação também fica legível para todos.
create or replace function app_private.awards_arquivo_publico(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.awards_fase() <> 'validacao'
     and exists (
       select 1
       from public.programas_awards_projetos p
       join public.programas_awards_finalistas f on f.projeto_id = p.id
       where p.apresentacao ->> 'path' = p_path or p.video ->> 'path' = p_path
     )
$$;

drop function if exists public.awards_marcar_finalista(uuid, boolean);

create or replace function public.awards_mudar_fase(p_fase text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_atual text;
begin
  if not app_private.awards_avaliador() then
    raise exception 'Só quem avalia muda a fase do prêmio.';
  end if;
  select fase into v_atual from public.programas_awards_estado where id = 1 for update;

  -- "where true" nos deletes: o safeupdate das chamadas do app recusa DELETE sem WHERE.
  if (v_atual, p_fase) = ('validacao', 'votacao') then
    if not exists (select 1 from public.programas_awards_projetos) then
      raise exception 'Nenhum projeto inscrito: não há o que votar.';
    end if;
    delete from public.programas_awards_finalistas where true;
    insert into public.programas_awards_finalistas (projeto_id, marcado_por)
    select p.id, app_private.my_colaborador_id() from public.programas_awards_projetos p;
  elsif (v_atual, p_fase) = ('votacao', 'validacao') then
    if exists (select 1 from public.programas_awards_votos) then
      raise exception 'Já há votos: não dá para voltar às inscrições.';
    end if;
    delete from public.programas_awards_finalistas where true;
  elsif (v_atual, p_fase) = ('encerrada', 'votacao') then
    delete from public.programas_awards_podio where true;
  elsif (v_atual, p_fase) in (('votacao', 'encerrada'), ('revelada', 'encerrada')) then
    null;
  else
    raise exception 'Não dá para passar de % para %.', v_atual, p_fase;
  end if;

  update public.programas_awards_estado
  set fase = p_fase, mudou_em = now(), mudou_por = app_private.my_colaborador_id()
  where id = 1;
end;
$$;

revoke all on function public.awards_mudar_fase(text) from public;
revoke execute on function public.awards_mudar_fase(text) from anon;
grant execute on function public.awards_mudar_fase(text) to authenticated;

notify pgrst, 'reload schema';
