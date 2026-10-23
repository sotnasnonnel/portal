-- Migration: Feed — regras de convivência com aceite no primeiro acesso (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (23/10/2026): quem entra no feed pela primeira vez vê um
-- termo com os avisos principais do que não fazer e só usa o feed depois de
-- aceitar. O texto mora em src/config/feed.js (TERMOS_FEED).
--
-- O aceite fica no cadastro da pessoa, como o feed_visto_em: a versão aceita e
-- quando. Versão nova do texto (TERMOS_FEED.versao) faz todo mundo aceitar de
-- novo — a tela compara a versão gravada com a atual.
--
-- O banco só registra o aceite; feed_postar e feed_comentar NÃO conferem. A
-- trava é da tela (o termo cobre a página até o aceite).
--
-- Pré-requisito: supabase_migration_feed_mencoes.sql. Aplicar ANTES do deploy do front.
-- Já aplicada em 23/10/2026.
-- ============================================================================

alter table public.colaboradores add column if not exists feed_termos_versao text;
alter table public.colaboradores add column if not exists feed_termos_em     timestamptz;

-- O aceite de quem está logado: { versao, em }, ou nulos se nunca aceitou.
create or replace function public.feed_termos_aceite()
 returns table (versao text, em timestamptz) language sql stable security definer set search_path to ''
as $$
  select c.feed_termos_versao, c.feed_termos_em
    from public.colaboradores c
   where c.id = app_private.feed_eu()
$$;

-- Registra o aceite da versão que a pessoa leu e devolve a hora gravada.
create or replace function public.feed_aceitar_termos(p_versao text)
 returns timestamptz language plpgsql security definer set search_path to ''
as $$
declare
  v_eu uuid := app_private.feed_eu();
  v_em timestamptz := now();
begin
  if v_eu is null then raise exception 'Só colaborador ativo usa o feed.'; end if;
  if coalesce(btrim(p_versao), '') = '' then raise exception 'Versão do termo não informada.'; end if;
  update public.colaboradores
     set feed_termos_versao = left(btrim(p_versao), 20), feed_termos_em = v_em
   where id = v_eu;
  return v_em;
end $$;

revoke all on function public.feed_termos_aceite(), public.feed_aceitar_termos(text) from public, anon;
grant execute on function public.feed_termos_aceite(), public.feed_aceitar_termos(text) to authenticated;
