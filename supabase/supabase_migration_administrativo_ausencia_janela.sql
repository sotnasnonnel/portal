-- Migration: janela do aviso de ausência no chamado (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Reporte da Edijane (02/10/2026), chamado #244: com o chamado ainda aberto, o
-- aviso "tem ausência registrada durante este chamado" mostrava uma Ausência
-- Programada de fevereiro de 2027, que nada tem a ver com o atendimento.
--
-- Causa: chamado aberto não tinha fim de janela, então qualquer ausência
-- futura entrava. Agora a janela de um chamado aberto vai até o vencimento do
-- SLA (ou hoje, se ele já venceu ou ainda não começou). Chamado fechado segue
-- indo até o fechamento.
--
-- Não mexe no prazo: o gatilho `adm_sla_da_ausencia` continua igual.
-- Não depende de deploy do front.
--
-- Para derrubar: reaplicar o bloco 3 de
-- supabase_migration_administrativo_colaborador_ausente.sql.
-- ============================================================================

create or replace function public.chamados_adm_ausencias(p_chamados uuid[])
returns table (chamado_id uuid, tipo text, data_inicio date, data_fim date)
language sql stable security invoker set search_path = '' as $$
  select c.id, a.tipo, a.data_inicio, a.data_fim
    from public.chamados_adm c
    cross join lateral app_private.ausencias_no_periodo(
      c.colaborador_id,
      (c.criado_em at time zone 'America/Sao_Paulo')::date,
      (coalesce(c.fechado_em, greatest(c.sla_vence_em, now())) at time zone 'America/Sao_Paulo')::date
    ) a
   where c.id = any(p_chamados)
     and c.colaborador_id is not null
$$;
revoke all on function public.chamados_adm_ausencias(uuid[]) from public;
revoke execute on function public.chamados_adm_ausencias(uuid[]) from anon;
grant execute on function public.chamados_adm_ausencias(uuid[]) to authenticated;

notify pgrst, 'reload schema';
