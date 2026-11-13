-- Migration: Feed — marcar pessoas ao editar o post (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (13/11/2026): ao editar um post, poder marcar pessoas
-- (além de mudar o texto), como no Publicar.
--
-- feed_editar ganha p_mencoes. As marcações passam pela mesma checagem do
-- feed_postar (feed_mencoes_validas) e substituem as antigas. Só quem ENTROU
-- agora recebe aviso: quem já estava marcado não é avisado de novo a cada
-- edição.
--
-- p_mencoes nulo mantém as marcações como estão: o front antigo, que chama
-- feed_editar(p_id, p_texto), continua funcionando com este SQL aplicado.
--
-- Pré-requisito: supabase_migration_feed_mencoes.sql.
-- Aplicar ANTES do deploy do front (o front novo manda p_mencoes).
-- ============================================================================

drop function if exists public.feed_editar(uuid, text);

create or replace function public.feed_editar(p_id uuid, p_texto text, p_mencoes jsonb default null)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  v_eu      uuid := app_private.feed_eu();
  v_texto   text := btrim(coalesce(p_texto, ''));
  v_post    public.feed_posts;
  v_mencoes jsonb;
  v_novas   jsonb;
begin
  select * into v_post from public.feed_posts where id = p_id and not excluido;
  if v_post.id is null or v_post.autor_id is distinct from v_eu then
    raise exception 'Só quem escreveu edita o post.' using errcode = 'insufficient_privilege';
  end if;
  if v_texto = '' and jsonb_array_length(v_post.midia) = 0 then
    raise exception 'O post não pode ficar vazio.';
  end if;
  if char_length(v_texto) > 3000 then
    raise exception 'O texto passou de 3.000 caracteres.';
  end if;

  if p_mencoes is null then
    v_mencoes := coalesce(v_post.mencoes, '[]'::jsonb);
  else
    v_mencoes := app_private.feed_mencoes_validas(p_mencoes, v_eu);
  end if;

  update public.feed_posts
     set texto = v_texto, mencoes = v_mencoes, editado_em = now()
   where id = p_id;

  -- Aviso só para quem não estava marcado antes.
  select coalesce(jsonb_agg(m), '[]'::jsonb) into v_novas
    from jsonb_array_elements(v_mencoes) m
   where not exists (select 1 from jsonb_array_elements(coalesce(v_post.mencoes, '[]'::jsonb)) a
                      where a->>'id' = m->>'id');
  if jsonb_array_length(v_novas) > 0 then
    perform app_private.feed_avisar_mencoes(v_novas, v_eu, p_id, p_id, v_texto, false);
  end if;
end $$;

revoke all on function public.feed_editar(uuid, text, jsonb) from public, anon;
grant execute on function public.feed_editar(uuid, text, jsonb) to authenticated;
