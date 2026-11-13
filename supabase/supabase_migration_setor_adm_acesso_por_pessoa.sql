-- Migration: setor_adm_acesso_por_pessoa (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Frota e Alojamentos (card "Administrativo" da Home) passam a ser liberados
-- PESSOA POR PESSOA, no checkbox "Frota e Alojamentos" da coluna
-- "Administrativo (setor)" do Gerenciamento de acessos.
--
-- Antes, quem entrava era uma lista de e-mails chumbada em DOIS lugares que
-- tinham de andar juntos: SETOR_ADM_LIBERADOS (src/config/setorAdm.js) e o
-- corpo de app_private.setor_adm_liberado(). Liberar uma pessoa pedia editar
-- código, buildar e rodar SQL. Agora os dois lados leem a mesma coluna.
--
-- MUDA DUAS REGRAS, de propósito:
--   1. Estar marcado JÁ É ser do time: setor_adm_time() não exige mais papel no
--      Atendimento. Era essa exigência que fazia o liberado sem
--      administrativo_role entrar e encontrar tudo vazio.
--   2. ADMINISTRAR (configurações, excluir cadastro-mestre) agora pede
--      administrativo_role = 'admin'. No lançamento restrito, quem estava na
--      lista administrava mesmo sendo 'atendente'. Consequência: das 5 pessoas
--      de hoje, Marcus e Jarbas ('admin' no Atendimento) seguem administrando;
--      Lennon, Pérla e Edijane ('atendente') continuam lendo e escrevendo, mas
--      deixam de configurar. Para devolver, é um clique na coluna Atendimento —
--      ciente de que lá o 'admin' também vale para os chamados.
--
-- As 5 pessoas da lista antiga já nascem marcadas, para ninguém perder acesso
-- no deploy. O update só MARCA: rodar de novo não remarca quem for desmarcado
-- na tela depois.
--
-- As policies de frota_* e alojamentos* não mudam: seguem chamando
-- setor_adm_time / setor_adm_admin.
--
-- PRÉ-REQUISITO: supabase_migration_setor_adm_acesso.sql (criou as 3 funções) e
-- supabase_migration_administrativo.sql (criou is_adm_admin).
-- APLICAR ANTES DO FRONT: o Gerenciamento de acessos passa a pedir a coluna no
-- select, e sem ela a lista de pessoas não carrega.
-- Idempotente: pode rodar de novo.
--
-- Para derrubar: volte o corpo das três funções pela migration anterior e
--     alter table public.colaboradores drop column setor_adm_acesso;
-- ============================================================================

alter table public.colaboradores
  add column if not exists setor_adm_acesso boolean not null default false;

comment on column public.colaboradores.setor_adm_acesso is
  'Libera Frota e Alojamentos (card "Administrativo" da Home) para esta pessoa, pelo Gerenciamento de acessos: entra e escreve. Lida pela RLS via app_private.setor_adm_time/setor_adm_admin. Não confundir com administrativo_role, que é o Atendimento.';

-- Quem já entrava pela lista de e-mails continua entrando.
update public.colaboradores
   set setor_adm_acesso = true
 where setor_adm_acesso = false
   and lower(email) in (
     'marcus.guimaraes@phdengenharia.eng.br',
     'lennon.santos@phdengenharia.eng.br',
     'jarbas.junior@phdengenharia.eng.br',
     'perla.passos@phdengenharia.eng.br',
     'edijane.rodrigues@phdengenharia.eng.br'
   );

-- Agora é a coluna, e não mais a lista de e-mails. Continua SECURITY DEFINER:
-- lê colaboradores sem depender da RLS de lá.
create or replace function app_private.setor_adm_liberado()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and setor_adm_acesso
  )
$$;

-- Estar liberado já é ser do time: não pede mais papel no Atendimento.
create or replace function app_private.setor_adm_time()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.setor_adm_liberado()
$$;

-- Administrar continua pedindo algo a mais, agora o admin do Atendimento.
create or replace function app_private.setor_adm_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.setor_adm_liberado() and app_private.is_adm_admin()
$$;

-- `create or replace` preserva os grants, mas reafirmar não custa e deixa o
-- arquivo autossuficiente se alguém rodar fora de ordem.
revoke all on function app_private.setor_adm_liberado() from public;
revoke all on function app_private.setor_adm_time() from public;
revoke all on function app_private.setor_adm_admin() from public;
revoke execute on function app_private.setor_adm_liberado() from anon;
revoke execute on function app_private.setor_adm_time() from anon;
revoke execute on function app_private.setor_adm_admin() from anon;
grant execute on function app_private.setor_adm_liberado() to authenticated;
grant execute on function app_private.setor_adm_time() to authenticated;
grant execute on function app_private.setor_adm_admin() to authenticated;
