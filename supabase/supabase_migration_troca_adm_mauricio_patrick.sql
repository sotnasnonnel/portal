-- ============================================================================
-- Troca ADM: Patrick Pereira substitui Maurício Silva
-- (projeto bogsuuhrgvopzgcceoqz — rodar no SQL Editor, como postgres)
--
-- O que faz:
--   1) Mostra o antes (papéis dos dois) para conferência.
--   2) Copia de mauricio.silva para patrick.pereira TODOS os campos de
--      permissão/acesso da tabela colaboradores (perfil, rh_dp,
--      financeiro_role, administrativo_role, administrativo_reatribui,
--      horas_role, horas_gerencia_id, programas_role, area_alcada,
--      pode_ver_desligamento).
--      NÃO copia: superior_id / funcao / dados pessoais (Patrick já está no
--      organograma) nem solic_visto_em (timestamp por pessoa).
--   3) Reatribui o que estava no nome do Maurício para o Patrick:
--      chamados abertos (atendente), etapas de aprovação pendentes,
--      roteamento/config de chamados (atendente padrão e cadeia de
--      aprovadores) e, por garantia, gestor de gerência no Horas.
--   4) Mostra o depois.
--
-- Idempotente: rodar duas vezes não muda o resultado.
-- Histórico preservado: chamados fechados/cancelados/reprovados continuam
-- apontando para o Maurício (auditoria).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) ANTES — comparativo dos papéis
-- ----------------------------------------------------------------------------
select nome, email, perfil, rh_dp, financeiro_role, administrativo_role,
       administrativo_reatribui, horas_role, horas_gerencia_id, programas_role,
       area_alcada, pode_ver_desligamento, auth_id, ativo
  from public.colaboradores
 where lower(email) in ('mauricio.silva@phdengenharia.eng.br',
                        'patrick.pereira@phdengenharia.eng.br')
 order by email;

-- Trava: os dois precisam existir e o Patrick precisa de auth_id vinculado
-- (sem isso as policies/RPC não o reconhecem em nenhum módulo).
do $$
declare
  v_auth uuid;
begin
  select auth_id into v_auth
    from public.colaboradores
   where lower(email) = 'patrick.pereira@phdengenharia.eng.br';

  if v_auth is null then
    raise exception 'patrick.pereira sem auth_id vinculado — vincular antes de rodar.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2) Permissões: copia os papéis do Maurício para o Patrick
-- ----------------------------------------------------------------------------
update public.colaboradores p
   set perfil                  = m.perfil,
       rh_dp                   = m.rh_dp,
       financeiro_role         = m.financeiro_role,
       administrativo_role     = m.administrativo_role,
       administrativo_reatribui = m.administrativo_reatribui,
       horas_role              = m.horas_role,
       horas_gerencia_id       = m.horas_gerencia_id,
       programas_role          = m.programas_role,
       area_alcada             = m.area_alcada,
       pode_ver_desligamento   = m.pode_ver_desligamento
  from public.colaboradores m
 where lower(m.email) = 'mauricio.silva@phdengenharia.eng.br'
   and lower(p.email) = 'patrick.pereira@phdengenharia.eng.br';

-- ----------------------------------------------------------------------------
-- 3) Reatribuição do que estava no nome do Maurício
-- ----------------------------------------------------------------------------
with m as (select id from public.colaboradores where lower(email) = 'mauricio.silva@phdengenharia.eng.br'),
     p as (select id from public.colaboradores where lower(email) = 'patrick.pereira@phdengenharia.eng.br')
update public.chamados_adm c
   set atendente_id = (select id from p)
  from m
 where c.atendente_id = m.id
   and c.status in ('aguardando_aprovacao', 'aberto');   -- só os vivos

with m as (select id from public.colaboradores where lower(email) = 'mauricio.silva@phdengenharia.eng.br'),
     p as (select id from public.colaboradores where lower(email) = 'patrick.pereira@phdengenharia.eng.br')
update public.chamados_adm_etapas e
   set aprovador_id = (select id from p)
  from m
 where e.aprovador_id = m.id
   and e.status = 'pendente';                             -- decididas ficam no histórico

with m as (select id from public.colaboradores where lower(email) = 'mauricio.silva@phdengenharia.eng.br'),
     p as (select id from public.colaboradores where lower(email) = 'patrick.pereira@phdengenharia.eng.br')
update public.chamados_adm_config cfg
   set atendente_id = coalesce((select id from p), cfg.atendente_id),
       aprovadores   = array_replace(cfg.aprovadores, m.id, (select id from p))
  from m
 where cfg.atendente_id = m.id
    or m.id = any (cfg.aprovadores);

-- Defensivo: se o Maurício fosse gestor de alguma gerência no Horas.
with m as (select id from public.colaboradores where lower(email) = 'mauricio.silva@phdengenharia.eng.br'),
     p as (select id from public.colaboradores where lower(email) = 'patrick.pereira@phdengenharia.eng.br')
update public.horas_gerencias g
   set gestor_id = (select id from p)
  from m
 where g.gestor_id = m.id;

-- ----------------------------------------------------------------------------
-- 4) DEPOIS — conferência
-- ----------------------------------------------------------------------------
select nome, email, perfil, rh_dp, financeiro_role, administrativo_role,
       administrativo_reatribui, horas_role, horas_gerencia_id, programas_role,
       area_alcada, pode_ver_desligamento, ativo
  from public.colaboradores
 where lower(email) in ('mauricio.silva@phdengenharia.eng.br',
                        'patrick.pereira@phdengenharia.eng.br')
 order by email;

select (select count(*) from public.chamados_adm c
         where c.atendente_id = (select id from public.colaboradores
                                  where lower(email) = 'patrick.pereira@phdengenharia.eng.br')
           and c.status in ('aguardando_aprovacao', 'aberto')) as chamados_abertos_patrick,
       (select count(*) from public.chamados_adm_etapas e
         where e.aprovador_id = (select id from public.colaboradores
                                  where lower(email) = 'patrick.pereira@phdengenharia.eng.br')
           and e.status = 'pendente') as etapas_pendentes_patrick;

-- ----------------------------------------------------------------------------
-- OPCIONAL — se o Maurício saiu da empresa, deixar os papéis ADM dele ativos
-- mantém acesso caso ele logue. Zerar (descomentar para aplicar):
-- ----------------------------------------------------------------------------
-- update public.colaboradores
--    set administrativo_role = null,
--        administrativo_reatribui = false
--  where lower(email) = 'mauricio.silva@phdengenharia.eng.br';

notify pgrst, 'reload schema';
