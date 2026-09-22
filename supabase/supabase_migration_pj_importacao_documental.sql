-- Migration: 'documental' como tipo de importação do Fechamento PJ (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- A importação documental do prestador (o ZIP da pasta que vem do RH) grava em
-- pj_importacoes como qualquer outra importação, para ficar no histórico junto
-- com folha, organograma e Bradesco. Só que o check do `tipo` foi escrito antes
-- dela existir e só conhecia os quatro tipos originais, então a gravação morria
-- com:
--
--     new row for relation "pj_importacoes" violates check constraint
--     "pj_importacoes_tipo_check"
--
-- A tela já tinha feito o trabalho todo nesse ponto: o cadastro e os
-- dependentes eram salvos e só o registro do histórico falhava, derrubando a
-- confirmação inteira.
--
-- Nada além do check muda: as colunas de pj_importacoes atendem a importação
-- documental como estão (arquivo = nome do ZIP, linhas = quantidade de
-- documentos, localizados/sem_correspondencia = achou ou não o cadastro, e o
-- resumo em jsonb guarda campos lidos, fontes, dependentes e avisos).
--
-- Para derrubar:
--     alter table public.pj_importacoes drop constraint pj_importacoes_tipo_check;
--     alter table public.pj_importacoes add constraint pj_importacoes_tipo_check
--       check (tipo in ('folha', 'organograma', 'bradesco', 'historico'));
-- ============================================================================

alter table public.pj_importacoes
  drop constraint if exists pj_importacoes_tipo_check;

alter table public.pj_importacoes
  add constraint pj_importacoes_tipo_check
  check (tipo in ('folha', 'organograma', 'bradesco', 'historico', 'documental'));

comment on constraint pj_importacoes_tipo_check on public.pj_importacoes is
  'Tipos de importação do Fechamento PJ. ''documental'' é a pasta .zip de documentos do prestador (ImportarDocumentos.jsx).';
