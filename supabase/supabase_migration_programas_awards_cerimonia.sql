-- Migration: programas_awards_cerimonia (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- PHD Awards: a revelação vira cerimônia (pedido do Lucas, 12/11).
--
-- Antes, "Revelar vencedores" em Projetos inscritos gravava o pódio e já
-- mostrava para todos. Agora são dois passos:
--   1. awards_confirmar_podio: a comissão confirma o pódio (resolvendo empate)
--      com a votação encerrada. Nada fica público; dá para confirmar de novo.
--   2. awards_publicar_vencedores: chamado pela cerimônia em Projetos do Ano,
--      DEPOIS de mostrar o 1º lugar da última categoria. Até lá a fase continua
--      'encerrada', então ninguém vê o resultado pelo celular antes da hora.
--
-- awards_revelar sai: o front antigo que chama ela para de revelar (dá erro)
-- até o dist/ novo subir.
-- Reabrir a votação agora apaga o pódio confirmado: com voto novo, ele pode
-- não valer mais.
--
-- PRÉ-REQUISITO: supabase_migration_programas_awards_votacao.sql.
-- DEPOIS DESTE vem supabase_migration_programas_awards_video.sql, que redefine
-- awards_mudar_fase de novo: rodou este outra vez, rode aquele depois.
-- APLICAR ANTES DO FRONT. Idempotente: pode rodar de novo.
-- ============================================================================

drop function if exists public.awards_revelar(uuid[], uuid[]);

-- Cada array em ordem [1º, 2º, 3º]; com menos de 3 finalistas, menos posições.
create or replace function public.awards_confirmar_podio(p_operacao uuid[], p_backoffice uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_fase       text;
  v_categoria  text;
  v_nome       text;
  v_projetos   uuid[];
  v_finalistas integer;
  v_exigidos   integer;
  v_validos    integer;
begin
  if not app_private.awards_avaliador() then
    raise exception 'Só quem avalia confirma o pódio.';
  end if;
  select fase into v_fase from public.programas_awards_estado where id = 1 for update;
  if v_fase <> 'encerrada' then
    raise exception 'Encerre a votação antes de confirmar o pódio.';
  end if;

  -- "where true": o safeupdate das chamadas do app recusa DELETE sem WHERE.
  delete from public.programas_awards_podio where true;

  foreach v_categoria in array array['operacao', 'backoffice']::text[] loop
    v_projetos := case v_categoria when 'operacao' then p_operacao else p_backoffice end;
    v_nome := case v_categoria when 'operacao' then 'Operação' else 'Back office' end;

    select count(*) into v_finalistas
    from public.programas_awards_finalistas f
    join public.programas_awards_projetos p on p.id = f.projeto_id
    where p.categoria = v_categoria;
    v_exigidos := least(3, v_finalistas);

    if coalesce(array_length(v_projetos, 1), 0) <> v_exigidos
       or array_position(v_projetos, null) is not null
       or (select count(distinct x) from unnest(v_projetos) x) <> v_exigidos then
      raise exception 'O pódio de % precisa de % projetos diferentes.', v_nome, v_exigidos;
    end if;

    select count(*) into v_validos
    from public.programas_awards_finalistas f
    join public.programas_awards_projetos p on p.id = f.projeto_id
    where p.categoria = v_categoria and f.projeto_id = any(v_projetos);
    if v_validos <> v_exigidos then
      raise exception 'O pódio de % só pode ter finalistas da categoria.', v_nome;
    end if;

    insert into public.programas_awards_podio (categoria, posicao, projeto_id)
    select v_categoria, o.posicao, o.projeto_id
    from unnest(v_projetos) with ordinality as o(projeto_id, posicao);
  end loop;
end;
$$;

create or replace function public.awards_publicar_vencedores()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_fase text;
begin
  if not app_private.awards_avaliador() then
    raise exception 'Só quem avalia revela os vencedores.';
  end if;
  select fase into v_fase from public.programas_awards_estado where id = 1 for update;
  if v_fase = 'revelada' then
    return;
  end if;
  if v_fase <> 'encerrada' then
    raise exception 'Encerre a votação antes de revelar.';
  end if;

  if not exists (select 1 from public.programas_awards_podio)
     or exists (
       select 1
       from (values ('operacao'), ('backoffice')) c(categoria)
       where (select count(*) from public.programas_awards_podio pd where pd.categoria = c.categoria)
          <> least(3, (select count(*)
                       from public.programas_awards_finalistas f
                       join public.programas_awards_projetos p on p.id = f.projeto_id
                       where p.categoria = c.categoria))
     ) then
    raise exception 'Confirme o pódio em Projetos inscritos antes de revelar.';
  end if;

  update public.programas_awards_estado
  set fase = 'revelada', mudou_em = now(), mudou_por = app_private.my_colaborador_id()
  where id = 1;
end;
$$;

-- Igual à da votação, mais: reabrir a votação apaga o pódio confirmado.
create or replace function public.awards_mudar_fase(p_fase text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_atual text;
begin
  if not app_private.awards_avaliador() then
    raise exception 'Só quem avalia muda a fase do prêmio.';
  end if;
  select fase into v_atual from public.programas_awards_estado where id = 1 for update;

  if (v_atual, p_fase) = ('validacao', 'votacao') then
    if not exists (select 1 from public.programas_awards_finalistas) then
      raise exception 'Marque pelo menos um finalista antes de abrir a votação.';
    end if;
  elsif (v_atual, p_fase) = ('votacao', 'validacao') then
    if exists (select 1 from public.programas_awards_votos) then
      raise exception 'Já há votos: não dá para voltar à validação.';
    end if;
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

revoke all on function public.awards_confirmar_podio(uuid[], uuid[]) from public;
revoke all on function public.awards_publicar_vencedores() from public;
revoke execute on function public.awards_confirmar_podio(uuid[], uuid[]) from anon;
revoke execute on function public.awards_publicar_vencedores() from anon;
grant execute on function public.awards_confirmar_podio(uuid[], uuid[]) to authenticated;
grant execute on function public.awards_publicar_vencedores() to authenticated;

notify pgrst, 'reload schema';
