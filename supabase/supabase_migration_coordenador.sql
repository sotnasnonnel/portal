-- ============================================================================
-- Perfil Coordenador — equipe recursiva (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Gestor -> Coordenador -> usuários. O gestor herda visão/aprovação de toda a
-- subárvore. app_private.manages() passa de "superior direto" a "ancestral".
-- ============================================================================

-- Descendentes de <raiz> (não inclui a própria raiz). UNION (não ALL) protege
-- contra ciclos acidentais de superior_id.
create or replace function app_private.descendentes(raiz uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  with recursive arvore as (
    select id from public.colaboradores where superior_id = raiz
    union
    select c.id from public.colaboradores c join arvore a on c.superior_id = a.id
  )
  select id from arvore
$$;

revoke all on function app_private.descendentes(uuid) from public;
grant execute on function app_private.descendentes(uuid) to authenticated;

-- manages(): o logado é ANCESTRAL de <target>? (antes: superior direto)
create or replace function app_private.manages(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target in (
    select app_private.descendentes(app_private.my_colaborador_id())
  )
$$;

-- Equipe do logado (diretos + equipes dos coordenadores abaixo), para o front.
create or replace function public.get_minha_equipe()
returns table (id uuid) language sql stable security definer set search_path = '' as $$
  select * from app_private.descendentes(app_private.my_colaborador_id())
$$;

revoke all on function public.get_minha_equipe() from public;
grant execute on function public.get_minha_equipe() to authenticated;
-- anon herda EXECUTE do default do PostgREST; revoga explicitamente
-- (para anon retornaria vazio, mas o advisor de segurança sinaliza).
revoke execute on function public.get_minha_equipe() from anon;

-- colaboradores_select: troca "superior direto" por "ancestral" (subárvore).
drop policy if exists colaboradores_select on public.colaboradores;
create policy colaboradores_select on public.colaboradores
for select to authenticated
using (
  auth_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))   -- 1º login (auth_id nulo)
  or app_private.is_admin()
  or app_private.manages(id)
);

-- ciclos_ausencia: as policies existentes já usam manages(colaborador_id);
-- com manages() recursivo o gestor lê e aprova a equipe dos coordenadores
-- sem reescrever policy nenhuma.
