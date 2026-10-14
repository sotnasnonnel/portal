-- Migration: anexos só para quem pode ver o registro (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Corrige os achados F1-F5 e F9 da varredura de segurança de 13/10/2026
-- (CLAUDE-SECURITY-20261013-122633):
--
--   ajuda-custo-anexos, mapeamento-anexos, vaga-anexos
--     Buckets PÚBLICOS com policies para `anon`: sem login, qualquer um com a
--     chave pública listava, baixava, enviava e APAGAVA os anexos das
--     requisições do DP (inclusive de vaga sigilosa).
--   chamados-adm-anexos, mobilizacao-anexos
--     Buckets privados, mas as policies só conferiam o bucket: qualquer logado
--     listava, baixava e apagava anexos de chamados e da mobilização (ASO,
--     contratos, documentos pessoais).
--
-- A regra nova, a mesma para os cinco:
--   - ENVIAR: só logado (anon sai).
--   - VER: quem enviou o arquivo, ou quem consegue ver a linha que o referencia
--     (a coluna `anexos` [{path, nome}] ou o legado `anexo_path`). A consulta
--     roda com a RLS de quem pergunta, então o anexo herda exatamente a regra de
--     acesso da requisição, do chamado ou do comentário — mensagem interna do
--     Atendimento continua invisível ao solicitante, inclusive o anexo.
--   - APAGAR: só quem enviou. Os únicos `remove()` do front são do próprio
--     autor (rollback de upload que falhou e anexo tirado ao editar/reenviar).
--   - Ninguém lista o bucket inteiro: listar também passa pela regra de VER.
--
-- ⚠ DEPENDÊNCIA DE DEPLOY: os três buckets do DP deixam de ser públicos, e o
-- front antigo monta link com getPublicUrl — que passa a dar 400. Publique o
-- front que usa URL assinada (ModalRespostas.buscarRespostas) JUNTO com esta
-- migration. Entre um e outro, só o clique no anexo das requisições do DP
-- falha; nada se perde.

-- Quem consegue ver a linha que referencia este arquivo? SECURITY INVOKER de
-- propósito: as tabelas abaixo são lidas com a RLS de quem pergunta.
create or replace function app_private.anexo_referenciado_visivel(p_bucket text, p_path text)
returns boolean
language sql stable security invoker set search_path = '' as $$
  select case p_bucket
    when 'ajuda-custo-anexos' then exists (
      select 1 from public.ajudas_custo t
       where t.anexo_path = p_path
          or t.anexos @> jsonb_build_array(jsonb_build_object('path', p_path)))
    when 'mapeamento-anexos' then exists (
      select 1 from public.mapeamentos t
       where t.anexo_path = p_path
          or t.anexos @> jsonb_build_array(jsonb_build_object('path', p_path)))
    when 'vaga-anexos' then exists (
      select 1 from public.vagas t
       where t.anexo_path = p_path
          or t.anexos @> jsonb_build_array(jsonb_build_object('path', p_path)))
    when 'chamados-adm-anexos' then
      exists (select 1 from public.chamados_adm t
               where t.anexos @> jsonb_build_array(jsonb_build_object('path', p_path)))
      or exists (select 1 from public.chamados_adm_interacoes t
               where t.anexos @> jsonb_build_array(jsonb_build_object('path', p_path)))
    when 'mobilizacao-anexos' then
      exists (select 1 from public.mobilizacao_etapa_comentarios t
               where t.anexos @> jsonb_build_array(jsonb_build_object('path', p_path)))
      or exists (select 1 from public.mobilizacao_etapas t
               where t.anexos @> jsonb_build_array(jsonb_build_object('path', p_path)))
    else false
  end
$$;
revoke all on function app_private.anexo_referenciado_visivel(text, text) from public;
revoke execute on function app_private.anexo_referenciado_visivel(text, text) from anon;
grant execute on function app_private.anexo_referenciado_visivel(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Buckets do DP: deixam de ser públicos, e as policies de anon saem.
update storage.buckets set public = false
 where id in ('ajuda-custo-anexos', 'mapeamento-anexos', 'vaga-anexos');

drop policy if exists anon_select_ajuda_custo_anexos on storage.objects;
drop policy if exists anon_insert_ajuda_custo_anexos on storage.objects;
drop policy if exists anon_delete_ajuda_custo_anexos on storage.objects;
drop policy if exists anon_select_mapeamento_anexos on storage.objects;
drop policy if exists anon_insert_mapeamento_anexos on storage.objects;
drop policy if exists anon_delete_mapeamento_anexos on storage.objects;
drop policy if exists anon_select_vaga_anexos on storage.objects;
drop policy if exists anon_insert_vaga_anexos on storage.objects;
drop policy if exists anon_delete_vaga_anexos on storage.objects;

-- Atendimento e Mobilização: as policies antigas (só bucket_id) saem.
drop policy if exists chamados_adm_anexos_insert on storage.objects;
drop policy if exists chamados_adm_anexos_select on storage.objects;
drop policy if exists chamados_adm_anexos_delete on storage.objects;
drop policy if exists mobilizacao_anexos_insert on storage.objects;
drop policy if exists mobilizacao_anexos_select on storage.objects;
drop policy if exists mobilizacao_anexos_delete on storage.objects;

-- ---------------------------------------------------------------------------
-- Uma policy por operação, cobrindo os cinco buckets.
drop policy if exists anexos_protegidos_insert on storage.objects;
create policy anexos_protegidos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('ajuda-custo-anexos', 'mapeamento-anexos', 'vaga-anexos',
                  'chamados-adm-anexos', 'mobilizacao-anexos')
  );

drop policy if exists anexos_protegidos_select on storage.objects;
create policy anexos_protegidos_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('ajuda-custo-anexos', 'mapeamento-anexos', 'vaga-anexos',
                  'chamados-adm-anexos', 'mobilizacao-anexos')
    and (
      owner_id = (select auth.uid())::text
      or app_private.anexo_referenciado_visivel(bucket_id, name)
    )
  );

drop policy if exists anexos_protegidos_delete on storage.objects;
create policy anexos_protegidos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('ajuda-custo-anexos', 'mapeamento-anexos', 'vaga-anexos',
                  'chamados-adm-anexos', 'mobilizacao-anexos')
    and owner_id = (select auth.uid())::text
  );

notify pgrst, 'reload schema';
