-- Migration: Folga de Campo — "Já possui passagem comprada?" (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do André para a gerência de operação (30/09/2026):
--   1. pergunta obrigatória no pedido: "Já possui passagem comprada?". Quando
--      a resposta é NÃO, o líder (o aprovador do registro) recebe e-mail — isso
--      é da Edge Function notify-ausencia, evento 'sem_passagem', chamada pelo
--      front depois do registro;
--   2. indicador "Tempo de antecedência da programação" = data programada da
--      folga − data em que foi pedida. Sai de data_inicio e enviado_em, que já
--      existem; aqui só garantimos que a leitura os devolve.
--
-- `passagem_comprada` é NULL nos registros anteriores: a pergunta não existia,
-- e chutar "sim" ou "não" inventaria uma resposta. O front trata NULL como
-- "não perguntado".
--
-- Compatível com o front antigo: o parâmetro novo de folga_campo_registrar tem
-- default, então a chamada de quatro argumentos continua valendo. A função de
-- quatro argumentos é DERRUBADA para não haver duas versões (o PostgREST não
-- escolheria entre elas).
-- ============================================================================

alter table public.folga_campo_registros
  add column if not exists passagem_comprada boolean;

comment on column public.folga_campo_registros.passagem_comprada is
  'Resposta a "Já possui passagem comprada?" no pedido. NULL = registro de antes da pergunta.';

drop function if exists public.folga_campo_registrar(date, date, text, text);
create function public.folga_campo_registrar(
  p_inicio date,
  p_fim date,
  p_motivo text,
  p_obra text default null,
  p_passagem_comprada boolean default null
)
returns table (id uuid, numero bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Seu usuário não está vinculado a um colaborador.';
  end if;
  if p_inicio is null or p_fim is null then
    raise exception 'Informe a data de início e a data fim.';
  end if;
  if p_fim < p_inicio then
    raise exception 'A data fim não pode ser anterior à data de início.';
  end if;
  if p_inicio < current_date then
    raise exception 'A data de início não pode estar no passado.';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo da ausência.';
  end if;
  if exists (
    select 1 from public.folga_campo_registros r
    where r.colaborador_id = v_me
      and r.status in ('pendente', 'aprovada')
      and r.data_inicio <= p_fim and r.data_fim >= p_inicio
  ) then
    raise exception 'Você já tem uma folga de campo pendente ou aprovada nessas datas.';
  end if;

  insert into public.folga_campo_registros as r
    (colaborador_id, aprovador_id, obra, data_inicio, data_fim, motivo, passagem_comprada)
  values
    (v_me, app_private.folga_campo_aprovador_de(v_me), nullif(trim(p_obra), ''),
     p_inicio, p_fim, trim(p_motivo), p_passagem_comprada)
  returning r.id into v_id;

  return query select r.id, r.numero from public.folga_campo_registros r where r.id = v_id;
end $$;
revoke all on function public.folga_campo_registrar(date, date, text, text, boolean) from public;
revoke execute on function public.folga_campo_registrar(date, date, text, text, boolean) from anon;
grant execute on function public.folga_campo_registrar(date, date, text, text, boolean) to authenticated;

-- A leitura devolve a resposta (coluna nova no fim): drop + create.
drop function if exists public.folga_campo_listar(text);
create function public.folga_campo_listar(p_escopo text default 'meus')
returns table (
  id uuid, numero bigint, status text,
  colaborador_id uuid, colaborador_nome text, colaborador_funcao text,
  aprovador_id uuid, aprovador_nome text,
  obra text, data_inicio date, data_fim date, dias int, motivo text,
  motivo_reprovacao text, motivo_cancelamento text,
  enviado_em timestamptz, decidido_em timestamptz, decidido_por_nome text,
  cancelado_em timestamptz, created_at timestamptz,
  passagem_comprada boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select app_private.my_colaborador_id() as id)
  select r.id, r.numero, r.status,
         r.colaborador_id, c.nome, c.funcao,
         r.aprovador_id, a.nome,
         r.obra, r.data_inicio, r.data_fim, r.dias, r.motivo,
         r.motivo_reprovacao, r.motivo_cancelamento,
         r.enviado_em, r.decidido_em, d.nome,
         r.cancelado_em, r.created_at,
         r.passagem_comprada
  from public.folga_campo_registros r
  join public.colaboradores c on c.id = r.colaborador_id
  left join public.colaboradores a on a.id = r.aprovador_id
  left join public.colaboradores d on d.id = r.decidido_por
  cross join me
  where case p_escopo
          when 'meus'    then r.colaborador_id = me.id
          when 'aprovar' then r.aprovador_id = me.id
                              or (r.aprovador_id is null and app_private.is_folga_campo_rh())
          when 'equipe'  then r.colaborador_id in (select app_private.descendentes(me.id))
          when 'todos'   then app_private.is_folga_campo_rh()
          else false
        end
  order by r.data_inicio desc, r.numero desc
$$;
revoke all on function public.folga_campo_listar(text) from public;
revoke execute on function public.folga_campo_listar(text) from anon;
grant execute on function public.folga_campo_listar(text) to authenticated;

notify pgrst, 'reload schema';
