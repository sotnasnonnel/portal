-- Migration: administrativo — cadeia de aprovação Coordenador → Gerente
-- (projeto bogsuuhrgvopzgcceoqz)
--
-- Decisão da diretoria (ago/2026): o chamado do Adm passa a subir a hierarquia
-- como no Gestão de Pessoas — primeiro o COORDENADOR da pessoa, depois o
-- GERENTE acima desse coordenador. Só então entram as faixas de alçada por
-- valor e, por fim, a execução pelo time do Administrativo.
--
-- Antes o chamado parava no superior direto (uma etapa só) e, quando a pessoa
-- tinha cadeia cadastrada no Gestão de Pessoas, somava aquela cadeia — que
-- carrega conferentes do DP sem relação com compra, frota ou viagem.
--
-- Aqui mora apenas o ACESSO ao organograma: a RPC devolve a cadeia crua de
-- superiores. QUEM é o "gerente do coordenador" é decidido em
-- src/modules/administrativo/lib/alcadaAdm.js, onde a regra fica testável e
-- perto das demais regras do módulo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Cadeia de superiores do solicitante, para o módulo Administrativo.
--
-- SECURITY DEFINER por necessidade: a policy colaboradores_select libera a
-- própria linha e a subárvore abaixo da pessoa — ninguém enxerga o superior do
-- próprio superior, que é exatamente o gerente que esta regra precisa achar.
--
-- Expõe nome e função, NÃO o e-mail: para escolher o aprovador basta o cargo, e
-- a RPC é chamada por qualquer solicitante autenticado. `alcadas_resolver_papeis`
-- já devolve e-mail, mas ali ele é usado na notificação — aqui seria só
-- superfície a mais.
-- ----------------------------------------------------------------------------
drop function if exists public.chamados_adm_cadeia(uuid);

create function public.chamados_adm_cadeia(p_solicitante uuid)
returns table(nivel int, id uuid, nome text, funcao text)
language sql stable security definer set search_path = '' as $$
  select c.nivel, c.id, c.nome, c.funcao
    from app_private.cadeia_superiores(p_solicitante) c
   order by c.nivel
$$;

-- `revoke ... from public` NÃO tira o acesso do anon: o Supabase concede EXECUTE
-- em funções novas do schema public a anon/authenticated via ALTER DEFAULT
-- PRIVILEGES. Sem o revoke explícito, um anônimo enumeraria o organograma
-- inteiro via /rest/v1/rpc.
revoke all on function public.chamados_adm_cadeia(uuid) from public;
revoke execute on function public.chamados_adm_cadeia(uuid) from anon;
grant execute on function public.chamados_adm_cadeia(uuid) to authenticated;
