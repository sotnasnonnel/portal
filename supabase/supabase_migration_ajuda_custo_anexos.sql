-- Migration: ajuda_custo_anexos (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Conserta: "Could not find the 'anexos' column of 'ajudas_custo' in the schema
-- cache" ao usar "Responder e reenviar" numa requisição de Ajuda de Custo.
--
-- Causa: a migração supabase_migration_requisicoes_modalidade_e_multi_anexos.sql
-- criou a coluna `anexos` jsonb em `mapeamentos` e `vagas`, mas NÃO em
-- `ajudas_custo`. Só que config/reenvio.js declara `bucket` para ajuda_custo, e o
-- EditarReenviarModal grava `{ anexos: [...] }` sempre que o tipo tem bucket —
-- então o reenvio de Ajuda de Custo falhava 100% das vezes. (A criação não
-- falhava: FormAjudaCusto grava o par legado anexo_path/anexo_nome.)
--
-- Além de criar a coluna, migramos o anexo ÚNICO legado para dentro do array.
-- Sem isso o reenvio seria uma perda silenciosa: ModalRespostas usa o array
-- QUANDO ele não está vazio e só cai no legado caso contrário (`else if`), então
-- o primeiro reenvio passaria a exibir apenas os anexos novos e o original
-- sumiria da tela — sem erro nenhum, que é o pior tipo de falha.
--
-- anexo_path/anexo_nome NÃO são removidos: seguem preenchidos para os registros
-- antigos e para qualquer leitura que ainda dependa deles.
-- ============================================================================

alter table public.ajudas_custo
  add column if not exists anexos jsonb not null default '[]'::jsonb;

-- Backfill do anexo legado -> array [{ path, nome }] (formato de useAnexos/uploadAnexo).
-- Idempotente: só toca linhas com anexo legado e array ainda vazio.
update public.ajudas_custo
set anexos = jsonb_build_array(
      jsonb_build_object('path', anexo_path, 'nome', coalesce(anexo_nome, 'Anexo'))
    )
where anexo_path is not null
  and anexo_path <> ''
  and (anexos is null or anexos = '[]'::jsonb);

-- O PostgREST cacheia o schema; sem recarregar, o erro continuaria aparecendo
-- mesmo com a coluna já criada.
notify pgrst, 'reload schema';

-- ============================================================================
-- Conferir depois de aplicar:
--   select count(*) filter (where jsonb_array_length(anexos) > 0) as com_anexo,
--          count(*) as total
--   from public.ajudas_custo;
-- Reverter:
--   alter table public.ajudas_custo drop column anexos;
-- ============================================================================
