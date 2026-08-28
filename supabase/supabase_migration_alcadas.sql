-- Migration: alcadas (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Motor de Alçadas — implementa no banco os 5 pilares do §6 do "Documento de
-- Alçadas e Aprovações (Parte 3)":
--   1. Classificação obrigatória  -> colunas de classificação + CHECKs
--   2. Workflow por faixa         -> resolver de papéis (RPC) + config/alcadas.js
--   3. Bloqueio de avanço         -> papel não resolvido = criação barrada
--   4. Trilha de auditoria        -> tabela alcadas_auditoria (imutável)
--   5. Alerta de exceção e SLA    -> colunas de exceção + sla_* + view de estouro
--
-- A REGRA (faixas, +1 nível, quem aprova em cada nível) vive em
-- src/config/alcadas.js, que é lógica pura e testada. Este arquivo cuida do que
-- só o banco pode fazer: guardar a classificação, resolver PAPEL -> PESSOA
-- subindo a cadeia hierárquica, e registrar a trilha de forma imutável.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) Normalizador de função (acento + caixa), espelha o norm() do JS
-- ----------------------------------------------------------------------------
create or replace function app_private.norm_funcao(p text)
returns text language sql immutable set search_path = '' as $$
  select upper(translate(coalesce(p, ''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'))
$$;


-- ----------------------------------------------------------------------------
-- 1) Papéis atribuíveis
-- ----------------------------------------------------------------------------
-- Papéis que NÃO dá para deduzir do cadastro atual precisam ser atribuídos à
-- mão: hoje ninguém tem função jurídica e não existe conselho no cadastro.
-- Os papéis dedutíveis (CEO, COO, Diretor Comercial, Gerente Financeiro) também
-- entram aqui como OVERRIDE explícito — assim uma troca de diretoria é um
-- UPDATE nesta tabela, não um deploy.
--
-- Um papel pode ter MAIS DE UMA pessoa (ex.: CONSELHO, JURIDICO, ou dois
-- gerentes executivos): nesse caso vale "qualquer um do grupo aprova".
create table if not exists public.alcadas_papeis (
  id             uuid primary key default gen_random_uuid(),
  papel          text not null check (papel in (
                   'GERENTE_EXECUTIVO', 'DIRETOR_AREA', 'CEO', 'COO',
                   'DIRETOR_COMERCIAL', 'GERENTE_FINANCEIRO',
                   'FINANCEIRO', 'RH', 'JURIDICO', 'CONSELHO')),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  ordem          int not null default 1,
  created_at     timestamptz not null default now(),
  constraint uniq_alcada_papel unique (papel, colaborador_id)
);
create index if not exists alcadas_papeis_papel_idx on public.alcadas_papeis (papel);

comment on table public.alcadas_papeis is
  'Papel simbólico do motor de alçadas -> pessoa. Trocar diretoria = UPDATE aqui, sem deploy.';


-- ----------------------------------------------------------------------------
-- 2) Área da alçada (Backoffice x Operação) — §5.1 e §5.2
-- ----------------------------------------------------------------------------
-- O documento separa liderança de BACKOFFICE (aprova CEO) de liderança de
-- OPERAÇÃO (aprova COO), mas o cadastro não tem coluna de área. Regra adotada:
--   * se `area_alcada` estiver preenchida, ela manda (override manual);
--   * senão, herda da cadeia: se o diretor no topo for o COO -> 'operacao';
--     qualquer outro topo -> 'backoffice'.
alter table public.colaboradores
  add column if not exists area_alcada text
  check (area_alcada is null or area_alcada in ('backoffice', 'operacao'));

comment on column public.colaboradores.area_alcada is
  'Override da área para alçada de G&C (§5). NULL = herda pelo diretor no topo da cadeia.';


-- ----------------------------------------------------------------------------
-- 3) Classificação obrigatória — §6, pilar 1
-- ----------------------------------------------------------------------------
-- "Todo lançamento deve receber obrigatoriamente: valor, categoria e indicação
--  se está dentro ou fora do orçamento aprovado."
alter table public.solicitacoes_financeiro
  add column if not exists categoria          text,
  add column if not exists dentro_orcamento   boolean,
  add column if not exists alcada_tabela      text,
  add column if not exists alcada_nivel_base  int,
  add column if not exists alcada_nivel_final int,
  add column if not exists alcada_modificadores text[] not null default '{}',
  add column if not exists alcada_gatilhos      text[] not null default '{}',
  add column if not exists alcada_excecoes      text[] not null default '{}';

-- ⚠️ O CHECK que TORNA a classificação obrigatória está em
-- supabase_migration_alcadas_obrigatoria.sql, de propósito: aplicá-lo antes de
-- os formulários passarem a enviar categoria/dentro_orcamento quebraria a
-- criação de solicitações em produção. Aqui as colunas só nascem (nullable).

comment on column public.solicitacoes_financeiro.dentro_orcamento is
  'false = fora do orçamento aprovado -> modificador-base +1 nível (§2.1) + alerta à diretoria.';


-- ----------------------------------------------------------------------------
-- 4) Papel simbólico na etapa
-- ----------------------------------------------------------------------------
-- Generaliza a semântica que já existia (aprovador_id NULL = "qualquer admin do
-- Financeiro"): agora NULL significa "qualquer pessoa que satisfaça
-- papel_codigo". Etapas com aprovador nomeado guardam o papel só para auditoria.
alter table public.solicitacoes_financeiro_etapas
  add column if not exists papel_codigo text;

comment on column public.solicitacoes_financeiro_etapas.papel_codigo is
  'Papel do motor de alçadas (CEO, COO, JURIDICO...). Com aprovador_id NULL, define quem pode agir.';

-- §3.3 — o parecer do Jurídico é etapa BLOQUEANTE, não um aviso.
alter table public.solicitacoes_financeiro_etapas
  drop constraint if exists solicitacoes_financeiro_etapas_tipo_etapa_check;
alter table public.solicitacoes_financeiro_etapas
  add constraint solicitacoes_financeiro_etapas_tipo_etapa_check
  check (tipo_etapa in ('aprovacao', 'execucao', 'parecer'));


-- ----------------------------------------------------------------------------
-- 5) Trilha de auditoria — §6, pilar 4
-- ----------------------------------------------------------------------------
-- "Log completo registrando: quem aprovou, data/hora, valor envolvido, e se
--  houve alguma exceção aplicada."
-- Imutável por policy: só INSERT e SELECT (sem UPDATE/DELETE para ninguém).
create table if not exists public.alcadas_auditoria (
  id              uuid primary key default gen_random_uuid(),
  modulo          text not null,             -- 'financeiro' | 'dp' | 'comercial'
  solicitacao_id  uuid,                      -- sem FK: o log sobrevive à exclusão
  numero          bigint,
  tipo            text,
  evento          text not null check (evento in (
                    'classificacao', 'aprovacao', 'reprovacao', 'execucao',
                    'parecer', 'excecao', 'alerta_sla', 'alerta_caixa')),
  ator_id         uuid,                      -- quem agiu
  ator_nome       text,                      -- snapshot (sobrevive a desligamento)
  papel_codigo    text,
  valor           numeric,
  alcada_tabela   text,
  nivel_base      int,
  nivel_final     int,
  excecoes        text[] not null default '{}',
  observacao      text,
  criado_em       timestamptz not null default now()
);
create index if not exists alcadas_auditoria_solic_idx on public.alcadas_auditoria (solicitacao_id);
create index if not exists alcadas_auditoria_data_idx  on public.alcadas_auditoria (criado_em desc);

comment on table public.alcadas_auditoria is
  'Trilha imutável de alçadas (§6 pilar 4). Sem FK em solicitacao_id de propósito: o log sobrevive à exclusão da solicitação.';


-- ----------------------------------------------------------------------------
-- 6) SLA — §6, pilar 5
-- ----------------------------------------------------------------------------
create table if not exists public.alcadas_sla (
  id          uuid primary key default gen_random_uuid(),
  modulo      text not null,
  tipo        text not null,
  horas       int  not null check (horas > 0),
  updated_at  timestamptz not null default now(),
  constraint uniq_alcada_sla unique (modulo, tipo)
);

insert into public.alcadas_sla (modulo, tipo, horas) values
  ('financeiro', 'cartao_virtual', 48),
  ('financeiro', 'aumento_limite', 48)
on conflict (modulo, tipo) do nothing;

-- Etapas pendentes que já estouraram o SLA do seu tipo. Vira alerta à diretoria.
-- security_invoker: sem isso a view rodaria como dona (postgres) e furaria a RLS
-- das tabelas de baixo, expondo solicitação de todo mundo a qualquer usuário.
create or replace view public.alcadas_sla_estourado
with (security_invoker = true) as
  select
    s.id              as solicitacao_id,
    s.numero,
    s.tipo,
    s.valor,
    e.id              as etapa_id,
    e.ordem,
    e.papel,
    e.papel_codigo,
    e.created_at      as etapa_criada_em,
    sla.horas         as sla_horas,
    round(extract(epoch from (now() - e.created_at)) / 3600.0, 1) as horas_pendente
  from public.solicitacoes_financeiro_etapas e
  join public.solicitacoes_financeiro s on s.id = e.solicitacao_id
  join public.alcadas_sla sla on sla.modulo = 'financeiro' and sla.tipo = s.tipo
  where e.status = 'pendente'
    and s.status = 'pendente'
    and e.created_at < now() - make_interval(hours => sla.horas);


-- ----------------------------------------------------------------------------
-- 7) Cadeia hierárquica do solicitante (helper interno)
-- ----------------------------------------------------------------------------
-- Sobe por superior_id a partir do solicitante. `nivel` 1 = superior direto.
-- O corte em 12 níveis é guarda contra ciclo em superior_id (o cadastro não tem
-- constraint que impeça A -> B -> A).
create or replace function app_private.cadeia_superiores(p_id uuid)
returns table(nivel int, id uuid, nome text, email text, funcao text)
language sql stable security definer set search_path = '' as $$
  with recursive cadeia as (
    select 0 as nivel, c.id, c.nome, c.email, c.funcao, c.superior_id, c.ativo
      from public.colaboradores c
     where c.id = p_id
    union all
    select ca.nivel + 1, s.id, s.nome, s.email, s.funcao, s.superior_id, s.ativo
      from cadeia ca
      join public.colaboradores s on s.id = ca.superior_id
     where ca.nivel < 12
  )
  select cadeia.nivel, cadeia.id, cadeia.nome, cadeia.email, cadeia.funcao
    from cadeia
   where cadeia.nivel > 0 and cadeia.ativo = true
   order by cadeia.nivel
$$;
revoke all on function app_private.cadeia_superiores(uuid) from public;


-- ----------------------------------------------------------------------------
-- 8) Área do colaborador (§5.1/§5.2)
-- ----------------------------------------------------------------------------
create or replace function public.alcadas_area_colaborador(p_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_override text;
  v_coo      uuid;
  v_tem_coo  boolean;
begin
  select area_alcada into v_override from public.colaboradores where id = p_id;
  if v_override is not null then
    return v_override;
  end if;

  -- COO = papel atribuído; se não houver, cai na função "DIRETOR DE OPERACOES".
  select colaborador_id into v_coo from public.alcadas_papeis where papel = 'COO' order by ordem limit 1;
  if v_coo is null then
    select id into v_coo from public.colaboradores
     where app_private.norm_funcao(funcao) like '%DIRETOR DE OPERACOES%' and ativo = true limit 1;
  end if;

  -- Operação = o COO está na cadeia de superiores (ou é o próprio).
  select exists (
    select 1 from app_private.cadeia_superiores(p_id) c where c.id = v_coo
  ) or (p_id = v_coo) into v_tem_coo;

  return case when v_tem_coo then 'operacao' else 'backoffice' end;
end;
$$;
revoke all on function public.alcadas_area_colaborador(uuid) from public;
revoke execute on function public.alcadas_area_colaborador(uuid) from anon;
grant execute on function public.alcadas_area_colaborador(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 9) Resolver de papéis — o coração do "workflow por faixa" (§6, pilar 2)
-- ----------------------------------------------------------------------------
-- Recebe o solicitante e a lista de PAPÉIS que o motor exigiu; devolve as
-- pessoas correspondentes, na ordem em que os papéis foram pedidos.
--
-- IMPORTANTE (§6, pilar 3 — bloqueio de avanço): quando um papel não resolve
-- (ex.: JURIDICO sem ninguém atribuído), a função devolve uma linha com
-- colaborador_id NULL e origem='NAO_ATRIBUIDO'. Ela NÃO omite a linha em
-- silêncio — omitir deixaria a solicitação seguir sem o aprovador exigido, que
-- é exatamente a falha que este documento existe para impedir.
create or replace function public.alcadas_resolver_papeis(p_solicitante uuid, p_papeis text[])
returns table(seq int, papel text, colaborador_id uuid, nome text, email text, origem text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_papel  text;
  v_i      int := 0;
  v_achou  boolean;
begin
  foreach v_papel in array coalesce(p_papeis, '{}') loop
    v_i := v_i + 1;
    v_achou := false;

    -- (a) PAPÉIS DINÂMICOS resolvem pela CADEIA primeiro.
    -- A precedência aqui é o inverso da dos papéis fixos, de propósito: o
    -- documento pede "o Gerente Executivo" do solicitante, não um qualquer.
    -- Se a atribuição manual tivesse precedência, o seed de GERENTE_EXECUTIVO
    -- (que tem 2 pessoas) devolveria as duas para todo mundo e a cadeia nunca
    -- seria consultada. A atribuição vira FALLBACK para quem não tem um na cadeia.
    if v_papel = 'GERENTE' then
      -- superior direto do solicitante
      for seq, papel, colaborador_id, nome, email, origem in
        select v_i, v_papel, c.id, c.nome, c.email, 'CADEIA'
          from app_private.cadeia_superiores(p_solicitante) c where c.nivel = 1
      loop v_achou := true; return next; end loop;

    elsif v_papel = 'GERENTE_EXECUTIVO' then
      -- 1º "GERENTE EXECUTIVO" subindo a cadeia
      for seq, papel, colaborador_id, nome, email, origem in
        select v_i, v_papel, c.id, c.nome, c.email, 'CADEIA'
          from app_private.cadeia_superiores(p_solicitante) c
         where app_private.norm_funcao(c.funcao) like '%GERENTE EXECUTIVO%'
         order by c.nivel limit 1
      loop v_achou := true; return next; end loop;

    elsif v_papel = 'DIRETOR_AREA' then
      -- 1º diretor (ou o CEO) subindo a cadeia
      for seq, papel, colaborador_id, nome, email, origem in
        select v_i, v_papel, c.id, c.nome, c.email, 'CADEIA'
          from app_private.cadeia_superiores(p_solicitante) c
         where app_private.norm_funcao(c.funcao) like 'DIRETOR%'
            or app_private.norm_funcao(c.funcao) = 'CEO'
         order by c.nivel limit 1
      loop v_achou := true; return next; end loop;
    end if;
    if v_achou then continue; end if;

    -- (b) papel ATRIBUÍDO à mão — precedência para os papéis fixos/de grupo,
    -- fallback para os dinâmicos que não acharam ninguém na cadeia.
    for seq, papel, colaborador_id, nome, email, origem in
      select v_i, v_papel, c.id, c.nome, c.email, 'ATRIBUIDO'
        from public.alcadas_papeis ap
        join public.colaboradores c on c.id = ap.colaborador_id
       where ap.papel = v_papel and c.ativo = true
       order by ap.ordem, c.nome
    loop
      v_achou := true; return next;
    end loop;
    if v_achou then continue; end if;

    -- (c) resolução automática por função/role
    if v_papel in ('CEO', 'COO', 'DIRETOR_COMERCIAL', 'GERENTE_FINANCEIRO') then
      -- fallback por função quando o papel não foi atribuído na tabela
      for seq, papel, colaborador_id, nome, email, origem in
        select v_i, v_papel, c.id, c.nome, c.email, 'FUNCAO'
          from public.colaboradores c
         where c.ativo = true and (
                (v_papel = 'CEO'                and app_private.norm_funcao(c.funcao) = 'CEO')
             or (v_papel = 'COO'                and app_private.norm_funcao(c.funcao) like '%DIRETOR DE OPERACOES%')
             or (v_papel = 'DIRETOR_COMERCIAL'  and app_private.norm_funcao(c.funcao) like '%DIRETOR COMERCIAL%')
             or (v_papel = 'GERENTE_FINANCEIRO' and app_private.norm_funcao(c.funcao) like '%GERENTE FINANCEIRO%'))
         order by c.nome limit 1
      loop v_achou := true; return next; end loop;

    elsif v_papel = 'FINANCEIRO' then
      for seq, papel, colaborador_id, nome, email, origem in
        select v_i, v_papel, c.id, c.nome, c.email, 'ROLE'
          from public.colaboradores c
         where c.ativo = true and c.financeiro_role = 'admin' order by c.nome
      loop v_achou := true; return next; end loop;

    elsif v_papel = 'RH' then
      for seq, papel, colaborador_id, nome, email, origem in
        select v_i, v_papel, c.id, c.nome, c.email, 'ROLE'
          from public.colaboradores c
         where c.ativo = true and c.rh_dp = true order by c.nome
      loop v_achou := true; return next; end loop;
    end if;

    -- (d) não resolveu -> devolve a lacuna EXPLICITAMENTE (bloqueia a criação)
    if not v_achou then
      seq := v_i; papel := v_papel; colaborador_id := null;
      nome := null; email := null; origem := 'NAO_ATRIBUIDO';
      return next;
    end if;
  end loop;
end;
$$;
-- ⚠️ `revoke ... from public` NÃO tira o acesso do anon: o Supabase concede
-- EXECUTE em funções novas do schema public a anon/authenticated via ALTER
-- DEFAULT PRIVILEGES. Sem o revoke explícito abaixo, um anônimo enumeraria o
-- organograma inteiro (nome + e-mail da cadeia) via /rest/v1/rpc.
revoke all on function public.alcadas_resolver_papeis(uuid, text[]) from public;
revoke execute on function public.alcadas_resolver_papeis(uuid, text[]) from anon;
grant execute on function public.alcadas_resolver_papeis(uuid, text[]) to authenticated;


-- ----------------------------------------------------------------------------
-- 10) Seed dos papéis dedutíveis do cadastro atual
-- ----------------------------------------------------------------------------
insert into public.alcadas_papeis (papel, colaborador_id, ordem)
select p.papel, c.id, 1
  from (values
    ('CEO',                'CEO'),
    ('COO',                '%DIRETOR DE OPERACOES%'),
    ('DIRETOR_COMERCIAL',  '%DIRETOR COMERCIAL%'),
    ('GERENTE_FINANCEIRO', '%GERENTE FINANCEIRO%')
  ) as p(papel, padrao)
  join public.colaboradores c
    on c.ativo = true
   and (case when p.padrao = 'CEO' then app_private.norm_funcao(c.funcao) = 'CEO'
             else app_private.norm_funcao(c.funcao) like p.padrao end)
on conflict (papel, colaborador_id) do nothing;

-- Os dois gerentes executivos entram como grupo (qualquer um resolve o papel
-- quando o solicitante não tiver um na própria cadeia).
insert into public.alcadas_papeis (papel, colaborador_id, ordem)
select 'GERENTE_EXECUTIVO', c.id, 2
  from public.colaboradores c
 where c.ativo = true and app_private.norm_funcao(c.funcao) like '%GERENTE EXECUTIVO%'
on conflict (papel, colaborador_id) do nothing;

-- ⚠️ PROVISÓRIO (decidido em 2026-07-24) — JURIDICO e CONSELHO não existem no
-- cadastro. Sem ninguém neles, toda compra acima de R$ 50.000, CAPEX relevante
-- e contrato com cláusula atípica ficariam bloqueados. Decisão: o CEO acumula
-- os dois papéis até que as pessoas reais sejam cadastradas.
--
-- O acúmulo fica VISÍVEL: a trilha de auditoria grava `papel_codigo`, então um
-- parecer jurídico dado pelo CEO aparece como tal no log — não se confunde com
-- uma aprovação comum dele. Para desfazer, basta apagar estas duas linhas na
-- tela de Alçadas e atribuir as pessoas certas.
insert into public.alcadas_papeis (papel, colaborador_id, ordem)
select p.papel, c.id, 1
  from (values ('JURIDICO'), ('CONSELHO')) as p(papel)
  join public.colaboradores c
    on c.ativo = true and app_private.norm_funcao(c.funcao) = 'CEO'
on conflict (papel, colaborador_id) do nothing;


-- ============================================================================
-- RLS
-- ============================================================================
alter table public.alcadas_papeis    enable row level security;
alter table public.alcadas_auditoria enable row level security;
alter table public.alcadas_sla       enable row level security;

-- Papéis: LEITURA MÍNIMA — cada um vê só os PRÓPRIOS papéis; admin do
-- Financeiro vê todos. Nada além disso é necessário: o único consumidor no
-- front é `meusPapeisAlcada`, que lê apenas as próprias linhas, e a resolução
-- papel->pessoa acontece dentro de `alcadas_resolver_papeis` (SECURITY DEFINER,
-- que não passa por esta policy). Um `using (true)` daria a todo colaborador
-- acesso a uma tabela que ele não tinha antes, sem que ninguém precise.
drop policy if exists alcadas_papeis_select on public.alcadas_papeis;
create policy alcadas_papeis_select on public.alcadas_papeis
  for select to authenticated
  using (colaborador_id = app_private.my_colaborador_id() or app_private.is_financeiro_admin());

drop policy if exists alcadas_papeis_write on public.alcadas_papeis;
create policy alcadas_papeis_write on public.alcadas_papeis
  for all to authenticated
  using (app_private.is_financeiro_admin())
  with check (app_private.is_financeiro_admin());

-- SLA: só admin do Financeiro (lê e escreve). É configuração de governança,
-- ninguém mais precisa dela.
drop policy if exists alcadas_sla_select on public.alcadas_sla;
create policy alcadas_sla_select on public.alcadas_sla
  for select to authenticated using (app_private.is_financeiro_admin());

drop policy if exists alcadas_sla_write on public.alcadas_sla;
create policy alcadas_sla_write on public.alcadas_sla
  for all to authenticated
  using (app_private.is_financeiro_admin())
  with check (app_private.is_financeiro_admin());

-- Auditoria: APPEND-ONLY. Existem policies só de INSERT e SELECT — sem policy
-- de UPDATE/DELETE, o RLS nega essas operações a qualquer usuário autenticado.
-- O INSERT exige ator_id = o próprio usuário: poder gravar um evento atribuído
-- a OUTRA pessoa anularia a serventia da trilha.
drop policy if exists alcadas_auditoria_insert on public.alcadas_auditoria;
create policy alcadas_auditoria_insert on public.alcadas_auditoria
  for insert to authenticated
  with check (ator_id is not null and ator_id = app_private.my_colaborador_id());

drop policy if exists alcadas_auditoria_select on public.alcadas_auditoria;
create policy alcadas_auditoria_select on public.alcadas_auditoria
  for select to authenticated
  using (
    app_private.is_financeiro_admin()
    or ator_id = app_private.my_colaborador_id()
    or (solicitacao_id is not null and app_private.fin_eh_solicitante(solicitacao_id))
    or (solicitacao_id is not null and app_private.fin_eh_aprovador(solicitacao_id))
  );

grant select, insert on public.alcadas_auditoria to authenticated;
grant select on public.alcadas_papeis, public.alcadas_sla to authenticated;
grant insert, update, delete on public.alcadas_papeis, public.alcadas_sla to authenticated;
grant select on public.alcadas_sla_estourado to authenticated;
