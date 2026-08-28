-- ============================================================================
-- ATENÇÃO: esta migração é do projeto BACKOFFICE (dvvqgoxqawyhycakppps), não do
-- portal_phd. Está versionada aqui porque quem depende dela é o Portal.
-- (Aplicada em 2026-08-28.)
--
-- Views só-leitura para o Portal ler as iniciativas da Inovação e onde elas
-- estão aplicadas — a tela Programas > Iniciativas em uso.
--
-- POR QUE VIEW, e não policy de anon nas tabelas (que é o que o organograma
-- faz): a oper_ferramenta_uso carrega custo_mensal, ganho_mensal e taxa_hora, e
-- a chave anon do backoffice vai no bundle do navegador do Portal. A view é o
-- recorte do que pode sair; as tabelas continuam exigindo login no backoffice e
-- ser membro de Governança/Operação.
--
-- As views são SECURITY DEFINER (o padrão do Postgres): é isso que permite ao
-- anon ler através delas sem abrir as tabelas de origem. Conferido depois de
-- aplicar: `set local role anon` lê 16 e 32 linhas pelas views, e 0 e 0 nas
-- tabelas.
-- ============================================================================

create or replace view public.portal_inovacao_iniciativas as
select p.id, p.titulo, p.subtitulo, p.area, p.estagio, p.responsavel,
       p.data_estagio, p.ordem
from public.inovacao_pipeline p;

comment on view public.portal_inovacao_iniciativas is
  'Recorte publico (anon) de inovacao_pipeline para o Portal. So identificacao e estagio -- nenhum numero.';

create or replace view public.portal_inovacao_aplicacoes as
select u.id, u.iniciativa_id, u.tipo_local,
       u.obra_id, o.cod_phd, o.cod_ct, o.produto, o.gerente,
       o.status as obra_status,
       u.area_ga, u.inicio, u.fim
from public.oper_ferramenta_uso u
left join public.organograma_obra o on o.id = u.obra_id
where u.deleted_at is null;

comment on view public.portal_inovacao_aplicacoes is
  'Recorte publico (anon) de oper_ferramenta_uso para o Portal: onde cada iniciativa esta aplicada. Custo, ganho e taxa/hora ficam de fora de proposito.';

grant select on public.portal_inovacao_iniciativas to anon, authenticated;
grant select on public.portal_inovacao_aplicacoes  to anon, authenticated;
