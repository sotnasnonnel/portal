-- Migrations: mapeamentos_e_bucket_anexos + policies (aplicadas em 2026-06-12 no projeto bogsuuhrgvopzgcceoqz)

-- Detalhe da requisição de Mapeamento (1:1 com solicitacoes_rh, tipo 'mapeamento').
create table if not exists public.mapeamentos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null unique references public.solicitacoes_rh(id) on delete cascade,
  funcao text,
  unidade text,
  codigo_proposta_cliente text,
  unidade_negocios text,
  estado text,
  cidade text,
  salario_base numeric,
  ajuda_custo_alimentacao numeric,
  ajuda_custo_moradia numeric,
  ajuda_custo_mobilidade numeric,
  data_limite_contratacao date,
  horario_trabalho text,
  criterio_folga text,
  formacao text,
  tempo_experiencia text,
  atividades_cargo text,
  conhecimentos_obrigatorios text,
  desconsiderar_perfis text,
  anexo_path text,
  anexo_nome text,
  created_at timestamptz not null default now()
);

-- Mesmo padrão de acesso das demais tabelas do App Dp (login custom, anon key).
alter table public.mapeamentos enable row level security;
create policy anon_all_mapeamentos on public.mapeamentos for all to anon, authenticated using (true) with check (true);

-- Bucket público para os anexos (10 MB; PDF/Word/Excel/imagens).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mapeamento-anexos', 'mapeamento-anexos', true, 10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg']
)
on conflict (id) do nothing;

create policy anon_insert_mapeamento_anexos on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'mapeamento-anexos');

-- Operações da API de storage (remove/list) precisam de SELECT no objeto;
-- DELETE permite a limpeza compensatória quando a criação da requisição falha.
create policy anon_select_mapeamento_anexos on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'mapeamento-anexos');

create policy anon_delete_mapeamento_anexos on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'mapeamento-anexos');
