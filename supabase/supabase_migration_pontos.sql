-- Migration: Pontos PHD — pontos, lojinha e mural de parabéns (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (16/10/2026). Todo colaborador ganha pontos com o que
-- qualquer um faz no portal e troca por itens cosméticos que aparecem para os
-- outros (moldura na foto, insígnia, tema, enfeites do aniversário e do recado).
--
-- Como ganha (sempre no banco, nunca pelo navegador):
--   login           +5   1 por dia               (pontos_registrar_acesso)
--   sequencia       +10  a cada 5 dias úteis seguidos com login
--   humor           +5   1 por dia               (gatilho em humor_registros)
--   parabens        +10  1 recado por aniversariante, só no dia (parabens_enviar)
--   parabens_recebido +2 por recado recebido
--   ajuste          ±N   só o super admin (pontos_creditar)
--   compra / estorno     loja (pontos_comprar / pontos_decidir)
--
-- O saldo é a SOMA de pontos_movimentos: não existe coluna de saldo para editar.
-- A chave única (colaborador, motivo, ref) é o que impede ganhar duas vezes.
--
-- O visual de cada item mora no front (src/config/pontos.js), pelo id. Aqui
-- ficam preço, categoria e regras.
--
-- Sem dependência de deploy: tudo é novo. Aplicar ANTES do front, que chama
-- estas RPCs ao abrir o portal (sem elas, a Home só não mostra os pontos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabelas
-- ----------------------------------------------------------------------------
create table if not exists public.pontos_itens (
  id                text primary key,
  categoria         text not null check (categoria in ('moldura', 'titulo', 'tema', 'aniversario', 'mural', 'destaque', 'real')),
  nome              text not null,
  descricao         text not null default '',
  preco             int  not null check (preco > 0),
  -- Itens do mesmo grupo não se somam: um fundo de card, um papel de recado.
  grupo             text,
  requer_aprovacao  boolean not null default false,
  -- Conquista: só compra quem tem esta sequência de dias úteis.
  sequencia_minima  int,
  em_breve          boolean not null default false,
  ativo             boolean not null default true,
  ordem             int not null default 0
);

create table if not exists public.pontos_movimentos (
  id              bigint generated always as identity primary key,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  pontos          int  not null check (pontos <> 0),
  motivo          text not null,
  ref             text not null,
  descricao       text,
  criado_em       timestamptz not null default now(),
  constraint pontos_mov_unico unique (colaborador_id, motivo, ref)
);
create index if not exists pontos_mov_colab_idx on public.pontos_movimentos (colaborador_id, criado_em desc);

create table if not exists public.pontos_compras (
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  item_id         text not null references public.pontos_itens(id),
  status          text not null default 'ok' check (status in ('ok', 'pendente', 'recusado')),
  -- Título personalizado / recado da Home: o texto que o RH aprova.
  texto           text check (texto is null or char_length(texto) <= 140),
  -- Recado da Home: o dia em que aparece (marcado na aprovação).
  exibir_em       date,
  criado_em       timestamptz not null default now(),
  decidido_em     timestamptz,
  decidido_por    uuid references public.colaboradores(id),
  primary key (colaborador_id, item_id)
);

-- O que cada um está usando. Moldura, título e tema: um de cada. Enfeites do
-- aniversário e do recado: vários (respeitando o grupo).
create table if not exists public.pontos_perfil (
  colaborador_id  uuid primary key references public.colaboradores(id) on delete cascade,
  moldura         text references public.pontos_itens(id),
  titulo          text references public.pontos_itens(id),
  tema            text references public.pontos_itens(id),
  aniversario     text[] not null default '{}',
  mural           text[] not null default '{}',
  atualizado_em   timestamptz not null default now()
);

create table if not exists public.parabens_recados (
  id          uuid primary key default gen_random_uuid(),
  para_id     uuid not null references public.colaboradores(id) on delete cascade,
  de_id       uuid not null references public.colaboradores(id) on delete cascade,
  ano         int  not null,
  texto       text not null check (char_length(btrim(texto)) between 1 and 500),
  criado_em   timestamptz not null default now(),
  constraint parabens_um_por_ano unique (para_id, de_id, ano)
);
create index if not exists parabens_para_idx on public.parabens_recados (para_id, ano);

-- RLS: leitura do catálogo por todos; o resto só por RPC (security definer).
alter table public.pontos_itens enable row level security;
alter table public.pontos_movimentos enable row level security;
alter table public.pontos_compras enable row level security;
alter table public.pontos_perfil enable row level security;
alter table public.parabens_recados enable row level security;

drop policy if exists pontos_itens_leitura on public.pontos_itens;
create policy pontos_itens_leitura on public.pontos_itens for select to authenticated using (true);

drop policy if exists pontos_mov_proprio on public.pontos_movimentos;
create policy pontos_mov_proprio on public.pontos_movimentos for select to authenticated
using (colaborador_id = app_private.my_colaborador_id());

drop policy if exists pontos_compras_proprio on public.pontos_compras;
create policy pontos_compras_proprio on public.pontos_compras for select to authenticated
using (colaborador_id = app_private.my_colaborador_id());

drop policy if exists pontos_perfil_proprio on public.pontos_perfil;
create policy pontos_perfil_proprio on public.pontos_perfil for select to authenticated
using (colaborador_id = app_private.my_colaborador_id());

-- ----------------------------------------------------------------------------
-- 2) Catálogo
-- ----------------------------------------------------------------------------
insert into public.pontos_itens (id, categoria, nome, descricao, preco, grupo, requer_aprovacao, sequencia_minima, em_breve, ordem) values
  ('m-phd',        'moldura', 'PHD',            'Metade laranja, metade azul.',                    100, null, false, null, false, 10),
  ('m-zebra',      'moldura', 'Fita zebrada',   'Amarelo e preto de canteiro.',                    200, null, false, null, false, 20),
  ('m-planta',     'moldura', 'Planta baixa',   'Régua de escala em azul de projeto.',             200, null, false, null, false, 30),
  ('m-capacete',   'moldura', 'Capacete',       'Anel amarelo com capacete no topo.',              250, null, false, null, false, 40),
  ('m-neon',       'moldura', 'Neon',           'Brilho que pulsa em ciano e rosa.',               300, null, false, null, false, 50),
  ('m-arco',       'moldura', 'Arco-íris',      'Cores girando sem parar.',                        350, null, false, null, false, 60),
  ('m-ouro',       'moldura', 'Dourada',        'Ouro com brilho girando.',                        450, null, false, null, false, 70),
  ('m-coroa',      'moldura', 'Coroa',          'Dourada com coroa. A mais cara.',                 700, null, false, null, false, 80),
  ('m-fogo',       'moldura', 'Em chamas',      'Só com 20 dias úteis seguidos.',                  300, null, false, 20,   false, 90),
  ('m-natal',      'moldura', 'Natal',          'Listras de Natal com arvorezinha.',               250, null, false, null, false, 100),

  ('t-botina',     'titulo',  'Botina suja',    'Pegadas de barro na insígnia.',                   150, null, false, null, false, 10),
  ('t-home',       'titulo',  'Home office',    'Casinha com wi-fi piscando.',                     150, null, false, null, false, 20),
  ('t-crono',      'titulo',  'Mestre do cronograma', 'Barras de Gantt que se desenham.',          150, null, false, null, false, 30),
  ('t-cafe',       'titulo',  'Movido a café',  'Xícara soltando vapor.',                          150, null, false, null, false, 40),
  ('t-excel',      'titulo',  'Rei do Excel',   'Planilha coroada.',                               150, null, false, null, false, 50),
  ('t-presente',   'titulo',  'Sempre presente','Só com 30 dias úteis seguidos.',                  150, null, false, 30,   false, 60),
  ('t-livre',      'titulo',  'Título personalizado', 'Você escreve, o RH aprova antes de aparecer.', 500, null, true, null, false, 70),

  ('th-noite',     'tema',    'Noite de obra',  'Menu e topo escuros, com o laranja da marca.',    200, null, false, null, false, 10),
  ('th-canteiro',  'tema',    'Canteiro',       'Preto e amarelo de segurança.',                   300, null, false, null, false, 20),
  ('th-planta',    'tema',    'Planta baixa',   'Azul de projeto com quadriculado.',               350, null, false, null, false, 30),
  ('th-concreto',  'tema',    'Concreto',       'Cinza com textura, laranja nos botões.',          250, null, false, null, false, 40),
  ('th-porsol',    'tema',    'Pôr do sol',     'Menu em degradê roxo e laranja.',                 300, null, false, null, false, 50),
  ('th-mata',      'tema',    'Mata',           'Verdes da marca.',                                200, null, false, null, false, 60),
  ('th-halloween', 'tema',    'Halloween',      'Morcegos voando, teia com aranha e fantasma.',    300, null, false, null, false, 70),
  ('th-natal',     'tema',    'Natal',          'Pisca-pisca no topo, neve caindo e árvore.',      300, null, false, null, false, 80),

  ('a-confete',    'aniversario', 'Chuva de confete', 'Confete caindo no seu card.',               150, null,    false, null, false, 10),
  ('a-baloes',     'aniversario', 'Balões',           'Balões subindo atrás de você.',             200, null,    false, null, false, 20),
  ('a-faixa',      'aniversario', 'Bandeirinhas',     'Varal de bandeirinhas com seu nome.',       200, null,    false, null, false, 30),
  ('a-bolo',       'aniversario', 'Bolo animado',     'Bolo que balança acima do botão.',          100, null,    false, null, false, 40),
  ('a-ouro',       'aniversario', 'Card dourado',     'Troca o fundo azul por dourado.',           300, 'fundo', false, null, false, 50),
  ('a-noite',      'aniversario', 'Noite estrelada',  'Fundo escuro com brilho roxo.',             250, 'fundo', false, null, false, 60),

  ('mu-papel',     'mural', 'Post-it',          'Seu recado num papel amarelo torto.',             150, 'papel', false, null, false, 10),
  ('mu-cartao',    'mural', 'Cartão de festa',  'Borda colorida e confete no canto.',              200, 'papel', false, null, false, 20),
  ('mu-mao',       'mural', 'Letra de mão',     'Seu recado em letra cursiva.',                    150, null,    false, null, false, 30),

  ('d-home',       'destaque', 'Recado na Home', 'Uma frase no topo da Home de todo mundo por 1 dia. Passa pelo RH.', 800, null, true, null, false, 10),

  ('r-caneca',     'real', 'Caneca PHD',            'Retirada no escritório.',                    1500, null, true, null, true, 10),
  ('r-camisa',     'real', 'Camiseta PHD',          'Escolhe o tamanho na troca.',                2500, null, true, null, true, 20),
  ('r-folga',      'real', 'Meio período de folga', 'Combinado com o gestor.',                    4000, null, true, null, true, 30)
on conflict (id) do update set
  categoria = excluded.categoria, nome = excluded.nome, descricao = excluded.descricao, preco = excluded.preco,
  grupo = excluded.grupo, requer_aprovacao = excluded.requer_aprovacao, sequencia_minima = excluded.sequencia_minima,
  em_breve = excluded.em_breve, ordem = excluded.ordem;

-- ----------------------------------------------------------------------------
-- 3) Auxiliares
-- ----------------------------------------------------------------------------
create or replace function app_private.pontos_saldo(p_colab uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(pontos), 0)::int from public.pontos_movimentos where colaborador_id = p_colab
$$;
revoke all on function app_private.pontos_saldo(uuid) from public;

-- Dias úteis seguidos com login, contando de hoje para trás. Sábado e domingo
-- não quebram a sequência (nem contam, se não houve login). Feriado quebra:
-- simplificação aceita.
create or replace function app_private.pontos_sequencia(p_colab uuid)
returns int language plpgsql stable security definer set search_path = '' as $$
declare
  v_dia date := app_private.hoje_brasil();
  v_n int := 0;
  v_dias date[];
begin
  -- O cast fica dentro do case: o Postgres não garante a ordem do where, e
  -- os refs dos outros motivos não são datas.
  select coalesce(array_agg(d), '{}') into v_dias from (
    select case when motivo = 'login' then ref::date end as d
      from public.pontos_movimentos
     where colaborador_id = p_colab and motivo = 'login'
  ) x where d > v_dia - 400;
  -- Hoje ainda sem login não quebra: a sequência é de ontem para trás.
  if not (v_dia = any(v_dias)) then v_dia := v_dia - 1; end if;
  loop
    if v_dia = any(v_dias) then
      if extract(isodow from v_dia) < 6 then v_n := v_n + 1; end if;
    elsif extract(isodow from v_dia) < 6 then
      exit;
    end if;
    v_dia := v_dia - 1;
    exit when v_n > 400;
  end loop;
  return v_n;
end $$;
revoke all on function app_private.pontos_sequencia(uuid) from public;

-- Garante a linha de perfil.
create or replace function app_private.pontos_perfil_de(p_colab uuid)
returns public.pontos_perfil language plpgsql security definer set search_path = '' as $$
declare v public.pontos_perfil;
begin
  insert into public.pontos_perfil (colaborador_id) values (p_colab) on conflict do nothing;
  select * into v from public.pontos_perfil where colaborador_id = p_colab;
  return v;
end $$;
revoke all on function app_private.pontos_perfil_de(uuid) from public;

-- ----------------------------------------------------------------------------
-- 4) Ganhar
-- ----------------------------------------------------------------------------
-- Chamado pelo front ao abrir o portal. Idempotente no dia.
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
  values (v_me, 5, 'login', v_hoje::text, 'Entrou no portal')
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_seq := app_private.pontos_sequencia(v_me);
  if v_n > 0 then
    v_ganhou := 5;
    if v_seq > 0 and v_seq % 5 = 0 and extract(isodow from v_hoje) < 6 then
      insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
      values (v_me, 10, 'sequencia', v_hoje::text, v_seq || ' dias úteis seguidos')
      on conflict do nothing;
      get diagnostics v_n = row_count;
      v_ganhou := v_ganhou + 10 * v_n;
    end if;
  end if;
  return query select v_ganhou, app_private.pontos_saldo(v_me), v_seq;
end $$;
revoke all on function public.pontos_registrar_acesso() from public, anon;
grant execute on function public.pontos_registrar_acesso() to authenticated;

-- Humor do dia: vale responder (qualquer resposta), uma vez por dia.
create or replace function app_private.pontos_humor_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (new.colaborador_id, 5, 'humor', new.dia::text, 'Respondeu o humor do dia')
  on conflict do nothing;
  return new;
end $$;
revoke all on function app_private.pontos_humor_trg() from public;
drop trigger if exists pontos_humor on public.humor_registros;
create trigger pontos_humor after insert on public.humor_registros
for each row execute function app_private.pontos_humor_trg();

-- ----------------------------------------------------------------------------
-- 5) Consultar
-- ----------------------------------------------------------------------------
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

create or replace function public.pontos_extrato(p_limite int default 100)
returns table (pontos int, motivo text, descricao text, criado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.pontos, m.motivo, m.descricao, m.criado_em from public.pontos_movimentos m
   where m.colaborador_id = app_private.my_colaborador_id()
   order by m.criado_em desc, m.id desc
   limit least(greatest(coalesce(p_limite, 100), 1), 500)
$$;
revoke all on function public.pontos_extrato(int) from public, anon;
grant execute on function public.pontos_extrato(int) to authenticated;

-- O que os OUTROS estão usando: é cosmético e feito para ser visto, então
-- qualquer logado lê. Só dos ids pedidos (a lista que a tela já mostra).
create or replace function public.pontos_visuais(p_ids uuid[])
returns table (colaborador_id uuid, moldura text, titulo text, titulo_texto text, aniversario text[], mural text[])
language sql stable security definer set search_path = '' as $$
  select p.colaborador_id, p.moldura, p.titulo,
         (select c.texto from public.pontos_compras c where c.colaborador_id = p.colaborador_id and c.item_id = 't-livre' and c.status = 'ok'),
         p.aniversario, p.mural
    from public.pontos_perfil p
   where p.colaborador_id = any(p_ids[1:300])
$$;
revoke all on function public.pontos_visuais(uuid[]) from public, anon;
grant execute on function public.pontos_visuais(uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Loja
-- ----------------------------------------------------------------------------
create or replace function public.pontos_comprar(p_item text, p_texto text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_item public.pontos_itens;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_status text;
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  -- Uma compra por vez por pessoa: duas abas não gastam o mesmo saldo.
  perform pg_advisory_xact_lock(hashtext('pontos:' || v_me::text));

  select * into v_item from public.pontos_itens where id = p_item and ativo;
  if not found then raise exception 'Item não encontrado.'; end if;
  if v_item.em_breve then raise exception 'Este item ainda não está à venda.'; end if;
  if exists (select 1 from public.pontos_compras where colaborador_id = v_me and item_id = p_item and status <> 'recusado') then
    raise exception 'Você já tem este item.';
  end if;
  if v_item.sequencia_minima is not null and app_private.pontos_sequencia(v_me) < v_item.sequencia_minima then
    raise exception 'Este item pede % dias úteis seguidos entrando no portal.', v_item.sequencia_minima;
  end if;
  if v_item.requer_aprovacao and v_item.categoria in ('titulo', 'destaque') and v_texto is null then
    raise exception 'Escreva o texto que vai aparecer.';
  end if;
  if char_length(v_texto) > 140 then raise exception 'Texto longo demais (máximo de 140 caracteres).'; end if;
  if app_private.pontos_saldo(v_me) < v_item.preco then raise exception 'Saldo insuficiente.'; end if;

  v_status := case when v_item.requer_aprovacao then 'pendente' else 'ok' end;
  insert into public.pontos_compras (colaborador_id, item_id, status, texto)
  values (v_me, p_item, v_status, v_texto)
  on conflict (colaborador_id, item_id) do update
    set status = excluded.status, texto = excluded.texto, criado_em = now(),
        decidido_em = null, decidido_por = null, exibir_em = null;
  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (v_me, -v_item.preco, 'compra', p_item || ':' || extract(epoch from now())::bigint, 'Lojinha: ' || v_item.nome);

  if v_status = 'ok' then perform public.pontos_usar(p_item, true); end if;
  return jsonb_build_object('status', v_status, 'saldo', app_private.pontos_saldo(v_me));
end $$;
revoke all on function public.pontos_comprar(text, text) from public, anon;
grant execute on function public.pontos_comprar(text, text) to authenticated;

create or replace function public.pontos_usar(p_item text, p_ligar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_item public.pontos_itens;
  v_perfil public.pontos_perfil;
  v_lista text[];
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  select * into v_item from public.pontos_itens where id = p_item;
  if not found then raise exception 'Item não encontrado.'; end if;
  if not exists (select 1 from public.pontos_compras where colaborador_id = v_me and item_id = p_item and status = 'ok') then
    raise exception 'Este item ainda não é seu.';
  end if;
  v_perfil := app_private.pontos_perfil_de(v_me);

  if v_item.categoria in ('moldura', 'titulo', 'tema') then
    update public.pontos_perfil set
      moldura = case when v_item.categoria = 'moldura' then (case when p_ligar then p_item end) else moldura end,
      titulo  = case when v_item.categoria = 'titulo'  then (case when p_ligar then p_item end) else titulo end,
      tema    = case when v_item.categoria = 'tema'    then (case when p_ligar then p_item end) else tema end,
      atualizado_em = now()
    where colaborador_id = v_me;
  elsif v_item.categoria in ('aniversario', 'mural') then
    v_lista := case v_item.categoria when 'aniversario' then v_perfil.aniversario else v_perfil.mural end;
    v_lista := array_remove(v_lista, p_item);
    if p_ligar then
      if v_item.grupo is not null then
        select coalesce(array_agg(x), '{}') into v_lista from unnest(v_lista) x
         where not exists (select 1 from public.pontos_itens i where i.id = x and i.grupo = v_item.grupo);
      end if;
      v_lista := v_lista || p_item;
    end if;
    update public.pontos_perfil set
      aniversario = case when v_item.categoria = 'aniversario' then v_lista else aniversario end,
      mural       = case when v_item.categoria = 'mural' then v_lista else mural end,
      atualizado_em = now()
    where colaborador_id = v_me;
  end if;
end $$;
revoke all on function public.pontos_usar(text, boolean) from public, anon;
grant execute on function public.pontos_usar(text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 7) Moderação (RH e super admin): título personalizado, recado da Home
-- ----------------------------------------------------------------------------
create or replace function public.pontos_pendentes()
returns table (colaborador_id uuid, nome text, item_id text, item_nome text, texto text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app_private.is_rh_dp() or app_private.is_portal_super_admin()) then
    raise exception 'Apenas o RH modera os pedidos da lojinha.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select c.colaborador_id, col.nome, c.item_id, i.nome, c.texto, c.criado_em
    from public.pontos_compras c
    join public.pontos_itens i on i.id = c.item_id
    join public.colaboradores col on col.id = c.colaborador_id
   where c.status = 'pendente'
   order by c.criado_em;
end $$;
revoke all on function public.pontos_pendentes() from public, anon;
grant execute on function public.pontos_pendentes() to authenticated;

create or replace function public.pontos_decidir(p_colab uuid, p_item text, p_aprovar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_compra public.pontos_compras;
  v_item public.pontos_itens;
  v_dia date;
begin
  if not (app_private.is_rh_dp() or app_private.is_portal_super_admin()) then
    raise exception 'Apenas o RH modera os pedidos da lojinha.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_compra from public.pontos_compras where colaborador_id = p_colab and item_id = p_item for update;
  if not found or v_compra.status <> 'pendente' then raise exception 'Pedido não está mais pendente.'; end if;
  select * into v_item from public.pontos_itens where id = p_item;

  if p_aprovar then
    -- Recado da Home: um por dia, na fila. O primeiro dia livre a partir de amanhã.
    if v_item.categoria = 'destaque' then
      select greatest(app_private.hoje_brasil() + 1, coalesce(max(exibir_em) + 1, app_private.hoje_brasil() + 1))
        into v_dia from public.pontos_compras where item_id = p_item and status = 'ok' and exibir_em is not null;
    end if;
    update public.pontos_compras
       set status = 'ok', decidido_em = now(), decidido_por = app_private.my_colaborador_id(), exibir_em = v_dia
     where colaborador_id = p_colab and item_id = p_item;
    if v_item.categoria = 'titulo' then
      perform app_private.pontos_perfil_de(p_colab);
      update public.pontos_perfil set titulo = p_item, atualizado_em = now() where colaborador_id = p_colab;
    end if;
  else
    update public.pontos_compras
       set status = 'recusado', decidido_em = now(), decidido_por = app_private.my_colaborador_id()
     where colaborador_id = p_colab and item_id = p_item;
    insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
    values (p_colab, v_item.preco, 'estorno', p_item || ':' || extract(epoch from now())::bigint, 'Pedido recusado: ' || v_item.nome);
  end if;
end $$;
revoke all on function public.pontos_decidir(uuid, text, boolean) from public, anon;
grant execute on function public.pontos_decidir(uuid, text, boolean) to authenticated;

-- Recado aprovado para hoje (no máximo um).
create or replace function public.pontos_recado_home()
returns table (colaborador_id uuid, nome text, texto text)
language sql stable security definer set search_path = '' as $$
  select c.colaborador_id, col.nome, c.texto
    from public.pontos_compras c join public.colaboradores col on col.id = c.colaborador_id
   where c.item_id = 'd-home' and c.status = 'ok' and c.exibir_em = app_private.hoje_brasil()
   limit 1
$$;
revoke all on function public.pontos_recado_home() from public, anon;
grant execute on function public.pontos_recado_home() to authenticated;

-- Super admin: ajuste manual (lançamento, teste, correção).
create or replace function public.pontos_creditar(p_colab uuid, p_pontos int, p_descricao text default null)
returns int language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_portal_super_admin() then
    raise exception 'Apenas o super admin ajusta pontos.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_pontos, 0) = 0 then raise exception 'Informe os pontos.'; end if;
  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (p_colab, p_pontos, 'ajuste', gen_random_uuid()::text, coalesce(nullif(btrim(p_descricao), ''), 'Ajuste do administrador'));
  return app_private.pontos_saldo(p_colab);
end $$;
revoke all on function public.pontos_creditar(uuid, int, text) from public, anon;
grant execute on function public.pontos_creditar(uuid, int, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8) Mural de parabéns
-- ----------------------------------------------------------------------------
create or replace function public.parabens_enviar(p_para uuid, p_texto text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_hoje date := app_private.hoje_brasil();
  v_ano int := extract(year from app_private.hoje_brasil())::int;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_id uuid;
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
  on conflict (para_id, de_id, ano) do update set texto = excluded.texto
  returning id into v_id;

  -- Editar o recado não paga de novo: a chave do movimento é o aniversariante.
  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (v_me, 10, 'parabens', p_para::text || ':' || v_ano, 'Recado de aniversário')
  on conflict do nothing;
  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (p_para, 2, 'parabens_recebido', v_me::text || ':' || v_ano, 'Recebeu um recado de aniversário')
  on conflict do nothing;
  return app_private.pontos_saldo(v_me);
end $$;
revoke all on function public.parabens_enviar(uuid, text) from public, anon;
grant execute on function public.parabens_enviar(uuid, text) to authenticated;

create or replace function public.parabens_mural(p_para uuid)
returns table (id uuid, de_id uuid, de_nome text, texto text, criado_em timestamptz, moldura text, mural text[])
language sql stable security definer set search_path = '' as $$
  select r.id, r.de_id, c.nome, r.texto, r.criado_em, p.moldura, coalesce(p.mural, '{}')
    from public.parabens_recados r
    join public.colaboradores c on c.id = r.de_id
    left join public.pontos_perfil p on p.colaborador_id = r.de_id
   where r.para_id = p_para and r.ano = extract(year from app_private.hoje_brasil())::int
   order by r.criado_em
$$;
revoke all on function public.parabens_mural(uuid) from public, anon;
grant execute on function public.parabens_mural(uuid) to authenticated;

notify pgrst, 'reload schema';
