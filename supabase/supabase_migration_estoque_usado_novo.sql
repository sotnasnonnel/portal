-- Migration: estoque_usado_novo (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- O saldo da variante passa a ser DOIS: peça usada e peça nova.
--
-- POR QUÊ: a planilha de referência ("Controle - EPI + Uniforme.xlsx") controla
-- as duas colunas separadas — USADO e NOVO, com TOTAL = usado + novo. Não é
-- detalhe de planilha: um capacete usado e um capacete novo têm a mesma função
-- mas não o mesmo destino, e o almoxarifado precisa saber quanto tem de cada
-- para decidir o que entrega e o que compra. Hoje há 64 peças de EPI usadas em
-- circulação; com um saldo só, elas somem dentro do total.
--
-- COMO: a condição vira atributo do MOVIMENTO, não da variante. Assim continua
-- valendo a regra de que saldo só muda por movimento, e "Camisa Polo M" segue
-- sendo UMA linha do catálogo (com dois saldos), em vez de virar duas linhas
-- que a pessoa teria de escolher na hora de pedir.
--
--   estoque_variantes.saldo_novo   + saldo_usado  -> reais, mexidos pelo trigger
--   estoque_variantes.saldo        -> GERADO (soma), é o que as telas já leem
--   estoque_movimentos.condicao    -> 'novo' | 'usado'
--
-- As tabelas estão vazias (o módulo ainda não entrou em uso), então dá para
-- reestruturar a coluna em vez de conviver com um remendo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Variante: dois saldos, e o total gerado a partir deles
-- ----------------------------------------------------------------------------

-- REFERÊNCIA da planilha de uniformes. Campo livre, preenchido à mão — a coluna
-- do arquivo hoje traz o setor (Sede/Obra/Coordenação), que continua indo para
-- `setor`; esta fica para a referência de fato (modelo, código do fornecedor).
alter table public.estoque_variantes add column if not exists referencia text;

-- A view e o gatilho de alerta dependem de `saldo`; saem antes e voltam
-- reconstruídos no fim (o gatilho passa a ouvir os saldos reais).
drop view if exists public.estoque_posicao;
drop view if exists public.estoque_conferencia;
drop trigger if exists trg_notif_estoque_minimo on public.estoque_variantes;

alter table public.estoque_variantes drop constraint if exists estoque_saldo_nao_negativo;
drop index if exists public.estoque_variantes_alerta;
alter table public.estoque_variantes drop column if exists saldo;

alter table public.estoque_variantes
  add column if not exists saldo_novo int not null default 0
    constraint estoque_saldo_novo_nao_negativo check (saldo_novo >= 0);
alter table public.estoque_variantes
  add column if not exists saldo_usado int not null default 0
    constraint estoque_saldo_usado_nao_negativo check (saldo_usado >= 0);

-- Gerada: o total nunca é escrito, nem por engano. Some a possibilidade de o
-- total discordar das partes.
alter table public.estoque_variantes
  add column if not exists saldo int generated always as (saldo_novo + saldo_usado) stored;

create index if not exists estoque_variantes_alerta on public.estoque_variantes (saldo) where ativo;

-- ----------------------------------------------------------------------------
-- 2) Movimento: em que condição a peça entrou ou saiu
-- ----------------------------------------------------------------------------
alter table public.estoque_movimentos
  add column if not exists condicao text not null default 'novo';
alter table public.estoque_movimentos
  drop constraint if exists estoque_mov_condicao_check;
alter table public.estoque_movimentos
  add constraint estoque_mov_condicao_check check (condicao in ('novo', 'usado'));

create index if not exists estoque_mov_condicao
  on public.estoque_movimentos (variante_id, condicao);

-- ----------------------------------------------------------------------------
-- 3) Trigger de saldo: cada movimento cai no seu bolso
-- ----------------------------------------------------------------------------
create or replace function public.estoque_aplica_saldo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.condicao = 'usado' then
    update public.estoque_variantes
       set saldo_usado = saldo_usado + new.quantidade, updated_at = now()
     where id = new.variante_id;
  else
    update public.estoque_variantes
       set saldo_novo = saldo_novo + new.quantidade, updated_at = now()
     where id = new.variante_id;
  end if;
  return null;
end $$;
revoke all on function public.estoque_aplica_saldo() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) Views
-- ----------------------------------------------------------------------------
create or replace view public.estoque_posicao with (security_invoker = on) as
select
  v.id, v.item_id, i.categoria, i.descricao, i.unidade,
  v.tamanho, v.ca, v.genero, v.setor, v.codigo, v.referencia,
  v.custo_unitario, v.estoque_minimo, v.estoque_maximo,
  v.saldo_novo, v.saldo_usado, v.saldo, v.ativo,
  (v.saldo * coalesce(v.custo_unitario, 0))::numeric(14, 2) as valor_total,
  case
    when v.saldo = 0 then 'sem_estoque'
    when v.saldo < v.estoque_minimo then 'abaixo_minimo'
    when v.estoque_maximo is not null and v.saldo > v.estoque_maximo then 'acima_maximo'
    else 'ok'
  end as situacao
from public.estoque_variantes v
join public.estoque_itens i on i.id = v.item_id;

-- Confere os DOIS bolsos separadamente: um erro que se anulasse na soma
-- passaria batido numa conferência só do total.
create or replace view public.estoque_conferencia with (security_invoker = on) as
select
  v.id,
  v.saldo_novo, coalesce(m.total_novo, 0) as movimentos_novo,
  v.saldo_novo - coalesce(m.total_novo, 0) as diferenca_novo,
  v.saldo_usado, coalesce(m.total_usado, 0) as movimentos_usado,
  v.saldo_usado - coalesce(m.total_usado, 0) as diferenca_usado,
  (v.saldo_novo - coalesce(m.total_novo, 0))
    + (v.saldo_usado - coalesce(m.total_usado, 0)) as diferenca
from public.estoque_variantes v
left join (
  select variante_id,
         sum(quantidade) filter (where condicao = 'novo')  as total_novo,
         sum(quantidade) filter (where condicao = 'usado') as total_usado
  from public.estoque_movimentos group by variante_id
) m on m.variante_id = v.id
where app_private.is_estoque_operador();

-- ----------------------------------------------------------------------------
-- 5) RPC: valida contra o bolso certo
-- ----------------------------------------------------------------------------
create or replace function app_private.estoque_aplicar(p_movs jsonb, p_chamado uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  m jsonb; v_qtd int; v_cond text; v_saldo int; v_rot text;
  v_eu uuid := app_private.my_colaborador_id(); n int := 0;
begin
  if v_eu is null then raise exception 'Usuário sem cadastro de colaborador.'; end if;

  for m in select * from jsonb_array_elements(coalesce(p_movs, '[]'::jsonb)) loop
    v_qtd := (m->>'quantidade')::int;
    if v_qtd = 0 then raise exception 'Quantidade não pode ser zero.'; end if;

    v_cond := coalesce(nullif(m->>'condicao', ''), 'novo');
    if v_cond not in ('novo', 'usado') then
      raise exception 'Condição inválida: %.', v_cond;
    end if;

    -- Trava a variante e lê SÓ o bolso que vai ser mexido.
    select case when v_cond = 'usado' then v.saldo_usado else v.saldo_novo end,
           i.descricao
             || coalesce(' ' || nullif(btrim(v.tamanho), ''), '')
             || coalesce(' (CA ' || nullif(btrim(v.ca), '') || ')', '')
      into v_saldo, v_rot
      from public.estoque_variantes v
      join public.estoque_itens i on i.id = v.item_id
     where v.id = (m->>'variante_id')::uuid
     for update of v;

    if not found then raise exception 'Item de estoque inexistente.'; end if;

    if v_saldo + v_qtd < 0 then
      raise exception 'Saldo insuficiente de % (%): disponível %, pedido %.',
        v_rot, v_cond, v_saldo, abs(v_qtd) using errcode = 'check_violation';
    end if;

    insert into public.estoque_movimentos (
      variante_id, tipo, condicao, quantidade, motivo,
      colaborador_id, chamado_id, registrado_por, documento, observacao
    ) values (
      (m->>'variante_id')::uuid, m->>'tipo', v_cond, v_qtd,
      nullif(btrim(coalesce(m->>'motivo', '')), ''),
      nullif(m->>'colaborador_id', '')::uuid, p_chamado, v_eu,
      nullif(btrim(coalesce(m->>'documento', '')), ''),
      nullif(btrim(coalesce(m->>'observacao', '')), '')
    );
    n := n + 1;
  end loop;

  return n;
end $$;
revoke all on function app_private.estoque_aplicar(jsonb, uuid) from public, anon;
grant execute on function app_private.estoque_aplicar(jsonb, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Alerta de mínimo: continua olhando o TOTAL
--    Recriado porque a função lia `old.saldo`, que agora é coluna gerada — o
--    valor continua disponível em OLD, mas o gatilho precisa disparar na
--    mudança dos saldos reais, não da coluna gerada.
-- ----------------------------------------------------------------------------
drop trigger if exists trg_notif_estoque_minimo on public.estoque_variantes;
create trigger trg_notif_estoque_minimo
  after update of saldo_novo, saldo_usado on public.estoque_variantes
  for each row execute function app_private.notif_estoque_minimo();
