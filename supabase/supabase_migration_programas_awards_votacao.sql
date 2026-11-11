-- Migration: programas_awards_votacao (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- PHD Awards, Projetos do Ano: validação, votação e revelação dos vencedores.
-- Regras do Lucas Ferraz (10/11):
--   - quem avalia marca os finalistas, no máximo 6 por categoria (o número fica
--     em programas_awards_estado.max_finalistas: dá para mudar sem migração);
--   - todos votam em 1º, 2º e 3º, separado por categoria; 1º vale 3 pontos,
--     2º vale 2 e 3º vale 1. Pode votar no próprio projeto e mudar o voto
--     enquanto a votação estiver aberta;
--   - só quem avalia vê o resultado parcial, para resolver empate antes de
--     revelar (quem decide o empate é a comissão: André, Lucas e Pedro);
--   - abrir, encerrar e revelar são botões de quem avalia, sem data fixa.
--
-- FASES (programas_awards_estado.fase, uma linha só):
--   validacao  inscrições e escolha dos finalistas. Nada é público.
--   votacao    os finalistas ficam visíveis para todos, com o arquivo, e todos
--              votam. Nenhum projeto muda mais (cadastro, edição, exclusão).
--   encerrada  ninguém vota; quem avalia confere o resultado e monta o pódio.
--   revelada   o pódio de cada categoria fica visível para todos.
--
-- Os votos não são legíveis por ninguém além do próprio eleitor: quem avalia
-- recebe só a soma, por awards_resultado().
--
-- PRÉ-REQUISITO: supabase_migration_programas_awards.sql.
-- APLICAR ANTES DO FRONT: a tela nova lê programas_awards_estado.
-- Idempotente: pode rodar de novo.
-- ============================================================================

-- ------------------------------------------------------- quem avalia ----
-- Pedro Morais entrou em 11/11: ele está na comissão que decide empate.
-- Repete AWARDS_AVALIADORES (src/config/programas.js): mudou lá, muda aqui.
create or replace function app_private.awards_avaliador()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
    'lucas.ferraz@phdengenharia.eng.br',
    'andre.guimaraes@phdengenharia.eng.br',
    'marcus.guimaraes@phdengenharia.eng.br',
    'pedro.morais@phdengenharia.eng.br'
  )
$$;

-- ---------------------------------------------------------------- estado ----
create table if not exists public.programas_awards_estado (
  id             smallint primary key default 1 check (id = 1),
  fase           text not null default 'validacao'
                 check (fase in ('validacao', 'votacao', 'encerrada', 'revelada')),
  max_finalistas smallint not null default 6 check (max_finalistas between 1 and 20),
  mudou_em       timestamptz not null default now(),
  mudou_por      uuid references public.colaboradores(id)
);
insert into public.programas_awards_estado (id) values (1) on conflict (id) do nothing;

alter table public.programas_awards_estado enable row level security;
revoke all on table public.programas_awards_estado from anon;
-- Só leitura: quem muda a fase é awards_mudar_fase() / awards_revelar().
drop policy if exists programas_awards_estado_select on public.programas_awards_estado;
create policy programas_awards_estado_select on public.programas_awards_estado
  for select to authenticated using (true);

create or replace function app_private.awards_fase()
returns text language sql stable security definer set search_path = '' as $$
  select fase from public.programas_awards_estado where id = 1
$$;

-- ------------------------------------------------------------ finalistas ----
create table if not exists public.programas_awards_finalistas (
  projeto_id  uuid primary key references public.programas_awards_projetos(id) on delete cascade,
  marcado_por uuid references public.colaboradores(id),
  marcado_em  timestamptz not null default now()
);

alter table public.programas_awards_finalistas enable row level security;
revoke all on table public.programas_awards_finalistas from anon;
drop policy if exists programas_awards_finalistas_select on public.programas_awards_finalistas;
create policy programas_awards_finalistas_select on public.programas_awards_finalistas
  for select to authenticated
  using (app_private.awards_avaliador() or app_private.awards_fase() <> 'validacao');

-- Projeto finalista depois que a votação abriu: todo logado lê.
create or replace function app_private.awards_projeto_publico(p_projeto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.awards_fase() <> 'validacao'
     and exists (select 1 from public.programas_awards_finalistas f where f.projeto_id = p_projeto)
$$;

-- O mesmo, para o arquivo do projeto no bucket.
create or replace function app_private.awards_arquivo_publico(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.awards_fase() <> 'validacao'
     and exists (
       select 1
       from public.programas_awards_projetos p
       join public.programas_awards_finalistas f on f.projeto_id = p.id
       where p.apresentacao ->> 'path' = p_path
     )
$$;

-- ----------------------------------------------------------------- votos ----
create table if not exists public.programas_awards_votos (
  eleitor_id uuid not null references public.colaboradores(id),
  categoria  text not null check (categoria in ('operacao', 'backoffice')),
  posicao    smallint not null check (posicao between 1 and 3),
  projeto_id uuid not null references public.programas_awards_projetos(id) on delete cascade,
  votado_em  timestamptz not null default now(),
  primary key (eleitor_id, categoria, posicao),
  unique (eleitor_id, categoria, projeto_id)
);
create index if not exists programas_awards_votos_projeto_idx on public.programas_awards_votos (projeto_id);

alter table public.programas_awards_votos enable row level security;
revoke all on table public.programas_awards_votos from anon;
-- Cada um lê só o próprio voto. Gravar, só por awards_votar().
drop policy if exists programas_awards_votos_select on public.programas_awards_votos;
create policy programas_awards_votos_select on public.programas_awards_votos
  for select to authenticated
  using (eleitor_id = app_private.my_colaborador_id());

-- ----------------------------------------------------------------- pódio ----
create table if not exists public.programas_awards_podio (
  categoria  text not null check (categoria in ('operacao', 'backoffice')),
  posicao    smallint not null check (posicao between 1 and 3),
  projeto_id uuid not null references public.programas_awards_projetos(id) on delete cascade,
  primary key (categoria, posicao),
  unique (projeto_id)
);

alter table public.programas_awards_podio enable row level security;
revoke all on table public.programas_awards_podio from anon;
drop policy if exists programas_awards_podio_select on public.programas_awards_podio;
create policy programas_awards_podio_select on public.programas_awards_podio
  for select to authenticated
  using (app_private.awards_fase() = 'revelada' or app_private.awards_avaliador());

-- ------------------------------------------- projetos: leitura e trava ----
-- Finalista vira público quando a votação abre. Fora da fase de validação,
-- ninguém cadastra, edita ou exclui: o voto tem que ser sobre o projeto que
-- quem avaliou escolheu.
drop policy if exists programas_awards_select on public.programas_awards_projetos;
create policy programas_awards_select on public.programas_awards_projetos
  for select to authenticated
  using (
    autor_id = app_private.my_colaborador_id()
    or app_private.awards_avaliador()
    or app_private.awards_projeto_publico(id)
  );

drop policy if exists programas_awards_insert on public.programas_awards_projetos;
create policy programas_awards_insert on public.programas_awards_projetos
  for insert to authenticated
  with check (
    autor_id = app_private.my_colaborador_id()
    and app_private.awards_pode_inscrever()
    and app_private.awards_fase() = 'validacao'
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
  );

drop policy if exists programas_awards_delete on public.programas_awards_projetos;
create policy programas_awards_delete on public.programas_awards_projetos
  for delete to authenticated
  using (
    autor_id = app_private.my_colaborador_id()
    and app_private.awards_pode_inscrever()
    and app_private.awards_fase() = 'validacao'
  );

drop policy if exists programas_awards_arquivo_insert on storage.objects;
create policy programas_awards_arquivo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'programas-awards'
    and (storage.foldername(name))[1] = (app_private.my_colaborador_id())::text
    and app_private.awards_pode_inscrever()
    and app_private.awards_fase() = 'validacao'
  );

drop policy if exists programas_awards_arquivo_select on storage.objects;
create policy programas_awards_arquivo_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'programas-awards'
    and ((storage.foldername(name))[1] = (app_private.my_colaborador_id())::text
         or app_private.awards_avaliador()
         or app_private.awards_arquivo_publico(name))
  );

drop policy if exists programas_awards_arquivo_delete on storage.objects;
create policy programas_awards_arquivo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'programas-awards'
    and (storage.foldername(name))[1] = (app_private.my_colaborador_id())::text
    and app_private.awards_pode_inscrever()
    and app_private.awards_fase() = 'validacao'
  );

-- ------------------------------------------------------------------ RPCs ----
-- Todas travam a linha do estado: assim um voto não entra no meio do
-- "Encerrar votação", e dois avaliadores não passam juntos do limite de finalistas.

create or replace function public.awards_marcar_finalista(p_projeto uuid, p_finalista boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_estado    public.programas_awards_estado;
  v_categoria text;
  v_total     integer;
begin
  if not app_private.awards_avaliador() then
    raise exception 'Só quem avalia escolhe os finalistas.';
  end if;
  select * into v_estado from public.programas_awards_estado where id = 1 for update;
  if v_estado.fase <> 'validacao' then
    raise exception 'A votação já foi aberta: os finalistas não mudam mais.';
  end if;

  if not p_finalista then
    delete from public.programas_awards_finalistas where projeto_id = p_projeto;
    return;
  end if;

  select categoria into v_categoria from public.programas_awards_projetos where id = p_projeto;
  if v_categoria is null then
    raise exception 'Projeto não encontrado.';
  end if;
  select count(*) into v_total
  from public.programas_awards_finalistas f
  join public.programas_awards_projetos p on p.id = f.projeto_id
  where p.categoria = v_categoria and f.projeto_id <> p_projeto;
  if v_total >= v_estado.max_finalistas then
    raise exception 'Esta categoria já tem % finalistas, o máximo.', v_estado.max_finalistas;
  end if;

  insert into public.programas_awards_finalistas (projeto_id, marcado_por)
  values (p_projeto, app_private.my_colaborador_id())
  on conflict (projeto_id) do nothing;
end;
$$;

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
  elsif (v_atual, p_fase) in (('votacao', 'encerrada'), ('encerrada', 'votacao'), ('revelada', 'encerrada')) then
    null;
  else
    raise exception 'Não dá para passar de % para %.', v_atual, p_fase;
  end if;

  update public.programas_awards_estado
  set fase = p_fase, mudou_em = now(), mudou_por = app_private.my_colaborador_id()
  where id = 1;
end;
$$;

-- p_projetos em ordem: [1º, 2º, 3º]. Com menos de 3 finalistas na categoria,
-- o voto tem tantas posições quantos forem os finalistas.
create or replace function public.awards_votar(p_categoria text, p_projetos uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_eleitor    uuid := app_private.my_colaborador_id();
  v_fase       text;
  v_finalistas integer;
  v_exigidos   integer;
  v_validos    integer;
begin
  if v_eleitor is null then
    raise exception 'Colaborador não encontrado para este login.';
  end if;
  select fase into v_fase from public.programas_awards_estado where id = 1 for share;
  if v_fase <> 'votacao' then
    raise exception 'A votação não está aberta.';
  end if;
  if p_categoria not in ('operacao', 'backoffice') then
    raise exception 'Categoria inválida.';
  end if;

  select count(*) into v_finalistas
  from public.programas_awards_finalistas f
  join public.programas_awards_projetos p on p.id = f.projeto_id
  where p.categoria = p_categoria;
  v_exigidos := least(3, v_finalistas);

  if coalesce(array_length(p_projetos, 1), 0) <> v_exigidos
     or array_position(p_projetos, null) is not null
     or (select count(distinct x) from unnest(p_projetos) x) <> v_exigidos then
    raise exception 'Escolha % projetos diferentes, um para cada posição.', v_exigidos;
  end if;

  select count(*) into v_validos
  from public.programas_awards_finalistas f
  join public.programas_awards_projetos p on p.id = f.projeto_id
  where p.categoria = p_categoria and f.projeto_id = any(p_projetos);
  if v_validos <> v_exigidos then
    raise exception 'Só dá para votar nos finalistas desta categoria.';
  end if;

  delete from public.programas_awards_votos where eleitor_id = v_eleitor and categoria = p_categoria;
  insert into public.programas_awards_votos (eleitor_id, categoria, posicao, projeto_id)
  select v_eleitor, p_categoria, o.posicao, o.projeto_id
  from unnest(p_projetos) with ordinality as o(projeto_id, posicao);
end;
$$;

-- A soma por finalista, sem dizer quem votou em quem. Só para quem avalia.
create or replace function public.awards_resultado()
returns table (
  categoria text, projeto_id uuid, pontos integer,
  primeiro integer, segundo integer, terceiro integer, eleitores integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.awards_avaliador() then
    raise exception 'Só quem avalia vê o resultado.';
  end if;
  return query
  select
    p.categoria,
    p.id,
    coalesce(sum(4 - v.posicao), 0)::integer,
    (count(*) filter (where v.posicao = 1))::integer,
    (count(*) filter (where v.posicao = 2))::integer,
    (count(*) filter (where v.posicao = 3))::integer,
    (select count(distinct v2.eleitor_id) from public.programas_awards_votos v2
      where v2.categoria = p.categoria)::integer
  from public.programas_awards_finalistas f
  join public.programas_awards_projetos p on p.id = f.projeto_id
  left join public.programas_awards_votos v on v.projeto_id = p.id
  group by p.categoria, p.id;
end;
$$;

-- O pódio é o que a comissão confirma, não o cálculo: o empate se resolve aqui.
-- Cada array em ordem [1º, 2º, 3º]; com menos de 3 finalistas, menos posições.
create or replace function public.awards_revelar(p_operacao uuid[], p_backoffice uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_fase       text;
  v_categoria  text;
  v_projetos   uuid[];
  v_finalistas integer;
  v_exigidos   integer;
  v_validos    integer;
begin
  if not app_private.awards_avaliador() then
    raise exception 'Só quem avalia revela os vencedores.';
  end if;
  select fase into v_fase from public.programas_awards_estado where id = 1 for update;
  if v_fase <> 'encerrada' then
    raise exception 'Encerre a votação antes de revelar.';
  end if;

  delete from public.programas_awards_podio;

  foreach v_categoria in array array['operacao', 'backoffice']::text[] loop
    v_projetos := case v_categoria when 'operacao' then p_operacao else p_backoffice end;

    select count(*) into v_finalistas
    from public.programas_awards_finalistas f
    join public.programas_awards_projetos p on p.id = f.projeto_id
    where p.categoria = v_categoria;
    v_exigidos := least(3, v_finalistas);

    if coalesce(array_length(v_projetos, 1), 0) <> v_exigidos
       or array_position(v_projetos, null) is not null
       or (select count(distinct x) from unnest(v_projetos) x) <> v_exigidos then
      raise exception 'O pódio de % precisa de % projetos diferentes.',
        case v_categoria when 'operacao' then 'Operação' else 'Back office' end, v_exigidos;
    end if;

    select count(*) into v_validos
    from public.programas_awards_finalistas f
    join public.programas_awards_projetos p on p.id = f.projeto_id
    where p.categoria = v_categoria and f.projeto_id = any(v_projetos);
    if v_validos <> v_exigidos then
      raise exception 'O pódio de % só pode ter finalistas da categoria.',
        case v_categoria when 'operacao' then 'Operação' else 'Back office' end;
    end if;

    insert into public.programas_awards_podio (categoria, posicao, projeto_id)
    select v_categoria, o.posicao, o.projeto_id
    from unnest(v_projetos) with ordinality as o(projeto_id, posicao);
  end loop;

  update public.programas_awards_estado
  set fase = 'revelada', mudou_em = now(), mudou_por = app_private.my_colaborador_id()
  where id = 1;
end;
$$;

-- ---------------------------------------------------------------- grants ----
revoke all on function app_private.awards_fase() from public;
revoke all on function app_private.awards_projeto_publico(uuid) from public;
revoke all on function app_private.awards_arquivo_publico(text) from public;
revoke all on function public.awards_marcar_finalista(uuid, boolean) from public;
revoke all on function public.awards_mudar_fase(text) from public;
revoke all on function public.awards_votar(text, uuid[]) from public;
revoke all on function public.awards_resultado() from public;
revoke all on function public.awards_revelar(uuid[], uuid[]) from public;

revoke execute on function app_private.awards_fase() from anon;
revoke execute on function app_private.awards_projeto_publico(uuid) from anon;
revoke execute on function app_private.awards_arquivo_publico(text) from anon;
revoke execute on function public.awards_marcar_finalista(uuid, boolean) from anon;
revoke execute on function public.awards_mudar_fase(text) from anon;
revoke execute on function public.awards_votar(text, uuid[]) from anon;
revoke execute on function public.awards_resultado() from anon;
revoke execute on function public.awards_revelar(uuid[], uuid[]) from anon;

grant execute on function app_private.awards_fase() to authenticated;
grant execute on function app_private.awards_projeto_publico(uuid) to authenticated;
grant execute on function app_private.awards_arquivo_publico(text) to authenticated;
grant execute on function public.awards_marcar_finalista(uuid, boolean) to authenticated;
grant execute on function public.awards_mudar_fase(text) to authenticated;
grant execute on function public.awards_votar(text, uuid[]) to authenticated;
grant execute on function public.awards_resultado() to authenticated;
grant execute on function public.awards_revelar(uuid[], uuid[]) to authenticated;

notify pgrst, 'reload schema';
