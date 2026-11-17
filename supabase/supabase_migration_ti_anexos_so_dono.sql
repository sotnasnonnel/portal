-- Migration: ti_anexos_so_dono (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Anexo de ativo (bucket ti-anexos, pasta ativos/<id>/) pode ser o termo
-- assinado em papel, com CPF. Antes abria para quem enxerga o ativo, ou seja,
-- também para o gestor (subárvore). Agora, fora do time de TI, só abre para o
-- RESPONSÁVEL atual do ativo. termos/<id>/ já era só do dono (RLS de ti_termos).
--
-- Substitui a policy ti_anexos_select de supabase_migration_ti_visibilidade.sql.
-- Idempotente; pode ir antes ou depois do front.
-- ============================================================================

drop policy if exists ti_anexos_select on storage.objects;
create policy ti_anexos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ti-anexos' and (
      app_private.ti_time()
      or (split_part(name, '/', 1) = 'ativos' and exists (
            select 1 from public.ti_ativos a
             where a.id::text = split_part(name, '/', 2)
               and lower(trim(a.responsavel)) = (
                 select lower(c.email) from public.colaboradores c
                  where c.auth_id = (select auth.uid()) limit 1)))
      or (split_part(name, '/', 1) = 'termos' and exists (
            select 1 from public.ti_termos t where t.id::text = split_part(name, '/', 2)))
    )
  );

notify pgrst, 'reload schema';
