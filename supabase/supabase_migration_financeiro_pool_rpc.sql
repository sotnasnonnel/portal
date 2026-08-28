-- Migration: financeiro_pool_rpc (projeto bogsuuhrgvopzgcceoqz)
--
-- Pool de colaboradores (id, nome, perfil) para a tela de Fluxos do Financeiro.
-- SECURITY DEFINER: contorna a RLS de colaboradores (as executoras do Financeiro
-- podem não ser admin do DP), mas SÓ retorna linhas se o chamador for admin do
-- Financeiro — senão o WHERE fica falso e o retorno é vazio.
create or replace function public.financeiro_colaboradores_pool()
returns table(id uuid, nome text, perfil text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.perfil
  from public.colaboradores c
  where c.ativo = true
    and c.perfil in ('coordenador', 'gestor', 'admin')
    and app_private.is_financeiro_admin()
  order by c.nome
$$;
revoke all on function public.financeiro_colaboradores_pool() from public;
grant execute on function public.financeiro_colaboradores_pool() to authenticated;
