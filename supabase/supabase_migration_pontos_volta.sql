-- Migration: os pontos voltam (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (16/10/2026). Tudo tem preço (ver o ajuste no fim); antes eram só
-- estes custavam pontos: os temas do mês (Halloween, Outubro Rosa, Novembro Azul,
-- Natal), uma moldura (Coroa), um título (IA trabalhando) e um enfeite de
-- recado (Cartão de festa). Ganhar tem que ser fácil: o tema do mês precisa
-- caber dentro do mês para quem usa o portal no dia a dia.
--
--   boas_vindas      +530 uma vez (lançamento: moldura + título + 2 temas + recado)
--   login            +10  1 por dia
--   sequencia        +25  a cada 5 dias úteis seguidos entrando
--   humor            +5   marcou como está (1 por dia)
--   humor_motivo     +5   contou o motivo (comentário no humor, 1 por dia)
--   parabens         +10  recado no mural, 1 por aniversariante
--
-- Rende ~20 pts por dia útil (~450 no mês). Tema: 150.
--
-- O custo fica em pontos_itens.custo (0 = grátis). A coluna antiga "preco"
-- não é mais lida.
--
-- Aplicar ANTES do front novo: o front chama pontos_registrar_acesso de novo
-- e lê "custo". O front de agora segue funcionando (comprar passa a cobrar).
-- Já aplicada em 16/10/2026.
-- ============================================================================

alter table public.pontos_itens add column if not exists custo int not null default 0 check (custo >= 0);
update public.pontos_itens set custo = 0;
update public.pontos_itens set custo = 150 where id in ('th-halloween', 'th-outubro-rosa', 'th-novembro-azul', 'th-natal');
update public.pontos_itens set custo = 200 where id = 'm-coroa';
update public.pontos_itens set custo = 120 where id = 't-ia';
update public.pontos_itens set custo = 80  where id = 'mu-cartao';

-- Ganhar ----------------------------------------------------------------------
create or replace function public.pontos_registrar_acesso()
returns table (ganhou int, saldo int, sequencia int)
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_hoje date := app_private.hoje_brasil();
  v_ganhou int := 0;
  v_seq int;
  v_n int;
begin
  if v_me is null then return; end if;

  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (v_me, 530, 'boas_vindas', 'unico', 'Pontos de lançamento da Personalização')
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_ganhou := v_ganhou + 530 * v_n;

  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (v_me, 10, 'login', v_hoje::text, 'Entrou no portal')
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_seq := app_private.pontos_sequencia(v_me);
  if v_n > 0 then
    v_ganhou := v_ganhou + 10;
    if v_seq > 0 and v_seq % 5 = 0 and extract(isodow from v_hoje) < 6 then
      insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
      values (v_me, 25, 'sequencia', v_hoje::text, v_seq || ' dias úteis seguidos')
      on conflict do nothing;
      get diagnostics v_n = row_count;
      v_ganhou := v_ganhou + 25 * v_n;
    end if;
  end if;
  return query select v_ganhou, app_private.pontos_saldo(v_me), v_seq;
end $$;
revoke all on function public.pontos_registrar_acesso() from public, anon;
grant execute on function public.pontos_registrar_acesso() to authenticated;

-- Humor: marcar paga 5; contar o motivo (comentário) paga mais 5. Os dois
-- uma vez por dia, mesmo que a pessoa mude a resposta.
create or replace function app_private.pontos_humor_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (new.colaborador_id, 5, 'humor', new.dia::text, 'Marcou como está hoje')
  on conflict do nothing;
  if nullif(btrim(coalesce(new.comentario, '')), '') is not null then
    insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
    values (new.colaborador_id, 5, 'humor_motivo', new.dia::text, 'Contou o motivo no humor')
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function app_private.pontos_humor_trg() from public;
drop trigger if exists pontos_humor on public.humor_registros;
create trigger pontos_humor after insert or update of humor, comentario on public.humor_registros
for each row execute function app_private.pontos_humor_trg();

-- Recado de aniversário: +10 para quem escreve, uma vez por aniversariante.
create or replace function public.parabens_enviar(p_para uuid, p_texto text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_hoje date := app_private.hoje_brasil();
  v_ano int := extract(year from app_private.hoje_brasil())::int;
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  if p_para = v_me then raise exception 'O recado é para os colegas.'; end if;
  if v_texto = '' then raise exception 'Escreva o recado.'; end if;
  if char_length(v_texto) > 500 then raise exception 'Recado longo demais (máximo de 500 caracteres).'; end if;
  if not exists (
    select 1 from public.colaboradores c
     where c.id = p_para and c.ativo is distinct from false and c.data_nascimento is not null
       and extract(month from c.data_nascimento) = extract(month from v_hoje)
       and extract(day from c.data_nascimento) = extract(day from v_hoje)
  ) then
    raise exception 'O mural só recebe recados no dia do aniversário.';
  end if;
  insert into public.parabens_recados (para_id, de_id, ano, texto)
  values (p_para, v_me, v_ano, v_texto)
  on conflict (para_id, de_id, ano) do update set texto = excluded.texto;
  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (v_me, 10, 'parabens', p_para::text || ':' || v_ano, 'Recado de aniversário')
  on conflict do nothing;
  return app_private.pontos_saldo(v_me);
end $$;
revoke all on function public.parabens_enviar(uuid, text) from public, anon;
grant execute on function public.parabens_enviar(uuid, text) to authenticated;

-- Trocar ----------------------------------------------------------------------
create or replace function public.pontos_comprar(p_item text, p_texto text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_item public.pontos_itens;
  v_mes int := extract(month from app_private.hoje_brasil())::int;
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  -- Uma troca por vez por pessoa: duas abas não gastam o mesmo saldo.
  perform pg_advisory_xact_lock(hashtext('pontos:' || v_me::text));
  select * into v_item from public.pontos_itens where id = p_item and ativo;
  if not found then raise exception 'Item não encontrado.'; end if;
  if v_item.mes is not null and v_item.mes <> v_mes then
    raise exception 'Este item só fica disponível no mês dele.';
  end if;
  if exists (select 1 from public.pontos_compras where colaborador_id = v_me and item_id = p_item and status = 'ok') then
    raise exception 'Você já tem este item.';
  end if;
  if v_item.custo > 0 and app_private.pontos_saldo(v_me) < v_item.custo then
    raise exception 'Faltam % pontos.', v_item.custo - app_private.pontos_saldo(v_me);
  end if;

  insert into public.pontos_compras (colaborador_id, item_id, status)
  values (v_me, p_item, 'ok')
  on conflict (colaborador_id, item_id) do update set status = 'ok', criado_em = now();
  if v_item.custo > 0 then
    insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
    values (v_me, -v_item.custo, 'compra', p_item || ':' || extract(epoch from now())::bigint, 'Trocou por ' || v_item.nome);
  end if;
  perform public.pontos_usar(p_item, true);
  return jsonb_build_object('status', 'ok', 'saldo', app_private.pontos_saldo(v_me));
end $$;
revoke all on function public.pontos_comprar(text, text) from public, anon;
grant execute on function public.pontos_comprar(text, text) to authenticated;

notify pgrst, 'reload schema';

-- Ajuste do mesmo dia (pedido do usuário): nada de graça, um preço por
-- categoria.
update public.pontos_itens set custo = case categoria
  when 'moldura' then 100
  when 'titulo' then 80
  when 'tema' then 150
  when 'mural' then 50
  else custo end;

-- Ajuste do mesmo dia (pedido do usuário): todo mundo começa com o bastante
-- para uma moldura, um título, os dois temas de outubro e um enfeite de
-- recado: as boas-vindas viram 530 pts de lançamento (quem já tinha recebido
-- os 50 foi corrigido). A função pontos_registrar_acesso foi recriada com o
-- valor novo (ver a versão aplicada no banco: migration pontos_lancamento_530).
update public.pontos_movimentos set pontos = 530, descricao = 'Pontos de lançamento da Personalização' where motivo = 'boas_vindas';
