-- Migration: itens novos em Ajustes de Valores (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido: em Gestão de Pessoas › Consultas › Ajustes de Valores, poder
-- cadastrar um item novo (equipamento, software, EPI ou benefício) com o preço,
-- e esse item aparecer como opção nos formulários de Nova Vaga e Contratação.
--
-- Até aqui as listas eram fixas no código (config/novaVaga.js e
-- config/formularioContratacao.js) e precos_itens só guardava o preço delas.
-- A coluna `extra` marca a linha que É o item (criada pela tela), e não só o
-- preço de um item do código. Sem a marca, uma linha de preço de item que saiu
-- do código voltaria a aparecer no formulário como se fosse cadastrada.
--
-- Escrita: a policy precos_itens_write (supabase_migration_valores_ajuste.sql)
-- já cobre insert/delete para quem pode ajustar valores. Nada muda na RLS.
--
-- ORDEM: aplicar ANTES de publicar o front. O front novo lê a coluna `extra`;
-- sem ela, a tela e os preços dos formulários deixam de carregar.
--
-- Para derrubar (depois de voltar o front):
--     delete from public.precos_itens where extra;
--     alter table public.precos_itens drop column extra;
-- ============================================================================

alter table public.precos_itens
  add column if not exists extra boolean not null default false;

comment on column public.precos_itens.extra is
  'true = item cadastrado na tela Ajustes de Valores (não existe na lista fixa do código); aparece como opção nos formulários de requisição.';

notify pgrst, 'reload schema';
