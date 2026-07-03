-- ============================================================================
-- Provisiona um colaborador "Sem acesso" no 1º login Microsoft
-- (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Antes, quem não estava em colaboradores era BLOQUEADO no login. Agora, no 1º
-- login, cria-se um colaborador com nome+e-mail da conta Microsoft, perfil nulo
-- ("Sem acesso") e ativo=true — para a pessoa aparecer nas listas (Gerenciar
-- acessos / Listagem DP) e o admin poder atribuir um papel. SECURITY DEFINER
-- porque a RLS de colaboradores só deixa admin inserir. Idempotente.
-- Chamada por AuthContext.resolveColaborador quando não acha o colaborador.
-- ============================================================================

create or replace function public.provisionar_meu_colaborador()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_nome  text := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() ->> 'email'
  );
begin
  if v_email is null then return; end if;
  if exists (select 1 from public.colaboradores where auth_id = (select auth.uid())) then return; end if;
  if exists (select 1 from public.colaboradores where lower(email) = v_email) then return; end if;
  insert into public.colaboradores (nome, email, perfil, ativo, auth_id)
  values (v_nome, v_email, null, true, (select auth.uid()));
end;
$$;
revoke all on function public.provisionar_meu_colaborador() from public;
grant execute on function public.provisionar_meu_colaborador() to authenticated;
