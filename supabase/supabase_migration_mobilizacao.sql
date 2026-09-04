-- Migration: mobilizacao (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Módulo de Gestão de Mobilização.
--
-- Substitui a planilha referencia/planilha_modulo_mobilizacao.xlsx, que hoje
-- controla três processos em três abas: MOB.PESSOAS (11 etapas),
-- MOB.EMPRESAS (8) e DESMOB. PESSOAS (5). Cada linha da planilha é um
-- PROCESSO; cada bloco de colunas "DATA PREV / DATA REAL / DIAS ATRASO" é uma
-- ETAPA.
--
-- O QUE AS FÓRMULAS DA PLANILHA DETERMINARAM (não é suposição):
--
--   * Cada etapa tem UM predecessor, e a data prevista dela é
--         WORKDAY( coalesce(DATA REAL do predecessor, DATA PREV dele), SLA )
--     Ou seja: toda etapa já nasce com prazo PROJETADO, e esse prazo se
--     reajusta sozinho quando a etapa anterior conclui de fato. Não existe
--     etapa "sem relógio" — diferente do chamado do Adm, que fica sem
--     vencimento enquanto espera aprovação.
--
--   * Não é uma fila linear: em MOB.PESSOAS, "Treinamentos agendados" pende de
--     "Abertura de chamado" enquanto "Emissão do ASO" pende de "Exames". É uma
--     árvore, por isso `depende_de` é coluna da etapa e não a ordem menos um.
--
--   * Etapa RAIZ (sem predecessor) tem a data informada na abertura. O número
--     que aparece acima dela na planilha não é offset — é o "+1" das fórmulas
--     de tempo inclusivo. A exceção é "Alteração contratual" (25), que é uma
--     duração-alvo; por isso a raiz também aceita SLA, contado a partir da
--     data-base do processo.
--
--   * MOB.PESSOAS conta dias CORRIDOS e as outras duas contam dias ÚTEIS
--     (WORKDAY). Aqui tudo passa a contar dias ÚTEIS, que é o pedido e o que o
--     Adm já faz (src/modules/administrativo/lib/prazo.js). Efeito colateral
--     conhecido: os prazos de mobilização de pessoas ficam ~2 dias mais
--     folgados do que na planilha atual.
--
-- O CATÁLOGO DE ETAPAS É DADO, NÃO CÓDIGO (mobilizacao_catalogo_etapas). A
-- planilha continua viva e vai mudar; nome de etapa em .js exigiria deploy.
--
-- PERMISSÃO: nenhum papel novo. Quem opera é o mesmo time do Administrativo,
-- então este módulo reusa administrativo_role e os helpers is_adm_time() /
-- is_adm_admin(). Duas listas de "quem é do time" divergiriam com o tempo.
--
-- Nota sobre os `revoke` deste arquivo: o Supabase tem um ALTER DEFAULT
-- PRIVILEGES que concede EXECUTE de toda função nova em public para anon,
-- authenticated e service_role. `revoke ... from public` NÃO desfaz isso — é um
-- grant direto ao papel. Por isso cada função abaixo revoga de `anon`
-- explicitamente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Dias úteis
--    Espelho plpgsql de src/utils/diasUteis.js. NÃO trata feriados — a mesma
--    limitação assumida do Adm, e ela dói mais aqui: mobilização acontece muito
--    em janeiro e em véspera de feriado prolongado. Quando existir tabela de
--    feriados, é só filtrar nos dois lugares.
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_dias_uteis_apos(p_data date, p_dias int)
returns date language plpgsql immutable set search_path = '' as $$
declare
  d date := p_data;
  n int := coalesce(p_dias, 0);
  i int := 0;
begin
  if p_data is null then return null; end if;

  -- Começar num fim de semana empurra para segunda ANTES de contar: senão o
  -- primeiro dia do prazo seria consumido por um dia em que ninguém trabalha.
  while extract(isodow from d) > 5 loop d := d + 1; end loop;

  while i < n loop
    d := d + 1;
    while extract(isodow from d) > 5 loop d := d + 1; end loop;
    i := i + 1;
  end loop;
  return d;
end $$;
revoke all on function app_private.mob_dias_uteis_apos(date, int) from public;
revoke execute on function app_private.mob_dias_uteis_apos(date, int) from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1) Catálogo de etapas — o ponto onde a planilha vira sistema
-- ----------------------------------------------------------------------------
create table if not exists public.mobilizacao_catalogo_etapas (
  id uuid primary key default gen_random_uuid(),
  fluxo text not null check (fluxo in
    ('mobilizacao_pessoa', 'desmobilizacao_pessoa', 'mobilizacao_empresa')),

  -- Chave natural e ESTÁVEL do passo. É por ela que a instância se liga ao
  -- catálogo, que `depende_de` aponta e que a recarga da planilha faz upsert.
  -- Renomear o título é livre; renomear o código quebra processos em curso.
  codigo text not null,
  ordem int not null,
  titulo text not null,
  descricao text,                     -- o "como fazer" do passo

  -- Predecessor. NULL = etapa raiz, com data informada na abertura.
  depende_de text,
  sla_dias_uteis int check (sla_dias_uteis is null or sla_dias_uteis >= 0),

  -- Responsável padrão. A planilha traz nome solto ("Edijane", "Ivone"); o
  -- papel cobre o caso "é da TI", sem amarrar numa pessoa que sai de férias.
  -- Sem nenhum dos dois a etapa nasce órfã e cai na coluna "sem responsável"
  -- do quadro — que é justamente o que precisa aparecer, não sumir.
  responsavel_id uuid references public.colaboradores(id),
  responsavel_papel text,

  obrigatoria boolean not null default true,

  -- Condição sobre os campos do processo. É o que permite UMA lista de etapas
  -- atender "Nova mobilização" e "Movimentação de profissional" sem duplicar o
  -- fluxo: {"movimento": ["Nova mobilização"]} cria a etapa só nesse caso.
  -- Vazio = sempre cria.
  condicao jsonb not null default '{}'::jsonb,

  ativo boolean not null default true,
  updated_at timestamptz not null default now(),

  constraint mobilizacao_catalogo_chave unique (fluxo, codigo),
  -- Uma etapa não pode depender de si mesma. Ciclos maiores são barrados na
  -- tela (lib/catalogo.js, testável) e na instanciação, que aborta em vez de
  -- gerar processo travado.
  constraint mobilizacao_catalogo_sem_auto_dep check (depende_de is null or depende_de <> codigo)
);

create index if not exists mobilizacao_catalogo_fluxo
  on public.mobilizacao_catalogo_etapas (fluxo, ordem);

-- ----------------------------------------------------------------------------
-- 2) Processos — o envelope (uma linha da planilha)
-- ----------------------------------------------------------------------------
create sequence if not exists public.mobilizacao_numero_seq;

create table if not exists public.mobilizacao_processos (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null default nextval('public.mobilizacao_numero_seq'),
  fluxo text not null check (fluxo in
    ('mobilizacao_pessoa', 'desmobilizacao_pessoa', 'mobilizacao_empresa')),

  titulo text not null,

  -- Vocabulário LITERAL da planilha (coluna STATUS PROCESSO MOBILIZAÇÃO).
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'finalizado', 'cancelado')),

  -- A planilha traz gente que ainda vai entrar na empresa, então o vínculo com
  -- colaboradores é opcional e o NOME fica congelado na linha.
  profissional_id uuid references public.colaboradores(id),
  profissional_nome text,

  -- As colunas por que o time filtra e agrupa hoje.
  empresa_phd text,
  cliente_phd text,
  cliente_final text,
  local_obra text,
  cod_ct text,
  cod_phd text,
  coo_phd text,
  ger_phd text,
  contrato text,

  -- Data-base: de onde partem as etapas raiz. Em MOB.PESSOAS é a abertura do
  -- chamado; em MOB.EMPRESAS, o e-mail de novo contrato.
  data_base date,
  observacoes text,
  campos jsonb not null default '{}'::jsonb,   -- o resto da planilha, sem virar coluna

  solicitante_id uuid references public.colaboradores(id),
  responsavel_id uuid references public.colaboradores(id),

  -- Rastro da origem.
  origem text not null default 'manual' check (origem in ('adm', 'manual', 'planilha')),
  origem_chamado_id uuid references public.chamados_adm(id) on delete set null,
  carga_chave text,

  -- Materializados pelo trigger de recálculo: é o "está atrasado?" e o "4 de 11"
  -- sem varrer as etapas em toda listagem. Indicador que exige subconsulta por
  -- linha morre de lentidão assim que a base cresce.
  prazo_em date,
  etapas_total int not null default 0,
  etapas_concluidas int not null default 0,

  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  updated_at timestamptz not null default now()
);

-- Um chamado do Adm gera UM processo. Re-disparo (aprovação, correção manual,
-- reprocessamento) não duplica. Mesma ideia para a recarga da planilha.
create unique index if not exists mobilizacao_processos_origem_key
  on public.mobilizacao_processos (origem_chamado_id) where origem_chamado_id is not null;
create unique index if not exists mobilizacao_processos_carga_key
  on public.mobilizacao_processos (carga_chave) where carga_chave is not null;

create index if not exists mobilizacao_processos_status
  on public.mobilizacao_processos (status, criado_em desc);
create index if not exists mobilizacao_processos_resp
  on public.mobilizacao_processos (responsavel_id);
create index if not exists mobilizacao_processos_fluxo
  on public.mobilizacao_processos (fluxo, status);

-- ----------------------------------------------------------------------------
-- 3) Etapas instanciadas — SNAPSHOT do catálogo
--    Mudar o SLA de um passo amanhã não pode reescrever o prazo de processo que
--    já está rodando, nem apagar o passo de quem já o cumpriu. O vínculo com o
--    catálogo fica só para rastro.
-- ----------------------------------------------------------------------------
create table if not exists public.mobilizacao_etapas (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.mobilizacao_processos(id) on delete cascade,
  catalogo_id uuid references public.mobilizacao_catalogo_etapas(id) on delete set null,

  codigo text not null,
  ordem int not null,
  titulo text not null,
  descricao text,
  depende_de text,
  sla_dias_uteis int,

  responsavel_id uuid references public.colaboradores(id),

  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluida', 'dispensada')),

  data_prevista date,
  data_real date,
  dias_atraso int,          -- calculado; é a coluna que o time já olha na planilha

  observacao text,
  anexos jsonb not null default '[]'::jsonb,

  -- Trava da convivência com o Excel: marcada quando a mudança tem sessão de
  -- usuário. A recarga da planilha NÃO sobrescreve etapa marcada — senão o
  -- Excel apagaria o trabalho feito no portal.
  tocada_no_portal boolean not null default false,

  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint mobilizacao_etapas_chave unique (processo_id, codigo)
);

create index if not exists mobilizacao_etapas_processo
  on public.mobilizacao_etapas (processo_id, ordem);
create index if not exists mobilizacao_etapas_resp
  on public.mobilizacao_etapas (responsavel_id, status);
-- O índice dos indicadores e do filtro "atrasados".
create index if not exists mobilizacao_etapas_prazo
  on public.mobilizacao_etapas (status, data_prevista) where status <> 'concluida';

-- ----------------------------------------------------------------------------
-- 4) Histórico — só os gatilhos escrevem
--    Mesma razão do chamados_adm_eventos: histórico que a aplicação pode
--    reescrever não serve como histórico.
-- ----------------------------------------------------------------------------
create table if not exists public.mobilizacao_eventos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.mobilizacao_processos(id) on delete cascade,
  etapa_id uuid references public.mobilizacao_etapas(id) on delete set null,
  tipo text not null check (tipo in ('criado', 'status', 'atribuido', 'concluida', 'cancelado', 'carga')),
  autor_id uuid references public.colaboradores(id),   -- nulo em carga: nulo é honesto
  de text,
  para text,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mobilizacao_eventos_processo
  on public.mobilizacao_eventos (processo_id, created_at desc);

-- Falhas do gatilho do Adm. Existe para o módulo novo não poder derrubar a
-- abertura de chamado em silêncio: o erro é engolido e cai aqui.
create table if not exists public.mobilizacao_gatilho_falhas (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid,
  erro text,
  resolvido_em timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5) Recálculo — o coração do módulo
--    Mora no BANCO, não no cliente, porque o quadro grava por arrasto (um
--    UPDATE de uma coluna só). Se o encadeamento morasse na tela, qualquer
--    outro caminho — carga da planilha, correção manual, uma tela nova amanhã —
--    deixaria a etapa seguinte sem prazo para sempre, e calada.
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_recalcular(p_processo uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_total int;
  v_passo int;
  v_mudou boolean;
  v_base date;
  v_nova date;
  v_data_base date;
  r record;
begin
  select count(*) into v_total from public.mobilizacao_etapas where processo_id = p_processo;
  if v_total = 0 then
    update public.mobilizacao_processos
       set etapas_total = 0, etapas_concluidas = 0, prazo_em = null, updated_at = now()
     where id = p_processo;
    return;
  end if;

  select data_base into v_data_base from public.mobilizacao_processos where id = p_processo;

  -- Etapas RAIZ: data informada na abertura; se não veio, projeta da data-base
  -- do processo somando o SLA (0 na maioria — ver cabeçalho).
  update public.mobilizacao_etapas e
     set data_prevista = app_private.mob_dias_uteis_apos(v_data_base, coalesce(e.sla_dias_uteis, 0))
   where e.processo_id = p_processo
     and e.depende_de is null
     and e.data_prevista is null
     and v_data_base is not null;

  -- Etapas dependentes. Uma passada em ORDEM basta quando o catálogo está bem
  -- formado (predecessor sempre vem antes). O laço existe para o caso de ele
  -- não estar: sem ele, uma dependência apontando para etapa de ordem maior
  -- deixaria a data desatualizada e calada. Limite = nº de etapas, então um
  -- ciclo que tenha escapado da validação para, em vez de girar para sempre.
  for v_passo in 1..v_total loop
    v_mudou := false;
    for r in
      select e.id, e.depende_de, e.sla_dias_uteis, e.data_prevista
        from public.mobilizacao_etapas e
       where e.processo_id = p_processo and e.depende_de is not null
       order by e.ordem
    loop
      select coalesce(p.data_real, p.data_prevista) into v_base
        from public.mobilizacao_etapas p
       where p.processo_id = p_processo and p.codigo = r.depende_de;

      v_nova := case when v_base is null then null
                     else app_private.mob_dias_uteis_apos(v_base, coalesce(r.sla_dias_uteis, 0)) end;

      if v_nova is distinct from r.data_prevista then
        update public.mobilizacao_etapas set data_prevista = v_nova where id = r.id;
        v_mudou := true;
      end if;
    end loop;
    exit when not v_mudou;
  end loop;

  -- Atraso, na mesma conta da planilha: enquanto não concluiu, o relógio corre
  -- contra hoje. Dispensada não tem atraso — não era para acontecer.
  update public.mobilizacao_etapas e
     set dias_atraso = case
           when e.status = 'dispensada' then null
           when e.data_prevista is null then null
           else coalesce(e.data_real, current_date) - e.data_prevista
         end
   where e.processo_id = p_processo;

  -- Progresso e prazo do processo. Cancelado não volta a andar por cálculo.
  update public.mobilizacao_processos p
     set etapas_total = t.total,
         etapas_concluidas = t.feitas,
         prazo_em = t.prazo,
         status = case when p.status = 'cancelado' then 'cancelado'
                       when t.feitas >= t.total then 'finalizado'
                       else 'em_andamento' end,
         concluido_em = case when p.status <> 'cancelado' and t.feitas >= t.total
                             then coalesce(p.concluido_em, now()) else null end,
         updated_at = now()
    from (
      select count(*) as total,
             count(*) filter (where status in ('concluida', 'dispensada')) as feitas,
             max(data_prevista) filter (where status not in ('concluida', 'dispensada')) as prazo
        from public.mobilizacao_etapas where processo_id = p_processo
    ) t
   where p.id = p_processo;
end $$;
-- Sem grant para authenticated: quem chama são os gatilhos e as funções
-- SECURITY DEFINER deste arquivo, que já rodam como dono. Exposta, ela deixaria
-- qualquer logado reescrever data_prevista de processo alheio.
revoke all on function app_private.mob_recalcular(uuid) from public;
revoke execute on function app_private.mob_recalcular(uuid) from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6) Gatilhos das etapas
-- ----------------------------------------------------------------------------

-- BEFORE: carimba updated_at, fecha a data real ao concluir e marca a etapa
-- como "tocada no portal".
--
-- A marca só vale quando o CONTEÚDO da etapa mudou. Sem esse cuidado, o
-- recálculo (que escreve data_prevista em TODAS as etapas do processo) marcaria
-- passos que ninguém encostou, e a próxima carga da planilha deixaria de
-- atualizá-los.
create or replace function public.mobilizacao_etapa_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();

  if new.status in ('concluida', 'dispensada') and new.data_real is null then
    new.data_real := current_date;
  end if;
  if new.status not in ('concluida', 'dispensada') and old.status in ('concluida', 'dispensada') then
    new.data_real := null;   -- voltou para o quadro: a data real deixou de existir
  end if;

  if app_private.my_colaborador_id() is not null
     and (new.status is distinct from old.status
          or new.data_real is distinct from old.data_real
          or new.responsavel_id is distinct from old.responsavel_id
          or new.observacao is distinct from old.observacao) then
    new.tocada_no_portal := true;
  end if;

  return new;
end $$;

drop trigger if exists mobilizacao_etapa_before_trg on public.mobilizacao_etapas;
create trigger mobilizacao_etapa_before_trg
  before update on public.mobilizacao_etapas
  for each row execute function public.mobilizacao_etapa_before();

-- AFTER UPDATE OF status, data_real: recalcula o processo inteiro.
--
-- A lista de colunas do OF é o que impede a recursão: mob_recalcular escreve
-- data_prevista e dias_atraso, que não estão nela, então a própria escrita do
-- recálculo não redispara o gatilho.
create or replace function public.mobilizacao_etapa_apos()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_eu uuid := app_private.my_colaborador_id();
begin
  perform app_private.mob_recalcular(new.processo_id);

  if new.status is distinct from old.status then
    insert into public.mobilizacao_eventos (processo_id, etapa_id, tipo, autor_id, de, para, dados)
    values (new.processo_id, new.id,
            case when new.status = 'concluida' then 'concluida' else 'status' end,
            v_eu, old.status, new.status, jsonb_build_object('etapa', new.titulo));
  end if;

  return null;
end $$;

drop trigger if exists mobilizacao_etapa_apos_trg on public.mobilizacao_etapas;
create trigger mobilizacao_etapa_apos_trg
  after update of status, data_real on public.mobilizacao_etapas
  for each row execute function public.mobilizacao_etapa_apos();

-- Troca de responsável tem gatilho próprio: não mexe em prazo, só em histórico.
create or replace function public.mobilizacao_etapa_atribuida()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.responsavel_id is distinct from old.responsavel_id then
    insert into public.mobilizacao_eventos (processo_id, etapa_id, tipo, autor_id, de, para, dados)
    values (new.processo_id, new.id, 'atribuido', app_private.my_colaborador_id(),
            old.responsavel_id::text, new.responsavel_id::text,
            jsonb_build_object('etapa', new.titulo));
  end if;
  return null;
end $$;

drop trigger if exists mobilizacao_etapa_atribuida_trg on public.mobilizacao_etapas;
create trigger mobilizacao_etapa_atribuida_trg
  after update of responsavel_id on public.mobilizacao_etapas
  for each row execute function public.mobilizacao_etapa_atribuida();

-- INSERT em nível de STATEMENT: um processo com 11 etapas recalcula uma vez, e
-- não onze. Mesmo padrão de app_private.notif_adm_etapas_insert().
create or replace function public.mobilizacao_etapas_inseridas()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p uuid;
begin
  for p in select distinct processo_id from novas loop
    perform app_private.mob_recalcular(p);
  end loop;
  return null;
end $$;

drop trigger if exists mobilizacao_etapas_inseridas_trg on public.mobilizacao_etapas;
create trigger mobilizacao_etapas_inseridas_trg
  after insert on public.mobilizacao_etapas
  referencing new table as novas
  for each statement execute function public.mobilizacao_etapas_inseridas();

-- Mudar a data-base do processo reprojeta tudo.
create or replace function public.mobilizacao_processo_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists mobilizacao_processo_before_trg on public.mobilizacao_processos;
create trigger mobilizacao_processo_before_trg
  before update on public.mobilizacao_processos
  for each row execute function public.mobilizacao_processo_before();

create or replace function public.mobilizacao_processo_data_base()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Só as raízes sem data real são reprojetadas; o que já aconteceu não se move.
  update public.mobilizacao_etapas
     set data_prevista = app_private.mob_dias_uteis_apos(new.data_base, coalesce(sla_dias_uteis, 0))
   where processo_id = new.id and depende_de is null and data_real is null;
  perform app_private.mob_recalcular(new.id);
  return null;
end $$;

drop trigger if exists mobilizacao_processo_data_base_trg on public.mobilizacao_processos;
create trigger mobilizacao_processo_data_base_trg
  after update of data_base on public.mobilizacao_processos
  for each row execute function public.mobilizacao_processo_data_base();

create or replace function public.mobilizacao_catalogo_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists mobilizacao_catalogo_touch_trg on public.mobilizacao_catalogo_etapas;
create trigger mobilizacao_catalogo_touch_trg
  before update on public.mobilizacao_catalogo_etapas
  for each row execute function public.mobilizacao_catalogo_touch();

-- ----------------------------------------------------------------------------
-- 7) RLS
--
--    O módulo é aberto a todo logado — quadro, fila e indicadores são consulta
--    geral, como no Adm. Quem limita o CONTEÚDO é a policy: fora do time, cada
--    um vê os processos em que está envolvido.
--
--    mob_pode_ver_processo é SECURITY DEFINER pela mesma razão documentada no
--    Adm: sem isso a policy de processos consulta etapas, cuja policy consulta
--    processos de volta, e o Postgres aborta com recursão infinita.
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_pode_ver_processo(p_processo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mobilizacao_processos p
    where p.id = p_processo
      and (p.solicitante_id = app_private.my_colaborador_id()
        or p.responsavel_id = app_private.my_colaborador_id()
        or p.profissional_id = app_private.my_colaborador_id())
  ) or exists (
    select 1 from public.mobilizacao_etapas e
    where e.processo_id = p_processo and e.responsavel_id = app_private.my_colaborador_id()
  )
$$;
revoke all on function app_private.mob_pode_ver_processo(uuid) from public;
grant execute on function app_private.mob_pode_ver_processo(uuid) to authenticated;

alter table public.mobilizacao_catalogo_etapas enable row level security;
alter table public.mobilizacao_processos       enable row level security;
alter table public.mobilizacao_etapas          enable row level security;
alter table public.mobilizacao_eventos         enable row level security;
alter table public.mobilizacao_gatilho_falhas  enable row level security;

-- Catálogo: leitura livre porque a tela precisa do SLA para prever prazo antes
-- de gravar. Escrita, só o admin do Adm.
drop policy if exists mobilizacao_catalogo_select on public.mobilizacao_catalogo_etapas;
create policy mobilizacao_catalogo_select on public.mobilizacao_catalogo_etapas
  for select to authenticated using (true);

drop policy if exists mobilizacao_catalogo_write on public.mobilizacao_catalogo_etapas;
create policy mobilizacao_catalogo_write on public.mobilizacao_catalogo_etapas
  for all to authenticated
  using (app_private.is_adm_admin()) with check (app_private.is_adm_admin());

drop policy if exists mobilizacao_processos_select on public.mobilizacao_processos;
create policy mobilizacao_processos_select on public.mobilizacao_processos
  for select to authenticated
  using (app_private.is_adm_time() or app_private.mob_pode_ver_processo(id));

drop policy if exists mobilizacao_processos_insert on public.mobilizacao_processos;
create policy mobilizacao_processos_insert on public.mobilizacao_processos
  for insert to authenticated with check (app_private.is_adm_time());

drop policy if exists mobilizacao_processos_update on public.mobilizacao_processos;
create policy mobilizacao_processos_update on public.mobilizacao_processos
  for update to authenticated
  using (app_private.is_adm_time() or responsavel_id = app_private.my_colaborador_id())
  with check (app_private.is_adm_time() or responsavel_id = app_private.my_colaborador_id());

drop policy if exists mobilizacao_etapas_select on public.mobilizacao_etapas;
create policy mobilizacao_etapas_select on public.mobilizacao_etapas
  for select to authenticated
  using (app_private.is_adm_time() or app_private.mob_pode_ver_processo(processo_id));

drop policy if exists mobilizacao_etapas_insert on public.mobilizacao_etapas;
create policy mobilizacao_etapas_insert on public.mobilizacao_etapas
  for insert to authenticated with check (app_private.is_adm_time());

-- O responsável da etapa atualiza a etapa dele mesmo sem ser do time do Adm —
-- é o que permite TI, DP ou o gerente da obra fecharem o próprio passo.
drop policy if exists mobilizacao_etapas_update on public.mobilizacao_etapas;
create policy mobilizacao_etapas_update on public.mobilizacao_etapas
  for update to authenticated
  using (app_private.is_adm_time() or responsavel_id = app_private.my_colaborador_id())
  with check (app_private.is_adm_time() or responsavel_id = app_private.my_colaborador_id());

drop policy if exists mobilizacao_eventos_select on public.mobilizacao_eventos;
create policy mobilizacao_eventos_select on public.mobilizacao_eventos
  for select to authenticated
  using (app_private.is_adm_time() or app_private.mob_pode_ver_processo(processo_id));
-- Sem policy de insert/update/delete: só os gatilhos escrevem.

drop policy if exists mobilizacao_falhas_select on public.mobilizacao_gatilho_falhas;
create policy mobilizacao_falhas_select on public.mobilizacao_gatilho_falhas
  for select to authenticated using (app_private.is_adm_time());

drop policy if exists mobilizacao_falhas_update on public.mobilizacao_gatilho_falhas;
create policy mobilizacao_falhas_update on public.mobilizacao_gatilho_falhas
  for update to authenticated
  using (app_private.is_adm_time()) with check (app_private.is_adm_time());

-- ----------------------------------------------------------------------------
-- 8) Abertura de processo
--
--    RPC e não inserts pelo cliente porque processo sem etapas não serve para
--    nada, e o Adm já paga o preço do contrário: criarMobilizacaoComAdicionais
--    carrega um bloco inteiro de tratamento para "pai gravado e filhos pela
--    metade", justamente por não haver transação entre inserts pelo cliente.
-- ----------------------------------------------------------------------------

-- Condição do catálogo: {"movimento": ["Nova mobilização"]} contra os dados do
-- processo. Chave ausente nos dados = condição não atendida.
create or replace function app_private.mob_condicao_ok(p_cond jsonb, p_dados jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  if p_cond is null or p_cond = '{}'::jsonb then return true; end if;
  for k in select jsonb_object_keys(p_cond) loop
    if not (p_cond -> k ? coalesce(p_dados ->> k, '')) then return false; end if;
  end loop;
  return true;
end $$;

-- Núcleo da abertura, SEM checagem de permissão: é chamado pelo gatilho do
-- Administrativo, que roda em nome de QUEM ABRIU O CHAMADO — uma pessoa que
-- normalmente não é do time e não poderia inserir processo nenhum.
--
-- Fica em app_private e sem grant. A porta para o cliente é
-- public.mobilizacao_abrir, logo abaixo, que exige o time: sem essa separação,
-- SECURITY DEFINER passaria por cima da policy de insert e qualquer logado
-- criaria processo pela RPC.
create or replace function app_private.mob_abrir(
  p_fluxo text,
  p_dados jsonb,
  p_origem text default 'manual',
  p_origem_chamado uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_eu uuid := app_private.my_colaborador_id();
  v_titulo text;
  v_datas jsonb := coalesce(p_dados -> 'datas', '{}'::jsonb);
  v_qtd int;
begin
  if p_fluxo not in ('mobilizacao_pessoa', 'desmobilizacao_pessoa', 'mobilizacao_empresa') then
    raise exception 'Fluxo desconhecido: %', p_fluxo;
  end if;

  -- Idempotência: o gatilho do Adm pode disparar de novo (aprovação, correção,
  -- reprocessamento) e não pode gerar um segundo processo.
  if p_origem_chamado is not null then
    select id into v_id from public.mobilizacao_processos
     where origem_chamado_id = p_origem_chamado;
    if v_id is not null then return v_id; end if;
  end if;

  -- Mesma defesa para a recarga da planilha: rodar o import duas vezes devolve
  -- o processo que já existe, em vez de criar um segundo.
  if nullif(btrim(p_dados ->> 'carga_chave'), '') is not null then
    select id into v_id from public.mobilizacao_processos
     where carga_chave = btrim(p_dados ->> 'carga_chave');
    if v_id is not null then return v_id; end if;
  end if;

  v_titulo := coalesce(
    nullif(btrim(p_dados ->> 'titulo'), ''),
    nullif(btrim(p_dados ->> 'profissional_nome'), ''),
    nullif(btrim(p_dados ->> 'cliente_phd'), ''),
    'Processo sem identificação'
  );

  insert into public.mobilizacao_processos (
    fluxo, titulo, profissional_id, profissional_nome,
    empresa_phd, cliente_phd, cliente_final, local_obra, cod_ct, cod_phd,
    coo_phd, ger_phd, contrato, data_base, observacoes, campos,
    solicitante_id, responsavel_id, origem, origem_chamado_id, carga_chave
  ) values (
    p_fluxo, v_titulo,
    nullif(p_dados ->> 'profissional_id', '')::uuid,
    nullif(btrim(p_dados ->> 'profissional_nome'), ''),
    nullif(btrim(p_dados ->> 'empresa_phd'), ''),
    nullif(btrim(p_dados ->> 'cliente_phd'), ''),
    nullif(btrim(p_dados ->> 'cliente_final'), ''),
    nullif(btrim(p_dados ->> 'local_obra'), ''),
    nullif(btrim(p_dados ->> 'cod_ct'), ''),
    nullif(btrim(p_dados ->> 'cod_phd'), ''),
    nullif(btrim(p_dados ->> 'coo_phd'), ''),
    nullif(btrim(p_dados ->> 'ger_phd'), ''),
    nullif(btrim(p_dados ->> 'contrato'), ''),
    nullif(p_dados ->> 'data_base', '')::date,
    nullif(btrim(p_dados ->> 'observacoes'), ''),
    coalesce(p_dados -> 'campos', '{}'::jsonb),
    coalesce(nullif(p_dados ->> 'solicitante_id', '')::uuid, v_eu),
    nullif(p_dados ->> 'responsavel_id', '')::uuid,
    p_origem, p_origem_chamado,
    nullif(btrim(p_dados ->> 'carga_chave'), '')
  ) returning id into v_id;

  insert into public.mobilizacao_etapas (
    processo_id, catalogo_id, codigo, ordem, titulo, descricao,
    depende_de, sla_dias_uteis, responsavel_id, data_prevista
  )
  select v_id, c.id, c.codigo, c.ordem, c.titulo, c.descricao,
         c.depende_de, c.sla_dias_uteis, c.responsavel_id,
         nullif(v_datas ->> c.codigo, '')::date
    from public.mobilizacao_catalogo_etapas c
   where c.fluxo = p_fluxo and c.ativo
     and app_private.mob_condicao_ok(c.condicao, p_dados)
   order by c.ordem;

  get diagnostics v_qtd = row_count;

  insert into public.mobilizacao_eventos (processo_id, tipo, autor_id, para, dados)
  values (v_id, 'criado', v_eu, p_fluxo,
          jsonb_build_object('origem', p_origem, 'etapas', v_qtd,
                             'catalogo_vazio', v_qtd = 0));

  -- Catálogo vazio NÃO é erro: é o estado real enquanto o fluxo não foi
  -- cadastrado, e o processo aparecendo sem passos é exatamente o aviso que o
  -- admin precisa ver. O insert acima não dispara o gatilho de statement
  -- quando não insere nada, então o recálculo vai daqui.
  perform app_private.mob_recalcular(v_id);

  return v_id;
end $$;
revoke all on function app_private.mob_abrir(text, jsonb, text, uuid) from public;
revoke execute on function app_private.mob_abrir(text, jsonb, text, uuid) from anon, authenticated;

-- Porta do cliente: só o time abre processo, e sempre manual. Origem e chamado
-- não são parâmetro de propósito — deixá-los abertos permitiria forjar um
-- processo 'adm' amarrado a um chamado alheio.
create or replace function public.mobilizacao_abrir(p_fluxo text, p_dados jsonb)
returns uuid language plpgsql security definer set search_path = '' as $fn$
begin
  if not app_private.is_adm_time() then
    raise exception 'Só o time do Administrativo pode abrir um processo de mobilização.'
      using errcode = 'insufficient_privilege';
  end if;
  return app_private.mob_abrir(p_fluxo, p_dados, 'manual', null);
end $fn$;
revoke all on function public.mobilizacao_abrir(text, jsonb) from public;
revoke execute on function public.mobilizacao_abrir(text, jsonb) from anon;
grant execute on function public.mobilizacao_abrir(text, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 9) Cancelamento em cascata (chamado reprovado/cancelado no Adm)
-- ----------------------------------------------------------------------------
create or replace function public.mobilizacao_cancelar(p_processo uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- DEFINER passa por cima da RLS, então a permissão é conferida aqui: o
  -- espelho exato da policy de update de mobilizacao_processos.
  if not (app_private.is_adm_time() or exists (
        select 1 from public.mobilizacao_processos p
         where p.id = p_processo and p.responsavel_id = app_private.my_colaborador_id())) then
    raise exception 'Você não tem permissão para cancelar este processo.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.mobilizacao_processos
     set status = 'cancelado', updated_at = now()
   where id = p_processo and status <> 'cancelado';

  insert into public.mobilizacao_eventos (processo_id, tipo, autor_id, para, dados)
  values (p_processo, 'cancelado', app_private.my_colaborador_id(), 'cancelado',
          jsonb_build_object('motivo', p_motivo));
end $$;
revoke all on function public.mobilizacao_cancelar(uuid, text) from public;
revoke execute on function public.mobilizacao_cancelar(uuid, text) from anon;
grant execute on function public.mobilizacao_cancelar(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 10) Carga da planilha
--
--     A REGRA MAIS IMPORTANTE DA CONVIVÊNCIA COM O EXCEL mora aqui, e num
--     lugar só: a recarga NÃO sobrescreve etapa que alguém já tocou pelo
--     portal. Sem isso, o próximo import apagaria o trabalho dos responsáveis.
--
--     Repare no que a carga NÃO traz: data_prevista. As datas previstas da
--     planilha foram calculadas com a regra antiga (MOB.PESSOAS somava dias
--     CORRIDOS), e importá-las deixaria o histórico com duas réguas
--     conflitantes. O que entra é o que de fato aconteceu — data real e
--     situação —, e a previsão é recalculada pela regra nova, igual para todos.
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_carga_etapa(
  p_processo uuid,
  p_codigo text,
  p_status text,
  p_data_real date default null
) returns void language plpgsql security definer set search_path = '' as $carga$
begin
  update public.mobilizacao_etapas
     set status = p_status,
         data_real = p_data_real
   where processo_id = p_processo
     and codigo = p_codigo
     and tocada_no_portal is false;
end $carga$;
revoke all on function app_private.mob_carga_etapa(uuid, text, text, date) from public;
revoke execute on function app_private.mob_carga_etapa(uuid, text, text, date) from anon, authenticated;

-- Uma linha do import = uma chamada. As etapas viajam dentro do próprio jsonb
-- ("etapas": {"exames": "2026-01-05", ...}), o que tira do SQL gerado onze
-- `perform` repetidos por processo — metade do arquivo era boilerplate.
--
-- `status` só é aplicado quando é 'cancelado': os outros dois o recálculo
-- deduz das etapas, e mandá-los explicitamente abriria espaço para o import
-- discordar do que as etapas dizem.
create or replace function app_private.mob_carga_processo(p_fluxo text, p_dados jsonb)
returns uuid language plpgsql security definer set search_path = '' as $cargaproc$
declare
  v_id uuid;
  k text;
begin
  v_id := app_private.mob_abrir(p_fluxo, p_dados - 'etapas' - 'status', 'planilha', null);

  for k in select jsonb_object_keys(coalesce(p_dados -> 'etapas', '{}'::jsonb)) loop
    perform app_private.mob_carga_etapa(
      v_id, k, 'concluida', nullif(p_dados -> 'etapas' ->> k, '')::date);
  end loop;

  if p_dados ->> 'status' = 'cancelado' then
    update public.mobilizacao_processos set status = 'cancelado' where id = v_id;
  end if;

  return v_id;
end $cargaproc$;
revoke all on function app_private.mob_carga_processo(text, jsonb) from public;
revoke execute on function app_private.mob_carga_processo(text, jsonb) from anon, authenticated;

-- Abertura pela carga: mesma porta do gatilho, com origem 'planilha'. Não é
-- exposta ao cliente — o import roda no SQL editor, como todos os seeds do
-- repositório.
create or replace function app_private.mob_abrir_carga(p_fluxo text, p_dados jsonb)
returns uuid language sql security definer set search_path = '' as $cargaabrir$
  select app_private.mob_abrir(p_fluxo, p_dados, 'planilha', null)
$cargaabrir$;
revoke all on function app_private.mob_abrir_carga(text, jsonb) from public;
revoke execute on function app_private.mob_abrir_carga(text, jsonb) from anon, authenticated;

notify pgrst, 'reload schema';
