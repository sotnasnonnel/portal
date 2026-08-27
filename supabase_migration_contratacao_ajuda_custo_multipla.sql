-- ============================================================================
-- Formulário de Contratação — AJUDA DE CUSTO com valor por motivo
-- ----------------------------------------------------------------------------
-- Antes: o motivo era escolha ÚNICA (radio) e havia uma só coluna de valor
-- (valor_ajuda_custo). Quem precisava conceder alimentação E alojamento tinha
-- de escolher um dos dois — só um campo ficava apto a receber valor.
--
-- Agora o motivo é múltipla escolha e CADA motivo marcado tem o seu próprio
-- campo de valor, no mesmo padrão da requisição de Ajuda de Custo (que já fazia
-- isso com Alimentação/Mobilidade/Moradia — ver src/config/ajudaCusto.js).
--
-- As colunas antigas NÃO são removidas: a carga abaixo copia o que elas têm
-- para as novas (os 20 registros existentes usam só os 3 motivos reais, sem
-- caso ambíguo), e elas ficam de pé como rede de segurança para reverter.
-- O schema do front (src/config/formularioContratacao.js) deixa de escrevê-las.
--
-- Aditivo e idempotente.
-- ============================================================================

alter table public.formularios_contratacao
  -- jsonb para acompanhar softwares_extras/epis/beneficios, que já são jsonb.
  add column if not exists motivos_ajuda_custo          jsonb not null default '[]'::jsonb,
  add column if not exists valor_ajuda_custo_alimentacao numeric,
  add column if not exists valor_ajuda_custo_alojamento  numeric,
  add column if not exists valor_ajuda_custo_complemento numeric;

comment on column public.formularios_contratacao.motivos_ajuda_custo is
  'Motivos marcados (múltipla escolha). Substitui motivo_ajuda_custo, que virou legado.';
comment on column public.formularios_contratacao.motivo_ajuda_custo is
  'LEGADO: motivo único (radio). Substituído por motivos_ajuda_custo + um valor por motivo.';
comment on column public.formularios_contratacao.valor_ajuda_custo is
  'LEGADO: valor único. Substituído por valor_ajuda_custo_alimentacao/_alojamento/_complemento.';

-- Carga: o motivo antigo vira uma lista de um item, e o valor vai para a coluna
-- do motivo correspondente. `motivos_ajuda_custo = '[]'` na condição é o que
-- torna a migração repetível sem sobrescrever o que já foi editado na tela.
update public.formularios_contratacao
set motivos_ajuda_custo = jsonb_build_array(motivo_ajuda_custo),
    valor_ajuda_custo_alimentacao =
      case when motivo_ajuda_custo = 'Alimentação' then valor_ajuda_custo end,
    valor_ajuda_custo_alojamento =
      case when motivo_ajuda_custo = 'Alojamento' then valor_ajuda_custo end,
    valor_ajuda_custo_complemento =
      case when motivo_ajuda_custo = 'Complemento de Salário | Retirada' then valor_ajuda_custo end
where motivo_ajuda_custo is not null
  and motivo_ajuda_custo <> 'Não haverá ajuda de custo'
  and motivos_ajuda_custo = '[]'::jsonb;

-- ============================================================================
-- Conferência (esperado: 16 registros com motivo, todos com o valor na coluna
-- certa e nenhum valor antigo órfão):
--   select motivo_ajuda_custo, motivos_ajuda_custo, valor_ajuda_custo,
--          valor_ajuda_custo_alimentacao, valor_ajuda_custo_alojamento,
--          valor_ajuda_custo_complemento
--     from formularios_contratacao where motivo_ajuda_custo is not null;
--
-- Reverter:
--   alter table public.formularios_contratacao
--     drop column motivos_ajuda_custo,
--     drop column valor_ajuda_custo_alimentacao,
--     drop column valor_ajuda_custo_alojamento,
--     drop column valor_ajuda_custo_complemento;
--   (motivo_ajuda_custo e valor_ajuda_custo seguem intactos)
-- ============================================================================
