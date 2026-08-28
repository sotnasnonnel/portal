-- ============================================================================
-- Controle de Horas — catálogo FIXO de tarefas no apontamento
-- ----------------------------------------------------------------------------
-- Antes: cada gerência configurava 3 "atividades controladas" (rótulo + lista de
-- opções, em horas_atividades) e o apontamento guardava as escolhas no array
-- posicional horas_apontamentos.ativ[0..2]. O significado de cada posição mudava
-- de área para área.
--
-- Agora os campos são os MESMOS para toda a empresa, vindos da planilha
-- referencia/"Cópia de Clockify tarefas.xlsx" (ver src/modules/horas/lib/
-- catalogoTarefas.js): SIGLA, TAREFA, ETIQUETA e TAREFA 2. Só o PROJETO continua
-- sendo cadastrado por área. Como o conjunto virou fixo, cada campo ganha a sua
-- própria coluna — some o array posicional e dá para filtrar/relatar em SQL.
--
-- A cadeia de filtro (a sigla limita as tarefas e vice-versa) mora no front, no
-- mesmo módulo do catálogo; aqui só guardamos o que foi escolhido.
--
-- `ativ` NÃO é removida: ela guarda o histórico dos apontamentos antigos, feitos
-- com as atividades dinâmicas. horas_atividades também fica de pé (ninguém mais
-- lê), para não perder o que as áreas já tinham cadastrado.
--
-- Aditivo e idempotente.
-- ============================================================================

alter table public.horas_apontamentos
  add column if not exists sigla    text,
  add column if not exists tarefa   text,
  add column if not exists etiqueta text,
  add column if not exists tarefa2  text;

alter table public.horas_timer_ativo
  add column if not exists sigla    text,
  add column if not exists tarefa   text,
  add column if not exists etiqueta text,
  add column if not exists tarefa2  text;

comment on column public.horas_apontamentos.ativ is
  'LEGADO: as 3 atividades controladas por gerência (posicional). Substituído por sigla/tarefa/etiqueta/tarefa2.';

-- Quebras de relatório mais usadas nos dashboards.
create index if not exists horas_apont_sigla_idx    on public.horas_apontamentos (sigla, inicio desc);
create index if not exists horas_apont_etiqueta_idx on public.horas_apontamentos (etiqueta, inicio desc);
create index if not exists horas_apont_tarefa_idx   on public.horas_apontamentos (tarefa);

-- As colunas seguem a RLS já existente das duas tabelas (nada a alterar aqui):
-- horas_apontamentos pela subárvore da Gestão de Pessoas, horas_timer_ativo pelo
-- próprio colaborador.
