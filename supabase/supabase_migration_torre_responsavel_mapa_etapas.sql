-- Migration: responsável pelo contrato no Mapa e nas Etapas da Torre (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do André (29/09/2026): o filtro "Responsável pelo contrato" do Quadro
-- também no Mapa e nas Etapas.
--
-- O Quadro lê a view mobilizacao_torre_v, que resolve o nome pelo de-para
-- (torre_responsavel_de_para). Mapa e Etapas leem torre_processos,
-- torre_etapas e torre_chamados, que não traziam o nome. Aqui as três ganham
-- a coluna `responsavel_contrato` NO FIM, resolvida pela MESMA regra da view:
--   - chamado: o CC do formulário (campos->>'cc');
--   - mobilização: ger_phd, senão coo_phd, senão cod_phd, senão cod_ct.
--
-- Mudar o formato do retorno exige drop + create. O corpo é o mesmo de antes.
-- Coluna a mais é inofensiva para o front antigo: não depende de deploy.
-- ============================================================================

drop function if exists public.torre_chamados(integer);
create function public.torre_chamados(p_dias_fechados integer default 15)
returns table (
  id uuid, numero bigint, classe text, servico text, assunto text, status text,
  criado_em timestamptz, sla_vence_em timestamptz, fechado_em timestamptz, atendente_id uuid,
  responsavel_contrato text
)
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select c.id, c.numero, c.classe, c.servico, c.assunto, c.status,
         c.criado_em, c.sla_vence_em, c.fechado_em, c.atendente_id,
         d.nome
    from public.chamados_adm c
    left join public.torre_responsavel_de_para d on d.chave = trim(c.campos->>'cc')
   where app_private.pode_torre()
     and (c.status not in ('fechado','reprovado','cancelado')
       or c.updated_at >= now() - make_interval(days => p_dias_fechados));
$function$;

drop function if exists public.torre_etapas();
create function public.torre_etapas()
returns table (
  id uuid, processo_id uuid, codigo text, ordem integer, titulo text, status text,
  data_prevista date, data_real date, dias_atraso integer, responsavel_id uuid,
  updated_at timestamptz, numero bigint, fluxo text, processo_titulo text,
  processo_status text, cod_ct text, responsavel_contrato text
)
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select e.id, e.processo_id, e.codigo, e.ordem, e.titulo, e.status,
         e.data_prevista, e.data_real, e.dias_atraso, e.responsavel_id, e.updated_at,
         p.numero, p.fluxo, p.titulo, p.status, p.cod_ct, d.nome
    from public.mobilizacao_etapas e
    join public.mobilizacao_processos p on p.id = e.processo_id
    left join public.torre_responsavel_de_para d on d.chave = coalesce(
      nullif(trim(p.ger_phd), ''), nullif(trim(p.coo_phd), ''),
      nullif(trim(p.cod_phd), ''), nullif(trim(p.cod_ct), ''))
   -- Só o que está EM ANDAMENTO: a Torre é a reunião do que falta.
   where app_private.pode_torre() and p.status = 'em_andamento';
$function$;

drop function if exists public.torre_processos();
create function public.torre_processos()
returns table (
  id uuid, numero bigint, titulo text, fluxo text, status text, profissional_nome text,
  cliente_phd text, cod_ct text, local_obra text, responsavel_id uuid, prazo_em date,
  data_base date, concluido_real date, responsavel_contrato text
)
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select p.id, p.numero, p.titulo, p.fluxo, p.status,
         p.profissional_nome, p.cliente_phd, p.cod_ct, p.local_obra,
         p.responsavel_id, p.prazo_em, p.data_base, p.concluido_real, d.nome
    from public.mobilizacao_processos p
    left join public.torre_responsavel_de_para d on d.chave = coalesce(
      nullif(trim(p.ger_phd), ''), nullif(trim(p.coo_phd), ''),
      nullif(trim(p.cod_phd), ''), nullif(trim(p.cod_ct), ''))
   where app_private.pode_torre()
     and p.status = 'em_andamento';
$function$;

revoke all on function public.torre_chamados(integer) from public, anon;
revoke all on function public.torre_etapas() from public, anon;
revoke all on function public.torre_processos() from public, anon;
grant execute on function public.torre_chamados(integer) to authenticated, service_role;
grant execute on function public.torre_etapas() to authenticated, service_role;
grant execute on function public.torre_processos() to authenticated, service_role;

notify pgrst, 'reload schema';
