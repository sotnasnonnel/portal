-- Migration: PLR, multiplicador da empresa editável (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (04/11/2026): a parte da empresa no PLR dos colaboradores é
-- um percentual fixo, igual para todos, e o admin do PLR muda esse percentual em
-- Editar resultados. Sem linha na tabela para o ano, vale 75%.
--
-- ORDEM (a Edge Function nova depende destas RPCs):
--   1. esta migração;
--   2. deploy da Edge Function plr-calculo;
--   3. deploy do front.
--
-- Pré-requisito: supabase_migration_plr_calculo.sql.
-- ============================================================================

create table if not exists public.plr_config (
  ano             integer primary key,
  mult_empresa    numeric not null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.colaboradores(id),
  constraint plr_config_mult_empresa check (mult_empresa >= 0 and mult_empresa <= 1)
);

-- Como as outras tabelas do PLR: RLS ligada, sem policy, tudo pelas RPCs abaixo.
alter table public.plr_config enable row level security;
revoke all on public.plr_config from anon, authenticated;

create or replace function public.plr_mult_empresa(p_ano integer)
 returns numeric language plpgsql stable security definer set search_path to ''
as $$
begin
  if public.plr_acesso(p_ano) is null then
    raise exception 'Sem acesso ao PLR.' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((select c.mult_empresa from public.plr_config c where c.ano = p_ano), 0.75);
end $$;

create or replace function public.plr_salvar_mult_empresa(p_ano integer, p_valor numeric)
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if app_private.plr_papel() is distinct from 'admin' then
    raise exception 'Só o admin do PLR muda o multiplicador da empresa.' using errcode = 'insufficient_privilege';
  end if;
  if p_valor is null or p_valor < 0 or p_valor > 1 then
    raise exception 'O multiplicador da empresa vai de 0%% a 100%%.';
  end if;
  insert into public.plr_config (ano, mult_empresa, atualizado_em, atualizado_por)
  values (p_ano, p_valor, now(), app_private.plr_eu())
  on conflict (ano) do update
    set mult_empresa = excluded.mult_empresa,
        atualizado_em = excluded.atualizado_em,
        atualizado_por = excluded.atualizado_por;
end $$;

revoke all on function public.plr_mult_empresa(integer) from public, anon;
revoke all on function public.plr_salvar_mult_empresa(integer, numeric) from public, anon;
grant execute on function public.plr_mult_empresa(integer) to authenticated;
grant execute on function public.plr_salvar_mult_empresa(integer, numeric) to authenticated;
