-- Migration: frota_faturas (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Faturas de veículos da Frota (tela /frota/faturas), vindas da v2 do protótipo
-- docs/ref/"HTML Gestão de Frota PHD v2.html": a fatura da locadora lançada por
-- veículo, com o PDF anexado, para o Contas a Pagar conferir e pagar.
--
-- Mesmo molde de supabase_migration_frota.sql: vínculo por TEXTO (placa,
-- condutor), sem chave estrangeira; carimbo de alteração; RLS só do time pelos
-- helpers setor_adm_time / setor_adm_admin; nada para anon. Os anexos vão para o
-- bucket frota-anexos, na pasta faturas/, e as policies de storage que já
-- existem cobrem o bucket inteiro: nenhuma policy nova de storage aqui.
--
-- CONFERÊNCIA REGISTRADA PELO BANCO. Quando o status muda para Conferida,
-- Divergência ou Paga, o gatilho grava conferido_em = now() e o NOME de quem
-- mudou (conferido_por_nome), como faz o carimbo. O front não manda esses dois
-- campos, e o que ele mandasse seria sobrescrito: a conferência é a prova de quem
-- olhou a fatura e não pode ser preenchida à mão. Sem mudança de status, os dois
-- ficam como estavam. Status Paga sem data de pagamento ganha a data de hoje
-- (fuso de Brasília), como no protótipo.
--
-- Divergência exige a observação da conferência (check), também como no
-- protótipo, que só barrava na tela.
--
-- Exclusão: o time inteiro, como lançamento mensal e ocorrência. Fatura é
-- histórico corrigível, não cadastro-mestre.
--
-- FICOU DE FORA a "Visão Contas a Pagar" do protótipo (um link que abria só esta
-- tela para alguém do financeiro). No portal o acesso continua a lista de
-- lançamento restrito; quando o Contas a Pagar entrar, é decisão de papel.
--
-- PRÉ-REQUISITOS: supabase_migration_setor_adm_acesso.sql e
-- supabase_migration_frota.sql (bucket, policies de storage e frota_carimbo).
-- Pode ser aplicada antes ou depois do deploy do front: sem a tabela, a Frota
-- abre normalmente e só a tela de Faturas avisa que falta esta migração.
-- Idempotente.
-- ============================================================================

create table if not exists public.frota_faturas (
  id uuid primary key default gen_random_uuid(),

  -- Veículo. O formulário só oferece veículo ativo; o resto vem dele e pode
  -- ser ajustado (a fatura guarda o que valia no mês, não o cadastro de hoje).
  placa text not null,
  locadora text,
  contrato text,
  condutor text,
  ct text,
  custo_resp text,

  -- Fatura
  competencia text not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  tipo text not null default 'Locação mensal' check (tipo in
    ('Locação mensal', 'GPS / telemetria', 'Km excedente', 'Multa', 'Avaria', 'Frete', 'Outros')),
  numero_fatura text,
  emissao date,
  vencimento date,
  valor numeric(12,2),
  -- Sugerido pelo controle mensal do veículo na competência; editável.
  valor_previsto numeric(12,2),
  forma_pagamento text,
  envio_financeiro date,
  linha_digitavel text,
  -- [{path, nome, tipo, tipo_doc, enviado_em}]; o arquivo vai para frota-anexos.
  anexos jsonb not null default '[]'::jsonb,

  -- Conferência pelo Contas a Pagar
  status text not null default 'Aguardando conferência' check (status in
    ('Aguardando conferência', 'Conferida', 'Divergência', 'Paga', 'Cancelada')),
  data_pagamento date,
  obs_conferencia text,
  conferido_em timestamptz,
  conferido_por_nome text,

  obs text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text,

  constraint frota_faturas_divergencia_obs check (
    status <> 'Divergência' or nullif(btrim(obs_conferencia), '') is not null
  )
);
create index if not exists frota_faturas_placa_idx on public.frota_faturas (placa);
create index if not exists frota_faturas_vencimento_idx on public.frota_faturas (vencimento);
create index if not exists frota_faturas_competencia_idx on public.frota_faturas (competencia);

-- ----------------------------------------------------------------------------
-- Conferência. Roda antes do carimbo (ordem alfabética dos gatilhos BEFORE).
-- ----------------------------------------------------------------------------
create or replace function app_private.frota_fatura_conferencia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('Conferida', 'Divergência', 'Paga')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    new.conferido_em := now();
    new.conferido_por_nome := (
      select c.nome from public.colaboradores c where c.auth_id = (select auth.uid()) limit 1
    );
  elsif tg_op = 'INSERT' then
    new.conferido_em := null;
    new.conferido_por_nome := null;
  else
    new.conferido_em := old.conferido_em;
    new.conferido_por_nome := old.conferido_por_nome;
  end if;

  if new.status = 'Paga' and new.data_pagamento is null then
    new.data_pagamento := (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  return new;
end $$;
revoke all on function app_private.frota_fatura_conferencia() from public;
revoke execute on function app_private.frota_fatura_conferencia() from anon, authenticated;

drop trigger if exists frota_faturas_a_conferencia on public.frota_faturas;
create trigger frota_faturas_a_conferencia
  before insert or update on public.frota_faturas
  for each row execute function app_private.frota_fatura_conferencia();

drop trigger if exists frota_faturas_carimbo on public.frota_faturas;
create trigger frota_faturas_carimbo
  before insert or update on public.frota_faturas
  for each row execute function app_private.frota_carimbo();

-- ----------------------------------------------------------------------------
-- RLS: só o time. Nada para anon (ver a nota dos revoke em frota.sql).
-- ----------------------------------------------------------------------------
alter table public.frota_faturas enable row level security;
revoke all on public.frota_faturas from anon;

drop policy if exists frota_faturas_select on public.frota_faturas;
create policy frota_faturas_select on public.frota_faturas
  for select to authenticated
  using ( app_private.setor_adm_time() );

drop policy if exists frota_faturas_insert on public.frota_faturas;
create policy frota_faturas_insert on public.frota_faturas
  for insert to authenticated
  with check ( app_private.setor_adm_time() );

drop policy if exists frota_faturas_update on public.frota_faturas;
create policy frota_faturas_update on public.frota_faturas
  for update to authenticated
  using ( app_private.setor_adm_time() )
  with check ( app_private.setor_adm_time() );

drop policy if exists frota_faturas_delete on public.frota_faturas;
create policy frota_faturas_delete on public.frota_faturas
  for delete to authenticated
  using ( app_private.setor_adm_time() );

notify pgrst, 'reload schema';
