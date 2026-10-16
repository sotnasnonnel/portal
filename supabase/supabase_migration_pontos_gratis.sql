-- Migration: Lojinha de graça e temas do mês (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (16/10/2026):
--   - Acabou a contagem de pontos: tudo na lojinha é de graça, sempre.
--     Login, humor e mural deixam de lançar pontos (a tabela fica, parada).
--   - Saem as categorias "Seu aniversário", "Destaque" e "Itens reais".
--   - Temas: ficam só os do mês. Outubro: Halloween e Outubro Rosa.
--     Novembro: Novembro Azul. Dezembro: Natal. Fora do mês o tema não pode
--     ser escolhido e, se estava em uso, o portal não o aplica (o front checa
--     o mês; aqui só se impede escolher fora dele).
--   - Molduras novas do mês: Outubro Rosa (10) e Novembro Azul (11); a de
--     Natal passa a ser só de dezembro.
--   - O título personalizado continua passando pelo RH (texto livre).
--
-- Depende de supabase_migration_pontos.sql e _pontos_liberado.sql.
-- Já aplicada em 16/10/2026.
-- Aplicar ANTES do front novo (o front antigo segue funcionando: comprar
-- passa a não cobrar).
-- ============================================================================

alter table public.pontos_itens add column if not exists mes int check (mes between 1 and 12);

-- Sai do catálogo
update public.pontos_itens set ativo = false
 where categoria in ('aniversario', 'destaque', 'real')
    or id in ('th-noite', 'th-canteiro', 'th-planta', 'th-concreto', 'th-porsol', 'th-mata');

-- Sem conquista (não há mais contagem de dias)
update public.pontos_itens set sequencia_minima = null, em_breve = false;
update public.pontos_itens set descricao = 'Anel de fogo girando.' where id = 'm-fogo';
update public.pontos_itens set descricao = 'Calendário todo marcado.' where id = 't-presente';
update public.pontos_itens set descricao = 'Dourada, com coroa sobre a cabeça.' where id = 'm-coroa';
update public.pontos_itens set descricao = 'Anel amarelo com capacete sobre a cabeça.' where id = 'm-capacete';
update public.pontos_itens set descricao = 'Xícara de café quentinho.' where id = 't-cafe';

-- Temas e molduras do mês
update public.pontos_itens set mes = 10, descricao = 'Lua, teia e abóboras. Só em outubro.' where id = 'th-halloween';
update public.pontos_itens set mes = 12, descricao = 'Festão, meias penduradas e bengala doce. Só em dezembro.' where id = 'th-natal';
update public.pontos_itens set mes = 12, descricao = 'Listras de Natal com arvorezinha. Só em dezembro.' where id = 'm-natal';

insert into public.pontos_itens (id, categoria, nome, descricao, preco, grupo, requer_aprovacao, em_breve, ordem, mes) values
  ('th-outubro-rosa',  'tema',    'Outubro Rosa',  'Rosa da campanha, com laços pendurados. Só em outubro.',     1, null, false, false, 75, 10),
  ('th-novembro-azul', 'tema',    'Novembro Azul', 'Azul da campanha, com laços e bigodes. Só em novembro.',     1, null, false, false, 78, 11),
  ('m-rosa',           'moldura', 'Outubro Rosa',  'Anel rosa com o laço da campanha. Só em outubro.',           1, null, false, false, 95, 10),
  ('m-azul',           'moldura', 'Novembro Azul', 'Anel azul com bigode. Só em novembro.',                      1, null, false, false, 96, 11)
on conflict (id) do update set
  categoria = excluded.categoria, nome = excluded.nome, descricao = excluded.descricao,
  ativo = true, ordem = excluded.ordem, mes = excluded.mes;

-- O que estava em uso e saiu do catálogo deixa de ser usado
update public.pontos_perfil set aniversario = '{}';
update public.pontos_perfil p set tema = null
 where tema is not null and not exists (select 1 from public.pontos_itens i where i.id = p.tema and i.ativo);

-- Para de lançar pontos
drop trigger if exists pontos_humor on public.humor_registros;

create or replace function public.pontos_registrar_acesso()
returns table (ganhou int, saldo int, sequencia int)
language sql security definer set search_path = '' as $$
  select 0, 0, 0
$$;

create or replace function public.parabens_enviar(p_para uuid, p_texto text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_hoje date := app_private.hoje_brasil();
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
  values (p_para, v_me, extract(year from v_hoje)::int, v_texto)
  on conflict (para_id, de_id, ano) do update set texto = excluded.texto;
  return 0;
end $$;
revoke all on function public.parabens_enviar(uuid, text) from public, anon;
grant execute on function public.parabens_enviar(uuid, text) to authenticated;

-- "Comprar" virou "pegar": sempre de graça. Fica a regra do mês e a do RH.
create or replace function public.pontos_comprar(p_item text, p_texto text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_item public.pontos_itens;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_status text;
  v_mes int := extract(month from app_private.hoje_brasil())::int;
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  select * into v_item from public.pontos_itens where id = p_item and ativo;
  if not found then raise exception 'Item não encontrado.'; end if;
  if v_item.mes is not null and v_item.mes <> v_mes then
    raise exception 'Este item só fica disponível no mês dele.';
  end if;
  if exists (select 1 from public.pontos_compras where colaborador_id = v_me and item_id = p_item and status <> 'recusado') then
    raise exception 'Você já tem este item.';
  end if;
  if v_item.requer_aprovacao and v_texto is null then raise exception 'Escreva o texto que vai aparecer.'; end if;
  if char_length(v_texto) > 140 then raise exception 'Texto longo demais (máximo de 140 caracteres).'; end if;

  v_status := case when v_item.requer_aprovacao then 'pendente' else 'ok' end;
  insert into public.pontos_compras (colaborador_id, item_id, status, texto)
  values (v_me, p_item, v_status, v_texto)
  on conflict (colaborador_id, item_id) do update
    set status = excluded.status, texto = excluded.texto, criado_em = now(),
        decidido_em = null, decidido_por = null, exibir_em = null;
  if v_status = 'ok' then perform public.pontos_usar(p_item, true); end if;
  return jsonb_build_object('status', v_status);
end $$;
revoke all on function public.pontos_comprar(text, text) from public, anon;
grant execute on function public.pontos_comprar(text, text) to authenticated;

-- Recusar o título personalizado não devolve pontos (não há pontos).
create or replace function public.pontos_decidir(p_colab uuid, p_item text, p_aprovar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_compra public.pontos_compras;
  v_item public.pontos_itens;
begin
  if not (app_private.is_rh_dp() or app_private.is_portal_super_admin()) then
    raise exception 'Apenas o RH modera os pedidos da lojinha.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_compra from public.pontos_compras where colaborador_id = p_colab and item_id = p_item for update;
  if not found or v_compra.status <> 'pendente' then raise exception 'Pedido não está mais pendente.'; end if;
  select * into v_item from public.pontos_itens where id = p_item;
  update public.pontos_compras
     set status = case when p_aprovar then 'ok' else 'recusado' end,
         decidido_em = now(), decidido_por = app_private.my_colaborador_id()
   where colaborador_id = p_colab and item_id = p_item;
  if p_aprovar and v_item.categoria = 'titulo' then
    perform app_private.pontos_perfil_de(p_colab);
    update public.pontos_perfil set titulo = p_item, atualizado_em = now() where colaborador_id = p_colab;
  end if;
end $$;
revoke all on function public.pontos_decidir(uuid, text, boolean) from public, anon;
grant execute on function public.pontos_decidir(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
