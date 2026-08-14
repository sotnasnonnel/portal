-- Migration: administrativo — fluxos, eventos, quadro e satisfação
-- (projeto bogsuuhrgvopzgcceoqz) — continuação de supabase_migration_administrativo.sql
--
-- Reúne, na ordem em que foram aplicadas, as migrações posteriores à criação do
-- módulo. Cada bloco é idempotente e pode ser reexecutado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Lista de pessoas para os seletores (RPC ampliada)
--
-- Antes só respondia ao admin do Adm. O seletor de profissional da mobilização é
-- usado por QUALQUER solicitante, e a policy colaboradores_select só libera a
-- própria linha e a equipe — sem isto o dropdown viria quase vazio, calado.
-- Expõe apenas nome e o nome do superior (que preenche o campo "Gestor").
-- ----------------------------------------------------------------------------
drop function if exists public.chamados_adm_pessoas();

create function public.chamados_adm_pessoas()
returns table(id uuid, nome text, superior_id uuid, superior_nome text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.superior_id, s.nome
  from public.colaboradores c
  left join public.colaboradores s on s.id = c.superior_id
  where c.ativo is not false
  order by c.nome
$$;
revoke all on function public.chamados_adm_pessoas() from public;
grant execute on function public.chamados_adm_pessoas() to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Fluxos de aprovação, no molde do DP (solicitacoes_rh_fluxos)
--
-- Granularidade por CLASSE (10) e não por serviço (26): por serviço seria
-- cadastro demais para manter. classe = '' é o fluxo GERAL do solicitante.
-- Serviços com gasto NÃO usam esta tabela — a cadeia deles sai do motor de
-- alçadas por valor (config/alcadas.js), como no Financeiro.
-- ----------------------------------------------------------------------------
create table if not exists public.chamados_adm_fluxos (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.colaboradores(id) on delete cascade,
  classe text not null default '',            -- '' = fluxo geral
  aprovadores uuid[] not null default '{}',   -- ordenado
  updated_at timestamptz not null default now(),
  unique (solicitante_id, classe)
);
create index if not exists chamados_adm_fluxos_solicitante_idx
  on public.chamados_adm_fluxos (solicitante_id);

alter table public.chamados_adm_fluxos enable row level security;

drop policy if exists chamados_adm_fluxos_select on public.chamados_adm_fluxos;
create policy chamados_adm_fluxos_select on public.chamados_adm_fluxos
for select to authenticated
using ( solicitante_id = app_private.my_colaborador_id() or app_private.is_adm_time() );

drop policy if exists chamados_adm_fluxos_write on public.chamados_adm_fluxos;
create policy chamados_adm_fluxos_write on public.chamados_adm_fluxos
for all to authenticated
using ( app_private.is_adm_admin() ) with check ( app_private.is_adm_admin() );

-- ----------------------------------------------------------------------------
-- 3) Aprovador enxerga a CADEIA inteira, não só a própria etapa
--
-- Sem isto, a regra "só é a sua vez se não houver etapa pendente antes da sua"
-- ficava inócua: o segundo aprovador calculava o mínimo sobre a única linha que
-- enxergava (a dele) e o chamado aparecia antes de o primeiro decidir.
-- ----------------------------------------------------------------------------
drop policy if exists chamados_adm_etapas_select on public.chamados_adm_etapas;
create policy chamados_adm_etapas_select on public.chamados_adm_etapas
for select to authenticated
using (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_adm_time()
  or app_private.adm_e_solicitante(chamado_id)
  or app_private.adm_e_aprovador(chamado_id)
);

-- ----------------------------------------------------------------------------
-- 4) Dois status novos, para o quadro ter colunas que distingam o trabalho
--
--   aberto                 -> liberado, ninguém assumiu
--   em_atendimento         -> alguém assumiu e está tocando
--   aguardando_solicitante -> o Adm perguntou e espera resposta
--
-- O prazo NÃO pausa em nenhum deles: o SLA mede o tempo total até resolver.
-- ----------------------------------------------------------------------------
alter table public.chamados_adm drop constraint if exists chamados_adm_status_check;
alter table public.chamados_adm add constraint chamados_adm_status_check
  check (status in ('aguardando_aprovacao', 'aberto', 'em_atendimento',
                    'aguardando_solicitante', 'fechado', 'reprovado', 'cancelado'));

-- ----------------------------------------------------------------------------
-- 5) Histórico de eventos — gravado por TRIGGER, nunca pela aplicação
--
-- Sem policy de INSERT/UPDATE/DELETE de propósito: só os triggers escrevem, e
-- eles são SECURITY DEFINER. Histórico que a aplicação pode reescrever não serve
-- como histórico — e se dependesse do código da tela, qualquer caminho
-- alternativo (correção manual, painel do Supabase) deixaria buraco.
-- ----------------------------------------------------------------------------
create table if not exists public.chamados_adm_eventos (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados_adm(id) on delete cascade,
  tipo text not null check (tipo in ('criado','status','atribuido','aprovado','reprovado','avaliado')),
  autor_id uuid references public.colaboradores(id),
  de text,
  para text,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chamados_adm_eventos_chamado_idx
  on public.chamados_adm_eventos (chamado_id, created_at);

alter table public.chamados_adm_eventos enable row level security;

drop policy if exists chamados_adm_eventos_select on public.chamados_adm_eventos;
create policy chamados_adm_eventos_select on public.chamados_adm_eventos
for select to authenticated
using (
  app_private.is_adm_time()
  or app_private.adm_e_solicitante(chamado_id)
  or app_private.adm_e_atendente(chamado_id)
  or app_private.adm_e_aprovador(chamado_id)
);

-- O autor sai de my_colaborador_id(): numa mudança feita sem sessão (carga,
-- correção manual) fica nulo — e nulo é honesto, melhor que atribuir a alguém.
create or replace function public.chamados_adm_evento_criado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chamados_adm_eventos (chamado_id, tipo, autor_id, para, dados)
  values (new.id, 'criado', app_private.my_colaborador_id(), new.status,
          jsonb_build_object('assunto', new.assunto));
  return null;
end $$;

drop trigger if exists chamados_adm_evento_criado_trg on public.chamados_adm;
create trigger chamados_adm_evento_criado_trg
  after insert on public.chamados_adm
  for each row execute function public.chamados_adm_evento_criado();

-- Um UPDATE pode mexer em várias colunas de uma vez; cada mudança relevante vira
-- o seu próprio evento, e update que não muda nenhuma delas não gera nada.
create or replace function public.chamados_adm_evento_mudanca()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_autor uuid := app_private.my_colaborador_id();
begin
  if new.status is distinct from old.status then
    insert into public.chamados_adm_eventos (chamado_id, tipo, autor_id, de, para, dados)
    values (new.id, 'status', v_autor, old.status, new.status,
            case when new.status = 'fechado' and new.resolucao is not null
                 then jsonb_build_object('resolucao', new.resolucao) else '{}'::jsonb end);
  end if;

  if new.atendente_id is distinct from old.atendente_id then
    insert into public.chamados_adm_eventos (chamado_id, tipo, autor_id, de, para)
    values (new.id, 'atribuido', v_autor, old.atendente_id::text, new.atendente_id::text);
  end if;

  return null;
end $$;

drop trigger if exists chamados_adm_evento_mudanca_trg on public.chamados_adm;
create trigger chamados_adm_evento_mudanca_trg
  after update on public.chamados_adm
  for each row execute function public.chamados_adm_evento_mudanca();

-- A decisão do aprovador guarda a justificativa: é o que o solicitante precisa
-- ler quando o pedido é recusado.
create or replace function public.chamados_adm_evento_etapa()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('aprovada','reprovada') then
    insert into public.chamados_adm_eventos (chamado_id, tipo, autor_id, para, dados)
    values (new.chamado_id,
            case when new.status = 'aprovada' then 'aprovado' else 'reprovado' end,
            new.aprovador_id, new.status,
            jsonb_build_object('ordem', new.ordem, 'justificativa', new.justificativa));
  end if;
  return null;
end $$;

drop trigger if exists chamados_adm_evento_etapa_trg on public.chamados_adm_etapas;
create trigger chamados_adm_evento_etapa_trg
  after update on public.chamados_adm_etapas
  for each row execute function public.chamados_adm_evento_etapa();

create or replace function public.chamados_adm_evento_avaliacao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chamados_adm_eventos (chamado_id, tipo, autor_id, para, dados)
  values (new.chamado_id, 'avaliado', app_private.my_colaborador_id(), new.nota::text,
          jsonb_build_object('comentario', new.comentario));
  return null;
end $$;

drop trigger if exists chamados_adm_evento_avaliacao_trg on public.chamados_adm_avaliacoes;
create trigger chamados_adm_evento_avaliacao_trg
  after insert on public.chamados_adm_avaliacoes
  for each row execute function public.chamados_adm_evento_avaliacao();

-- ----------------------------------------------------------------------------
-- 6) Pesquisa de satisfação: de escala qualitativa para 1 a 5 ESTRELAS
--
-- O objetivo passou a ser medir satisfação — média por serviço, por período.
-- Texto não se soma; número sim. Vira smallint (e não texto com número dentro)
-- para `avg(nota)` funcionar sem conversão.
-- ----------------------------------------------------------------------------
alter table public.chamados_adm_avaliacoes
  drop constraint if exists chamados_adm_avaliacoes_nota_check;
alter table public.chamados_adm_avaliacoes
  drop constraint if exists chamados_adm_avaliacoes_comentario_obrigatorio;

alter table public.chamados_adm_avaliacoes
  alter column nota type smallint using nullif(regexp_replace(nota::text, '\D', '', 'g'), '')::smallint;

alter table public.chamados_adm_avaliacoes
  add constraint chamados_adm_avaliacoes_nota_check check (nota between 1 and 5);

-- Equivalente ao "Regular para baixo" do POP 9.2: nota até 3 exige comentário,
-- que é onde mora a informação útil de uma pesquisa de satisfação.
alter table public.chamados_adm_avaliacoes
  add constraint chamados_adm_avaliacoes_comentario_obrigatorio
  check (nota >= 4 or coalesce(btrim(comentario), '') <> '');

comment on column public.chamados_adm_avaliacoes.nota is
  'Satisfação de 1 a 5 estrelas. Até 3 exige comentário.';

notify pgrst, 'reload schema';
