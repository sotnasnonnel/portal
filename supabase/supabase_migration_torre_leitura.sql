-- Torre de Controle: superfície de leitura própria
-- ============================================================================
-- Aplicado em produção em 09/09/2026.
--
-- O PROBLEMA
--
-- A Torre foi liberada para coordenador, gestor e admin (config/torre.js), mas
-- a RLS não sabe que ela existe:
--
--   chamados_adm_select        = solicitante OR atendente OR is_adm_time() OR aprovador
--   mobilizacao_processos_sel  = is_adm_time() OR mob_pode_ver_processo(id)
--
-- Um gerente que não é do time do Adm abre a Torre e vê quase nada — e sem nada
-- dizendo que falta coisa. Uma tela de reunião que esconde o que a reunião
-- existe para discutir é pior que tela nenhuma: ela sugere que está tudo bem.
--
-- Não aparece hoje porque os três liberados são admin do Adm. Aparece no dia em
-- que a Torre abrir para os 35 gestores, que é o objetivo dela.
--
-- POR QUE NÃO SIMPLESMENTE ALARGAR A RLS
--
-- Era o caminho óbvio, e foi descartado depois de olhar o dado. `chamados_adm`
-- guarda os campos do formulário num jsonb, e lá dentro há **CPF, RG, data de
-- nascimento e e-mail pessoal** (chamados de hospedagem e passagem — precisa do
-- documento para reservar). RLS é linha, não coluna: liberar a linha libera o
-- jsonb inteiro. Alargar a policy daria documento de colega a 39 pessoas para
-- resolver um problema de FILTRO.
--
-- A SAÍDA
--
-- Quatro funções SECURITY DEFINER que devolvem EXATAMENTE as colunas que a
-- Torre desenha. Quem passa no portão vê tudo dessas colunas; `campos` não sai
-- daqui, e nenhuma outra tabela fica mais exposta do que já estava. As policies
-- das tabelas continuam intocadas — o módulo de origem não muda de
-- comportamento para ninguém.
--
-- O portão é o MESMO do front (config/torre.js): perfil de liderança ou time do
-- Adm. Se as duas listas divergirem, o sintoma é tela vazia sem erro — o pior
-- tipo de bug para diagnosticar —, por isso a função aponta para o arquivo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- O portão
-- ---------------------------------------------------------------------------
create or replace function app_private.e_torre()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- A MESMA lista de PERFIS_TORRE em src/config/torre.js.
  -- `auth_id`, e nao `user_id`: e a coluna que liga o login a pessoa, a mesma
  -- que is_adm_time() e my_colaborador_id() ja usam.
  select exists (
    select 1 from public.colaboradores c
     where c.auth_id = (select auth.uid())
       and c.perfil in ('coordenador', 'gestor', 'admin')
  );
$$;

create or replace function app_private.pode_torre()
returns boolean
language sql
stable
as $$
  -- Espelha podeAcessarTorre(): liderança OU time do Adm, que é quem apresenta.
  select app_private.e_torre() or app_private.is_adm_time();
$$;

revoke execute on function app_private.e_torre() from anon;
revoke execute on function app_private.pode_torre() from anon;

-- ---------------------------------------------------------------------------
-- 1. Quadro — o union das duas origens, já com o responsável resolvido.
--
-- A view continua `security_invoker = on` e continua servindo quem a consulta
-- direto. Chamada DE DENTRO de uma função SECURITY DEFINER, o papel corrente é
-- o dono, então a RLS das tabelas de baixo não corta — e é justamente esse o
-- efeito que se quer aqui, e só aqui.
-- ---------------------------------------------------------------------------
create or replace function public.torre_quadro()
returns setof public.mobilizacao_torre_v
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.mobilizacao_torre_v where app_private.pode_torre();
$$;

-- ---------------------------------------------------------------------------
-- 2. Etapas de mobilização, com o contexto do processo.
--
-- Sem janela de tempo de propósito: a matriz do Mapa precisa da etapa concluída
-- em janeiro para pintá-la de verde — cortá-la abriria BURACO na linha, e
-- célula vazia ali se lê como "esta etapa não existe neste processo". A lista
-- de Etapas faz o próprio recorte no cliente.
-- ---------------------------------------------------------------------------
create or replace function public.torre_etapas()
returns table (
  id uuid, processo_id uuid, codigo text, ordem int, titulo text, status text,
  data_prevista date, data_real date, dias_atraso int, responsavel_id uuid,
  updated_at timestamptz,
  numero bigint, fluxo text, processo_titulo text, processo_status text, cod_ct text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id, e.processo_id, e.codigo, e.ordem, e.titulo, e.status,
         e.data_prevista, e.data_real, e.dias_atraso, e.responsavel_id,
         e.updated_at,
         p.numero, p.fluxo, p.titulo, p.status, p.cod_ct
    from public.mobilizacao_etapas e
    join public.mobilizacao_processos p on p.id = e.processo_id
   where app_private.pode_torre()
     and p.status <> 'cancelado';
$$;

-- ---------------------------------------------------------------------------
-- 3. Processos em andamento — as LINHAS da matriz do Mapa.
-- ---------------------------------------------------------------------------
create or replace function public.torre_processos()
returns table (
  id uuid, numero bigint, titulo text, fluxo text, status text,
  profissional_nome text, cliente_phd text, cod_ct text, local_obra text,
  responsavel_id uuid, prazo_em date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.numero, p.titulo, p.fluxo, p.status,
         p.profissional_nome, p.cliente_phd, p.cod_ct, p.local_obra,
         p.responsavel_id, p.prazo_em
    from public.mobilizacao_processos p
   where app_private.pode_torre()
     and p.status = 'em_andamento';
$$;

-- ---------------------------------------------------------------------------
-- 4. Chamados do Adm — SEM `campos`.
--
-- Esta é a função que justifica o arquivo inteiro. Ela devolve o que a Torre
-- desenha (tipo, situação, prazo, atendente) e nada do que o formulário
-- guardou. O CPF continua visível só para quem já podia vê-lo.
--
-- `assunto` sai porque é o rótulo do cartão; é a linha de título do chamado,
-- não o corpo dele.
-- ---------------------------------------------------------------------------
create or replace function public.torre_chamados(p_dias_fechados int default 15)
returns table (
  id uuid, numero bigint, classe text, servico text, assunto text, status text,
  criado_em timestamptz, sla_vence_em timestamptz, fechado_em timestamptz,
  atendente_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.numero, c.classe, c.servico, c.assunto, c.status,
         c.criado_em, c.sla_vence_em, c.fechado_em, c.atendente_id
    from public.chamados_adm c
   where app_private.pode_torre()
     and (c.status not in ('fechado', 'reprovado', 'cancelado')
       or c.updated_at >= now() - make_interval(days => p_dias_fechados));
$$;

revoke execute on function public.torre_quadro() from anon;
revoke execute on function public.torre_etapas() from anon;
revoke execute on function public.torre_processos() from anon;
revoke execute on function public.torre_chamados(int) from anon;

grant execute on function public.torre_quadro() to authenticated;
grant execute on function public.torre_etapas() to authenticated;
grant execute on function public.torre_processos() to authenticated;
grant execute on function public.torre_chamados(int) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- O QUE ISTO EXPÕE, EXATAMENTE
--
-- 39 pessoas (3 coordenadores + 32 gestores + 4 admins, na contagem de
-- 09/09/2026) passam a LER, de todos os chamados e mobilizações:
--
--   tipo do chamado · assunto · situação · prazo · atendente · centro de custo
--   etapa · processo · profissional mobilizado · datas · atraso
--
-- E NÃO passam a ler: o conteúdo do formulário (`campos`), as mensagens do
-- chamado, anexos, nem qualquer outra tabela. Nenhuma delas ganha permissão de
-- escrita: as quatro funções são `stable` e só fazem select.
--
-- SE PRECISAR FECHAR DE NOVO: `revoke execute` nas quatro funções. As policies
-- das tabelas não foram tocadas, então não há nada a reverter nelas.
-- ============================================================================
