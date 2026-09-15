-- Migration: mobilizacao_comentarios (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Comentários por ETAPA, com anexo, no processo de mobilização.
--
-- Pedido do André (11/09/2026), em dois chamados que viraram um mecanismo só:
--   "Criar campos de comentários para cada etapa. O pessoal do ADM precisa
--    realizar algumas explicações e usaremos esse input. Considerar para cada
--    registro quem fez e data."
--   "Criar botão de anexar arquivo em cada etapa."
--
-- POR QUE UMA TABELA, e não a coluna que já existe: `mobilizacao_etapas` tem
-- `observacao text` e `anexos jsonb` desde a migração original, as duas sem uso
-- na interface. Nenhuma das duas serve ao pedido — `observacao` é UM texto, que
-- a próxima pessoa a escrever sobrescreve, e nem ela nem o jsonb guardam QUEM
-- escreveu e QUANDO, que é metade do que foi pedido. Um histórico que se
-- sobrescreve não é histórico.
--
-- POR QUE TEXTO E ANEXO NA MESMA LINHA: o arquivo quase sempre vem acompanhado
-- da explicação ("a clínica remarcou, segue a guia nova"). Separar viraria duas
-- listas paralelas na mesma etapa, e o arquivo perderia o porquê. Comentário só
-- com anexo é permitido — aí o arquivo É o recado —, e é o mesmo desenho que o
-- time do Adm já usa na resposta do chamado (chamados_adm_interacoes).
--
-- IMUTÁVEL: não há policy de update nem de delete, como em mobilizacao_eventos
-- e chamados_adm_interacoes. Histórico que a aplicação pode reescrever não
-- serve como histórico — e apagar um comentário deixaria o arquivo órfão no
-- bucket, sem nada que diga que ele existiu.
-- ============================================================================

create table if not exists public.mobilizacao_etapa_comentarios (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references public.mobilizacao_etapas(id) on delete cascade,
  autor_id uuid not null references public.colaboradores(id),

  texto text not null default '',
  anexos jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),

  -- Registro sem texto e sem arquivo não é comentário, é linha vazia no meio do
  -- histórico. A tela também barra, mas a trava real fica aqui.
  constraint mobilizacao_etapa_coment_conteudo
    check (btrim(texto) <> '' or jsonb_array_length(anexos) > 0)
);

-- A tela do processo lê os comentários de TODAS as etapas de uma vez, na ordem
-- em que foram escritos.
create index if not exists mobilizacao_etapa_coment_etapa
  on public.mobilizacao_etapa_comentarios (etapa_id, created_at);

-- ----------------------------------------------------------------------------
-- Quem enxerga a etapa.
--
-- SECURITY DEFINER pela MESMA razão documentada em mob_pode_ver_processo: sem
-- isso, a policy desta tabela consultaria mobilizacao_etapas, cuja policy
-- consulta mobilizacao_processos, cuja policy volta a etapas — e o Postgres
-- aborta com "infinite recursion detected in policy".
-- ----------------------------------------------------------------------------
create or replace function app_private.mob_pode_ver_etapa(p_etapa uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mobilizacao_etapas e
    where e.id = p_etapa
      and (app_private.is_adm_time()
        or e.responsavel_id = app_private.my_colaborador_id()
        or app_private.mob_pode_ver_processo(e.processo_id))
  )
$$;
revoke all on function app_private.mob_pode_ver_etapa(uuid) from public;
grant execute on function app_private.mob_pode_ver_etapa(uuid) to authenticated;

alter table public.mobilizacao_etapa_comentarios enable row level security;

-- Lê quem já enxerga a etapa: o time do Adm, quem responde pelo passo e quem
-- está envolvido no processo. Mesma régua da própria etapa, para não haver
-- comentário visível em etapa invisível (nem o contrário).
drop policy if exists mobilizacao_etapa_coment_select on public.mobilizacao_etapa_comentarios;
create policy mobilizacao_etapa_coment_select on public.mobilizacao_etapa_comentarios
  for select to authenticated
  using (app_private.mob_pode_ver_etapa(etapa_id));

-- Escreve quem lê, SEMPRE em nome próprio.
--
-- Deliberadamente mais largo que a policy de UPDATE da etapa, que é só do time
-- do Adm e do responsável: comentar não muda o processo. É o que permite o TI,
-- o DP ou o gerente da obra explicarem o próprio passo sem ganhar o direito de
-- mexer no prazo dele.
drop policy if exists mobilizacao_etapa_coment_insert on public.mobilizacao_etapa_comentarios;
create policy mobilizacao_etapa_coment_insert on public.mobilizacao_etapa_comentarios
  for insert to authenticated
  with check (
    autor_id = app_private.my_colaborador_id()
    and app_private.mob_pode_ver_etapa(etapa_id)
  );

-- ============================================================================
-- Bucket dos anexos
--
-- PRIVADO e sem `anon`, como o do Administrativo: comentário de mobilização
-- carrega documento de pessoa (guia de exame, ASO, contrato). O download no
-- front sai por URL assinada, não por link público.
--
-- Bucket próprio, e não o 'chamados-adm-anexos': são módulos diferentes, com
-- ciclos de vida diferentes: um processo de mobilização vive meses depois de o
-- chamado que o abriu ter fechado.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mobilizacao-anexos', 'mobilizacao-anexos', false, 10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg']
)
on conflict (id) do nothing;

drop policy if exists mobilizacao_anexos_insert on storage.objects;
create policy mobilizacao_anexos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'mobilizacao-anexos');

drop policy if exists mobilizacao_anexos_select on storage.objects;
create policy mobilizacao_anexos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'mobilizacao-anexos');

drop policy if exists mobilizacao_anexos_delete on storage.objects;
create policy mobilizacao_anexos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'mobilizacao-anexos');

-- PostgREST guarda o schema em cache; sem isso o front recebe
-- "Could not find the table ... in the schema cache".
notify pgrst, 'reload schema';
