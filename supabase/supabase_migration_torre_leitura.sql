-- Torre de Controle: leitura ampla para quem a Torre é feita
-- ============================================================================
-- NÃO APLICADO. Isto ALARGA o que um grupo de pessoas enxerga — decisão de
-- quem responde pelo dado, não minha. Leia "O que isto expõe" antes de rodar.
--
-- O PROBLEMA
--
-- A Torre foi liberada para coordenador, gestor e admin (config/torre.js). Mas
-- a RLS não sabe disso. Hoje:
--
--   chamados_adm_select        = solicitante OR atendente OR is_adm_time() OR aprovador
--   mobilizacao_processos_sel  = is_adm_time() OR mob_pode_ver_processo(id)
--
-- Ou seja: um gerente que NÃO é do time do Adm abre a Torre e vê a matriz de
-- chamados quase vazia, o Mapa quase vazio e a lista de Etapas quase vazia — e
-- sem nada dizendo que falta coisa. Uma tela de reunião que esconde o que a
-- reunião existe para discutir é pior que tela nenhuma: ela dá a entender que
-- está tudo bem.
--
-- Hoje isso não aparece porque só marcus e andre estão liberados, e os dois são
-- admin do Adm. Aparece no dia em que a Torre abrir para os 35 gestores e
-- coordenadores — que é o objetivo dela.
--
-- POR QUE UM HELPER, E NÃO A CONDIÇÃO SOLTA NA POLICY
--
-- Mesma razão já documentada em mob_pode_ver_processo: policy que consulta
-- `colaboradores` diretamente volta a passar pela RLS de colaboradores, e as
-- duas se chamam em círculo. SECURITY DEFINER corta o ciclo.
-- ============================================================================

create or replace function app_private.e_torre()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- A MESMA lista de PERFIS_TORRE em src/config/torre.js. Se uma mudar sem a
  -- outra, a tela deixa entrar quem o banco não deixa ler (ou o contrário), e o
  -- sintoma é uma pagina vazia sem erro — o pior tipo de bug para diagnosticar.
  select exists (
    select 1 from public.colaboradores c
     where c.user_id = auth.uid()
       and c.perfil in ('coordenador', 'gestor', 'admin')
  );
$$;

revoke execute on function app_private.e_torre() from anon;

-- ---------------------------------------------------------------------------
-- Chamados do Adm
-- ---------------------------------------------------------------------------
drop policy if exists chamados_adm_select on public.chamados_adm;
create policy chamados_adm_select on public.chamados_adm
  for select using (
    solicitante_id = app_private.my_colaborador_id()
    or atendente_id = app_private.my_colaborador_id()
    or app_private.is_adm_time()
    or app_private.adm_e_aprovador(id)
    -- Novo, e SÓ para leitura: a Torre não escreve nada.
    or app_private.e_torre()
  );

-- O UPDATE fica como está, de propósito: a Torre é tela de consulta, e quem vê
-- não passa a poder mexer.

-- ---------------------------------------------------------------------------
-- Mobilização — processos e etapas
-- ---------------------------------------------------------------------------
drop policy if exists mobilizacao_processos_select on public.mobilizacao_processos;
create policy mobilizacao_processos_select on public.mobilizacao_processos
  for select using (
    app_private.is_adm_time()
    or app_private.mob_pode_ver_processo(id)
    or app_private.e_torre()
  );

drop policy if exists mobilizacao_etapas_select on public.mobilizacao_etapas;
create policy mobilizacao_etapas_select on public.mobilizacao_etapas
  for select using (
    app_private.is_adm_time()
    or app_private.mob_pode_ver_processo(processo_id)
    or app_private.e_torre()
  );

notify pgrst, 'reload schema';

-- ============================================================================
-- O QUE ISTO EXPÕE
--
-- 39 pessoas (3 coordenadores + 32 gestores + 4 admins, na contagem de
-- 08/09/2026) passam a LER todos os chamados do Administrativo e todas as
-- mobilizações. Nenhuma delas ganha permissão de escrita.
--
-- Chamado do Adm carrega dado sensível: solicitação de EPI diz o tamanho da
-- roupa de alguém, mobilização diz salário em alguns casos, "outras demandas" é
-- texto livre e pode ter qualquer coisa. Hoje esse conteúdo é visível para o
-- time do Adm; passaria a ser visível para toda a gerência.
--
-- ALTERNATIVA MAIS ESTREITA, se o texto integral incomodar: em vez de alargar o
-- select, criar uma view AGREGADA (contagens por classe/serviço/status, sem
-- assunto e sem campos) com security_invoker OFF e dar select nela a e_torre().
-- A matriz de chamados funciona só com contagens — foi desenhada assim. O que
-- se perde é a lista de Etapas e o detalhe, que continuariam restritos.
-- Essa é a opção que eu escolheria: dá à Torre o que ela precisa e nada mais.
-- ============================================================================
