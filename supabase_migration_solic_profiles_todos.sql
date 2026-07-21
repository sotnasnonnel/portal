-- ============================================================================
-- Libera o módulo Solicitações para todo colaborador cadastrado
-- (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Antes, só quem tinha linha em solic_profiles (42 perfis migrados do app
-- antigo) via o card e conseguia abrir solicitações. Agora:
--   1) Seed: cria perfil role='user' para todo colaborador ativo sem perfil
--      (match por e-mail, mesmo critério de resolução do app).
--   2) RPC provisionar_meu_solic_profile(): no 1º login de um usuário sem
--      perfil, cria a linha na hora (SECURITY DEFINER porque a RLS não deixa
--      o próprio usuário se inserir). Idempotente. Chamada por
--      AuthContext.resolveSolicProfile quando não acha o perfil.
-- created_by das surveys continua apontando para solic_profiles.id — por isso
-- provisionar a linha (e não só liberar o card no front) é obrigatório.
-- ============================================================================

-- 1) Seed: um perfil para cada colaborador ativo que ainda não tem
insert into public.solic_profiles (id, auth_id, email, name, role)
select gen_random_uuid(), c.auth_id, lower(c.email), c.nome, 'user'
from public.colaboradores c
where c.ativo
  and c.email is not null
  and not exists (
    select 1 from public.solic_profiles p
    where lower(p.email) = lower(c.email)
  );

-- 2) Auto-provisionamento no 1º login (cobre cadastros futuros)
create or replace function public.provisionar_meu_solic_profile()
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
  if exists (select 1 from public.solic_profiles where auth_id = (select auth.uid())) then
    return;
  end if;
  -- Perfil antigo ainda sem vínculo: só liga o auth_id (não duplica)
  if exists (select 1 from public.solic_profiles where lower(email) = v_email) then
    update public.solic_profiles
      set auth_id = (select auth.uid())
      where lower(email) = v_email and auth_id is null;
    return;
  end if;
  insert into public.solic_profiles (id, auth_id, email, name, role)
  values (gen_random_uuid(), (select auth.uid()), v_email, v_nome, 'user');
end;
$$;
revoke all on function public.provisionar_meu_solic_profile() from public;
grant execute on function public.provisionar_meu_solic_profile() to authenticated;
