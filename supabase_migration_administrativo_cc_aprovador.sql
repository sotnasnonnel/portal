-- Migration: administrativo — centro de custo do APROVADOR no chamado
-- (projeto bogsuuhrgvopzgcceoqz)
--
-- O campo "Centro de custo" da solicitação passa a trazer o CC de quem aprova
-- (a cabeça da cadeia: exceção cadastrada em chamados_adm_fluxos ou, na falta
-- dela, o coordenador/gerente do organograma), e não mais a gerência de horas
-- do próprio solicitante. O gasto corre por conta de quem avaliza.
--
-- Aqui mora só o ACESSO: a RLS de colaboradores libera a própria linha e a
-- subárvore abaixo da pessoa, então ninguém enxerga a gerência de horas do
-- próprio superior. QUEM é o aprovador continua sendo decidido no JS
-- (cabecaDaCadeia, em src/modules/administrativo/lib/chamados.js).
-- ============================================================================

drop function if exists public.chamados_adm_centro_custo(uuid);

-- Devolve APENAS o nome da gerência de horas (o centro de custo) da pessoa
-- informada — nunca e-mail, salário ou qualquer outro dado do cadastro.
create function public.chamados_adm_centro_custo(p_pessoa uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select g.nome
    from public.colaboradores c
    join public.horas_gerencias g on g.id = c.horas_gerencia_id
   where c.id = p_pessoa
$$;

-- Sem o revoke explícito o Supabase deixaria um anônimo varrer a lotação de
-- todo mundo via /rest/v1/rpc (ALTER DEFAULT PRIVILEGES concede EXECUTE a
-- anon/authenticated em funções novas do schema public).
revoke all on function public.chamados_adm_centro_custo(uuid) from public;
revoke execute on function public.chamados_adm_centro_custo(uuid) from anon;
grant execute on function public.chamados_adm_centro_custo(uuid) to authenticated;
