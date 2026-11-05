-- Migration: frota (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Módulo Gestão de Frota (card "Administrativo" da Home, rotas /frota/*).
--
-- Substitui a planilha docs/ref/ADM_CONTROLE_GESTAO_DE_FROTA.xlsx. As telas e as
-- regras vêm do protótipo docs/ref/"Gestão de Frota PHD - HTML.html"; cada tabela
-- abaixo é uma coleção dele, com os campos dos SCHEMAS em snake_case:
--
--   frota_veiculos    -> cadastro: contrato de locação, condutor, km, revisão
--   frota_mensal      -> custos do mês por veículo (a aba CONTROLE da planilha)
--   frota_ocorrencias -> multas e avarias
--   frota_condutores  -> CNH e termo de responsabilidade
--   frota_manutencoes -> histórico de serviços
--   frota_config      -> parâmetros dos alertas (linha única)
--
-- VÍNCULOS POR TEXTO, de propósito: placa e condutor ligam as tabelas como na
-- planilha, sem chave estrangeira. O carro locado volta para a locadora, o
-- condutor sai da empresa e o histórico de custo precisa continuar de pé; e o
-- condutor pode ser "A / B" quando dois dividem o veículo. Nome de pessoa também
-- não aponta para colaboradores: há condutor que não é colaborador.
--
-- PERMISSÃO: nenhum papel novo. Os helpers setor_adm_time() / setor_adm_admin()
-- exigem administrativo_role E estar na lista de lançamento restrito. Não há
-- consulta geral: são custos e CNH.
--
-- PRÉ-REQUISITO: supabase_migration_setor_adm_acesso.sql (cria os helpers). Pode
-- ser aplicada antes do deploy do front; as tabelas nascem vazias e nada mais as
-- consulta. A carga da planilha é um passo à parte.
--
-- Nota sobre os `revoke`: o Supabase tem um ALTER DEFAULT PRIVILEGES que concede
-- tudo em objeto novo de public para anon, authenticated e service_role.
-- `revoke ... from public` NÃO desfaz isso (é grant direto ao papel), por isso
-- cada tabela e função abaixo revoga de `anon` explicitamente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Veículos
-- ----------------------------------------------------------------------------
create table if not exists public.frota_veiculos (
  id uuid primary key default gen_random_uuid(),

  -- Identificação. Placa fica vazia enquanto a retirada está pendente.
  placa text,
  modelo text,
  cor text,
  status text not null default 'Ativo' check (status in ('Ativo', 'Reservado', 'Inativo')),

  -- Contrato de locação
  locadora text,
  grupo text,
  codigo_reserva text,
  contrato text,
  tipo_contrato text,
  retirada date,
  devolucao date,
  km_contratado integer,
  custo_mensal numeric(12,2),
  valor_km_excedente numeric(12,2),
  proxima_fatura date,

  -- Alocação
  condutor text,
  ct text,
  custo_resp text,
  cidade text,

  -- Equipamentos e combustível
  gps text,
  gps_numero text,
  gps_valor numeric(12,2),
  adesivo text,
  cartao_combustivel text,
  recarga_mensal numeric(12,2),

  -- Quilometragem e revisão
  km_atual integer,
  km_ultima_manutencao integer,
  data_ultima_revisao date,
  data_proxima_revisao date,

  obs text,
  -- Condutores anteriores: [{condutor, locadora, contrato, retirada, devolucao,
  -- fonte}]. Só a carga da planilha preenche; a tela apenas mostra.
  historico jsonb not null default '[]'::jsonb,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
create unique index if not exists frota_veiculos_placa_uq
  on public.frota_veiculos (placa) where placa is not null;
create index if not exists frota_veiculos_status_idx on public.frota_veiculos (status);

-- ----------------------------------------------------------------------------
-- 2) Controle mensal
-- ----------------------------------------------------------------------------
create table if not exists public.frota_mensal (
  id uuid primary key default gen_random_uuid(),

  competencia text not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  placa text,
  condutor text,
  modelo text,
  locadora text,
  grupo text,
  codigo_reserva text,
  contrato text,
  ct text,
  custo_resp text,
  retirada date,
  devolucao date,

  -- Custos do mês. `adesivo` aqui é VALOR; em frota_veiculos é Sim/Não.
  custo_locacao numeric(12,2),
  gps_valor numeric(12,2),
  gps_numero text,
  multas numeric(12,2),
  avarias numeric(12,2),
  laudos numeric(12,2),
  adesivo numeric(12,2),
  frete numeric(12,2),

  -- Combustível. Fica fora do total do mês, como na planilha.
  recarga_mensal numeric(12,2),
  saldo_remanescente numeric(12,2),
  recarga_mes numeric(12,2),

  -- Quilometragem
  km_contratado integer,
  km_atual integer,
  km_ultima_manutencao integer,
  data_ultima_revisao date,
  data_proxima_revisao date,

  obs text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
create unique index if not exists frota_mensal_competencia_placa_uq
  on public.frota_mensal (competencia, placa) where placa is not null;
create index if not exists frota_mensal_competencia_idx on public.frota_mensal (competencia);

-- ----------------------------------------------------------------------------
-- 3) Multas e avarias
-- ----------------------------------------------------------------------------
create table if not exists public.frota_ocorrencias (
  id uuid primary key default gen_random_uuid(),

  tipo text not null check (tipo in ('Multa', 'Avaria')),
  data date,
  categoria text,
  gravidade text,
  placa text,
  modelo text,
  condutor text,
  gestor text,
  locadora text,
  cidade text,
  descricao text,

  -- Valores e pagamento
  valor numeric(12,2),
  status text not null default 'Aberta' check (status in
    ('Aberta', 'Em tratativa', 'Paga', 'Descontada do condutor', 'Encerrada', 'Cancelada')),
  numero_fatura text,
  contrato text,
  valor_fatura numeric(12,2),
  vencimento date,
  data_pagamento date,
  forma_pagamento text,
  responsavel_pagamento text,
  negociacao text,
  desconto_condutor text,
  forma_desconto text,
  financeiro_informado text,
  comprovante_enviado text,

  -- Registro e documentos
  data_phd_informada date,
  data_condutor_informado date,
  bo_registrado text,
  numero_bo text,
  laudo_recebido text,
  status_devolucao text,
  data_devolucao date,
  chamado_phd text,
  -- [{path, nome, tipo, tipo_doc, enviado_em}]; o arquivo vai para frota-anexos.
  anexos jsonb not null default '[]'::jsonb,
  obs text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
create index if not exists frota_ocorrencias_data_idx on public.frota_ocorrencias (data desc);
create index if not exists frota_ocorrencias_placa_idx on public.frota_ocorrencias (placa);

-- ----------------------------------------------------------------------------
-- 4) Condutores e termos
-- ----------------------------------------------------------------------------
create table if not exists public.frota_condutores (
  id uuid primary key default gen_random_uuid(),

  nome text not null,
  situacao text not null default 'Ativo' check (situacao in ('Ativo', 'Inativo', 'Desligado')),
  email text,
  ct text,
  gestor text,

  cnh_categoria text,
  cnh_validade date,
  -- {path, nome, tipo, tipo_doc, enviado_em}
  cnh_arquivo jsonb,
  -- De onde veio a validade quando ela não saiu do documento (carga da planilha).
  cnh_fonte text,

  termo_assinatura date,
  -- Em branco = assinatura + validade padrão de frota_config.
  termo_validade date,
  termo_placa text,
  termo_arquivo jsonb,

  obs text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
create unique index if not exists frota_condutores_nome_uq on public.frota_condutores (nome);

-- ----------------------------------------------------------------------------
-- 5) Manutenções
-- ----------------------------------------------------------------------------
create table if not exists public.frota_manutencoes (
  id uuid primary key default gen_random_uuid(),

  placa text,
  data date,
  tipo text,
  km integer,
  local text,
  protocolo text,
  valor numeric(12,2),
  condutor text,
  proxima_data date,
  descricao text,
  anexos jsonb not null default '[]'::jsonb,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
create index if not exists frota_manutencoes_placa_idx on public.frota_manutencoes (placa);

-- ----------------------------------------------------------------------------
-- 6) Parâmetros (linha única: a chave só aceita `true`)
-- ----------------------------------------------------------------------------
create table if not exists public.frota_config (
  id boolean primary key default true check (id),
  intervalo_revisao_km integer not null default 10000,
  margem_revisao_km integer not null default 1500,
  validade_termo_meses integer not null default 12,
  alerta_dias integer not null default 30,
  margem_revisao_dias integer not null default 15,
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
insert into public.frota_config (id) values (true) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7) Carimbo de alteração
--    SECURITY DEFINER porque a policy colaboradores_select não libera todo mundo.
--    Grava o NOME, e não o id, para a linha "Última alteração por" não depender
--    da RLS de colaboradores ao ser lida.
-- ----------------------------------------------------------------------------
create or replace function app_private.frota_carimbo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.atualizado_em := now();
  new.atualizado_por_nome := (
    select c.nome from public.colaboradores c where c.auth_id = (select auth.uid()) limit 1
  );
  return new;
end $$;
revoke all on function app_private.frota_carimbo() from public;
revoke execute on function app_private.frota_carimbo() from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['frota_veiculos', 'frota_mensal', 'frota_ocorrencias',
                           'frota_condutores', 'frota_manutencoes', 'frota_config'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_carimbo', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function app_private.frota_carimbo()',
      t || '_carimbo', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 8) RLS: só o time. Nada para anon.
--    Cadastro-mestre (veículo, condutor) só o admin exclui; o resto do histórico
--    o time corrige. frota_config: o time lê, só o admin altera.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['frota_veiculos', 'frota_mensal', 'frota_ocorrencias',
                           'frota_condutores', 'frota_manutencoes', 'frota_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;

  foreach t in array array['frota_veiculos', 'frota_mensal', 'frota_ocorrencias',
                           'frota_condutores', 'frota_manutencoes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ( app_private.setor_adm_time() )', t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ( app_private.setor_adm_time() )', t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ( app_private.setor_adm_time() )
         with check ( app_private.setor_adm_time() )', t || '_update', t);
  end loop;

  foreach t in array array['frota_veiculos', 'frota_condutores'] loop
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ( app_private.setor_adm_admin() )', t || '_delete', t);
  end loop;

  foreach t in array array['frota_mensal', 'frota_ocorrencias', 'frota_manutencoes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ( app_private.setor_adm_time() )', t || '_delete', t);
  end loop;
end $$;

drop policy if exists frota_config_select on public.frota_config;
create policy frota_config_select on public.frota_config
  for select to authenticated
  using ( app_private.setor_adm_time() );

drop policy if exists frota_config_update on public.frota_config;
create policy frota_config_update on public.frota_config
  for update to authenticated
  using ( app_private.setor_adm_admin() )
  with check ( app_private.setor_adm_admin() );

-- ----------------------------------------------------------------------------
-- 9) Bucket dos anexos: PRIVADO e só do time, porque guarda cópia de CNH.
--    Mais fechado que chamados-adm-anexos, que libera a qualquer autenticado.
--    O download no front sai por URL assinada.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'frota-anexos', 'frota-anexos', false, 20971520,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists frota_anexos_insert on storage.objects;
create policy frota_anexos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'frota-anexos' and app_private.setor_adm_time());

drop policy if exists frota_anexos_select on storage.objects;
create policy frota_anexos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'frota-anexos' and app_private.setor_adm_time());

drop policy if exists frota_anexos_delete on storage.objects;
create policy frota_anexos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'frota-anexos' and app_private.setor_adm_time());

-- PostgREST guarda o schema em cache; sem isso o front recebe
-- "Could not find the 'X' column ... in the schema cache".
notify pgrst, 'reload schema';
