-- Migration: alojamentos_faturas (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Faturas dos alojamentos para o Contas a Pagar, da v2 do protótipo
-- (docs/ref/"HTML Gestão de Alojamentos PHD v2.html").
--
-- O que muda em alojamentos_pagamentos:
--   - fornecedor e documento (nº da fatura / boleto / NF);
--   - anexos: a fatura, o boleto ou o comprovante. Mesmo formato da Frota,
--     [{path, nome, tipo, tamanho, enviado_em}], com o arquivo no bucket privado
--     alojamentos-anexos (criado abaixo);
--   - conferência: conferencia_status ('pendente' = "A conferir", 'conferida',
--     'divergencia'), conferencia_obs, conferido_por_nome e conferido_em.
-- A conta nova "Manutenção" não exige mudança: `conta` é texto livre, sem check.
--
-- O QUE FICA NO BANCO (gatilho app_private.aloj_conferencia):
--   - quem conferiu e quando: o gatilho carimba ao mudar conferencia_status para
--     conferida/divergência, e limpa ao voltar para pendente. O front não manda
--     esses dois campos; se mandar, o gatilho ignora;
--   - mexer no valor, no vencimento ou nos anexos de um lançamento já conferido
--     o devolve para 'pendente', com a observação "Lançamento alterado após a
--     conferência de DD/MM/AAAA." (a mesma regra está em voltaParaConferir, em
--     src/modules/alojamentos/lib/regras.js, que o front usa só para avisar);
--   - divergência sem observação é barrada por check.
-- O QUE FICA NO FRONT: a validação "pago exige valor ou data" e apagar do bucket
-- os arquivos de um lançamento ou alojamento excluído (o Storage não deixa
-- apagar o arquivo de verdade por SQL).
--
-- Os lançamentos que já existem entram como 'pendente' ("A conferir").
--
-- PRÉ-REQUISITO: supabase_migration_alojamentos.sql.
-- SEM PRÉ-REQUISITO DE DEPLOY: as colunas novas têm default, e o front atual
-- não as lê. Aplique antes do front novo, que grava nelas.
-- Idempotente: pode rodar de novo.
-- ============================================================================

alter table public.alojamentos_pagamentos
  add column if not exists fornecedor text,
  add column if not exists documento text,
  add column if not exists anexos jsonb not null default '[]'::jsonb,
  add column if not exists conferencia_status text not null default 'pendente',
  add column if not exists conferencia_obs text,
  add column if not exists conferido_por_nome text,
  add column if not exists conferido_em timestamptz;

alter table public.alojamentos_pagamentos
  drop constraint if exists alojamentos_pagamentos_conferencia_status_check;
alter table public.alojamentos_pagamentos
  add constraint alojamentos_pagamentos_conferencia_status_check
  check (conferencia_status in ('pendente', 'conferida', 'divergencia'));

alter table public.alojamentos_pagamentos
  drop constraint if exists alojamentos_pagamentos_divergencia_obs_check;
alter table public.alojamentos_pagamentos
  add constraint alojamentos_pagamentos_divergencia_obs_check
  check (conferencia_status <> 'divergencia' or nullif(btrim(conferencia_obs), '') is not null);

alter table public.alojamentos_pagamentos
  drop constraint if exists alojamentos_pagamentos_anexos_check;
alter table public.alojamentos_pagamentos
  add constraint alojamentos_pagamentos_anexos_check
  check (jsonb_typeof(anexos) = 'array');

-- A tela de faturas filtra e ordena por vencimento.
create index if not exists alojamentos_pagamentos_venc_idx on public.alojamentos_pagamentos (vencimento);

-- ----------------------------------------------------------------------------
-- Gatilho da conferência
--   SECURITY DEFINER porque a policy de colaboradores não libera todo mundo.
--   Grava o NOME, e não o id, no molde de app_private.frota_carimbo: a linha
--   "Conferida por" não depende da RLS de colaboradores ao ser lida.
-- ----------------------------------------------------------------------------
create or replace function app_private.aloj_conferencia()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_quem text := (select c.nome from public.colaboradores c where c.auth_id = (select auth.uid()) limit 1);
begin
  if tg_op = 'INSERT' then
    if new.conferencia_status = 'pendente' then
      new.conferido_por_nome := null;
      new.conferido_em := null;
    else
      new.conferido_por_nome := v_quem;
      new.conferido_em := now();
    end if;
    return new;
  end if;

  if new.conferencia_status is distinct from old.conferencia_status
     or (new.conferencia_status <> 'pendente' and new.conferencia_obs is distinct from old.conferencia_obs) then
    -- A conferência foi registrada (ou refeita) nesta gravação.
    if new.conferencia_status = 'pendente' then
      new.conferido_por_nome := null;
      new.conferido_em := null;
    else
      new.conferido_por_nome := v_quem;
      new.conferido_em := now();
    end if;
  elsif old.conferencia_status <> 'pendente'
     and (new.valor is distinct from old.valor
          or new.vencimento is distinct from old.vencimento
          or jsonb_path_query_array(new.anexos, '$[*].path') is distinct from jsonb_path_query_array(old.anexos, '$[*].path')) then
    -- Alterado depois de conferido: volta para a fila do Contas a Pagar.
    new.conferencia_obs := 'Lançamento alterado após a conferência de '
      || coalesce(to_char(old.conferido_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), 'data não registrada') || '.';
    new.conferencia_status := 'pendente';
    new.conferido_por_nome := null;
    new.conferido_em := null;
  else
    -- Nada de conferência mudou: o carimbo não se edita pelo front.
    new.conferido_por_nome := old.conferido_por_nome;
    new.conferido_em := old.conferido_em;
  end if;
  return new;
end $$;
revoke all on function app_private.aloj_conferencia() from public;
revoke execute on function app_private.aloj_conferencia() from anon, authenticated;

drop trigger if exists alojamentos_pagamentos_conferencia_trg on public.alojamentos_pagamentos;
create trigger alojamentos_pagamentos_conferencia_trg
  before insert or update on public.alojamentos_pagamentos
  for each row execute function app_private.aloj_conferencia();

-- ----------------------------------------------------------------------------
-- Bucket dos anexos: PRIVADO e só de quem está liberado, como o frota-anexos.
-- O download no front sai por URL assinada.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alojamentos-anexos', 'alojamentos-anexos', false, 20971520,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists alojamentos_anexos_insert on storage.objects;
create policy alojamentos_anexos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'alojamentos-anexos' and app_private.setor_adm_time());

drop policy if exists alojamentos_anexos_select on storage.objects;
create policy alojamentos_anexos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'alojamentos-anexos' and app_private.setor_adm_time());

drop policy if exists alojamentos_anexos_delete on storage.objects;
create policy alojamentos_anexos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'alojamentos-anexos' and app_private.setor_adm_time());

-- PostgREST guarda o schema em cache; sem isso o front recebe
-- "Could not find the 'X' column ... in the schema cache".
notify pgrst, 'reload schema';
