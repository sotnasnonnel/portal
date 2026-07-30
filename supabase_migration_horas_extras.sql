-- Migration: horas_extras (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Gestão de HORAS EXTRAS — ferramenta nova dentro do Controle de Horas.
-- Porta o protótipo referencia/Sistema_PHD_Gestao_Horas_Extras_Teste_Ajustado.html
-- para o portal. É um fluxo de SOLICITAÇÃO/APROVAÇÃO, paralelo e independente do
-- apontamento de horas (horas_apontamentos) — nada aqui gera apontamento.
--
-- Decisões (2026-07-30):
--  * APROVADOR = superior direto da Gestão de Pessoas (colaboradores.superior_id).
--    Resolvido na criação pela RPC horas_extras_meu_aprovador(), que sobe a árvore
--    até achar alguém ATIVO e COM LOGIN (auth_id) — assim um superior sem acesso
--    ao portal não trava a solicitação.
--  * DP/Admin = app_private.is_rh_dp() OR is_admin() OR super-admin (nenhuma
--    coluna/flag nova).
--  * Cargo vem de colaboradores.funcao, equipe de horas_gerencias e projeto de
--    horas_projetos. MATRÍCULA e CENTRO DE CUSTO não existem no cadastro: ficam
--    como texto na própria solicitação (snapshot do que valia na abertura).
--  * Percentual da hora NUNCA é do gestor — é aplicado pelo DP/RM conforme CCT.
--    Por isso não existe coluna de percentual aqui.
--
-- Prazo (regra do protótipo, agora com escopo de exceção real):
--    Regra padrão: solicitação só até 12:00 do próprio dia e sem retroativo.
--    Uma EXCEÇÃO ativa que cubra a data da hora extra troca o horário-limite E
--    libera o lançamento retroativo dentro do seu período — é exatamente o caso
--    que o protótipo cita no motivo ("colaborador em campo sem acesso ao
--    sistema", "queda de energia"), que sem isso ficaria sem solução.
--    O escopo 'solicitacao' do protótipo (liberar UMA solicitação específica)
--    virou "colaborador + data única": uma solicitação que ainda não existe não
--    pode ser referenciada, então a exceção aponta para a pessoa e o dia.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Helper de RLS: quem é o DP/Admin das horas extras
-- ----------------------------------------------------------------------------
create or replace function app_private.is_horas_extras_dp()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_rh_dp()
      or app_private.is_admin()
      or app_private.is_portal_super_admin()
$$;
revoke all on function app_private.is_horas_extras_dp() from public;
grant execute on function app_private.is_horas_extras_dp() to authenticated;

-- ----------------------------------------------------------------------------
-- 1) Exceções de prazo (Central de Exceções — DP)
-- ----------------------------------------------------------------------------
-- Criada antes das solicitações porque a solicitação guarda qual exceção a
-- liberou (excecao_id), para rastreabilidade.
create table if not exists public.horas_extras_excecoes (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('solicitacao', 'colaborador', 'equipe', 'global')),
  novo_horario   time not null,
  data_inicial   date not null,
  data_final     date not null,
  colaborador_id uuid references public.colaboradores(id) on delete cascade,
  gerencia_id    uuid references public.horas_gerencias(id) on delete cascade,
  projeto_id     uuid references public.horas_projetos(id) on delete cascade,
  motivo         text not null,
  ativa          boolean not null default true,
  criado_por     uuid references public.colaboradores(id),
  criado_em      timestamptz not null default now(),
  constraint he_exc_periodo check (data_final >= data_inicial),
  -- Cada escopo exige o seu alvo. 'global' vale para a empresa toda (sem alvo).
  constraint he_exc_alvo check (
    case tipo
      when 'solicitacao' then colaborador_id is not null and data_inicial = data_final
      when 'colaborador' then colaborador_id is not null
      when 'equipe'      then gerencia_id is not null or projeto_id is not null
      else true
    end
  )
);
create index if not exists horas_extras_exc_periodo_idx
  on public.horas_extras_excecoes (ativa, data_inicial, data_final);

-- ----------------------------------------------------------------------------
-- 2) Solicitações
-- ----------------------------------------------------------------------------
create table if not exists public.horas_extras_solicitacoes (
  id             uuid primary key default gen_random_uuid(),
  numero         bigint,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  aprovador_id   uuid references public.colaboradores(id),
  gerencia_id    uuid references public.horas_gerencias(id) on delete set null,
  projeto_id     uuid references public.horas_projetos(id) on delete set null,
  -- Snapshots do que valia na abertura (o cadastro pode mudar depois).
  cargo          text,
  matricula      text,
  centro_custo   text,
  -- A hora extra em si.
  data_he        date not null,
  hora_inicio    time not null,
  hora_fim       time not null,
  minutos        int generated always as
                   ((extract(epoch from (hora_fim - hora_inicio)) / 60)::int) stored,
  motivo         text not null,
  justificativa  text not null,
  -- Decisão do gestor.
  status         text not null default 'pendente'
                   check (status in ('pendente', 'aprovada', 'reprovada', 'cancelada', 'compensada')),
  destino        text check (destino in ('medicao', 'banco')),
  compensacao_data     date,
  compensacao_periodo  text check (compensacao_periodo in ('manha', 'tarde', 'dia_inteiro')),
  compensacao_minutos  int,
  observacao_destino   text,
  motivo_reprovacao    text,
  motivo_alteracao     text,   -- motivo da alteração/cancelamento pelo DP
  decidido_em    timestamptz,
  decidido_por   uuid references public.colaboradores(id),
  -- Prazo aplicado na abertura (auditoria do "por que pôde abrir").
  limite_horario time,
  excecao_id     uuid references public.horas_extras_excecoes(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz,
  constraint he_horario check (hora_fim > hora_inicio),
  -- Aprovada/compensada SEMPRE tem destino; compensada só existe no banco de horas.
  constraint he_destino_exigido check (status not in ('aprovada', 'compensada') or destino is not null),
  constraint he_compensada_banco check (status <> 'compensada' or destino = 'banco'),
  -- Regras do protótipo garantidas pelo banco, não só pela tela.
  constraint he_reprovacao_com_motivo check (status <> 'reprovada' or motivo_reprovacao is not null),
  constraint he_banco_completo check (
    destino is distinct from 'banco'
    or (compensacao_data is not null and compensacao_periodo is not null and compensacao_minutos is not null)
  )
);

-- Numeração curta e estável (#1, #2, ...), como no DP e no Financeiro.
create sequence if not exists public.horas_extras_solicitacoes_numero_seq
  owned by public.horas_extras_solicitacoes.numero;
alter table public.horas_extras_solicitacoes
  alter column numero set default nextval('public.horas_extras_solicitacoes_numero_seq');
alter table public.horas_extras_solicitacoes alter column numero set not null;
create unique index if not exists horas_extras_solic_numero_key
  on public.horas_extras_solicitacoes (numero);

create index if not exists horas_extras_solic_colab_idx
  on public.horas_extras_solicitacoes (colaborador_id, data_he desc);
create index if not exists horas_extras_solic_aprov_idx
  on public.horas_extras_solicitacoes (aprovador_id, status);

-- ----------------------------------------------------------------------------
-- 3) Auditoria
-- ----------------------------------------------------------------------------
-- Escrita SÓ por trigger (função SECURITY DEFINER): nem a tela nem o SQL do
-- usuário inserem/alteram linhas aqui, então o histórico não pode ser forjado
-- nem esquecido.
create table if not exists public.horas_extras_auditoria (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid references public.horas_extras_solicitacoes(id) on delete cascade,
  excecao_id     uuid references public.horas_extras_excecoes(id) on delete cascade,
  ator_id        uuid references public.colaboradores(id),
  acao           text not null,
  detalhe        text,
  criado_em      timestamptz not null default now()
);
create index if not exists horas_extras_audit_criado_idx
  on public.horas_extras_auditoria (criado_em desc);

-- Rótulos legíveis no detalhe da auditoria (espelham lib/horasExtras.js).
create or replace function app_private.horas_extras_destino_label(p text)
returns text language sql immutable set search_path = '' as $$
  select case p when 'medicao' then 'Medição/Pagamento' when 'banco' then 'Banco de Horas' else coalesce(p, '—') end
$$;

create or replace function app_private.horas_extras_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_acao    text;
  v_detalhe text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'Solicitação criada';
    v_detalhe := format(
      '#%s · %s · %s às %s (%s min) · aguardando aprovação',
      new.numero, to_char(new.data_he, 'DD/MM/YYYY'),
      to_char(new.hora_inicio, 'HH24:MI'), to_char(new.hora_fim, 'HH24:MI'), new.minutos
    );
    if new.excecao_id is not null then
      v_detalhe := v_detalhe || format(' · liberada por exceção (limite %s)', to_char(new.limite_horario, 'HH24:MI'));
    end if;
  elsif new.status is distinct from old.status or new.destino is distinct from old.destino then
    v_acao := case
      when old.status = 'pendente' and new.status = 'aprovada'  then 'Aprovação com destino da hora'
      when new.status = 'reprovada'                             then 'Reprovação'
      when new.status = 'cancelada'                             then 'Cancelamento'
      when new.status = 'compensada'                            then 'Compensação registrada'
      else 'Alteração de destino'
    end;
    v_detalhe := format('#%s · status %s', new.numero, new.status);
    if new.destino is not null then
      v_detalhe := v_detalhe || ' · destino ' || app_private.horas_extras_destino_label(new.destino);
    end if;
    if new.status = 'aprovada' and new.destino = 'banco' then
      v_detalhe := v_detalhe || format(
        ' · compensar em %s (%s, %s min)',
        to_char(new.compensacao_data, 'DD/MM/YYYY'), new.compensacao_periodo, new.compensacao_minutos
      );
    end if;
    if new.status = 'reprovada' and new.motivo_reprovacao is not null then
      v_detalhe := v_detalhe || ' · motivo: ' || new.motivo_reprovacao;
    end if;
    if new.motivo_alteracao is not null and new.motivo_alteracao is distinct from old.motivo_alteracao then
      v_detalhe := v_detalhe || ' · motivo: ' || new.motivo_alteracao;
    end if;
    -- Percentual não entra: é do DP/RM conforme a CCT vigente.
    v_detalhe := v_detalhe || ' · percentual conforme CCT/DP';
  else
    return new;
  end if;

  insert into public.horas_extras_auditoria (solicitacao_id, ator_id, acao, detalhe)
  values (new.id, app_private.my_colaborador_id(), v_acao, v_detalhe);
  return new;
end $$;

drop trigger if exists horas_extras_audit_trg on public.horas_extras_solicitacoes;
create trigger horas_extras_audit_trg
after insert or update on public.horas_extras_solicitacoes
for each row execute function app_private.horas_extras_audit();

create or replace function app_private.horas_extras_audit_excecao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_acao text; v_detalhe text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'Exceção de prazo criada';
  elsif new.ativa is distinct from old.ativa then
    v_acao := case when new.ativa then 'Exceção de prazo reativada' else 'Exceção de prazo desativada' end;
  else
    return new;
  end if;
  v_detalhe := format(
    'Escopo %s · %s a %s · limite %s · motivo: %s',
    new.tipo, to_char(new.data_inicial, 'DD/MM/YYYY'), to_char(new.data_final, 'DD/MM/YYYY'),
    to_char(new.novo_horario, 'HH24:MI'), new.motivo
  );
  insert into public.horas_extras_auditoria (excecao_id, ator_id, acao, detalhe)
  values (new.id, app_private.my_colaborador_id(), v_acao, v_detalhe);
  return new;
end $$;

drop trigger if exists horas_extras_audit_exc_trg on public.horas_extras_excecoes;
create trigger horas_extras_audit_exc_trg
after insert or update on public.horas_extras_excecoes
for each row execute function app_private.horas_extras_audit_excecao();

-- ============================================================================
-- 4) RLS
-- ============================================================================
alter table public.horas_extras_solicitacoes enable row level security;
alter table public.horas_extras_excecoes     enable row level security;
alter table public.horas_extras_auditoria    enable row level security;

-- ---- Solicitações ----
-- Lê: o solicitante, o aprovador, a gestão acima dele (subárvore) e o DP.
drop policy if exists horas_extras_solic_select on public.horas_extras_solicitacoes;
create policy horas_extras_solic_select on public.horas_extras_solicitacoes
for select to authenticated
using (
  app_private.is_horas_extras_dp()
  or colaborador_id = app_private.my_colaborador_id()
  or aprovador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

-- Abre: só em nome próprio (o DP pode abrir por alguém).
drop policy if exists horas_extras_solic_insert on public.horas_extras_solicitacoes;
create policy horas_extras_solic_insert on public.horas_extras_solicitacoes
for insert to authenticated
with check (
  colaborador_id = app_private.my_colaborador_id()
  or app_private.is_horas_extras_dp()
);

-- Decide/altera: o aprovador da solicitação e o DP. O solicitante NÃO edita
-- depois de enviar (o protótipo também não deixa) — cancelamento é do DP.
drop policy if exists horas_extras_solic_update on public.horas_extras_solicitacoes;
create policy horas_extras_solic_update on public.horas_extras_solicitacoes
for update to authenticated
using (
  app_private.is_horas_extras_dp()
  or aprovador_id = app_private.my_colaborador_id()
)
with check (
  app_private.is_horas_extras_dp()
  or aprovador_id = app_private.my_colaborador_id()
);

drop policy if exists horas_extras_solic_delete on public.horas_extras_solicitacoes;
create policy horas_extras_solic_delete on public.horas_extras_solicitacoes
for delete to authenticated
using ( app_private.is_horas_extras_dp() );

-- ---- Exceções ----
-- Só o DP lê a lista inteira e escreve. O colaborador nunca lê a tabela: a
-- exceção que vale para ELE vem pela RPC horas_extras_excecao_aplicavel().
drop policy if exists horas_extras_exc_all on public.horas_extras_excecoes;
create policy horas_extras_exc_all on public.horas_extras_excecoes
for all to authenticated
using ( app_private.is_horas_extras_dp() )
with check ( app_private.is_horas_extras_dp() );

-- ---- Auditoria ----
-- Leitura do DP. Sem policy de escrita: só o trigger (SECURITY DEFINER) insere.
drop policy if exists horas_extras_audit_select on public.horas_extras_auditoria;
create policy horas_extras_audit_select on public.horas_extras_auditoria
for select to authenticated
using ( app_private.is_horas_extras_dp() );

-- ============================================================================
-- 5) RPCs
-- ============================================================================

-- Quem aprova a MINHA hora extra: o superior direto; se ele estiver inativo ou
-- sem login, sobe a árvore até achar alguém que consiga decidir no portal.
-- DEFINER porque um usuário comum não lê os ancestrais (RLS de colaboradores).
create or replace function public.horas_extras_meu_aprovador()
returns table (id uuid, nome text, email text, funcao text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_atual uuid;
  v_prox  uuid;
  v_depth int := 0;
begin
  select c.superior_id into v_atual
  from public.colaboradores c
  where c.id = app_private.my_colaborador_id();

  while v_atual is not null and v_depth < 60 loop
    return query
      select c.id, c.nome, c.email, c.funcao
      from public.colaboradores c
      where c.id = v_atual
        and c.ativo is distinct from false
        and c.auth_id is not null;
    if found then
      return;
    end if;
    select c.superior_id into v_prox from public.colaboradores c where c.id = v_atual;
    v_atual := v_prox;
    v_depth := v_depth + 1;
  end loop;
  return;
end $$;
revoke all on function public.horas_extras_meu_aprovador() from public;
revoke execute on function public.horas_extras_meu_aprovador() from anon;
grant execute on function public.horas_extras_meu_aprovador() to authenticated;

-- Exceção de prazo que vale para MIM numa data (e, se for o caso, no projeto
-- escolhido). Quando há mais de uma, ganha a mais permissiva (horário maior).
create or replace function public.horas_extras_excecao_aplicavel(
  p_data date,
  p_projeto uuid default null
)
returns table (id uuid, tipo text, novo_horario time, data_inicial date, data_final date, motivo text)
language sql stable security definer set search_path = '' as $$
  with eu as (
    select c.id, c.horas_gerencia_id
    from public.colaboradores c
    where c.id = app_private.my_colaborador_id()
  )
  select e.id, e.tipo, e.novo_horario, e.data_inicial, e.data_final, e.motivo
  from public.horas_extras_excecoes e, eu
  where e.ativa
    and p_data between e.data_inicial and e.data_final
    and (
      e.tipo = 'global'
      or (e.tipo in ('colaborador', 'solicitacao') and e.colaborador_id = eu.id)
      or (e.tipo = 'equipe' and (
            (e.gerencia_id is not null and e.gerencia_id = eu.horas_gerencia_id)
         or (e.projeto_id is not null and e.projeto_id = p_projeto)
      ))
    )
  order by e.novo_horario desc, e.criado_em desc
  limit 1
$$;
revoke all on function public.horas_extras_excecao_aplicavel(date, uuid) from public;
revoke execute on function public.horas_extras_excecao_aplicavel(date, uuid) from anon;
grant execute on function public.horas_extras_excecao_aplicavel(date, uuid) to authenticated;

-- Lista as solicitações que eu posso ver, já com os NOMES resolvidos.
-- Existe porque o DP (rh_dp sem perfil admin) não lê `colaboradores` de toda a
-- empresa pela RLS — e sem isso o painel dele mostraria linhas sem nome.
-- O escopo aqui repete o da policy de select, de propósito.
create or replace function public.horas_extras_listar(
  p_de date default null,
  p_ate date default null
)
returns table (
  id uuid, numero bigint, status text, destino text,
  colaborador_id uuid, colaborador_nome text, colaborador_funcao text,
  aprovador_id uuid, aprovador_nome text,
  gerencia_id uuid, gerencia_nome text,
  projeto_id uuid, projeto_nome text, projeto_cliente text,
  cargo text, matricula text, centro_custo text,
  data_he date, hora_inicio time, hora_fim time, minutos int,
  motivo text, justificativa text,
  compensacao_data date, compensacao_periodo text, compensacao_minutos int,
  observacao_destino text, motivo_reprovacao text, motivo_alteracao text,
  limite_horario time, excecao_id uuid,
  decidido_em timestamptz, decidido_por uuid, decidido_por_nome text,
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.numero, s.status, s.destino,
         s.colaborador_id, c.nome, c.funcao,
         s.aprovador_id, a.nome,
         s.gerencia_id, g.nome,
         s.projeto_id, p.nome, p.cliente,
         s.cargo, s.matricula, s.centro_custo,
         s.data_he, s.hora_inicio, s.hora_fim, s.minutos,
         s.motivo, s.justificativa,
         s.compensacao_data, s.compensacao_periodo, s.compensacao_minutos,
         s.observacao_destino, s.motivo_reprovacao, s.motivo_alteracao,
         s.limite_horario, s.excecao_id,
         s.decidido_em, s.decidido_por, d.nome,
         s.created_at
  from public.horas_extras_solicitacoes s
  join public.colaboradores c on c.id = s.colaborador_id
  left join public.colaboradores a on a.id = s.aprovador_id
  left join public.colaboradores d on d.id = s.decidido_por
  left join public.horas_gerencias g on g.id = s.gerencia_id
  left join public.horas_projetos p on p.id = s.projeto_id
  where (p_de is null or s.data_he >= p_de)
    and (p_ate is null or s.data_he <= p_ate)
    and (
      app_private.is_horas_extras_dp()
      or s.colaborador_id = app_private.my_colaborador_id()
      or s.aprovador_id = app_private.my_colaborador_id()
      or s.colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
    )
  order by s.created_at desc
$$;
revoke all on function public.horas_extras_listar(date, date) from public;
revoke execute on function public.horas_extras_listar(date, date) from anon;
grant execute on function public.horas_extras_listar(date, date) to authenticated;

-- Auditoria com os nomes do ator e o número da solicitação (mesmo motivo da RPC
-- acima: o DP não lê `colaboradores` inteiro).
create or replace function public.horas_extras_auditoria_listar(p_limite int default 300)
returns table (
  id uuid, criado_em timestamptz, ator_id uuid, ator_nome text,
  acao text, detalhe text, solicitacao_id uuid, numero bigint, excecao_id uuid
)
language sql stable security definer set search_path = '' as $$
  select l.id, l.criado_em, l.ator_id, c.nome, l.acao, l.detalhe,
         l.solicitacao_id, s.numero, l.excecao_id
  from public.horas_extras_auditoria l
  left join public.colaboradores c on c.id = l.ator_id
  left join public.horas_extras_solicitacoes s on s.id = l.solicitacao_id
  where app_private.is_horas_extras_dp()
  order by l.criado_em desc
  limit greatest(1, least(coalesce(p_limite, 300), 2000))
$$;
revoke all on function public.horas_extras_auditoria_listar(int) from public;
revoke execute on function public.horas_extras_auditoria_listar(int) from anon;
grant execute on function public.horas_extras_auditoria_listar(int) to authenticated;

-- Nomes para os selects da Central de Exceções (escopo colaborador). O DP não lê
-- `colaboradores` pela RLS; devolve só id/nome de quem está ativo.
create or replace function public.horas_extras_colaboradores()
returns table (id uuid, nome text, funcao text, gerencia_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.funcao, c.horas_gerencia_id
  from public.colaboradores c
  where c.ativo is distinct from false
    and app_private.is_horas_extras_dp()
  order by c.nome
$$;
revoke all on function public.horas_extras_colaboradores() from public;
revoke execute on function public.horas_extras_colaboradores() from anon;
grant execute on function public.horas_extras_colaboradores() to authenticated;

-- ============================================================================
-- Depois de aplicar:
--   select * from get_advisors('security');  -- nenhuma horas_extras_* sem RLS
--   select * from public.horas_extras_meu_aprovador();       -- devolve 1 linha
--   select * from public.horas_extras_listar();              -- devolve as suas
-- Reverter (ordem importa por causa das FKs):
--   drop table public.horas_extras_auditoria, public.horas_extras_solicitacoes,
--              public.horas_extras_excecoes cascade;
-- ============================================================================
