-- Migration: pontos por postar no feed (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (21/10/2026): +25 por post no feed. Decisões do mesmo dia:
--   - Só o PRIMEIRO post do dia (fuso de Brasília) paga; os outros saem
--     normais, sem pontos. O feed aceita até 20 posts por dia, e 25 cada um
--     quebraria a conta da lojinha (~20 pts por dia útil, tema 150).
--   - Post apagado (pelo autor ou pela moderação) ou ocultado pela moderação
--     devolve os 25: entra um -25 'feed_post_estorno' com o id do post. Se a
--     moderação voltar a mostrar o post, o estorno sai e os pontos voltam.
--   - Post estornado não ocupa o dia: o próximo post do mesmo dia paga.
--
--   feed_post          +25  ref = id do post, 1 por dia
--   feed_post_estorno  -25  ref = id do post, 1 por post
--
-- Vai por gatilho em feed_posts, como o humor (pontos_humor_trg): feed_postar,
-- feed_excluir e feed_moderar não mudam. Não paga os posts de antes.
--
-- Pré-requisito: supabase_migration_feed.sql e supabase_migration_pontos.sql.
-- Pode ir antes do front: o front novo só mostra o "+25" na hora e a linha
-- em "Como ganhar pontos".
-- Já aplicada em 21/10/2026 (migration pontos_feed).
-- ============================================================================

create or replace function app_private.pontos_feed_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_fora_antes boolean;
  v_fora_agora boolean := new.excluido or new.oculto;
begin
  if tg_op = 'INSERT' then
    -- Dois posts ao mesmo tempo não pagam o dia duas vezes.
    perform pg_advisory_xact_lock(hashtext('pontos:' || new.autor_id::text));
    if not exists (
      select 1 from public.pontos_movimentos m
       where m.colaborador_id = new.autor_id and m.motivo = 'feed_post'
         and (m.criado_em at time zone 'America/Sao_Paulo')::date = app_private.hoje_brasil()
         and not exists (select 1 from public.pontos_movimentos e
                          where e.colaborador_id = m.colaborador_id
                            and e.motivo = 'feed_post_estorno' and e.ref = m.ref)
    ) then
      insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
      values (new.autor_id, 25, 'feed_post', new.id::text, 'Postou no feed')
      on conflict do nothing;
    end if;
    return new;
  end if;

  v_fora_antes := old.excluido or old.oculto;
  if v_fora_agora and not v_fora_antes then
    insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
    select new.autor_id, -25, 'feed_post_estorno', new.id::text,
           case when new.excluido then 'Post apagado do feed' else 'Post ocultado pela moderação' end
     where exists (select 1 from public.pontos_movimentos m
                    where m.colaborador_id = new.autor_id and m.motivo = 'feed_post' and m.ref = new.id::text)
    on conflict do nothing;
  elsif v_fora_antes and not v_fora_agora then
    delete from public.pontos_movimentos
     where colaborador_id = new.autor_id and motivo = 'feed_post_estorno' and ref = new.id::text;
  end if;
  return new;
end $$;
revoke all on function app_private.pontos_feed_trg() from public;

drop trigger if exists pontos_feed on public.feed_posts;
create trigger pontos_feed after insert or update of excluido, oculto on public.feed_posts
for each row execute function app_private.pontos_feed_trg();
