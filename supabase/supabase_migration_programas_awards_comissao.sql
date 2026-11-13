-- Migration: programas_awards_comissao (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- PHD Awards: nota da comissão (Lucas, 12/11).
--
-- Nota final = 50% votação + 50% comissão (era 70/30 até 13/11; o peso mora
-- no front, AWARDS_PESO_*). A comissão dá UMA nota de consenso
-- por projeto (não cada um a sua), de 0 a 10 em cada critério. Os critérios
-- moram no front (AWARDS_CRITERIOS em src/config/programas.js); aqui fica só
-- a nota de cada (projeto, critério). A conta da nota final é feita na tela.
--
-- Quem avalia lê e grava. Pode dar nota com a votação aberta ou encerrada
-- (cronograma: votação 07 a 11/12, comissão 14 a 18/12). Ninguém mais lê: a
-- nota não aparece na revelação.
-- "Reiniciar premiação" passa a apagar as notas também.
--
-- PRÉ-REQUISITO: supabase_migration_programas_awards_video.sql.
-- APLICAR ANTES DO FRONT. Idempotente: pode rodar de novo.
-- ============================================================================

create table if not exists public.programas_awards_notas (
  projeto_id     uuid not null references public.programas_awards_projetos(id) on delete cascade,
  criterio       text not null check (btrim(criterio) <> ''),
  nota           numeric(4, 2) not null check (nota between 0 and 10),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.colaboradores(id) default app_private.my_colaborador_id(),
  primary key (projeto_id, criterio)
);

alter table public.programas_awards_notas enable row level security;
revoke all on table public.programas_awards_notas from anon;

drop policy if exists programas_awards_notas_select on public.programas_awards_notas;
create policy programas_awards_notas_select on public.programas_awards_notas
  for select to authenticated
  using (app_private.awards_avaliador());

-- Só projeto que está na votação, e só com a votação aberta ou encerrada.
drop policy if exists programas_awards_notas_insert on public.programas_awards_notas;
create policy programas_awards_notas_insert on public.programas_awards_notas
  for insert to authenticated
  with check (
    app_private.awards_avaliador()
    and app_private.awards_fase() in ('votacao', 'encerrada')
    and exists (select 1 from public.programas_awards_finalistas f where f.projeto_id = programas_awards_notas.projeto_id)
  );

drop policy if exists programas_awards_notas_update on public.programas_awards_notas;
create policy programas_awards_notas_update on public.programas_awards_notas
  for update to authenticated
  using (app_private.awards_avaliador() and app_private.awards_fase() in ('votacao', 'encerrada'))
  with check (app_private.awards_avaliador() and app_private.awards_fase() in ('votacao', 'encerrada'));

drop policy if exists programas_awards_notas_delete on public.programas_awards_notas;
create policy programas_awards_notas_delete on public.programas_awards_notas
  for delete to authenticated
  using (app_private.awards_avaliador() and app_private.awards_fase() in ('votacao', 'encerrada'));

-- Igual à de supabase_migration_programas_awards_reiniciar.sql, mais as notas.
create or replace function public.awards_reiniciar_premiacao()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.awards_avaliador() then
    raise exception 'Só quem avalia reinicia a premiação.';
  end if;
  if (timezone('America/Sao_Paulo', now()))::date >= date '2026-11-16' then
    raise exception 'As inscrições já abriram: não dá mais para reiniciar.';
  end if;

  perform 1 from public.programas_awards_estado where id = 1 for update;
  -- "where true": o safeupdate das chamadas do app recusa DELETE sem WHERE.
  delete from public.programas_awards_notas where true;
  delete from public.programas_awards_podio where true;
  delete from public.programas_awards_votos where true;
  delete from public.programas_awards_finalistas where true;
  update public.programas_awards_estado
  set fase = 'validacao', mudou_em = now(), mudou_por = app_private.my_colaborador_id()
  where id = 1;
end;
$$;

notify pgrst, 'reload schema';
