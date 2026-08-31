-- Migration: estoque_alerta_minimo (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Aviso de reposição no sino do portal, no molde dos gatilhos de
-- supabase_migration_notificacoes.sql.
--
-- POR QUE UM GATILHO, E NÃO UMA CONSULTA NA TELA: "abaixo do mínimo" já aparece
-- no painel do Estoque, mas só para quem abre o painel. Num almoxarifado, o
-- momento que importa é o da SAÍDA — é ali que o item cruza o mínimo, e é ali
-- que alguém precisa saber, sem depender de lembrar de conferir.
--
-- QUANDO AVISA: só na TRANSIÇÃO. Se o item já estava abaixo do mínimo antes do
-- movimento, não avisa de novo — senão cada entrega de um item em falta viraria
-- mais um aviso, e o sino perderia o sentido em uma semana.
--
-- PARA QUEM: o time do Administrativo (administrativo_role), que é quem repõe.
-- Não vai para quem recebeu o material nem para o solicitante do chamado.
-- ============================================================================

create or replace function app_private.notif_estoque_minimo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_antes int;
  v_item record;
  v_rot text;
  v_titulo text;
  v_dest record;
begin
  -- O trigger é AFTER UPDATE da coluna saldo, então `old` é o saldo anterior.
  v_antes := old.saldo;

  -- Só interessa quem CRUZOU a linha agora. Já estar abaixo não é novidade.
  if new.estoque_minimo <= 0 and new.saldo > 0 then return null; end if;
  if not (
       (new.saldo = 0 and v_antes > 0)                                    -- zerou
    or (new.estoque_minimo > 0
        and new.saldo < new.estoque_minimo
        and v_antes >= new.estoque_minimo)                                -- caiu abaixo do mínimo
  ) then
    return null;
  end if;

  if new.ativo is not true then return null; end if;

  select i.descricao into v_item from estoque_itens i where i.id = new.item_id;
  v_rot := coalesce(v_item.descricao, 'Item')
           || coalesce(' ' || nullif(btrim(new.tamanho), ''), '')
           || coalesce(' (CA ' || nullif(btrim(new.ca), '') || ')', '');

  v_titulo := case
    when new.saldo = 0 then format('Estoque zerado: %s', v_rot)
    else format('Estoque baixo: %s', v_rot)
  end;

  -- Um aviso por pessoa do time. `notificar` tem `on conflict do nothing`, mas
  -- aqui cada destinatário é uma linha diferente, então o laço é necessário.
  for v_dest in
    select c.id from colaboradores c
     where c.administrativo_role in ('atendente', 'admin')
       and c.ativo is not false
  loop
    perform app_private.notificar(
      v_dest.id, 'estoque', 'alerta', v_titulo,
      format('Saldo %s, mínimo %s. Confira o que precisa repor.',
             new.saldo, new.estoque_minimo),
      '/estoque/posicao', new.id);
  end loop;

  return null;
end $$;

revoke all on function app_private.notif_estoque_minimo() from public, anon, authenticated;

drop trigger if exists trg_notif_estoque_minimo on public.estoque_variantes;
create trigger trg_notif_estoque_minimo
  after update of saldo on public.estoque_variantes
  for each row execute function app_private.notif_estoque_minimo();
