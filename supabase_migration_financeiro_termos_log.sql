-- Migration: financeiro_termos_log (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Termos de Uso e Responsabilidade: aceite OBRIGATÓRIO em toda solicitação do
-- Financeiro + log de auditoria dos aceites (quem + quando + qual termo).
-- ============================================================================

-- 1) Garantia no banco: nenhuma solicitação sem aceite (com data/hora). A regra
--    de tela já exige, isto é a rede de segurança — vale p/ os dois tipos.
alter table public.solicitacoes_financeiro
  drop constraint if exists solic_fin_aceite_obrigatorio_check;
alter table public.solicitacoes_financeiro
  add constraint solic_fin_aceite_obrigatorio_check
  check (aceite_termos is true and aceite_termos_em is not null);

-- 2) Log de aceites (auditoria). Durável: solicitacao_id vira NULL se a
--    solicitação for excluída, mas o registro do aceite permanece.
create table if not exists public.financeiro_termos_aceites (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid references public.solicitacoes_financeiro(id) on delete set null,
  colaborador_id uuid not null references public.colaboradores(id),
  tipo text not null,                 -- cartao_virtual | aumento_limite
  titulo text,                        -- snapshot do título do termo aceito
  aceito_em timestamptz not null,     -- momento do aceite (capturado na tela)
  created_at timestamptz not null default now()
);
create index if not exists fin_termos_aceites_colab_idx on public.financeiro_termos_aceites (colaborador_id);
create index if not exists fin_termos_aceites_solic_idx on public.financeiro_termos_aceites (solicitacao_id);

-- RLS: leitura para o admin do Financeiro (auditoria) e para o próprio autor;
-- inserção do próprio aceite (ou pelo admin). Sem UPDATE/DELETE: log imutável
-- (RLS habilitada sem policy de update/delete nega essas operações).
alter table public.financeiro_termos_aceites enable row level security;

drop policy if exists fin_termos_aceites_select on public.financeiro_termos_aceites;
create policy fin_termos_aceites_select on public.financeiro_termos_aceites
for select to authenticated
using ( app_private.is_financeiro_admin() or colaborador_id = app_private.my_colaborador_id() );

drop policy if exists fin_termos_aceites_insert on public.financeiro_termos_aceites;
create policy fin_termos_aceites_insert on public.financeiro_termos_aceites
for insert to authenticated
with check ( colaborador_id = app_private.my_colaborador_id() or app_private.is_financeiro_admin() );