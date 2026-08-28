-- Migration: vagas_e_bucket_anexos (aplicada em 2026-06-12 no projeto bogsuuhrgvopzgcceoqz)

-- Detalhe da requisição de Nova Vaga (1:1 com solicitacoes_rh, tipo 'nova_vaga').
create table if not exists public.vagas (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null unique references public.solicitacoes_rh(id) on delete cascade,
  justificativa text,
  previsao date,
  quantidade_vagas int,
  empresa text,
  filial text,
  departamento text,
  funcao text,
  salario_proposto numeric,
  unidade_negocios text,
  unidade text,
  nome_cliente text,
  codigo_cliente text,
  valor_orcado_contrato numeric,
  valor_margem_proposta numeric,
  tipo_transporte text,
  modalidade_contratacao text,
  horario_trabalho text,
  custo_projeto_100 boolean,
  tipo_moradia text,
  tipo_alimentacao text,
  folga_campo text,
  formacao text,
  tempo_experiencia text,
  cidade_atuacao text,
  estado_atuacao text,
  requisitos_desejados text,
  atividades_cargo text,
  requisitos_obrigatorios text,
  desconsiderar_perfis text,
  anexo_path text,
  anexo_nome text,
  created_at timestamptz not null default now()
);

-- Mesmo padrão de acesso das demais tabelas do App Dp (login custom, anon key).
alter table public.vagas enable row level security;
create policy anon_all_vagas on public.vagas for all to anon, authenticated using (true) with check (true);

-- Bucket público para os anexos (10 MB; só PDF e imagens, conforme o formulário).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vaga-anexos', 'vaga-anexos', true, 10485760,
  array['application/pdf','image/png','image/jpeg']
)
on conflict (id) do nothing;

create policy anon_insert_vaga_anexos on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'vaga-anexos');

-- SELECT p/ operações da API (remove/list); DELETE p/ limpeza compensatória.
create policy anon_select_vaga_anexos on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'vaga-anexos');

create policy anon_delete_vaga_anexos on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'vaga-anexos');
