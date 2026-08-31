-- Migration: estoque (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Módulo de Estoque — almoxarifado de EPIs e uniformes.
--
-- Substitui as duas planilhas que estão em referencia/referencia_estoque/
-- ("Controle de EPIs.xlsx" e "Controle de Uniformes.xlsx") e amarra o saldo aos
-- chamados do Administrativo (saude-seguranca/epi e /uniforme): quem entrega o
-- item dá baixa no estoque e fecha o chamado no MESMO clique, numa transação só.
--
-- MODELO: item (catálogo) -> variante (o que de fato tem saldo) -> movimentos.
--
--   * A chave da variante inclui o CA e o tamanho porque a planilha real repete
--     a mesma descrição com CA diferente (RESPIRADOR COM VÁLVULA aparece com CA
--     45021 E com 12011; LUVA DE PROTEÇÃO ANTICORTE com 32036 E 44524) e com
--     tamanho diferente (BOTINA COM METATARSO, do 37 ao 45). Fundir isso numa
--     variante só somaria saldos de itens que não são substituíveis entre si.
--     Uniforme acrescenta gênero e setor pelo mesmo motivo.
--
--   * O saldo é COLUNA, não view somando movimentos. Três razões: a tela precisa
--     ordenar e filtrar por "abaixo do mínimo" (agregação não é indexável); a
--     coluna permite `check (saldo >= 0)`, que é a diferença entre "o front
--     esqueceu de validar" e "o banco recusou"; e a leitura fica barata. O preço
--     é a divergência possível, coberta pela view estoque_conferencia.
--
--   * Movimento é IMUTÁVEL: só há policy de insert e select. Estorno é
--     movimento inverso. Assim o trigger de saldo tem um caminho só (after
--     insert) e o histórico serve de auditoria.
--
--   * quantidade é o delta ASSINADO (saída é negativa). O trigger vira
--     `saldo + new.quantidade` e a conferência com a planilha fica literal:
--     a fórmula do Excel é =D+E-I-J-...-T, ou seja saldo = entradas - saídas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Permissão
--    Reusa o papel do Administrativo — quem atende o chamado de EPI é quem
--    entrega o EPI. Mas com NOME PRÓPRIO: se um dia o almoxarifado ganhar papel
--    separado, muda-se esta função e nenhuma policy é reescrita.
-- ----------------------------------------------------------------------------
create or replace function app_private.is_estoque_operador()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_adm_time() or app_private.is_admin()
$$;
revoke all on function app_private.is_estoque_operador() from public;
grant execute on function app_private.is_estoque_operador() to authenticated;

-- Nota sobre os `revoke` deste arquivo: o Supabase tem um ALTER DEFAULT
-- PRIVILEGES que concede EXECUTE de toda função nova em public para anon,
-- authenticated e service_role. `revoke ... from public` NÃO desfaz isso — é um
-- grant direto ao papel. Por isso cada função abaixo revoga de `anon`
-- explicitamente. Sem isso elas ficam expostas em /rest/v1/rpc/ para quem não
-- fez login (o comportamento seria inócuo, porque is_estoque_operador() é false
-- sem sessão, mas a superfície não precisa existir).

-- ----------------------------------------------------------------------------
-- 1) Catálogo: item e variante
-- ----------------------------------------------------------------------------
create table if not exists public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('epi', 'uniforme')),
  descricao text not null,
  unidade text not null default 'un',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- lower() porque a planilha mistura "Camisa social Branca" e "Camisa Social Branca".
create unique index if not exists estoque_itens_chave
  on public.estoque_itens (categoria, lower(descricao));

create table if not exists public.estoque_variantes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.estoque_itens(id) on delete cascade,

  tamanho text,   -- '42' (botina) ou 'M' (camisa); null quando o item é único
  ca text,        -- EPI: certificado de aprovação. FAZ PARTE DA CHAVE.
  genero text check (genero in ('masculino', 'feminino', 'unisex')),
  setor  text check (setor  in ('sede', 'obra', 'coordenacao')),
  codigo text,    -- coluna CÓDIGO da planilha de uniformes

  custo_unitario numeric(12, 2),
  estoque_minimo int not null default 0 check (estoque_minimo >= 0),
  estoque_maximo int check (estoque_maximo is null or estoque_maximo >= estoque_minimo),

  saldo int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Rede final. A RPC já valida antes e com mensagem legível; isto aqui é o que
  -- garante que nenhum caminho futuro (script, correção manual) deixe negativo.
  constraint estoque_saldo_nao_negativo check (saldo >= 0)
);

-- coalesce porque índice único trata NULL como distinto de NULL: sem isso duas
-- variantes "CAPACETE 3M sem tamanho" conviveriam sem erro.
create unique index if not exists estoque_variantes_chave
  on public.estoque_variantes
  (item_id, coalesce(tamanho, ''), coalesce(ca, ''), coalesce(genero, ''), coalesce(setor, ''));

create index if not exists estoque_variantes_item on public.estoque_variantes (item_id);
create index if not exists estoque_variantes_alerta on public.estoque_variantes (saldo) where ativo;

-- ----------------------------------------------------------------------------
-- 2) Movimentos
-- ----------------------------------------------------------------------------
create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  variante_id uuid not null references public.estoque_variantes(id),
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade int not null check (quantidade <> 0),   -- delta ASSINADO

  motivo text,
  colaborador_id uuid references public.colaboradores(id),  -- QUEM RECEBEU
  chamado_id     uuid references public.chamados_adm(id),   -- chamado quitado
  registrado_por uuid not null references public.colaboradores(id),
  documento text,    -- NF / ordem de compra, na entrada
  observacao text,
  criado_em timestamptz not null default now(),

  constraint estoque_mov_sinal check (
    (tipo = 'entrada' and quantidade > 0)
    or (tipo = 'saida' and quantidade < 0)
    or tipo = 'ajuste'
  ),

  -- Dispensação nominal (as duas planilhas registram a pessoa: aba DISPENSAÇÃO
  -- e aba Entrega Agasalhos). Vira constraint em vez de convenção de front —
  -- saída sem dono é exatamente o que torna a planilha inauditável hoje.
  constraint estoque_mov_saida_nominal check (tipo <> 'saida' or colaborador_id is not null)
);

create index if not exists estoque_mov_variante on public.estoque_movimentos (variante_id, criado_em desc);
create index if not exists estoque_mov_chamado  on public.estoque_movimentos (chamado_id) where chamado_id is not null;
create index if not exists estoque_mov_colab    on public.estoque_movimentos (colaborador_id, criado_em desc);
create index if not exists estoque_mov_data     on public.estoque_movimentos (criado_em desc);

-- ----------------------------------------------------------------------------
-- 3) Triggers
-- ----------------------------------------------------------------------------
create or replace function public.estoque_aplica_saldo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.estoque_variantes
     set saldo = saldo + new.quantidade, updated_at = now()
   where id = new.variante_id;
  return null;
end $$;

drop trigger if exists estoque_movimentos_saldo_trg on public.estoque_movimentos;
create trigger estoque_movimentos_saldo_trg
  after insert on public.estoque_movimentos
  for each row execute function public.estoque_aplica_saldo();

create or replace function public.estoque_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists estoque_itens_touch_trg on public.estoque_itens;
create trigger estoque_itens_touch_trg before update on public.estoque_itens
  for each row execute function public.estoque_touch();

drop trigger if exists estoque_variantes_touch_trg on public.estoque_variantes;
create trigger estoque_variantes_touch_trg before update on public.estoque_variantes
  for each row execute function public.estoque_touch();

-- ----------------------------------------------------------------------------
-- 4) Views
--    security_invoker é OBRIGATÓRIO: view sem ele roda com os direitos do dono
--    e devolve tudo, ignorando a RLS das tabelas de baixo.
-- ----------------------------------------------------------------------------
create or replace view public.estoque_posicao with (security_invoker = on) as
select
  v.id, v.item_id, i.categoria, i.descricao, i.unidade,
  v.tamanho, v.ca, v.genero, v.setor, v.codigo,
  v.custo_unitario, v.estoque_minimo, v.estoque_maximo, v.saldo, v.ativo,
  (v.saldo * coalesce(v.custo_unitario, 0))::numeric(14, 2) as valor_total,
  case
    when v.saldo = 0 then 'sem_estoque'
    when v.saldo < v.estoque_minimo then 'abaixo_minimo'
    when v.estoque_maximo is not null and v.saldo > v.estoque_maximo then 'acima_maximo'
    else 'ok'
  end as situacao
from public.estoque_variantes v
join public.estoque_itens i on i.id = v.item_id;

-- Auditoria do saldo materializado. Diferença <> 0 significa que alguém escreveu
-- na coluna por fora do trigger — o único jeito de o saldo mentir.
--
-- O `is_estoque_operador()` no WHERE não é redundante com a RLS: é o que impede
-- a view de MENTIR. Sendo security_invoker, a soma dos movimentos passa pela
-- policy de estoque_movimentos, que mostra ao colaborador comum só o que ELE
-- recebeu. Sem o filtro, quem não é do time compara o saldo cheio com uma soma
-- parcial e vê divergência em quase toda variante. Melhor devolver nada do que
-- devolver um número errado numa view cujo propósito é justamente auditar.
create or replace view public.estoque_conferencia with (security_invoker = on) as
select
  v.id, v.saldo, coalesce(m.total, 0) as soma_movimentos,
  v.saldo - coalesce(m.total, 0) as diferenca
from public.estoque_variantes v
left join (
  select variante_id, sum(quantidade) as total
  from public.estoque_movimentos group by variante_id
) m on m.variante_id = v.id
where app_private.is_estoque_operador();

-- ----------------------------------------------------------------------------
-- 5) RLS
--    Catálogo é público para quem está logado — é o "saber se tem ou não" que o
--    Adm precisa antes de prometer o item. Escrita e movimentação, só operador.
-- ----------------------------------------------------------------------------
alter table public.estoque_itens      enable row level security;
alter table public.estoque_variantes  enable row level security;
alter table public.estoque_movimentos enable row level security;

drop policy if exists estoque_itens_select on public.estoque_itens;
create policy estoque_itens_select on public.estoque_itens
  for select to authenticated using (true);

drop policy if exists estoque_itens_write on public.estoque_itens;
create policy estoque_itens_write on public.estoque_itens
  for all to authenticated
  using (app_private.is_estoque_operador())
  with check (app_private.is_estoque_operador());

drop policy if exists estoque_variantes_select on public.estoque_variantes;
create policy estoque_variantes_select on public.estoque_variantes
  for select to authenticated using (true);

drop policy if exists estoque_variantes_write on public.estoque_variantes;
create policy estoque_variantes_write on public.estoque_variantes
  for all to authenticated
  using (app_private.is_estoque_operador())
  with check (app_private.is_estoque_operador());

-- Movimento: o operador vê tudo; o colaborador vê o que RECEBEU (a própria
-- ficha de EPI, que é o que a aba DISPENSAÇÃO guarda hoje) e o que saiu nos
-- chamados dele.
drop policy if exists estoque_mov_select on public.estoque_movimentos;
create policy estoque_mov_select on public.estoque_movimentos
  for select to authenticated using (
    app_private.is_estoque_operador()
    or colaborador_id = app_private.my_colaborador_id()
    or (chamado_id is not null and app_private.adm_e_solicitante(chamado_id))
  );

drop policy if exists estoque_mov_insert on public.estoque_movimentos;
create policy estoque_mov_insert on public.estoque_movimentos
  for insert to authenticated with check (
    app_private.is_estoque_operador()
    and registrado_por = app_private.my_colaborador_id()
  );

-- Sem policy de update/delete: movimento é imutável (ver cabeçalho).

-- ----------------------------------------------------------------------------
-- 6) RPCs
-- ----------------------------------------------------------------------------

-- Pessoas para o campo "quem recebeu".
-- NÃO reusar chamados_adm_pessoas(): ela exige is_adm_admin() e devolveria lista
-- VAZIA E CALADA para o atendente. Como saída sem colaborador é barrada por
-- constraint, a tela de saída ficaria simplesmente impossível de usar.
create or replace function public.estoque_pessoas()
returns table(id uuid, nome text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome
  from public.colaboradores c
  where c.ativo is not false
    and app_private.is_estoque_operador()
  order by c.nome
$$;
revoke all on function public.estoque_pessoas() from public;
grant execute on function public.estoque_pessoas() to authenticated;

-- Núcleo transacional das movimentações.
--
-- p_movs: [{ variante_id, tipo, quantidade, motivo, colaborador_id, documento, observacao }]
-- quantidade JÁ VEM ASSINADA (saída negativa) — quem monta é lib/estoque.js.
--
-- O `for update` não é zelo: sem ele dois atendentes entregando o último capacete
-- leem saldo 1, os dois passam na validação, e o segundo estoura no CHECK com
-- uma mensagem de constraint ininteligível. Com o lock, o segundo espera e
-- recebe "Saldo insuficiente de CAPACETE 3M (disponível: 0, pedido: 1)".
create or replace function app_private.estoque_aplicar(p_movs jsonb, p_chamado uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  m jsonb;
  v_qtd int;
  v_saldo int;
  v_rot text;
  v_eu uuid := app_private.my_colaborador_id();
  n int := 0;
begin
  if v_eu is null then
    raise exception 'Usuário sem cadastro de colaborador.';
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_movs, '[]'::jsonb)) loop
    v_qtd := (m->>'quantidade')::int;
    if v_qtd = 0 then
      raise exception 'Quantidade não pode ser zero.';
    end if;

    -- nullif porque tamanho/CA gravados como string vazia (em vez de NULL) viravam
    -- " ZZ ITEM  (CA )" na mensagem de erro que o usuário lê.
    select v.saldo, i.descricao
             || coalesce(' ' || nullif(btrim(v.tamanho), ''), '')
             || coalesce(' (CA ' || nullif(btrim(v.ca), '') || ')', '')
      into v_saldo, v_rot
      from public.estoque_variantes v
      join public.estoque_itens i on i.id = v.item_id
     where v.id = (m->>'variante_id')::uuid
     for update of v;

    if not found then
      raise exception 'Item de estoque inexistente.';
    end if;

    if v_saldo + v_qtd < 0 then
      raise exception 'Saldo insuficiente de % (disponível: %, pedido: %).',
        v_rot, v_saldo, abs(v_qtd) using errcode = 'check_violation';
    end if;

    insert into public.estoque_movimentos (
      variante_id, tipo, quantidade, motivo,
      colaborador_id, chamado_id, registrado_por, documento, observacao
    ) values (
      (m->>'variante_id')::uuid,
      m->>'tipo',
      v_qtd,
      nullif(btrim(coalesce(m->>'motivo', '')), ''),
      nullif(m->>'colaborador_id', '')::uuid,
      p_chamado,
      v_eu,
      nullif(btrim(coalesce(m->>'documento', '')), ''),
      nullif(btrim(coalesce(m->>'observacao', '')), '')
    );
    n := n + 1;
  end loop;

  return n;
end $$;
revoke all on function app_private.estoque_aplicar(jsonb, uuid) from public;
grant execute on function app_private.estoque_aplicar(jsonb, uuid) to authenticated;

-- Lançamento avulso pelo módulo de Estoque (entrada, saída ou ajuste em lote).
create or replace function public.estoque_lancar(p_movs jsonb, p_chamado uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_estoque_operador() then
    raise exception 'Você não tem permissão para movimentar o estoque.';
  end if;
  return app_private.estoque_aplicar(p_movs, p_chamado);
end $$;
revoke all on function public.estoque_lancar(jsonb, uuid) from public;
grant execute on function public.estoque_lancar(jsonb, uuid) to authenticated;

-- A BAIXA ATÔMICA: fecha o chamado E grava as saídas na MESMA transação.
-- Ou os dois acontecem, ou nenhum — fechar sem baixar deixa o saldo mentindo, e
-- baixar sem fechar entrega EPI num chamado que continua aberto.
--
-- ATENÇÃO: security definer PULA a RLS de chamados_adm. Sem a checagem de
-- permissão abaixo, qualquer usuário autenticado fecharia qualquer chamado.
-- Ela espelha o `podeFechar` da tela (app/chamado/page.jsx).
create or replace function public.estoque_baixa_chamado(
  p_chamado uuid, p_resolucao text, p_itens jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_numero bigint;
  n int;
begin
  if coalesce(btrim(p_resolucao), '') = '' then
    raise exception 'Escreva a resolução da solicitação.';
  end if;

  select status, numero into v_status, v_numero
    from public.chamados_adm where id = p_chamado for update;
  if not found then
    raise exception 'Chamado não encontrado.';
  end if;

  if not (app_private.is_adm_time() or app_private.adm_e_atendente(p_chamado)) then
    raise exception 'Você não tem permissão para fechar este chamado.';
  end if;

  if v_status not in ('aberto', 'em_atendimento', 'aguardando_solicitante') then
    raise exception 'Este chamado não está em andamento.';
  end if;

  n := app_private.estoque_aplicar(p_itens, p_chamado);

  update public.chamados_adm
     set status = 'fechado', fechado_em = now(),
         resolucao = btrim(p_resolucao), updated_at = now()
   where id = p_chamado;
  -- chamados_adm_evento_mudanca continua registrando o fechamento no histórico.

  return jsonb_build_object('numero', v_numero, 'movimentos', n);
end $$;
revoke all on function public.estoque_baixa_chamado(uuid, text, jsonb) from public;
grant execute on function public.estoque_baixa_chamado(uuid, text, jsonb) to authenticated;

-- Vínculo inverso: os chamados que uma saída avulsa pode quitar.
-- O `and is_estoque_operador()` no WHERE faz a função devolver zero linhas para
-- quem não é do time, em vez de expor a fila inteira.
create or replace function public.estoque_chamados_elegiveis()
returns table(
  id uuid, numero bigint, classe text, servico text, assunto text, status text,
  criado_em timestamptz, solicitante_id uuid, solicitante_nome text, itens jsonb
) language sql stable security definer set search_path = '' as $$
  select c.id, c.numero, c.classe, c.servico, c.assunto, c.status, c.criado_em,
         c.solicitante_id, s.nome, coalesce(c.campos->'itens', '[]'::jsonb)
  from public.chamados_adm c
  left join public.colaboradores s on s.id = c.solicitante_id
  where c.classe = 'saude-seguranca'
    and c.servico in ('epi', 'uniforme')
    and c.status in ('aberto', 'em_atendimento', 'aguardando_solicitante')
    and app_private.is_estoque_operador()
  order by c.criado_em
$$;
revoke all on function public.estoque_chamados_elegiveis() from public;
grant execute on function public.estoque_chamados_elegiveis() to authenticated;

-- ----------------------------------------------------------------------------
-- 7) Fecha a porta do `anon` (ver nota na seção 0)
-- ----------------------------------------------------------------------------
revoke execute on function
  app_private.is_estoque_operador(),
  app_private.estoque_aplicar(jsonb, uuid),
  public.estoque_pessoas(),
  public.estoque_lancar(jsonb, uuid),
  public.estoque_baixa_chamado(uuid, text, jsonb),
  public.estoque_chamados_elegiveis()
from anon;

-- Funções de trigger: ninguém as chama por RPC, nem logado. Aqui o revoke tem
-- de tirar de PUBLIC também — só revogar de anon não adianta, porque o papel
-- herda o EXECUTE que toda função nasce concedendo a PUBLIC.
revoke all on function public.estoque_aplica_saldo(), public.estoque_touch()
from public, anon, authenticated;
