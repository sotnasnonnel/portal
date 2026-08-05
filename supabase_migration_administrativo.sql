-- Migration: administrativo (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Módulo Administrativo — chamados no molde do Milldesk, conforme o
-- POP-ADM-001.00 ("Abertura de Chamados ADM", rev. 0, 03/10/2025), que está em
-- referencia/. Tabelas NOVAS e isoladas; nada do DP/Financeiro é reaproveitado.
--
-- O que o POP determina e virou regra aqui:
--   * Passo 5  — o chamado nasce com um atendente atribuído (roteamento por
--                serviço, em chamados_adm_config).
--   * Passo 6  — a lista mostra Criação, Análise e Vencimento SLA: são três
--                marcos distintos, por isso três colunas de data.
--   * Passo 7  — reabertura permitida por 3 dias após o fechamento (trigger).
--   * Passo 8  — comunicações sem limite, com anexo e marcação de lido.
--   * Passo 9  — avaliação obrigatória: sem avaliar o chamado fechado o
--                solicitante não abre outro (checado na policy de INSERT).
--   * Passo 10 — só os chamados COM alçada passam por aprovação, e o SLA só
--                começa a contar depois dela (analise_em).
--
-- A lógica de fluxo (montar etapas, avançar status, calcular vencimento) fica
-- em código, como no Financeiro. Aqui ficam só as garantias que não podem
-- depender do front: as duas travas do POP (avaliação e janela de reabertura).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Papel do time do Administrativo (mesmo padrão de financeiro_role)
-- ----------------------------------------------------------------------------
alter table public.colaboradores
  add column if not exists administrativo_role text
  check (administrativo_role in ('atendente', 'admin'));

create or replace function app_private.is_adm_time()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and administrativo_role in ('atendente', 'admin')
  )
$$;
revoke all on function app_private.is_adm_time() from public;
grant execute on function app_private.is_adm_time() to authenticated;

create or replace function app_private.is_adm_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and administrativo_role = 'admin'
  )
$$;
revoke all on function app_private.is_adm_admin() from public;
grant execute on function app_private.is_adm_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- 1) Configuração por serviço: roteamento, SLA e alçada
--    Os valores (quem atende, quantas horas, quem aprova) não estão no POP —
--    são cadastrados pelo admin do Adm em vez de ficarem no código.
--    A chave é o par (classe, servico) do catálogo em config/administrativo.js;
--    o slug de serviço sozinho não serve, "outras-demandas" se repete.
-- ----------------------------------------------------------------------------
create table if not exists public.chamados_adm_config (
  id uuid primary key default gen_random_uuid(),
  classe text not null,
  servico text not null,
  atendente_id uuid references public.colaboradores(id),   -- técnico padrão (Passo 5)
  sla_horas int,                                            -- prazo após a aprovação (Passo 6/10)
  exige_aprovacao boolean not null default false,           -- "chamados que tiverem alçada" (Passo 10)
  aprovadores uuid[] not null default '{}',                 -- cadeia ordenada, quando exige
  updated_at timestamptz not null default now(),
  unique (classe, servico)
);

-- ----------------------------------------------------------------------------
-- 2) Envelope do chamado
-- ----------------------------------------------------------------------------
create table if not exists public.chamados_adm (
  id uuid primary key default gen_random_uuid(),
  numero bigint,                                   -- ID curto exibido na lista (#26)
  classe text not null,
  servico text not null,
  assunto text not null,                           -- congelado: é o rótulo do serviço na abertura
  natureza text not null
    check (natureza in ('incidente', 'materiais', 'solicitacao_informacao', 'solicitacao_servico')),
  descricao text not null,
  campos jsonb not null default '{}'::jsonb,       -- "Campos extras", variam por serviço
  anexos jsonb not null default '[]'::jsonb,       -- [{path, nome}] — mesmo formato do DP

  solicitante_id uuid not null references public.colaboradores(id),
  atendente_id uuid references public.colaboradores(id),
  local text,
  departamento text default 'Administrativo',
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta')),

  -- 'aguardando_aprovacao' só existe quando o serviço tem alçada; sem alçada o
  -- chamado já nasce 'aberto' e o SLA começa na criação.
  status text not null default 'aberto'
    check (status in ('aguardando_aprovacao', 'aberto', 'fechado', 'reprovado', 'cancelado')),
  exige_aprovacao boolean not null default false,  -- congelado na abertura (config pode mudar depois)

  criado_em timestamptz not null default now(),    -- coluna "Criação"
  analise_em timestamptz,                          -- coluna "Análise" = decisão do gerente
  sla_vence_em timestamptz,                        -- coluna "Vencimento SLA"
  fechado_em timestamptz,
  resolucao text,                                  -- texto do atendente ao fechar (Passo 9)
  reaberto_em timestamptz,
  reaberturas int not null default 0,
  updated_at timestamptz
);

-- Numeração curta e estável (#1, #2, ...), como no DP e no Financeiro.
create sequence if not exists public.chamados_adm_numero_seq
  owned by public.chamados_adm.numero;
alter table public.chamados_adm
  alter column numero set default nextval('public.chamados_adm_numero_seq');
alter table public.chamados_adm alter column numero set not null;
create unique index if not exists chamados_adm_numero_key on public.chamados_adm (numero);

create index if not exists chamados_adm_solicitante_idx on public.chamados_adm (solicitante_id);
create index if not exists chamados_adm_atendente_idx on public.chamados_adm (atendente_id);
-- As duas listas do POP (abertas x fechadas) filtram por status o tempo todo.
create index if not exists chamados_adm_status_idx on public.chamados_adm (status, criado_em desc);

-- ----------------------------------------------------------------------------
-- 3) Etapas de aprovação (só para serviço com alçada) — forma do Financeiro
-- ----------------------------------------------------------------------------
create table if not exists public.chamados_adm_etapas (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados_adm(id) on delete cascade,
  ordem int not null,
  aprovador_id uuid not null references public.colaboradores(id),
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'reprovada')),
  justificativa text,
  decidido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chamados_adm_etapas_chamado_idx on public.chamados_adm_etapas (chamado_id);

-- ----------------------------------------------------------------------------
-- 4) Comunicações (Passo 8) — thread sem limite, com anexo
--    O "não lido" é por lado (solicitante x atendente), que é o que o POP
--    mostra: o ícone de pendência aparece para quem ainda não abriu.
-- ----------------------------------------------------------------------------
create table if not exists public.chamados_adm_interacoes (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados_adm(id) on delete cascade,
  autor_id uuid not null references public.colaboradores(id),
  mensagem text not null,
  anexos jsonb not null default '[]'::jsonb,
  interna boolean not null default false,          -- nota interna: não vai para o solicitante
  lida_solicitante_em timestamptz,
  lida_atendente_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chamados_adm_interacoes_chamado_idx
  on public.chamados_adm_interacoes (chamado_id, created_at);

-- ----------------------------------------------------------------------------
-- 5) Pesquisa de satisfação (Passo 9) — uma por chamado
-- ----------------------------------------------------------------------------
create table if not exists public.chamados_adm_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null unique references public.chamados_adm(id) on delete cascade,
  nota text not null
    check (nota in ('otimo', 'bom', 'regular', 'ruim', 'pessimo', 'nao_resolvido')),
  comentario text,
  avaliado_em timestamptz not null default now(),
  -- "Regular para baixo é obrigatório registrar o comentário" (POP 9.2).
  constraint chamados_adm_avaliacoes_comentario_obrigatorio
    check (nota in ('otimo', 'bom') or coalesce(btrim(comentario), '') <> '')
);

-- ============================================================================
-- Travas do POP que não podem depender do front
-- ============================================================================

-- 9.1 — sem avaliar o chamado fechado, o solicitante não abre outro.
create or replace function app_private.adm_tem_avaliacao_pendente()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.chamados_adm c
    left join public.chamados_adm_avaliacoes a on a.chamado_id = c.id
    where c.solicitante_id = app_private.my_colaborador_id()
      and c.status = 'fechado'
      and a.id is null
  )
$$;
revoke all on function app_private.adm_tem_avaliacao_pendente() from public;
grant execute on function app_private.adm_tem_avaliacao_pendente() to authenticated;

-- 7.3 — reabertura só nos 3 dias seguintes ao fechamento.
create or replace function public.chamados_adm_guarda_reabertura()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'fechado' and new.status <> 'fechado' then
    if old.fechado_em is null or old.fechado_em < now() - interval '3 days' then
      raise exception 'Prazo de 3 dias para reabrir este chamado expirou.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists chamados_adm_guarda_reabertura_trg on public.chamados_adm;
create trigger chamados_adm_guarda_reabertura_trg
  before update on public.chamados_adm
  for each row execute function public.chamados_adm_guarda_reabertura();

-- ============================================================================
-- RLS — participa quem é solicitante, atendente, aprovador ou time do Adm.
-- ============================================================================
alter table public.chamados_adm enable row level security;
alter table public.chamados_adm_etapas enable row level security;
alter table public.chamados_adm_interacoes enable row level security;
alter table public.chamados_adm_avaliacoes enable row level security;
alter table public.chamados_adm_config enable row level security;

-- ---- Envelope ----
drop policy if exists chamados_adm_select on public.chamados_adm;
create policy chamados_adm_select on public.chamados_adm
for select to authenticated
using (
  solicitante_id = app_private.my_colaborador_id()
  or atendente_id = app_private.my_colaborador_id()
  or app_private.is_adm_time()
  or exists (select 1 from public.chamados_adm_etapas e
             where e.chamado_id = id and e.aprovador_id = app_private.my_colaborador_id())
);

-- Abrir chamado é para todo mundo logado — desde que não haja avaliação pendente.
drop policy if exists chamados_adm_insert on public.chamados_adm;
create policy chamados_adm_insert on public.chamados_adm
for insert to authenticated
with check (
  solicitante_id = app_private.my_colaborador_id()
  and not app_private.adm_tem_avaliacao_pendente()
);

drop policy if exists chamados_adm_update on public.chamados_adm;
create policy chamados_adm_update on public.chamados_adm
for update to authenticated
using (
  solicitante_id = app_private.my_colaborador_id()
  or atendente_id = app_private.my_colaborador_id()
  or app_private.is_adm_time()
  or exists (select 1 from public.chamados_adm_etapas e
             where e.chamado_id = id and e.aprovador_id = app_private.my_colaborador_id())
)
with check (
  solicitante_id = app_private.my_colaborador_id()
  or atendente_id = app_private.my_colaborador_id()
  or app_private.is_adm_time()
  or exists (select 1 from public.chamados_adm_etapas e
             where e.chamado_id = id and e.aprovador_id = app_private.my_colaborador_id())
);

-- ---- Etapas ----
drop policy if exists chamados_adm_etapas_select on public.chamados_adm_etapas;
create policy chamados_adm_etapas_select on public.chamados_adm_etapas
for select to authenticated
using (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.is_adm_time()
  or exists (select 1 from public.chamados_adm c
             where c.id = chamado_id and c.solicitante_id = app_private.my_colaborador_id())
);

-- Quem decide é o aprovador da etapa; o time do Adm mantém a cadeia.
drop policy if exists chamados_adm_etapas_write on public.chamados_adm_etapas;
create policy chamados_adm_etapas_write on public.chamados_adm_etapas
for all to authenticated
using ( aprovador_id = app_private.my_colaborador_id() or app_private.is_adm_time() )
with check ( aprovador_id = app_private.my_colaborador_id() or app_private.is_adm_time() );

-- ---- Comunicações ----
-- Nota interna some para o solicitante: o filtro está na própria policy, não no
-- front, senão bastaria abrir o DevTools para lê-la.
drop policy if exists chamados_adm_interacoes_select on public.chamados_adm_interacoes;
create policy chamados_adm_interacoes_select on public.chamados_adm_interacoes
for select to authenticated
using (
  app_private.is_adm_time()
  or exists (select 1 from public.chamados_adm c
             where c.id = chamado_id
               and c.atendente_id = app_private.my_colaborador_id())
  or (
    interna = false
    and exists (select 1 from public.chamados_adm c
                where c.id = chamado_id
                  and c.solicitante_id = app_private.my_colaborador_id())
  )
);

drop policy if exists chamados_adm_interacoes_insert on public.chamados_adm_interacoes;
create policy chamados_adm_interacoes_insert on public.chamados_adm_interacoes
for insert to authenticated
with check (
  autor_id = app_private.my_colaborador_id()
  and (
    app_private.is_adm_time()
    or exists (select 1 from public.chamados_adm c
               where c.id = chamado_id
                 and (c.solicitante_id = app_private.my_colaborador_id()
                      or c.atendente_id = app_private.my_colaborador_id()))
  )
  -- Nota interna é privilégio do time do Adm.
  and (interna = false or app_private.is_adm_time())
);

-- UPDATE existe só para marcar como lido (Passo 8).
drop policy if exists chamados_adm_interacoes_update on public.chamados_adm_interacoes;
create policy chamados_adm_interacoes_update on public.chamados_adm_interacoes
for update to authenticated
using (
  app_private.is_adm_time()
  or exists (select 1 from public.chamados_adm c
             where c.id = chamado_id
               and (c.solicitante_id = app_private.my_colaborador_id()
                    or c.atendente_id = app_private.my_colaborador_id()))
)
with check (
  app_private.is_adm_time()
  or exists (select 1 from public.chamados_adm c
             where c.id = chamado_id
               and (c.solicitante_id = app_private.my_colaborador_id()
                    or c.atendente_id = app_private.my_colaborador_id()))
);

-- ---- Avaliações ----
drop policy if exists chamados_adm_avaliacoes_select on public.chamados_adm_avaliacoes;
create policy chamados_adm_avaliacoes_select on public.chamados_adm_avaliacoes
for select to authenticated
using (
  app_private.is_adm_time()
  or exists (select 1 from public.chamados_adm c
             where c.id = chamado_id
               and (c.solicitante_id = app_private.my_colaborador_id()
                    or c.atendente_id = app_private.my_colaborador_id()))
);

-- Só o solicitante avalia, e só chamado fechado.
drop policy if exists chamados_adm_avaliacoes_insert on public.chamados_adm_avaliacoes;
create policy chamados_adm_avaliacoes_insert on public.chamados_adm_avaliacoes
for insert to authenticated
with check (
  exists (select 1 from public.chamados_adm c
          where c.id = chamado_id
            and c.solicitante_id = app_private.my_colaborador_id()
            and c.status = 'fechado')
);

-- ---- Config ----
-- Leitura liberada a quem está logado: o front precisa do SLA e da alçada para
-- montar o chamado. Escrita só do admin do Adm.
drop policy if exists chamados_adm_config_select on public.chamados_adm_config;
create policy chamados_adm_config_select on public.chamados_adm_config
for select to authenticated using ( true );

drop policy if exists chamados_adm_config_write on public.chamados_adm_config;
create policy chamados_adm_config_write on public.chamados_adm_config
for all to authenticated
using ( app_private.is_adm_admin() )
with check ( app_private.is_adm_admin() );

-- ============================================================================
-- Bucket dos anexos (chamado e comunicações)
-- Diferente do bucket antigo 'ajuda-custo-anexos', este é PRIVADO e sem `anon`:
-- chamado carrega dado de pessoal, obra e cliente. O download no front sai por
-- URL assinada, não por link público.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chamados-adm-anexos', 'chamados-adm-anexos', false, 10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg']
)
on conflict (id) do nothing;

drop policy if exists chamados_adm_anexos_insert on storage.objects;
create policy chamados_adm_anexos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chamados-adm-anexos');

drop policy if exists chamados_adm_anexos_select on storage.objects;
create policy chamados_adm_anexos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'chamados-adm-anexos');

drop policy if exists chamados_adm_anexos_delete on storage.objects;
create policy chamados_adm_anexos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'chamados-adm-anexos');

-- PostgREST guarda o schema em cache; sem isso o front recebe
-- "Could not find the 'X' column ... in the schema cache".
notify pgrst, 'reload schema';
