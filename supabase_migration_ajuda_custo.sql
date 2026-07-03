-- Migration: ajudas_custo_e_bucket_anexos (aplicada em 2026-06-12 no projeto bogsuuhrgvopzgcceoqz)

-- Detalhe da requisição de Ajuda de Custo (1:1 com solicitacoes_rh, tipo 'ajuda_custo').
create table if not exists public.ajudas_custo (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null unique references public.solicitacoes_rh(id) on delete cascade,
  data_inicio date,
  data_final date,
  tipos text[] not null default '{}',
  alimentacao_valor numeric,
  alimentacao_justificativa text,
  mobilidade_valor numeric,
  mobilidade_justificativa text,
  moradia_valor numeric,
  transf_origem text,
  transf_destino text,
  transf_alimentacao_valor numeric,
  transf_alimentacao_qtd_dias int,
  transf_mobilidade_valor numeric,
  transf_mobilidade_qtd_dias int,
  transf_moradia_valor numeric,
  retro_justificativa text,
  retro_alimentacao_valor numeric,
  retro_alimentacao_justificativa text,
  retro_mobilidade_valor numeric,
  retro_mobilidade_qtd_dias int,
  retro_moradia_valor numeric,
  anexo_path text,
  anexo_nome text,
  created_at timestamptz not null default now()
);

-- Mesmo padrão de acesso das demais tabelas do App Dp (login custom, anon key).
alter table public.ajudas_custo enable row level security;
create policy anon_all_ajudas_custo on public.ajudas_custo for all to anon, authenticated using (true) with check (true);

-- Bucket público para os anexos (10 MB; PDF/Word/Excel/imagens).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ajuda-custo-anexos', 'ajuda-custo-anexos', true, 10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg']
)
on conflict (id) do nothing;

create policy anon_insert_ajuda_custo_anexos on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'ajuda-custo-anexos');

-- SELECT p/ operações da API (remove/list); DELETE p/ limpeza compensatória.
create policy anon_select_ajuda_custo_anexos on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'ajuda-custo-anexos');

create policy anon_delete_ajuda_custo_anexos on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'ajuda-custo-anexos');
