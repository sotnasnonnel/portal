-- ============================================================================
-- Módulo PROGRAMAS — Campo de Ideias + Alavanca PHD
--
-- Espelha a estrutura do módulo Administrativo (chamados_adm*): tabela-mãe,
-- tabela de eventos (histórico append-only) e log de aceite dos termos, todas
-- com RLS apoiada em helpers de app_private.
--
-- São DOIS programas dentro de um módulo só:
--   Campo de Ideias  -> ideias e iniciativas de qualquer colaborador. Painel
--                       aberto a TODOS (é vitrine interna, não controle).
--   Alavanca PHD     -> indicação comercial. O painel é do TIME COMERCIAL;
--                       quem indica enxerga apenas as próprias indicações.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Papel do módulo (mesma mecânica de administrativo_role / financeiro_role)
--    NULL = colaborador comum: participa dos dois programas, mas não avalia
--    indicação. 'comercial' = time comercial (avalia a Alavanca).
--    'admin' = administra o módulo (comercial + status do Campo de Ideias).
-- ---------------------------------------------------------------------------
alter table public.colaboradores add column if not exists programas_role text;
alter table public.colaboradores drop constraint if exists colaboradores_programas_role_check;
alter table public.colaboradores add constraint colaboradores_programas_role_check
  check (programas_role is null or programas_role in ('comercial', 'admin'));

create or replace function app_private.is_programas_comercial()
returns boolean language sql stable security definer set search_path to '' as $fn$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and programas_role in ('comercial', 'admin')
  )
$fn$;

create or replace function app_private.is_programas_admin()
returns boolean language sql stable security definer set search_path to '' as $fn$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and programas_role = 'admin'
  )
$fn$;

-- ============================================================================
-- 2) CAMPO DE IDEIAS
-- ============================================================================
-- Uma tabela para os dois cards (ideia e iniciativa). São o mesmo objeto em
-- estágios diferentes — a ideia é o que ainda não existe, a iniciativa é o que
-- alguém já está construindo — e o painel (kanban, gráfico, mapa) lista os dois
-- lado a lado. Separar em duas tabelas obrigaria a um UNION em toda consulta.
-- Os campos exclusivos de cada forma ficam anuláveis; a obrigatoriedade por
-- tipo é garantida pelo CHECK abaixo, não só pelo formulário.
create table if not exists public.programas_ideias (
  id           uuid primary key default gen_random_uuid(),
  numero       bigint generated always as identity,
  tipo         text not null check (tipo in ('ideia', 'iniciativa')),

  -- comuns aos dois
  titulo       text not null,            -- ideia: "título da ideia" | iniciativa: "o que está criando"
  categoria    text not null check (categoria in ('individual', 'coletiva', 'venda')),
  retorno      text not null,            -- ganho esperado (financeiro, tempo ou produtividade)
  situacao     text not null default 'idealizado'
                 check (situacao in ('idealizado', 'iniciado', 'desenvolvimento', 'concluido')),

  -- só da ideia
  descricao    text,
  problema     text,
  beneficios   text,

  -- só da iniciativa
  data_inicio  date,
  setor        text,
  ferramentas  text[] not null default '{}',   -- "prever mais de uma"
  finalidade   text,

  -- opcionais (planilha: "não obrigatório")
  link         text,
  observacoes  text,

  autor_id     uuid not null references public.colaboradores(id) on delete restrict,
  criado_em    timestamptz not null default now(),
  updated_at   timestamptz,

  -- A ideia nasce sempre como ideia (sem data/setor/ferramenta); a iniciativa
  -- já existe e por isso precisa dizer quando começou, de quem é e com o quê.
  --
  -- coalesce no array_length: array vazio devolve NULL, e CHECK que avalia NULL
  -- PASSA — sem ele, a iniciativa entrava sem nenhuma ferramenta. O ELSE false
  -- pelo mesmo motivo: CASE sem ramo devolve NULL.
  constraint programas_ideias_campos_por_tipo check (
    case tipo
      when 'ideia' then descricao is not null and problema is not null and beneficios is not null
      when 'iniciativa' then data_inicio is not null and setor is not null
                            and finalidade is not null
                            and coalesce(array_length(ferramentas, 1), 0) >= 1
      else false
    end
  )
);

create index if not exists programas_ideias_autor_idx on public.programas_ideias (autor_id);
create index if not exists programas_ideias_criado_idx on public.programas_ideias (criado_em desc);

-- Histórico do "botão atualizar status" do mapa. Append-only: é o que sustenta
-- o e-mail de mudança de status e a leitura de quem mexeu no quê.
create table if not exists public.programas_ideias_eventos (
  id         uuid primary key default gen_random_uuid(),
  ideia_id   uuid not null references public.programas_ideias(id) on delete cascade,
  tipo       text not null check (tipo in ('criada', 'status', 'editada')),
  autor_id   uuid references public.colaboradores(id) on delete set null,
  de         text,
  para       text,
  created_at timestamptz not null default now()
);
create index if not exists programas_ideias_eventos_idx on public.programas_ideias_eventos (ideia_id, created_at);

-- ============================================================================
-- 3) ALAVANCA PHD
-- ============================================================================
-- status     = onde a indicação está no funil do comercial (o "mapa geral").
-- elegibilidade = resultado da checagem automática contra a base comercial,
--   guardado junto porque é o que o colaborador vê na hora do envio e o que
--   justifica uma recusa meses depois. Separado de `status` de propósito: a
--   checagem é da máquina, o status é decisão de gente.
create table if not exists public.programas_alavanca (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity,

  oportunidade     text not null,
  descricao        text not null,
  empresa          text not null,
  contato_nome     text not null,
  contato_cargo    text not null,
  contato_telefone text not null,
  contato_email    text not null,
  tratativas       text not null,   -- "o que já foi tratado / o que já temos"

  indicado_por     uuid not null references public.colaboradores(id) on delete restrict,

  status           text not null default 'em_analise'
                     check (status in ('em_analise', 'nao_elegivel', 'em_evolucao', 'concluida')),
  comentario       text,            -- comentário do comercial no mapa geral

  elegibilidade    text not null default 'pendente'
                     check (elegibilidade in ('pendente', 'elegivel', 'nao_elegivel', 'em_analise')),
  elegibilidade_motivo text,
  elegibilidade_em timestamptz,

  -- Premiação: 0,5% do contrato, teto de R$ 10.000 (regra do programa). O valor
  -- é obrigatório na conclusão — garantido pelo CHECK, não só pela tela.
  valor_contrato   numeric(14, 2),
  valor_premio     numeric(14, 2),
  pago_em          date,
  concluida_em     timestamptz,

  criado_em        timestamptz not null default now(),
  updated_at       timestamptz,

  constraint programas_alavanca_premio_na_conclusao check (
    status <> 'concluida' or valor_premio is not null
  )
);

create index if not exists programas_alavanca_indicador_idx on public.programas_alavanca (indicado_por);
create index if not exists programas_alavanca_empresa_idx on public.programas_alavanca (lower(empresa));
create index if not exists programas_alavanca_criado_idx on public.programas_alavanca (criado_em desc);

create table if not exists public.programas_alavanca_eventos (
  id           uuid primary key default gen_random_uuid(),
  indicacao_id uuid not null references public.programas_alavanca(id) on delete cascade,
  tipo         text not null check (tipo in ('criada', 'elegibilidade', 'status', 'comentario', 'premiacao')),
  autor_id     uuid references public.colaboradores(id) on delete set null,
  de           text,
  para         text,
  texto        text,
  created_at   timestamptz not null default now()
);
create index if not exists programas_alavanca_eventos_idx on public.programas_alavanca_eventos (indicacao_id, created_at);

-- Log do aceite obrigatório das REGRAS (mesmo papel de financeiro_termos_aceites).
create table if not exists public.programas_termos_aceites (
  id             uuid primary key default gen_random_uuid(),
  indicacao_id   uuid references public.programas_alavanca(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  programa       text not null,
  titulo         text,
  aceito_em      timestamptz not null default now()
);

-- ============================================================================
-- 4) RLS
-- ============================================================================
alter table public.programas_ideias enable row level security;
alter table public.programas_ideias_eventos enable row level security;
alter table public.programas_alavanca enable row level security;
alter table public.programas_alavanca_eventos enable row level security;
alter table public.programas_termos_aceites enable row level security;

-- --- Campo de Ideias: vitrine interna. Todo logado LÊ tudo (o painel é
--     "liberado para todos"), mas só o autor e o admin do módulo escrevem.
drop policy if exists programas_ideias_select on public.programas_ideias;
create policy programas_ideias_select on public.programas_ideias
  for select to authenticated using (true);

drop policy if exists programas_ideias_insert on public.programas_ideias;
create policy programas_ideias_insert on public.programas_ideias
  for insert to authenticated
  with check (autor_id = app_private.my_colaborador_id());

drop policy if exists programas_ideias_update on public.programas_ideias;
create policy programas_ideias_update on public.programas_ideias
  for update to authenticated
  using (autor_id = app_private.my_colaborador_id() or app_private.is_programas_admin())
  with check (autor_id = app_private.my_colaborador_id() or app_private.is_programas_admin());

drop policy if exists programas_ideias_eventos_select on public.programas_ideias_eventos;
create policy programas_ideias_eventos_select on public.programas_ideias_eventos
  for select to authenticated using (true);

drop policy if exists programas_ideias_eventos_insert on public.programas_ideias_eventos;
create policy programas_ideias_eventos_insert on public.programas_ideias_eventos
  for insert to authenticated
  with check (autor_id = app_private.my_colaborador_id());

-- --- Alavanca: indicação é dado comercial. Quem indicou vê a própria; o time
--     comercial vê todas e é o único que muda status, comentário e premiação.
drop policy if exists programas_alavanca_select on public.programas_alavanca;
create policy programas_alavanca_select on public.programas_alavanca
  for select to authenticated
  using (indicado_por = app_private.my_colaborador_id() or app_private.is_programas_comercial());

drop policy if exists programas_alavanca_insert on public.programas_alavanca;
create policy programas_alavanca_insert on public.programas_alavanca
  for insert to authenticated
  with check (indicado_por = app_private.my_colaborador_id());

-- Sem quem-indicou no USING: a indicação, depois de enviada, é do comercial.
-- Deixar o autor editar abriria a porta para trocar a empresa depois de a
-- elegibilidade ter sido calculada.
drop policy if exists programas_alavanca_update on public.programas_alavanca;
create policy programas_alavanca_update on public.programas_alavanca
  for update to authenticated
  using (app_private.is_programas_comercial())
  with check (app_private.is_programas_comercial());

drop policy if exists programas_alavanca_eventos_select on public.programas_alavanca_eventos;
create policy programas_alavanca_eventos_select on public.programas_alavanca_eventos
  for select to authenticated
  using (exists (
    select 1 from public.programas_alavanca a
    where a.id = indicacao_id
      and (a.indicado_por = app_private.my_colaborador_id() or app_private.is_programas_comercial())
  ));

drop policy if exists programas_alavanca_eventos_insert on public.programas_alavanca_eventos;
create policy programas_alavanca_eventos_insert on public.programas_alavanca_eventos
  for insert to authenticated
  with check (
    autor_id = app_private.my_colaborador_id()
    and (app_private.is_programas_comercial() or exists (
      select 1 from public.programas_alavanca a
      where a.id = indicacao_id and a.indicado_por = app_private.my_colaborador_id()
    ))
  );

drop policy if exists programas_termos_aceites_select on public.programas_termos_aceites;
create policy programas_termos_aceites_select on public.programas_termos_aceites
  for select to authenticated
  using (colaborador_id = app_private.my_colaborador_id() or app_private.is_programas_comercial());

drop policy if exists programas_termos_aceites_insert on public.programas_termos_aceites;
create policy programas_termos_aceites_insert on public.programas_termos_aceites
  for insert to authenticated
  with check (colaborador_id = app_private.my_colaborador_id());

-- ============================================================================
-- 5) Duplicidade da Alavanca (regra 4 do programa: vale quem indicou primeiro)
-- ============================================================================
-- SECURITY DEFINER porque a RLS acima esconde de mim as indicações dos outros —
-- e é exatamente contra elas que preciso comparar. Devolve só o suficiente para
-- explicar a recusa (quem e quando), nunca a indicação inteira.
create or replace function public.alavanca_indicacao_anterior(p_empresa text)
returns table (nome text, criado_em timestamptz)
language sql stable security definer set search_path to '' as $fn$
  select c.nome, a.criado_em
  from public.programas_alavanca a
  join public.colaboradores c on c.id = a.indicado_por
  where lower(btrim(a.empresa)) = lower(btrim(p_empresa))
    and a.status <> 'nao_elegivel'
  order by a.criado_em asc
  limit 1
$fn$;

-- O revoke de `anon` é o que importa e precisa vir DEPOIS do CREATE: o Supabase
-- concede EXECUTE a anon/authenticated/service_role em toda função nova de
-- public por event trigger, ignorando o que a migração já tinha revogado. Sem
-- ele, qualquer um com a chave pública sondaria "empresa X já foi indicada?" e
-- receberia de volta o nome de quem indicou.
revoke all on function public.alavanca_indicacao_anterior(text) from public;
revoke execute on function public.alavanca_indicacao_anterior(text) from anon;
grant execute on function public.alavanca_indicacao_anterior(text) to authenticated;
