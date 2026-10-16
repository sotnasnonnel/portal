-- Migration: Pontos PHD — período de teste com tudo liberado (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (16/10/2026): "deixe tudo liberado por enquanto". Com a
-- chave ligada, a lojinha entrega qualquer item de graça: sem cobrar pontos,
-- sem cadeado de "em breve", sem exigir sequência e sem passar pelo RH. O
-- recado da Home aprovado assim aparece no mesmo dia.
--
-- Os pontos continuam sendo ganhos normalmente (login, humor, mural).
--
-- Para encerrar o teste:
--   update public.pontos_config set liberado = false;
-- (o que já foi pego continua com quem pegou; para zerar, apague de
-- pontos_compras e limpe pontos_perfil.)
--
-- Depende de supabase_migration_pontos.sql. Sem dependência de deploy: o front
-- antigo só não mostra o aviso de período de teste.
-- ============================================================================

create table if not exists public.pontos_config (
  id        boolean primary key default true check (id),
  liberado  boolean not null default false
);
insert into public.pontos_config (id, liberado) values (true, true)
on conflict (id) do update set liberado = true;

alter table public.pontos_config enable row level security;
drop policy if exists pontos_config_leitura on public.pontos_config;
create policy pontos_config_leitura on public.pontos_config for select to authenticated using (true);

create or replace function app_private.pontos_liberado()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select liberado from public.pontos_config where id), false)
$$;
revoke all on function app_private.pontos_liberado() from public;

create or replace function public.pontos_comprar(p_item text, p_texto text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_item public.pontos_itens;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_status text;
  v_livre boolean := app_private.pontos_liberado();
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  -- Uma compra por vez por pessoa: duas abas não gastam o mesmo saldo.
  perform pg_advisory_xact_lock(hashtext('pontos:' || v_me::text));

  select * into v_item from public.pontos_itens where id = p_item and ativo;
  if not found then raise exception 'Item não encontrado.'; end if;
  if exists (select 1 from public.pontos_compras where colaborador_id = v_me and item_id = p_item and status <> 'recusado') then
    raise exception 'Você já tem este item.';
  end if;
  if v_item.requer_aprovacao and v_item.categoria in ('titulo', 'destaque') and v_texto is null then
    raise exception 'Escreva o texto que vai aparecer.';
  end if;
  if char_length(v_texto) > 140 then raise exception 'Texto longo demais (máximo de 140 caracteres).'; end if;

  if not v_livre then
    if v_item.em_breve then raise exception 'Este item ainda não está à venda.'; end if;
    if v_item.sequencia_minima is not null and app_private.pontos_sequencia(v_me) < v_item.sequencia_minima then
      raise exception 'Este item pede % dias úteis seguidos entrando no portal.', v_item.sequencia_minima;
    end if;
    if app_private.pontos_saldo(v_me) < v_item.preco then raise exception 'Saldo insuficiente.'; end if;
  end if;

  v_status := case when v_item.requer_aprovacao and not v_livre then 'pendente' else 'ok' end;
  insert into public.pontos_compras (colaborador_id, item_id, status, texto, exibir_em)
  values (v_me, p_item, v_status, v_texto,
          case when v_livre and v_item.categoria = 'destaque' then app_private.hoje_brasil() end)
  on conflict (colaborador_id, item_id) do update
    set status = excluded.status, texto = excluded.texto, criado_em = now(),
        decidido_em = null, decidido_por = null, exibir_em = excluded.exibir_em;

  if not v_livre then
    insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
    values (v_me, -v_item.preco, 'compra', p_item || ':' || extract(epoch from now())::bigint, 'Lojinha: ' || v_item.nome);
  end if;

  if v_status = 'ok' and v_item.categoria in ('moldura', 'titulo', 'tema', 'aniversario', 'mural') then
    perform public.pontos_usar(p_item, true);
  end if;
  return jsonb_build_object('status', v_status, 'saldo', app_private.pontos_saldo(v_me));
end $$;
revoke all on function public.pontos_comprar(text, text) from public, anon;
grant execute on function public.pontos_comprar(text, text) to authenticated;

create or replace function public.pontos_meu_resumo()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_perfil public.pontos_perfil;
begin
  if v_me is null then return null; end if;
  v_perfil := app_private.pontos_perfil_de(v_me);
  return jsonb_build_object(
    'saldo', app_private.pontos_saldo(v_me),
    'sequencia', app_private.pontos_sequencia(v_me),
    'liberado', app_private.pontos_liberado(),
    'perfil', jsonb_build_object(
      'moldura', v_perfil.moldura, 'titulo', v_perfil.titulo, 'tema', v_perfil.tema,
      'aniversario', to_jsonb(v_perfil.aniversario), 'mural', to_jsonb(v_perfil.mural),
      'titulo_texto', (select texto from public.pontos_compras where colaborador_id = v_me and item_id = 't-livre' and status = 'ok')),
    'compras', coalesce((select jsonb_agg(jsonb_build_object('item_id', item_id, 'status', status, 'texto', texto, 'exibir_em', exibir_em))
                           from public.pontos_compras where colaborador_id = v_me), '[]'::jsonb),
    'pode_moderar', app_private.is_rh_dp() or app_private.is_portal_super_admin(),
    'pode_creditar', app_private.is_portal_super_admin()
  );
end $$;
revoke all on function public.pontos_meu_resumo() from public, anon;
grant execute on function public.pontos_meu_resumo() to authenticated;

notify pgrst, 'reload schema';
