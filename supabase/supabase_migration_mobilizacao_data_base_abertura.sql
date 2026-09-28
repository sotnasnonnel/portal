-- Migration: a data-base do processo volta a ser a ABERTURA (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Bug relatado pelo Jarbas em 28/09/2026: em todos os processos abertos pelo
-- portal, a "Data-base do processo" estava à frente da abertura do chamado e da
-- aprovação do gerente — 4 dias no exemplo dele (processo #140), até 24 dias em
-- outros. Efeito colateral: as etapas de SLA 0, que marcam o próprio começo,
-- nasciam previstas para o futuro e apareciam como "4d de folga" no dia em que
-- foram feitas.
--
-- A CAUSA foi um campo trocado neste gatilho: ele gravava a "data de início no
-- cliente" digitada no chamado como data-base. Mas data-base, neste modelo, é
-- de onde partem as etapas RAIZ — o comentário da coluna em
-- supabase_migration_mobilizacao.sql já dizia "em MOB.PESSOAS é a abertura do
-- chamado", a carga da planilha usou a coluna DATA REAL/PREV - FORMS
-- (docs/gerar_carga_mobilizacao.cjs) e a própria etapa "Assinatura de contrato"
-- se descreve como "a data que abre a contagem do processo". Ou seja: os
-- processos vindos da planilha estavam certos e os vindos do portal, não.
--
-- CORREÇÃO: a data-base passa a ser o dia em que o PROCESSO nasce. Para o
-- chamado com alçada isso é, na prática, a data da aprovação do gerente — o
-- processo só é criado quando a última etapa aprova. É o que o pedido pediu.
--
-- A data de início no cliente NÃO se perde: passa a viajar em `campos`, junto
-- do contato do cliente, e a tela do processo a mostra no resumo. Ela continua
-- sendo informação de operação ("quando a pessoa entra na obra"); o que ela
-- deixa de ser é régua de prazo.
--
-- A desmobilização segue a mesma régua, pelo mesmo motivo: a data em que a
-- pessoa sai é o ALVO do processo, não o começo dele. Ela também vai para
-- `campos`.
--
-- Este arquivo NÃO corrige os processos já existentes — isso é um UPDATE
-- separado, aplicado à mão depois (ver o bloco comentado no fim).
-- ============================================================================

create or replace function app_private.mob_dados_do_chamado(p_campos jsonb, p_solicitante uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'profissional_id',   nullif(p_campos ->> 'profissional_id', ''),
    'profissional_nome', nullif(btrim(coalesce(p_campos ->> 'profissional', '')), ''),
    'local_obra',        nullif(btrim(coalesce(p_campos ->> 'local_obra', '')), ''),
    'cod_ct',            nullif(btrim(coalesce(p_campos ->> 'cc', '')), ''),
    'ger_phd',           nullif(btrim(coalesce(p_campos ->> 'gestor', '')), ''),
    'cliente_phd',       nullif(btrim(coalesce(p_campos ->> 'cliente', '')), ''),
    'cliente_final',     nullif(btrim(coalesce(p_campos ->> 'cliente_final', '')), ''),
    'empresa_phd',       nullif(btrim(coalesce(p_campos ->> 'empresa_phd', '')), ''),
    -- O que não tem coluna própria viaja aqui, em vez de ser descartado calado.
    -- As duas datas entraram nesta lista quando deixaram de ser data-base: são
    -- informação da operação, não régua de prazo.
    'campos',            nullif(jsonb_strip_nulls(jsonb_build_object(
                           'contato_cliente',     nullif(btrim(coalesce(p_campos ->> 'contato_cliente', '')), ''),
                           'data_inicio_cliente', nullif(p_campos ->> 'data_inicio_cliente', ''),
                           'data_desmobilizacao', nullif(p_campos ->> 'data_desmobilizacao', '')
                         )), '{}'::jsonb),
    -- Data-base = o dia em que o processo nasce. Com alçada, é o dia da
    -- aprovação: o gatilho só cria o processo quando a cadeia se cumpre.
    'data_base',         to_char(current_date, 'YYYY-MM-DD'),
    'solicitante_id',    p_solicitante::text,
    -- O movimento não vira coluna, mas precisa viajar: é o que a `condicao` do
    -- catálogo consulta para decidir quais etapas nascem.
    'movimento',         nullif(p_campos ->> 'movimento', '')
  ))
$$;

-- `immutable` não cabe mais: a função passou a depender de current_date.
-- (o create or replace acima já redefine a volatilidade para `stable`)

-- ----------------------------------------------------------------------------
-- Correção dos processos já abertos — rodar UMA vez, junto desta migração.
--
-- Só os EM ANDAMENTO: em processo finalizado a data-base é história, e mexer
-- nela reescreveria prazos de etapas que já aconteceram. A data que estava lá
-- (o início no cliente) é preservada em `campos` antes de ser substituída, e o
-- gatilho mobilizacao_processo_data_base_trg reprojeta sozinho as etapas que
-- ainda não aconteceram.
-- ----------------------------------------------------------------------------
update public.mobilizacao_processos p
   set campos = coalesce(p.campos, '{}'::jsonb) || jsonb_build_object(
         case when p.fluxo = 'desmobilizacao_pessoa' then 'data_desmobilizacao'
              else 'data_inicio_cliente' end,
         to_char(p.data_base, 'YYYY-MM-DD')),
       data_base = p.criado_em::date
 where p.origem = 'adm'
   and p.status = 'em_andamento'
   and p.data_base is distinct from p.criado_em::date;

notify pgrst, 'reload schema';
