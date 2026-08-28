-- Migration: financeiro_acesso_role (projeto bogsuuhrgvopzgcceoqz)
--
-- Acesso ao módulo Financeiro: papel por colaborador, no mesmo padrão de
-- perfil/rh_dp/horas_role (a RLS de colaboradores já protege a escrita: só admin).
-- NULL = sem acesso; 'user' = solicitante; 'admin' = administra o Financeiro.
-- Toggle em /portal-admin (Gerenciar acessos), coluna "Financeiro".
alter table public.colaboradores add column if not exists financeiro_role text;

alter table public.colaboradores
  drop constraint if exists colaboradores_financeiro_role_check;
alter table public.colaboradores
  add constraint colaboradores_financeiro_role_check
  check (financeiro_role is null or financeiro_role in ('user', 'admin'));
