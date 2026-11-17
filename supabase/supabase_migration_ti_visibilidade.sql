-- Migration: ti_visibilidade (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Módulo TI aberto para CONSULTA a todos, pela hierarquia:
--
--   * quem tem o checkbox "TI" (colaboradores.ti_acesso) vê TUDO e altera;
--     Patrick Pereira passa a ter;
--   * os demais só leem, e só os equipamentos deles e de toda a equipe abaixo
--     deles na hierarquia (colaboradores.superior_id, recursivo):
--       - usuário: só os dele;
--       - coordenador: os dele e dos subordinados;
--       - gerente: os dele, dos coordenadores e dos subordinados destes.
--     É uma regra só (a subárvore), a mesma de app_private.descendentes, que o
--     motor de alçadas já usa.
--
-- Vale para ti_ativos (pelo responsável), ti_termos (só os próprios: têm CPF),
-- ti_movimentacoes (por quem entregou ou recebeu), anexos do bucket ti-anexos e
-- a lista de pessoas de ti_pessoas(). Gravar continua só com ti_time().
--
-- PRÉ-REQUISITO: supabase_migration_ti.sql. Pode ir antes do front: só AMPLIA
-- leitura; o front antigo esconde o card de quem não tem o checkbox.
-- Idempotente.
-- ============================================================================

update public.colaboradores
   set ti_acesso = true
 where ti_acesso = false
   and lower(email) = 'patrick.pereira@phdengenharia.eng.br';

-- E-mails que a pessoa logada enxerga: ela mesma e toda a subárvore abaixo.
-- Devolve array para a policy avaliar UMA vez por consulta (initplan), e não
-- uma vez por linha.
create or replace function app_private.ti_emails_visiveis()
returns text[] language sql stable security definer set search_path = '' as $$
  with eu as (
    select id from public.colaboradores where auth_id = (select auth.uid()) limit 1
  )
  select coalesce(array_agg(distinct lower(c.email)), '{}')
    from public.colaboradores c
   where c.email is not null
     and (c.id in (select id from eu)
          or c.id in (select app_private.descendentes(eu.id) from eu))
$$;
revoke all on function app_private.ti_emails_visiveis() from public;
revoke execute on function app_private.ti_emails_visiveis() from anon;
grant execute on function app_private.ti_emails_visiveis() to authenticated;

drop policy if exists ti_ativos_select on public.ti_ativos;
create policy ti_ativos_select on public.ti_ativos for select to authenticated
  using (
    app_private.ti_time()
    or lower(responsavel) = any ((select app_private.ti_emails_visiveis())::text[])
  );

-- Termos: o termo guarda CPF, então fora do time cada um vê só os PRÓPRIOS.
-- O gestor acompanha a equipe pela situação do termo em ti_ativos.
drop policy if exists ti_termos_select on public.ti_termos;
create policy ti_termos_select on public.ti_termos for select to authenticated
  using (
    app_private.ti_time()
    or lower(pessoa_email) = (
      select lower(c.email) from public.colaboradores c where c.auth_id = (select auth.uid()) limit 1
    )
  );

drop policy if exists ti_movimentacoes_select on public.ti_movimentacoes;
create policy ti_movimentacoes_select on public.ti_movimentacoes for select to authenticated
  using (
    app_private.ti_time()
    or lower(de_responsavel) = any ((select app_private.ti_emails_visiveis())::text[])
    or lower(para_responsavel) = any ((select app_private.ti_emails_visiveis())::text[])
  );

-- Nomes e vínculo: o time vê todos; os demais, só quem está na própria árvore.
create or replace function public.ti_pessoas()
returns table (id uuid, nome text, email text, vinculo text, data_admissao date, ativo boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, lower(c.email), c.formato, c.data_admissao, coalesce(c.ativo, true)
    from public.colaboradores c
   where c.email is not null
     and (app_private.ti_time() or lower(c.email) = any (app_private.ti_emails_visiveis()))
   order by c.nome
$$;
revoke all on function public.ti_pessoas() from public;
revoke execute on function public.ti_pessoas() from anon;
grant execute on function public.ti_pessoas() to authenticated;

-- Anexos: ativos/<id do ativo>/... e termos/<id do termo>/... abrem para quem
-- enxerga o ativo ou o termo (a própria RLS das tabelas decide no exists).
drop policy if exists ti_anexos_select on storage.objects;
create policy ti_anexos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ti-anexos' and (
      app_private.ti_time()
      or (split_part(name, '/', 1) = 'ativos' and exists (
            select 1 from public.ti_ativos a where a.id::text = split_part(name, '/', 2)))
      or (split_part(name, '/', 1) = 'termos' and exists (
            select 1 from public.ti_termos t where t.id::text = split_part(name, '/', 2)))
    )
  );

notify pgrst, 'reload schema';
