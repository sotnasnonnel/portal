-- ============================================================================
-- Torre de Controle — contexto no cartão do Quadro
--
-- Pedido (15/09/2026): o cartão mostrava "Contato com o cliente · LEONARDO" e
-- ninguém sabia DE ONDE era. Agora a view entrega o que identifica o item:
--
--   mobilização de empresa        -> projeto (cliente · código do contrato)
--   mobilização/desmob. de pessoa -> nome do colaborador
--   chamado do Adm                -> solicitante_id (o nome sai de
--                                    nomes_colaboradores no front, como o do
--                                    responsável)
--
-- As colunas novas vão no FIM: CREATE OR REPLACE VIEW só aceita acrescentar
-- colunas depois das existentes. torre_quadro() é `select *` desta view e passa
-- a devolvê-las sem precisar ser recriada.
-- ============================================================================

create or replace view public.mobilizacao_torre_v
with (security_invoker = on) as
 select 'adm'::text as origem,
    c.id,
    c.numero,
    c.assunto as titulo,
    c.status,
    c.atendente_id as responsavel_id,
    c.sla_vence_em::date as prazo,
    c.criado_em,
    c.campos ->> 'cc'::text as cc,
    null::uuid as processo_id,
    null::text as obra,
    null::text as gestor,
    null::text as obra_cod_phd,
    d.nome as responsavel_contrato,
    null::text as fluxo,
    null::text as contexto,
    c.solicitante_id
   from chamados_adm c
     left join torre_responsavel_de_para d on d.chave = trim(both from c.campos ->> 'cc'::text)
  where (c.status <> all (array['fechado'::text, 'reprovado'::text, 'cancelado'::text]))
     or c.updated_at >= (now() - '15 days'::interval)
union all
 select 'mobilizacao'::text as origem,
    e.id,
    p.numero,
    e.titulo,
    e.status,
    e.responsavel_id,
    e.data_prevista as prazo,
    p.criado_em,
    null::text as cc,
    p.id as processo_id,
    p.cod_ct as obra,
    p.ger_phd as gestor,
    p.cod_phd as obra_cod_phd,
    d.nome as responsavel_contrato,
    p.fluxo,
    case
      when p.fluxo = 'mobilizacao_empresa' then
        nullif(concat_ws(' · ',
          coalesce(nullif(trim(p.cliente_phd), ''), nullif(trim(p.titulo), '')),
          nullif(trim(p.cod_ct), '')), '')
      else coalesce(nullif(trim(p.profissional_nome), ''), nullif(trim(p.titulo), ''))
    end as contexto,
    null::uuid as solicitante_id
   from mobilizacao_etapas e
     join mobilizacao_processos p on p.id = e.processo_id
     left join torre_responsavel_de_para d on d.chave = coalesce(
       nullif(trim(both from p.ger_phd), ''::text), nullif(trim(both from p.coo_phd), ''::text),
       nullif(trim(both from p.cod_phd), ''::text), nullif(trim(both from p.cod_ct), ''::text))
  where p.status = 'em_andamento'::text;

notify pgrst, 'reload schema';
