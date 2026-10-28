-- Migration: leitura da Ausência Programada e do Humor da empresa sem ser RH (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do Lennon (20/10/2026): o Lucas Ferraz (gestor) precisa ver as
-- ausências programadas e o humor de TODO mundo, mantendo o que já vê hoje.
--
-- Ligar `rh_dp` resolveria, mas abriria também vagas, contratação, requisições
-- do RH, ajudas de custo e mapeamentos. Então nasce uma flag só de LEITURA:
-- `colaboradores.ve_ausencia_humor`.
--
--   - app_private.is_ausencia_leitor() = RH da ausência OU a flag;
--   - troca is_ausencia_rh() por ela só onde é leitura: o escopo 'todos' das
--     listas, a lista de pessoas, humor_resumo('todos'), humor_respostas e o
--     SELECT das três tabelas;
--   - aprovar sem aprovador, cancelar, corrigir, gerar períodos, cadastro e
--     "fora do controle" continuam só do RH (is_ausencia_rh, intactas).
--
-- Ordem: aplicar ANTES do deploy do front (o front novo lê a coluna).
-- ============================================================================

alter table public.colaboradores
  add column if not exists ve_ausencia_humor boolean not null default false;

comment on column public.colaboradores.ve_ausencia_humor is
  'Vê (só leitura) a Ausência Programada e o Humor da empresa toda. Ver app_private.is_ausencia_leitor().';

create or replace function app_private.is_ausencia_leitor()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select app_private.is_ausencia_rh()
      or exists (select 1 from public.colaboradores c
                  where c.id = app_private.my_colaborador_id()
                    and c.ve_ausencia_humor is true
                    and c.ativo is distinct from false)
$function$;

grant execute on function app_private.is_ausencia_leitor() to authenticated;

-- ---- Listas -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ausencia_adicional_listar(p_escopo text DEFAULT 'meus'::text)
 RETURNS TABLE(id uuid, numero bigint, status text, colaborador_id uuid, colaborador_nome text, colaborador_funcao text, registrado_por uuid, registrado_por_nome text, aprovador_id uuid, aprovador_nome text, projeto_id uuid, projeto_nome text, dias integer, observacao text, periodo_id uuid, periodo_inicio date, periodo_fim date, motivo_reprovacao text, motivo_cancelamento text, decidido_em timestamp with time zone, decidido_por_nome text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select app_private.my_colaborador_id() as id)
  select a.id, a.numero, a.status,
         a.colaborador_id, c.nome, c.funcao,
         a.registrado_por, r.nome,
         a.aprovador_id, ap.nome,
         a.projeto_id, a.projeto_nome, a.dias, a.observacao,
         a.periodo_id, p.inicio_periodo, p.fim_periodo,
         a.motivo_reprovacao, a.motivo_cancelamento,
         a.decidido_em, d.nome, a.created_at
  from public.ausencia_adicionais a
  join public.colaboradores c on c.id = a.colaborador_id
  join public.colaboradores r on r.id = a.registrado_por
  left join public.colaboradores ap on ap.id = a.aprovador_id
  left join public.colaboradores d on d.id = a.decidido_por
  left join public.ausencia_periodos p on p.id = a.periodo_id
  cross join me
  where case p_escopo
          when 'meus'    then a.registrado_por = me.id or a.colaborador_id = me.id
          when 'aprovar' then a.aprovador_id = me.id
                              or (a.aprovador_id is null and app_private.is_ausencia_rh())
          when 'todos'   then app_private.is_ausencia_leitor()
          else false
        end
  order by a.created_at desc
$function$;

CREATE OR REPLACE FUNCTION public.ausencia_periodos_listar(p_escopo text DEFAULT 'meus'::text)
 RETURNS TABLE(id uuid, colaborador_id uuid, colaborador_nome text, colaborador_funcao text, colaborador_formato text, superior_nome text, inicio_periodo date, fim_periodo date, data_inicial date, data_limite date, dias_direito integer, dias_ajuste integer, ajuste_motivo text, observacao text, origem text, dias_tirados integer, dias_agendados integer, dias_pendentes integer, saldo integer, dias_adicionais integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select app_private.my_colaborador_id() as id)
  select p.id, p.colaborador_id, c.nome, c.funcao, c.formato, sup.nome,
         p.inicio_periodo, p.fim_periodo, p.data_inicial, p.data_limite,
         p.dias_direito, p.dias_ajuste, p.ajuste_motivo, p.observacao, p.origem,
         coalesce(u.tirados, 0), coalesce(u.agendados, 0), coalesce(u.pendentes, 0),
         p.dias_direito + p.dias_ajuste + ad.dias
           - coalesce(u.tirados, 0) - coalesce(u.agendados, 0) - coalesce(u.pendentes, 0),
         ad.dias
  from public.ausencia_periodos p
  join public.colaboradores c on c.id = p.colaborador_id
  left join public.colaboradores sup on sup.id = c.superior_id
  left join lateral (
    select
      sum(s.dias) filter (where s.status = 'aprovada' and s.data_fim < current_date)::int  as tirados,
      sum(s.dias) filter (where s.status = 'aprovada' and s.data_fim >= current_date)::int as agendados,
      sum(s.dias) filter (where s.status = 'pendente')::int                                as pendentes
    from public.ausencia_solicitacoes s
    where s.periodo_id = p.id
  ) u on true
  cross join lateral (select app_private.ausencia_adicionais_do_periodo(p.id) as dias) ad
  cross join me
  where (p_escopo = 'meus' or c.ausencia_fora_do_controle is not true)
    and case p_escopo
          when 'meus'   then p.colaborador_id = me.id
          when 'equipe' then p.colaborador_id in (select app_private.descendentes(me.id))
          when 'todos'  then app_private.is_ausencia_leitor()
          else false
        end
  order by c.nome, p.inicio_periodo desc
$function$;

CREATE OR REPLACE FUNCTION public.ausencia_pessoas_listar()
 RETURNS TABLE(id uuid, nome text, funcao text, formato text, superior_id uuid, superior_nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.id, c.nome, c.funcao, c.formato, c.superior_id, sup.nome
  from public.colaboradores c
  left join public.colaboradores sup on sup.id = c.superior_id
  where app_private.is_ausencia_leitor()
    and c.ativo is distinct from false
  order by c.nome
$function$;

CREATE OR REPLACE FUNCTION public.ausencia_solicitacoes_listar(p_escopo text DEFAULT 'meus'::text)
 RETURNS TABLE(id uuid, numero bigint, status text, origem text, fora_do_prazo boolean, colaborador_id uuid, colaborador_nome text, colaborador_funcao text, aprovador_id uuid, aprovador_nome text, periodo_id uuid, inicio_periodo date, fim_periodo date, data_inicial date, data_limite date, saldo_periodo integer, data_inicio date, data_fim date, dias integer, observacao text, motivo_reprovacao text, motivo_cancelamento text, enviado_em timestamp with time zone, decidido_em timestamp with time zone, decidido_por_nome text, cancelado_em timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select app_private.my_colaborador_id() as id)
  select s.id, s.numero, s.status, s.origem, s.fora_do_prazo,
         s.colaborador_id, c.nome, c.funcao,
         s.aprovador_id, a.nome,
         s.periodo_id, p.inicio_periodo, p.fim_periodo, p.data_inicial, p.data_limite,
         app_private.ausencia_saldo(p.id),
         s.data_inicio, s.data_fim, s.dias, s.observacao,
         s.motivo_reprovacao, s.motivo_cancelamento,
         s.enviado_em, s.decidido_em, d.nome,
         s.cancelado_em, s.created_at
  from public.ausencia_solicitacoes s
  join public.colaboradores c on c.id = s.colaborador_id
  join public.ausencia_periodos p on p.id = s.periodo_id
  left join public.colaboradores a on a.id = s.aprovador_id
  left join public.colaboradores d on d.id = s.decidido_por
  cross join me
  where case p_escopo
          when 'meus'    then s.colaborador_id = me.id
          when 'aprovar' then s.status <> 'rascunho'
                              and (s.aprovador_id = me.id
                                   or (s.aprovador_id is null and app_private.is_ausencia_rh()))
          when 'equipe'  then s.status <> 'rascunho'
                              and s.colaborador_id in (select app_private.descendentes(me.id))
          when 'todos'   then s.status <> 'rascunho' and app_private.is_ausencia_leitor()
          else false
        end
  order by s.data_inicio desc, s.numero desc
$function$;

-- ---- Humor ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.humor_respostas(p_de date, p_ate date)
 RETURNS TABLE(dia date, colaborador_id uuid, nome text, funcao text, humor smallint, comentario text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not app_private.is_ausencia_leitor() then
    raise exception 'Apenas o RH vê as respostas por pessoa.' using errcode = 'insufficient_privilege';
  end if;
  if p_ate - p_de > 366 then
    raise exception 'Período longo demais (máximo de um ano).';
  end if;
  return query
  select h.dia, c.id, c.nome, c.funcao, h.humor, h.comentario
    from public.humor_registros h
    join public.colaboradores c on c.id = h.colaborador_id
   where h.identificado
     and h.dia between p_de and p_ate
   order by h.dia desc, c.nome;
end $function$;

CREATE OR REPLACE FUNCTION public.humor_resumo(p_de date, p_ate date, p_escopo text DEFAULT 'equipe'::text)
 RETURNS TABLE(dia date, total integer, muito_mal integer, triste integer, ok integer, feliz integer, muito_feliz integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_me uuid := app_private.my_colaborador_id();
  c_minimo constant int := 3;
begin
  if p_escopo = 'todos' and not app_private.is_ausencia_leitor() then
    raise exception 'Apenas o RH vê o resumo da empresa.' using errcode = 'insufficient_privilege';
  end if;
  if p_escopo not in ('equipe', 'todos') then
    raise exception 'Escopo inválido.';
  end if;
  if p_ate - p_de > 366 then
    raise exception 'Período longo demais (máximo de um ano).';
  end if;

  return query
  with base as (
    select h.dia, h.humor
      from public.humor_registros h
     where h.dia between p_de and p_ate
       and (p_escopo = 'todos'
            or h.colaborador_id in (select app_private.descendentes(v_me)))
  ), agg as (
    select b.dia, count(*)::int as total,
           count(*) filter (where b.humor = 1)::int as n1,
           count(*) filter (where b.humor = 2)::int as n2,
           count(*) filter (where b.humor = 3)::int as n3,
           count(*) filter (where b.humor = 4)::int as n4,
           count(*) filter (where b.humor = 5)::int as n5
      from base b group by b.dia
  )
  select a.dia, a.total,
         case when a.total >= c_minimo then a.n1 end,
         case when a.total >= c_minimo then a.n2 end,
         case when a.total >= c_minimo then a.n3 end,
         case when a.total >= c_minimo then a.n4 end,
         case when a.total >= c_minimo then a.n5 end
    from agg a
   order by a.dia;
end $function$;

-- ---- SELECT das tabelas (as policies ALL do RH ficam como estão) ---------

alter policy aus_adic_select on public.ausencia_adicionais
  using (app_private.is_ausencia_leitor()
         or colaborador_id = app_private.my_colaborador_id()
         or registrado_por = app_private.my_colaborador_id()
         or aprovador_id = app_private.my_colaborador_id());

alter policy ausencia_periodos_select on public.ausencia_periodos
  using (app_private.is_ausencia_leitor()
         or colaborador_id = app_private.my_colaborador_id()
         or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id())));

alter policy ausencia_solic_select on public.ausencia_solicitacoes
  using (app_private.is_ausencia_leitor()
         or colaborador_id = app_private.my_colaborador_id()
         or aprovador_id = app_private.my_colaborador_id()
         or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id())));

-- ---- Quem recebe ------------------------------------------------------------
update public.colaboradores set ve_ausencia_humor = true
 where email = 'lucas.ferraz@phdengenharia.eng.br';

-- 28/10/2026, pedido do Lennon: a Tamiris Machado (RH) passa a ver o humor da
-- empresa; leva junto a leitura da Ausência Programada. Já aplicado.
update public.colaboradores set ve_ausencia_humor = true
 where email = 'tamiris.machado@phdengenharia.eng.br';
