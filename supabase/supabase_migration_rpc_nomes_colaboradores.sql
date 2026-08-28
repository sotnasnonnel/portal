-- ============================================================================
-- RPC nomes_colaboradores — resolve SÓ (id, nome) por lista de ids
-- (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Complementa a RLS de supabase_migration_rls_dp.sql. A policy colaboradores_select
-- restringe a leitura à própria linha + equipe (subordinados diretos) + admin.
-- Porém, ao criar uma requisição, o gestor precisa do NOME dos aprovadores da
-- sua cadeia (solicitacoes_rh_fluxos.aprovadores), que normalmente estão ACIMA
-- dele na hierarquia (ex.: Lucas Ferraz, Pedro Morais) e portanto a RLS bloqueia.
-- Sem o nome, montarEtapasDeConfig() lançava
--   "Aprovador sem nome resolvido (id ...). Recarregue e tente de novo."
--
-- Esta função SECURITY DEFINER expõe APENAS o nome (nunca senha/salário) e só
-- para os ids explicitamente informados. Usada por resolverCadeia()
-- em src/pages/Gestor/requisicoes/useRequisicaoForm.js.
-- ============================================================================

create or replace function public.nomes_colaboradores(p_ids uuid[])
returns table(id uuid, nome text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome
  from public.colaboradores c
  where c.id = any(p_ids)
$$;

revoke all on function public.nomes_colaboradores(uuid[]) from public;
grant execute on function public.nomes_colaboradores(uuid[]) to authenticated;
