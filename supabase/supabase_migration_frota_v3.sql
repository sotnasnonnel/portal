-- Migration: frota_v3 (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Gestão de Frota, v3 do protótipo (docs/ref/"HTML Gestão de Frota PHD v3.html").
-- O que entra no banco:
--
-- 1. frota_veiculos.dia_vencimento_fatura: dia do mês (1 a 31) em que a fatura de
--    locação vence. Com ele a tela gera as faturas "Prevista" do mês e preenche o
--    vencimento sozinha.
-- 2. frota_mensal.km_rodado_inf / km_fonte / km_importado_em: km rodado no mês
--    informado (relatório da Cobli ou planilha da locadora). Quando existe, vale
--    sobre o cálculo pela diferença do hodômetro. km_fonte = 'Cobli' quando veio
--    da importação da Cobli; nulo quando digitado ou importado de outra planilha.
-- 3. frota_condutores.placa_vinculada / tipo_condutor: vínculo do condutor com o
--    veículo. Cada placa tem 1 condutor Principal e até 5 Adicionais (entre os
--    condutores Ativos). O banco garante os dois limites: índice único para o
--    principal e gatilho para os adicionais.
--    Carga inicial: o condutor Ativo cujo nome é igual ao do condutor do veículo
--    ativo vira o Principal daquela placa (só onde ainda não há vínculo).
-- 4. frota_faturas.status ganha 'Prevista' (fatura gerada pelo dia de vencimento,
--    antes de chegar a fatura de verdade).
-- 5. Tabela nova frota_arquivos_mensais: os relatórios mensais das plataformas
--    (Ticket Log, Cobli, GPS da locadora...) anexados em Combustível e em
--    Quilometragem, com o registro do que foi importado para o controle mensal.
-- 6. Bucket frota-anexos passa a aceitar planilha e texto (CSV, XLSX, XLS, ODS,
--    TXT), que é o formato desses relatórios.
--
-- Mesmo padrão de acesso do resto da Frota: só o time (setor_adm_time).
-- PRÉ-REQUISITO: supabase_migration_frota.sql e supabase_migration_frota_faturas.sql.
-- APLICAR ANTES DO FRONT. Idempotente: pode rodar de novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Veículo: dia de vencimento da fatura
-- ----------------------------------------------------------------------------
alter table public.frota_veiculos
  add column if not exists dia_vencimento_fatura smallint
    check (dia_vencimento_fatura between 1 and 31);

-- ----------------------------------------------------------------------------
-- 2) Controle mensal: km rodado informado
-- ----------------------------------------------------------------------------
alter table public.frota_mensal
  add column if not exists km_rodado_inf numeric(12,2) check (km_rodado_inf >= 0),
  add column if not exists km_fonte text,
  add column if not exists km_importado_em timestamptz;

-- ----------------------------------------------------------------------------
-- 3) Condutor: vínculo com o veículo
-- ----------------------------------------------------------------------------
alter table public.frota_condutores
  add column if not exists placa_vinculada text,
  add column if not exists tipo_condutor text check (tipo_condutor in ('Principal', 'Adicional'));

-- Um principal por placa, entre os ativos.
create unique index if not exists frota_condutores_principal_uq
  on public.frota_condutores (placa_vinculada)
  where situacao = 'Ativo' and tipo_condutor = 'Principal' and placa_vinculada is not null;

-- Até 5 adicionais por placa, entre os ativos.
create or replace function app_private.frota_limite_adicionais()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.situacao = 'Ativo' and new.tipo_condutor = 'Adicional' and new.placa_vinculada is not null
     and (select count(*) from public.frota_condutores c
          where c.id <> new.id and c.situacao = 'Ativo' and c.tipo_condutor = 'Adicional'
            and c.placa_vinculada = new.placa_vinculada) >= 5 then
    raise exception '% já tem 5 condutores adicionais.', new.placa_vinculada;
  end if;
  return new;
end $$;
revoke all on function app_private.frota_limite_adicionais() from public;
revoke execute on function app_private.frota_limite_adicionais() from anon, authenticated;

drop trigger if exists frota_condutores_limite_adicionais on public.frota_condutores;
create trigger frota_condutores_limite_adicionais
  before insert or update on public.frota_condutores
  for each row execute function app_private.frota_limite_adicionais();

-- Carga inicial do vínculo: o condutor do veículo ativo vira o principal da placa.
-- Só preenche quem ainda não tem vínculo, e só uma placa por condutor.
update public.frota_condutores c
set placa_vinculada = v.placa, tipo_condutor = 'Principal'
from (
  select distinct on (lower(btrim(condutor))) lower(btrim(condutor)) as nome, placa
  from public.frota_veiculos
  where status = 'Ativo' and placa is not null and coalesce(btrim(condutor), '') <> ''
    and condutor not like '% / %'
  order by lower(btrim(condutor)), placa
) v
where c.situacao = 'Ativo'
  and c.placa_vinculada is null
  and lower(btrim(c.nome)) = v.nome
  -- Dois cadastros com o mesmo nome: só o mais antigo, senão o índice acima barra.
  and c.id = (
    select c2.id from public.frota_condutores c2
    where c2.situacao = 'Ativo' and lower(btrim(c2.nome)) = v.nome
    order by c2.criado_em, c2.id limit 1
  )
  and not exists (
    select 1 from public.frota_condutores o
    where o.situacao = 'Ativo' and o.tipo_condutor = 'Principal' and o.placa_vinculada = v.placa
  );

-- ----------------------------------------------------------------------------
-- 4) Fatura: status 'Prevista'
-- ----------------------------------------------------------------------------
alter table public.frota_faturas drop constraint if exists frota_faturas_status_check;
alter table public.frota_faturas add constraint frota_faturas_status_check check (status in
  ('Prevista', 'Aguardando conferência', 'Conferida', 'Divergência', 'Paga', 'Cancelada'));

-- ----------------------------------------------------------------------------
-- 5) Relatórios mensais das plataformas
-- ----------------------------------------------------------------------------
create table if not exists public.frota_arquivos_mensais (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('combustivel', 'quilometragem')),
  competencia text not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  plataforma text,
  -- {path, nome, tipo, enviado_em} no bucket frota-anexos; nulo quando a
  -- importação da Cobli não conseguiu guardar o arquivo.
  arquivo jsonb,
  periodo_inicio date,
  periodo_fim date,
  km_total numeric(12,2),
  importado_em timestamptz,
  importado_qtd integer,
  -- Campo do controle mensal que recebeu os valores.
  importado_campo text check (importado_campo in ('recarga_mes', 'saldo_remanescente', 'km_atual', 'km_rodado_inf')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
create index if not exists frota_arquivos_mensais_comp_idx
  on public.frota_arquivos_mensais (area, competencia);

drop trigger if exists frota_arquivos_mensais_carimbo on public.frota_arquivos_mensais;
create trigger frota_arquivos_mensais_carimbo
  before insert or update on public.frota_arquivos_mensais
  for each row execute function app_private.frota_carimbo();

alter table public.frota_arquivos_mensais enable row level security;
revoke all on public.frota_arquivos_mensais from anon;

drop policy if exists frota_arquivos_mensais_select on public.frota_arquivos_mensais;
create policy frota_arquivos_mensais_select on public.frota_arquivos_mensais
  for select to authenticated using ( app_private.setor_adm_time() );

drop policy if exists frota_arquivos_mensais_insert on public.frota_arquivos_mensais;
create policy frota_arquivos_mensais_insert on public.frota_arquivos_mensais
  for insert to authenticated with check ( app_private.setor_adm_time() );

drop policy if exists frota_arquivos_mensais_update on public.frota_arquivos_mensais;
create policy frota_arquivos_mensais_update on public.frota_arquivos_mensais
  for update to authenticated
  using ( app_private.setor_adm_time() ) with check ( app_private.setor_adm_time() );

drop policy if exists frota_arquivos_mensais_delete on public.frota_arquivos_mensais;
create policy frota_arquivos_mensais_delete on public.frota_arquivos_mensais
  for delete to authenticated using ( app_private.setor_adm_time() );

-- ----------------------------------------------------------------------------
-- 6) Bucket: planilha e texto, para os relatórios das plataformas
-- ----------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet'
]
where id = 'frota-anexos';

notify pgrst, 'reload schema';
