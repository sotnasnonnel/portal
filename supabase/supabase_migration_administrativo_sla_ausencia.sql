-- Migration: SLA do chamado começa na volta do atendente ausente (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do Adm: quando o chamado cai para alguém que está de férias ou de
-- folga, o prazo não pode correr — ele começa quando a pessoa volta.
--
-- Hoje `sla_vence_em` é calculado no FRONT, em dois caminhos (abertura direta e
-- liberação depois da última aprovação). Por isso a regra mora num GATILHO, e
-- não numa terceira conta em JavaScript: o gatilho pega os dois caminhos, pega
-- também qualquer correção feita fora da tela, e não tem como ser esquecido
-- quando aparecer o terceiro caminho. O front continua mandando o prazo normal;
-- o banco só o empurra quando é caso de ausência.
--
-- DUAS decisões que o pedido não decide:
--
-- 1) Olha-se a ausência SÓ NO MOMENTO em que o prazo nasce. Férias que começam
--    depois não mexem em prazo já dado: o chamado que já está na mesa de alguém
--    muda de dono, não de prazo. (Decisão do usuário, 23/09/2026.)
--
-- 2) O prazo é do ATENDENTE do serviço, que é quem o chamado nasce esperando.
--    Chamado sem atendente definido segue com o prazo normal — não há de quem
--    esperar a volta.
--
-- `sla_inicio_em` é gravado SEMPRE, e não só no caso de ausência: sem ele a
-- tela não teria como dizer por que um chamado aberto hoje só vence em três
-- semanas, e o prazo esticado pareceria erro.
--
-- Para derrubar:
--     drop trigger if exists chamados_adm_sla_ausencia on public.chamados_adm;
--     alter table public.chamados_adm drop column sla_inicio_em;
-- ============================================================================

alter table public.chamados_adm
  add column if not exists sla_inicio_em timestamptz;

comment on column public.chamados_adm.sla_inicio_em is
  'Quando o relógio do SLA começou a correr. Normalmente = abertura (ou liberação da alçada); mais tarde quando o atendente estava ausente e o prazo foi empurrado para a volta dele.';

-- ----------------------------------------------------------------------------
-- 1) Até quando a pessoa está fora
--
-- Devolve o ÚLTIMO dia de ausência aprovada que cobre `p_dia`, emendando
-- períodos colados: quem sai de férias e emenda folga volta uma vez só, e parar
-- no primeiro período devolveria uma "volta" em que a pessoa continua fora.
--
-- A Folga de Campo entra por `to_regclass` porque as tabelas dela ainda não
-- existem em produção (módulo escrito, migração não aplicada). Referência
-- estática quebraria a função inteira — e com ela a abertura de chamados.
-- ----------------------------------------------------------------------------
create or replace function app_private.ausente_ate(p_pessoa uuid, p_dia date)
returns date language plpgsql stable security definer set search_path = '' as $$
declare
  v_fim  date;
  v_novo date;
  i int := 0;
begin
  if p_pessoa is null or p_dia is null then return null; end if;

  select max(s.data_fim) into v_fim
    from public.ausencia_solicitacoes s
   where s.colaborador_id = p_pessoa
     and s.status = 'aprovada'
     and p_dia between s.data_inicio and s.data_fim;

  if v_fim is null and to_regclass('public.folga_campo_solicitacoes') is not null then
    execute 'select max(s.data_fim) from public.folga_campo_solicitacoes s
              where s.colaborador_id = $1 and s.status = ''aprovada''
                and $2 between s.data_inicio and s.data_fim'
       into v_fim using p_pessoa, p_dia;
  end if;

  if v_fim is null then return null; end if;

  -- Emenda: período que começa até o dia seguinte ao fim do anterior. O limite
  -- de 12 voltas é só para nunca girar sem fim se algum dado vier torto.
  loop
    i := i + 1;
    exit when i > 12;

    select max(s.data_fim) into v_novo
      from public.ausencia_solicitacoes s
     where s.colaborador_id = p_pessoa
       and s.status = 'aprovada'
       and s.data_inicio <= v_fim + 1
       and s.data_fim > v_fim;

    if v_novo is null and to_regclass('public.folga_campo_solicitacoes') is not null then
      execute 'select max(s.data_fim) from public.folga_campo_solicitacoes s
                where s.colaborador_id = $1 and s.status = ''aprovada''
                  and s.data_inicio <= $2 + 1 and s.data_fim > $2'
         into v_novo using p_pessoa, v_fim;
    end if;

    exit when v_novo is null;
    v_fim := v_novo;
  end loop;

  return v_fim;
end $$;
revoke all on function app_private.ausente_ate(uuid, date) from public;
revoke execute on function app_private.ausente_ate(uuid, date) from anon;
grant execute on function app_private.ausente_ate(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Prazo em dias úteis — espelho plpgsql de venceEmDiasUteis (utils/diasUteis.js)
--
-- Preserva a hora do início, como a versão JS, e empurra para segunda quem
-- começa no fim de semana: senão o primeiro dia do prazo seria gasto num dia em
-- que ninguém trabalha. Feriado não é tratado em NENHUM dos dois — limitação
-- conhecida do portal, documentada lá.
-- ----------------------------------------------------------------------------
create or replace function app_private.adm_vence_em_dias_uteis(p_inicio timestamptz, p_dias int)
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare
  d timestamptz := p_inicio;
  i int := 0;
begin
  if p_inicio is null or coalesce(p_dias, 0) <= 0 then return null; end if;

  while extract(isodow from d) > 5 loop d := d + interval '1 day'; end loop;
  while i < p_dias loop
    d := d + interval '1 day';
    while extract(isodow from d) > 5 loop d := d + interval '1 day'; end loop;
    i := i + 1;
  end loop;
  return d;
end $$;
revoke all on function app_private.adm_vence_em_dias_uteis(timestamptz, int) from public;
revoke execute on function app_private.adm_vence_em_dias_uteis(timestamptz, int) from anon;

-- ----------------------------------------------------------------------------
-- 3) O gatilho
--
-- Só age quando o prazo NASCE (insert com prazo, ou update que passa a ter um).
-- Um chamado que já tem prazo não é recalculado: o relógio, uma vez começado,
-- é o mesmo até o fim.
-- ----------------------------------------------------------------------------
create or replace function app_private.adm_sla_da_ausencia()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_volta date;
  v_dias  int;
  v_inicio timestamptz;
begin
  if new.sla_vence_em is null then return new; end if;
  if tg_op = 'UPDATE' and old.sla_vence_em is not null then return new; end if;

  new.sla_inicio_em := coalesce(new.sla_inicio_em, now());

  if new.atendente_id is null then return new; end if;

  v_volta := app_private.ausente_ate(new.atendente_id, current_date);
  if v_volta is null then return new; end if;

  select cfg.sla_dias_uteis into v_dias
    from public.chamados_adm_config cfg
   where cfg.classe = new.classe and cfg.servico = new.servico;
  if coalesce(v_dias, 0) <= 0 then return new; end if;

  -- Volta no dia seguinte ao último de ausência; a conta de dias úteis empurra
  -- para segunda se essa volta cair no fim de semana.
  v_inicio := (v_volta + 1)::timestamptz + (now() - date_trunc('day', now()));

  new.sla_inicio_em := v_inicio;
  new.sla_vence_em  := app_private.adm_vence_em_dias_uteis(v_inicio, v_dias);
  return new;
end $$;

drop trigger if exists chamados_adm_sla_ausencia on public.chamados_adm;
create trigger chamados_adm_sla_ausencia
before insert or update of sla_vence_em on public.chamados_adm
for each row execute function app_private.adm_sla_da_ausencia();

-- PostgREST guarda o schema em cache; sem isso o front recebe
-- "Could not find the ... column" ao ler sla_inicio_em.
notify pgrst, 'reload schema';
