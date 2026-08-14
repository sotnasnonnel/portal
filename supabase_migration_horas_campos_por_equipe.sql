-- ============================================================================
-- Controle de Horas — CAMPOS DO APONTAMENTO configuráveis POR EQUIPE
-- ----------------------------------------------------------------------------
-- Antes (supabase_migration_horas_catalogo_tarefas.sql): os campos preenchidos
-- antes de dar play no cronômetro eram um catálogo FIXO da empresa inteira —
-- SIGLA, TAREFA, ETIQUETA e TAREFA 2 — gravados em 4 colunas próprias.
--
-- Agora cada EQUIPE (horas_gerencias) monta os seus: o gestor escolhe o rótulo,
-- o tipo (lista suspensa com opções livres, ou texto livre) e se é obrigatório.
-- O apontamento guarda o que foi preenchido em jsonb, com o rótulo em SNAPSHOT
-- ao lado do valor — assim renomear/apagar um campo depois não reescreve o
-- histórico nem quebra os relatórios (que agrupam pelo rótulo gravado).
--
-- Formato de horas_apontamentos.campos / horas_timer_ativo.campos:
--   [{"id": "<uuid do campo>", "label": "Sigla", "valor": "PTA"}, ...]
--   Na ordem em que a equipe configurou. Campo sem valor não é gravado.
--
-- As colunas sigla/tarefa/etiqueta/tarefa2 NÃO são removidas: guardam o
-- histórico do período do catálogo fixo, e o front continua exibindo/exportando
-- esses apontamentos antigos (mesmo tratamento dado a `ativ`, o legado anterior).
--
-- A carga inicial abaixo semeia, em TODA equipe existente, exatamente os 4
-- campos de hoje com as mesmas opções — ninguém fica sem campos no dia do
-- deploy. Único comportamento perdido de propósito: o filtro SIGLA -> TAREFA
-- (Tarefa nasce como lista suspensa com todas as 155 tarefas). Com campos
-- livres não há como expressar o par sigla/tarefa da planilha.
--
-- Aditivo e idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) A configuração de cada equipe
-- ----------------------------------------------------------------------------
create table if not exists public.horas_campos_apontamento (
  id          uuid primary key default gen_random_uuid(),
  gerencia_id uuid not null references public.horas_gerencias(id) on delete cascade,
  ordem       int  not null default 0,
  label       text not null,
  tipo        text not null default 'dropdown' check (tipo in ('dropdown', 'texto')),
  -- Só para tipo='dropdown'. Lista fechada que a equipe define à vontade.
  opcoes      text[] not null default '{}',
  obrigatorio boolean not null default true,
  criado_em   timestamptz not null default now(),
  -- Lista suspensa sem opção nenhuma é um campo impossível de preencher.
  constraint horas_campos_dropdown_com_opcoes
    check (tipo <> 'dropdown' or cardinality(opcoes) > 0)
);

create index if not exists horas_campos_gerencia_idx
  on public.horas_campos_apontamento (gerencia_id, ordem);

-- Rótulo único por equipe: os relatórios agrupam PELO RÓTULO, então dois campos
-- "Tarefa" na mesma equipe cairiam na mesma coluna do CSV/gráfico.
create unique index if not exists horas_campos_label_uq
  on public.horas_campos_apontamento (gerencia_id, lower(label));

comment on table public.horas_campos_apontamento is
  'Campos que a equipe pede antes de iniciar o cronômetro. Configurados em /horas/config/apontamento.';

-- ----------------------------------------------------------------------------
-- 2) Onde os valores preenchidos são gravados
-- ----------------------------------------------------------------------------
alter table public.horas_apontamentos
  add column if not exists campos jsonb not null default '[]'::jsonb;

alter table public.horas_timer_ativo
  add column if not exists campos jsonb not null default '[]'::jsonb;

comment on column public.horas_apontamentos.campos is
  'Campos configuráveis da equipe: [{id,label,valor}] com o label em snapshot. Substitui sigla/tarefa/etiqueta/tarefa2.';

comment on column public.horas_apontamentos.sigla is
  'LEGADO: catálogo fixo da empresa. Substituído por campos (jsonb).';
comment on column public.horas_apontamentos.tarefa is
  'LEGADO: catálogo fixo da empresa. Substituído por campos (jsonb).';
comment on column public.horas_apontamentos.etiqueta is
  'LEGADO: catálogo fixo da empresa. Substituído por campos (jsonb).';
comment on column public.horas_apontamentos.tarefa2 is
  'LEGADO: catálogo fixo da empresa. Substituído por campos (jsonb).';

-- ----------------------------------------------------------------------------
-- 3) Quem configura os campos: uma lista NOMINAL de 3 pessoas, e elas mexem em
--    QUALQUER equipe.
--    Isto é de propósito mais restrito que os projetos (pode_gerir_gerencia,
--    que libera o líder de cada área): os campos definem o formato do
--    apontamento da empresa inteira e alimentam os relatórios, então quem os
--    edita é uma curadoria central, não cada gestor.
--    Não dá para reaproveitar is_horas_admin(): ela pega todo perfil='admin' —
--    hoje 5 pessoas, incluindo o usuário de sistema.
--    Pela mesma razão de is_portal_super_admin(), a checagem é pelo e-mail do
--    JWT: sobrevive a recadastro do colaborador e não depende de RLS.
--    Para mudar a lista, é este o único lugar (e o espelho de UI em
--    src/modules/horas/lib/roles.js — CONFIG_APONTAMENTO_EMAILS).
-- ----------------------------------------------------------------------------
create or replace function app_private.pode_configurar_campos_apontamento()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
    'marcus.guimaraes@phdengenharia.eng.br',  -- Marcus Guimarães
    'lennon.santos@phdengenharia.eng.br',     -- Lennon Santos
    'vinicius.costa@phdengenharia.eng.br'     -- Vinicius Costa
  )
$$;
revoke all on function app_private.pode_configurar_campos_apontamento() from public;
grant execute on function app_private.pode_configurar_campos_apontamento() to authenticated;

-- ----------------------------------------------------------------------------
-- 4) RLS — todos LEEM (a pessoa precisa dos campos da própria equipe para
--    apontar); escrevem só os três acima, em qualquer equipe.
-- ----------------------------------------------------------------------------
alter table public.horas_campos_apontamento enable row level security;

drop policy if exists horas_campos_select on public.horas_campos_apontamento;
create policy horas_campos_select on public.horas_campos_apontamento
for select to authenticated using ( true );

drop policy if exists horas_campos_write on public.horas_campos_apontamento;
create policy horas_campos_write on public.horas_campos_apontamento
for all to authenticated
using (app_private.pode_configurar_campos_apontamento())
with check (app_private.pode_configurar_campos_apontamento());

-- ----------------------------------------------------------------------------
-- 5) Carga inicial: os 4 campos de hoje, iguais para toda equipe existente.
--    Só semeia equipe que ainda não tem campo nenhum, então rodar de novo não
--    duplica nem desfaz o que um gestor já ajustou.
--    Fonte: src/modules/horas/lib/catalogoTarefas.js (gerado a partir dele).
-- ----------------------------------------------------------------------------
insert into public.horas_campos_apontamento (gerencia_id, ordem, label, tipo, obrigatorio, opcoes)
select g.id, m.ordem, m.label, m.tipo, m.obrigatorio, m.opcoes
from public.horas_gerencias g
cross join (values
  (0, 'Sigla', 'dropdown', true, array[
      'PES',
      'POP',
      'PTA',
      'PTO'
    ]::text[]),
  (1, 'Tarefa', 'dropdown', true, array[
      '6WLA',
      'ABERTURA DE REQUISIÇÕES DE COMPRAS NO MAXIMO',
      'ACOMPANHAMENTO DO CRONOGRAMA DE ENGENHARIA',
      'ACOMPANHAMENTO E VALIDAÇÃO DA LD',
      'ALIMENTAR BASE DE DADOS PBI E INDICADORES - FÍSICO / FINANCEIRO',
      'ALIMENTAR BASE DE DADOS PBI E INDICADORES - FÍSICO / FINNANCEIRO',
      'ALIMENTAR BASE DE DADOS PBI E INDICADORES - LPS',
      'ANÁLISE CURVA E AVANÇOS',
      'ANÁLISE DA DOCUMENTAÇÃO',
      'ANÁLISE DA PROGRAMAÇÃO SEMANAL E ADERENCIA DE INDICADORES',
      'ANÁLISE DE CAMINHO CRÍTICO DE ENGENHARIA',
      'ANÁLISE DE IMPACTO DE ATRASOS DE ENGENHARIA EM SUPRIMENTOS',
      'ANÁLISE DETALHADA DOS SUPRIMENTOS CRÍTICOS',
      'ANALISE DO RELATORIO DE DELIGENCIAMENTO',
      'APOIO AO HANDOVER',
      'APRESENTAÇÃO SEMANAL',
      'ATUALIZAÇÃO BASE DE DADOS - ENGEFORM',
      'ATUALIZAÇÃO DAS DEMANDAS DIÁRIAS NO ONENOTE/PLANNER',
      'ATUALIZAÇÃO DE CRONOGRAMA',
      'ATUALIZAÇÃO DE CRONOGRAMA - INTERNO',
      'ATUALIZAÇÃO DE CRONOGRAMA DE ENTREGA',
      'ATUALIZAÇÃO DE HIGHLIGHTS E PRÓXIMOS PASSOS',
      'ATUALIZAÇÃO DO CRONOGRAMA MASTER DE INFORMAÇÕES DE SUPRIMENTO E ENGENHARIA',
      'ATUALIZAÇÃO DO CRONOGRAMA MASTER E CURVAS',
      'ATUALIZAÇÃO E ANÁLISE MASTER',
      'ATUALIZAÇÃO MENTOR CONSTRUÇÃO',
      'ATUALIZAÇÕES DAS AÇÕES LOOKAHEAD',
      'ATUALIZAR RELATÓRIO DO WAVE',
      'ATUALIZAR RELATÓRIOS',
      'CADASTRO DE PRODUTOS NO MAXIMO',
      'CHECK LIST PARA ANÁLISE FINANCEIRA DOS PROJETOS',
      'CHECK-IN/ OUT',
      'CHECK-IN/OUT',
      'CONSOLIDAÇÃO DO STATUS DO MAPA DE SUPRIMENTOS E REPORTING',
      'CONSTRUÇÃO, ATUALIZAÇÃO E REPORTING DO CRONOGRAMA MASTER',
      'CONTROLE DE ARMAZENAMENTO DE MATERIAIS',
      'CONTROLE DE CB E ESCAVADEIRA (VIAGENS)',
      'CONTROLE DE DESVIOS DE ESCOPO - LOOK AHEAD E RITMO, PREVISIBILIDADE E TENDENCIA DE ENGENHARIA',
      'CONTROLE DE DESVIOS DE ESCOPO DE SUPRIMENTOS, MANUFATURA E MOBILIZAÇÃO',
      'CONTROLE DE ENGENHARIA',
      'CONTROLE DE MARCOS',
      'CONTROLE DE PRIORIDADES DE ENGENHARIA PARA OBRA',
      'CONTROLE DE SUPRIMENTOS / AQUISIÇÕES',
      'CONTROLE PBI',
      'CRIAÇÕES NO POWERBI E AJUSTES SOLICITADOS',
      'CRONOGRAMA',
      'CRONOGRAMA DE ENGENHARIA',
      'CRONOGRAMA DETALHADO DE COMISSIONAMENTO',
      'CURSOS ADM COURSEMILL',
      'CURVA DE COMMODITIES',
      'CURVA FINANCEIRA',
      'CURVA FISICA',
      'CURVA FÍSICA',
      'DASHBOARD DE ACOMPANHAMENTO',
      'DASHBOARD DE ACOMPANHAMENTO / RELATÓRIO SEMANAL',
      'DEFINIÇÃO DE BASELINE DE PRAZOS DE SUPRIMENTOS',
      'DEFINIÇÃO DE MARCOS CRÍTICOS DE AQUISIÇÃO',
      'DESVIOS DA OBRA',
      'DETALHAMENTO DO CAMINHO DA CONSTRUÇÃO COM VALIDAÇÃO DE ENGENHARIA E SUPRIMENTOS',
      'DIRECIONAMENTO ESTRATÉGICO',
      'EAP',
      'EDIÇÃO DO MAPA DE SUPRIMENTOS',
      'ELABORAÇÃO DA BASE DO PBI',
      'ELABORAÇÃO DA DECLARAÇÃO DE ESCOPO',
      'ELABORAÇÃO DE CRONOGRAMA DO PROJETO',
      'ELABORAÇÃO DE CRONOGRAMA FEL',
      'ELABORAÇÃO DE MEMÓRIA DE CÁLCULO',
      'ELABORAÇÃO DE PLANEJAMENTO 30 DIAS ATÉ DIA 28 DE CADA MÊS - VALE',
      'ELABORAÇÃO DE PLANO DE AÇÃO DO CRONOGRAMA CORRENTE',
      'ELABORAÇÃO DE PLANO DE ATAQUE',
      'ELABORAÇÃO DE RAO / DESVIOS DA OBRA',
      'ELABORAÇÃO DO PLANEJAMENTO DO PLANO DE COMISSIONAMENTO',
      'ELABORAÇÃO DO REPLANEJAMENTO DAS ATIVIDADES',
      'ELABORAÇÃO REORÇAMENTO',
      'ELEABORAÇÃO DO PLANO DE ATAQUE',
      'ENVIO DE ONE PAGE NAS PARADAS',
      'ENVIO DE REPORT ANÁLITICO DO PROJETO INTERNO',
      'ENVIO DE REPORTING SEMANAL DOS PONTOS CRÍTICOS E DESVIOS DA ENGENHARIA CLIENTE E CONTRATADA',
      'ENVIO DO PPC',
      'ESTRATÉGIA DE MOBILIZAÇÃO',
      'ESTRUTURAÇÃO DAS COMPOSIÇÕES DO ORÇAMENTO',
      'EXTRAÇÃO DE RELATÓRIOS PARA ANÁLISE CRÍTICA FINANCEIRA',
      'FUP DO HELPDESK CENTRAL DE NOTAS E CADASTROS',
      'FUP DO PROCESSO DE COMPRAS',
      'GERAR DOCUMENTO DE PLANO DE GERENCIAMENTO PHD',
      'GESTÃO A VISTA',
      'GESTÃO DA DOCUMENTAÇÃO',
      'GESTÃO DE CONTRATADAS, CONTROLE DA EVOLUÇÃO FÍSICA DA MANUFATURA',
      'GESTÃO DE INTERFACES DA ENGENHARIA COM SUPRIMENTOS',
      'GESTÃO DE INTERFACES ENTRE ENGENHARIA, SUPRIMENTOS E OBRAS',
      'GESTÃO DE PENDÊNCIAS',
      'HISTOGRAMA',
      'INCLUSÃO DE CONTROLE DE ORDENS DE COMRAS',
      'INCLUSÃO, ORGANIZAÇÃO, ENVIO PARA PAGAMENTO E CONTROLE DE NOTAS FISCAIS',
      'LABORAÇÃO DE REPLANEJAMENTO',
      'LISTA DE PENDÊNCIA ESTRATÉGICA',
      'LISTA DE PENDÊNCIA ESTRATÉGICA / PLANO DE AÇÃO',
      'LISTA DE PENDÊNCIA PARA COMISSIONAMENTO / PLANO DE AÇÃO',
      'MAPA DE CONTROLE',
      'MAPA DE SUPRIMENTOS',
      'MAPEAMENTO DE ITENS CRÍTICOS',
      'MEDIÇÃO',
      'MEMÓRIA DE CALCULO',
      'META FINANCEIRA',
      'NÁLISE DE DESVIOS',
      'ORGANIZAÇÃO DE DOCUMENTAÇÃO DAS PASTAS CONFORME INSTRUÇÃO DE TRABALHO CLIENTE',
      'PLANEJAMENTO 90 DIAS',
      'PLANEJAMENTO DETALHADO JUNTO ÀS EMPREITEIRAS (ANÁLISE DE CRONOGRAMAS)',
      'PLANEJAMENTO DETALHADO JUNTO ÀS EMPREITEIRAS (IMPLANTAÇÃO LPS)',
      'POC (APRESENTAÇÃO DO POC)',
      'PPC - CAUSA DE RAIZ DE DESVIOS',
      'PREENCHIMENTO E APOIO DAS PLANILHAS DE CAPITALIZAÇÃO JUNTO A CONTROLADORIA',
      'PROGRAMAÇÃO SEMANAL',
      'PROGRAMAÇÃO SEMANAL DE MONTAGEM',
      'PULL PLANNING',
      'RAO / DESVIOS DA OBRA',
      'RDC',
      'RDO',
      'RELATÓRIO MENSAL DE RESULTADOS',
      'RELATÓRIO MENSAL VALE',
      'RELATÓRIO SEMANAL',
      'REPORT DIÁRIO',
      'REPORT PROGRAMAÇÃO SEMANAL',
      'REPORTING DE TENDENCIA POR DISCIPLINA',
      'RESPONDER E-MAILS',
      'REUNIÃO COM FORNECEDORES',
      'REUNIÃO DE ACOMPANHAMENTO SEMANAL COM TERCEIRAS',
      'REUNIÃO DE ALINHAMENTO COM O CLIENTE',
      'REUNIÃO DE ALINHAMENTO DAS ATIVIDADES ALFA',
      'REUNIÃO DE ALINHAMENTO DAS ATIVIDADES COM A EMPRESA SANTANNA',
      'REUNIÃO DE ALINHAMENTO DAS ATIVIDADES TMSA',
      'REUNIÃO DE ALINHAMENTO INTERNA',
      'REUNIÃO DE AQUISIÇÃO - SUPRIMENTOS GOIASA',
      'REUNIÃO DE FOLLOW-UP',
      'REUNIÃO DE PLANEJAMENTO - CIVIL E MONTAGEM',
      'REUNIÃO DE PROGRAMAÇÃO SEMANAL',
      'REUNIÃO DO MAPA DE PARADAS',
      'REUNIÃO GERENCIAIS E CONTRATUAL',
      'REUNIÃO GERENCIAL E CONTRATUAL',
      'REUNIÃO ONE TO ONE COM GESTORES PARA ATUALIZAÇÃO DE FORECAST',
      'REUNIÃO ONE TO ONE COM GESTORES PARA PLANEJAMENTO',
      'REUNIÃO PROGRAMAÇÃO SEMANAL VALE',
      'REUNIÃO SEMANAL DE STAFF PHD INTERNA E COM O CLIENTE',
      'REUNIÃO SEMANAL DO MAS',
      'RMA VALE',
      'RMA VALE ATÉ 1°DIA útil',
      'ROTINA DE LEVANTAMENTO E ALINHAMENTOS DE CAMPO',
      'SOLICITAÇÃO, CADASTRO DE FORNECEDORES E CONTA BANCARIA NO MAXIMO',
      'SUPORTE A REUNIÕES DE STATUS E TOMADA DE DECISÃO',
      'TAKE-OFF',
      'VALIDAÇÃO CURVA FISICA',
      'VALIDAÇÃO DE CRONOGRAMA',
      'VALIDAÇÃO DO AVANÇO SEMANAL DAS EMPREITEIRAS',
      'VERIFICAÇÃO DE COMPLETUDE E CONSISTÊNCIA DOS ENTREGÁVEIS',
      'WASTE TIME'
    ]::text[]),
  (2, 'Etiqueta', 'dropdown', true, array[
      'FIN',
      'ENG',
      'LPS',
      'PLA'
    ]::text[]),
  (3, 'Tarefa 2', 'dropdown', true, array[
      'CONTROLAR',
      'ELABORAR',
      'REVISAR'
    ]::text[])
) as m(ordem, label, tipo, obrigatorio, opcoes)
where not exists (
  select 1 from public.horas_campos_apontamento c where c.gerencia_id = g.id
);

-- ============================================================================
-- Depois de aplicar:
--   1. get_advisors(security) — nenhuma rls_disabled_in_public em horas_*.
--   2. /horas/config/apontamento passa a listar os 4 campos em cada equipe. A
--      tela abre com o seletor de TODAS as equipes; só as 3 pessoas da lista
--      acima entram nela (as demais são redirecionadas e nem veem o menu).
--   3. Equipe SEM campos configurados continua apontando — só com Projeto e
--      Descrição. A tela avisa o gestor.
--
-- Reverter:
--   drop table public.horas_campos_apontamento;
--   alter table public.horas_apontamentos drop column campos;
--   alter table public.horas_timer_ativo  drop column campos;
--   (o histórico do catálogo fixo continua em sigla/tarefa/etiqueta/tarefa2)
-- ============================================================================
