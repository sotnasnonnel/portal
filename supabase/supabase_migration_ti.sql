-- Migration: ti (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Módulo TI (card "TI" da Home, rotas /ti/*): controle de ativos de tecnologia
-- (notebooks, monitores, impressoras, tablets, licenças) e os termos de
-- responsabilidade de quem está com cada equipamento.
--
-- Substitui o app de Power Apps "Controle de ativos" e a planilha
-- "Controle de ativos - organizado 1.xlsx". Cada coluna da planilha virou um
-- campo de ti_ativos, em snake_case. A carga inicial é um arquivo à parte:
-- supabase_seed_ti_ativos.sql.
--
--   ti_ativos         -> um equipamento por número de série
--   ti_movimentacoes  -> histórico de troca de responsável / situação
--   ti_termos         -> cada termo de empréstimo gerado (cópia do que saiu no PDF)
--
-- VÍNCULO POR E-MAIL, de propósito: `responsavel` é o e-mail corporativo, como
-- na planilha, sem chave para colaboradores. Há responsável que já saiu da
-- empresa e há linha com "Não encontrado"; o histórico do equipamento precisa
-- continuar de pé.
--
-- PERMISSÃO: checkbox "TI" no Gerenciamento de acessos (colaboradores.ti_acesso).
-- Marcado = entra, lê e escreve. Não há consulta geral: tem CPF nos termos.
--
-- APLICAR ANTES DO FRONT: o Gerenciamento de acessos passa a pedir a coluna
-- ti_acesso no select, e sem ela a lista de pessoas não carrega.
-- Idempotente: pode rodar de novo.
--
-- Nota sobre os `revoke`: o Supabase concede tudo em objeto novo de public para
-- anon; `revoke ... from public` não desfaz isso, por isso cada tabela e função
-- revoga de `anon` explicitamente (mesmo cuidado de supabase_migration_frota.sql).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Quem entra: coluna em colaboradores + helper para a RLS
-- ----------------------------------------------------------------------------
alter table public.colaboradores
  add column if not exists ti_acesso boolean not null default false;

comment on column public.colaboradores.ti_acesso is
  'Libera o módulo TI (controle de ativos e termos) para esta pessoa, pelo Gerenciamento de acessos: entra e escreve. Lida pela RLS via app_private.ti_time().';

-- Quem administra o portal já nasce liberado. O update só MARCA: rodar de novo
-- não remarca quem for desmarcado na tela depois.
update public.colaboradores
   set ti_acesso = true
 where ti_acesso = false
   and lower(email) in (
     'lennon.santos@phdengenharia.eng.br',
     'marcus.guimaraes@phdengenharia.eng.br',
     'andre.guimaraes@phdengenharia.eng.br'
   );

create or replace function app_private.ti_time()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and ti_acesso and coalesce(ativo, true)
  )
$$;
revoke all on function app_private.ti_time() from public;
revoke execute on function app_private.ti_time() from anon;
grant execute on function app_private.ti_time() to authenticated;

-- ----------------------------------------------------------------------------
-- 1) Ativos
-- ----------------------------------------------------------------------------
create table if not exists public.ti_ativos (
  id uuid primary key default gen_random_uuid(),

  numero_serie text not null,
  fornecedor text,               -- Selbet, EMC, Próprio
  tipo text,                     -- Notebook, Monitor, Impressora, Tablet, Serviço, Licença
  descricao text,
  modelo text,
  configuracao text,
  software text,

  -- Com quem está e em que pé
  responsavel text,              -- e-mail corporativo (ou texto livre da planilha)
  situacao text,                 -- Em utilização, Recolhido, Devolução, ...
  cidade text,
  observacoes text,
  ultima_movimentacao date,

  -- Contrato de locação
  contrato text,
  cnpj text,
  inicio_contrato date,
  vencimento_contrato date,
  valor_mensal numeric(12,2),
  nfe_remessa text,

  -- Conferência com a base do fornecedor (colunas "base" da planilha)
  responsavel_base text,
  situacao_base text,

  -- Termo de responsabilidade
  situacao_termo text,           -- Sem termo, A conferir, Termo existente - a validar, Termo divergente, Termo gerado, Assinado
  link_termo text,
  data_envio_termo date,
  data_assinatura_termo date,

  -- [{path, nome, tipo, enviado_em}] no bucket ti-anexos
  anexos jsonb not null default '[]'::jsonb,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
create unique index if not exists ti_ativos_serie_uq on public.ti_ativos (upper(numero_serie));
create index if not exists ti_ativos_resp_idx on public.ti_ativos (lower(responsavel));

-- ----------------------------------------------------------------------------
-- 2) Movimentações
-- ----------------------------------------------------------------------------
create table if not exists public.ti_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid references public.ti_ativos(id) on delete cascade,
  numero_serie text,             -- cópia: sobrevive se o ativo for excluído
  data date not null default current_date,
  de_responsavel text,
  para_responsavel text,
  de_situacao text,
  para_situacao text,
  obs text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
create index if not exists ti_mov_ativo_idx on public.ti_movimentacoes (ativo_id, data desc);

-- ----------------------------------------------------------------------------
-- 3) Termos gerados
-- ----------------------------------------------------------------------------
create table if not exists public.ti_termos (
  id uuid primary key default gen_random_uuid(),
  pessoa_email text not null,
  pessoa_nome text,
  cpf text,
  vinculo text,                  -- CLT, PJ, Sócio Cotista...
  data_admissao date,
  cidade text,
  data_termo date not null default current_date,
  -- Cópia dos equipamentos como saíram no PDF: [{id, numero_serie, tipo, modelo, descricao, configuracao, fornecedor, valor_mensal}]
  ativos jsonb not null default '[]'::jsonb,
  status text not null default 'Gerado' check (status in ('Gerado', 'Assinado', 'Cancelado')),
  data_assinatura date,
  anexos jsonb not null default '[]'::jsonb,   -- termo assinado
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
create index if not exists ti_termos_pessoa_idx on public.ti_termos (lower(pessoa_email), data_termo desc);

-- ----------------------------------------------------------------------------
-- 4) Carimbo de alteração (quem e quando)
-- ----------------------------------------------------------------------------
create or replace function app_private.ti_carimbo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.atualizado_em := now();
  new.atualizado_por_nome := (
    select c.nome from public.colaboradores c where c.auth_id = (select auth.uid()) limit 1
  );
  return new;
end;
$$;
revoke all on function app_private.ti_carimbo() from public;
revoke execute on function app_private.ti_carimbo() from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['ti_ativos', 'ti_movimentacoes', 'ti_termos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_carimbo', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function app_private.ti_carimbo()',
      t || '_carimbo', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using ( app_private.ti_time() )', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ( app_private.ti_time() )', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using ( app_private.ti_time() ) with check ( app_private.ti_time() )', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using ( app_private.ti_time() )', t || '_delete', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 5) Pessoas para o termo: nome, vínculo e admissão de TODOS os colaboradores.
--    A policy de colaboradores não libera a lista inteira, então sai por esta
--    função, que só responde a quem é do time de TI e só devolve o necessário.
-- ----------------------------------------------------------------------------
create or replace function public.ti_pessoas()
returns table (id uuid, nome text, email text, vinculo text, data_admissao date, ativo boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, lower(c.email), c.formato, c.data_admissao, coalesce(c.ativo, true)
    from public.colaboradores c
   where app_private.ti_time() and c.email is not null
   order by c.nome
$$;
revoke all on function public.ti_pessoas() from public;
revoke execute on function public.ti_pessoas() from anon;
grant execute on function public.ti_pessoas() to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Bucket dos anexos (termos assinados, notas): PRIVADO e só do time.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ti-anexos', 'ti-anexos', false, 20971520,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists ti_anexos_insert on storage.objects;
create policy ti_anexos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ti-anexos' and app_private.ti_time());

drop policy if exists ti_anexos_select on storage.objects;
create policy ti_anexos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'ti-anexos' and app_private.ti_time());

drop policy if exists ti_anexos_delete on storage.objects;
create policy ti_anexos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ti-anexos' and app_private.ti_time());

notify pgrst, 'reload schema';
