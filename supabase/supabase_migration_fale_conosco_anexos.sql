-- ============================================================================
-- Fale conosco: anexos (print de tela, foto, PDF) na mensagem
-- (projeto bogsuuhrgvopzgcceoqz — rodar no SQL Editor, como postgres)
--
-- PRÉ-REQUISITO DE ORDEM: aplicar ANTES do deploy do front. O modal novo grava
-- a coluna `anexos`; sem ela, todo envio falha com "Could not find the
-- 'anexos' column".
--
-- Um bug descrito em 150 caracteres ("não consigo salvar") raramente se
-- reproduz; o print da tela resolve a maioria. Só a MENSAGEM leva anexo — a
-- resposta continua só texto, por enquanto.
--
-- Diferente de chamados-adm-anexos, o bucket aqui NÃO é aberto a qualquer
-- logado: print de tela pode mostrar salário, CPF ou dado de saúde de outra
-- pessoa. Quem lê é o autor e quem atende — o mesmo recorte da tabela.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Coluna — mesmo formato das Requisições DP e do Administrativo:
--    [{ path, nome }]. Até 3 arquivos, que é o que a tela oferece.
-- ---------------------------------------------------------------------------
alter table fale_conosco
  add column if not exists anexos jsonb not null default '[]'::jsonb;

alter table fale_conosco drop constraint if exists fale_conosco_anexos_chk;
alter table fale_conosco add constraint fale_conosco_anexos_chk
  check (jsonb_typeof(anexos) = 'array' and jsonb_array_length(anexos) <= 3);

-- ---------------------------------------------------------------------------
-- 2. Bucket privado. Download só por URL assinada.
--    Imagens (o print colado chega como PNG) e PDF; 10 MB por arquivo.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fale-conosco-anexos', 'fale-conosco-anexos', false, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- O arquivo mora em <colaborador_id do autor>/<uuid>/<nome>. A primeira pasta
-- é o que as policies conferem: ninguém sobe arquivo na pasta de outro.
drop policy if exists fale_conosco_anexos_insert on storage.objects;
create policy fale_conosco_anexos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fale-conosco-anexos'
    and (storage.foldername(name))[1] = (select app_private.my_colaborador_id())::text
  );

-- Lê o autor (a própria pasta) e quem atende (tudo).
drop policy if exists fale_conosco_anexos_select on storage.objects;
create policy fale_conosco_anexos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fale-conosco-anexos'
    and (
      (storage.foldername(name))[1] = (select app_private.my_colaborador_id())::text
      or (select app_private.is_suporte())
    )
  );

-- Apagar serve SÓ ao rollback do envio (subiu o arquivo, o insert da mensagem
-- falhou): o autor apaga da própria pasta o que nenhuma mensagem cita. Depois
-- de enviado, o anexo é parte do registro, como o texto — não sai mais.
drop policy if exists fale_conosco_anexos_delete on storage.objects;
create policy fale_conosco_anexos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fale-conosco-anexos'
    and (storage.foldername(name))[1] = (select app_private.my_colaborador_id())::text
    and not exists (
      select 1 from public.fale_conosco f
      where f.anexos @> jsonb_build_array(jsonb_build_object('path', storage.objects.name))
    )
  );

notify pgrst, 'reload schema';
