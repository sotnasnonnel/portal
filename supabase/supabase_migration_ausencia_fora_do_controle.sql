-- Migration: tirar alguém do controle da Ausência Programada (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do Maicon (29/09/2026): "tem alguns que não precisam estar nessa
-- lista; habilitar para que eu possa excluir os profissionais que não precisam
-- estar no controle".
--
-- NÃO é por modalidade. Ele falou de CLT, mas dos 51 CLT ativos 32 já têm
-- período e 26 já pediram ausência — cortar a modalidade inteira tiraria do
-- controle gente que o usa. É caso a caso, por pessoa.
--
-- NÃO é apagar o período, também: o portal gera período sozinho para quem tem
-- menos de um ano de casa, então a pessoa voltaria para a lista sozinha na
-- próxima abertura da tela. Uma remoção que não se sustenta vira retrabalho.
--
-- Por isso uma FLAG na pessoa. Ela faz três coisas, e é importante que sejam as
-- três, senão a remoção fica pela metade:
--   1. tira a pessoa da lista "Sem saldo cadastrado" (ausencia_sem_periodo);
--   2. tira os períodos dela dos painéis do RH e do gestor (escopos 'todos' e
--      'equipe' de ausencia_periodos_listar);
--   3. impede a geração automática de novos períodos.
--
-- O QUE ELA NÃO FAZ: apagar nada. Períodos e pedidos continuam no banco, e a
-- própria pessoa continua enxergando os seus em "Minha Ausência" — o escopo
-- 'meus' não filtra pela flag de propósito. Esconder de alguém o pedido que ela
-- mesma fez seria perder informação dela, não limpar lista do RH.
--
-- Para derrubar:
--     alter table public.colaboradores drop column ausencia_fora_do_controle;
--     -- e refazer as três funções abaixo sem o filtro
-- ============================================================================

alter table public.colaboradores
  add column if not exists ausencia_fora_do_controle boolean not null default false;

comment on column public.colaboradores.ausencia_fora_do_controle is
  'Pessoa que não entra no controle de Ausência Programada: some das listas do RH e do gestor e não ganha período automático. Não apaga histórico — o que ela já tem continua visível para ela.';

-- ----------------------------------------------------------------------------
-- 1) A lista de quem não tem período
-- ----------------------------------------------------------------------------
create or replace function public.ausencia_sem_periodo()
returns table (id uuid, nome text, funcao text, formato text, data_admissao date)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.funcao, c.formato, c.data_admissao
  from public.colaboradores c
  where app_private.is_ausencia_rh()
    and c.ativo is distinct from false
    and c.auth_id is not null
    and c.ausencia_fora_do_controle is not true
    and not exists (select 1 from public.ausencia_periodos p where p.colaborador_id = c.id)
  order by c.nome
$$;
revoke all on function public.ausencia_sem_periodo() from public;
revoke execute on function public.ausencia_sem_periodo() from anon;
grant execute on function public.ausencia_sem_periodo() to authenticated;

-- ----------------------------------------------------------------------------
-- 2) A geração automática pula quem está fora
-- ----------------------------------------------------------------------------
create or replace function public.ausencia_gerar_periodos(p_colaborador uuid default null, p_todos boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_me     uuid := app_private.my_colaborador_id();
  v_rh     boolean := app_private.is_ausencia_rh();
  v_colab  record;
  v_base   date;
  v_criados int := 0;
  v_guarda int;
begin
  if (p_todos or (p_colaborador is not null and p_colaborador <> v_me)) and not v_rh then
    raise exception 'Apenas o RH gera períodos de outros colaboradores.';
  end if;

  for v_colab in
    select c.id, c.data_admissao
    from public.colaboradores c
    where c.ativo is distinct from false
      and c.ausencia_fora_do_controle is not true
      and (p_todos or c.id = coalesce(p_colaborador, v_me))
  loop
    select max(p.fim_periodo) into v_base from public.ausencia_periodos p where p.colaborador_id = v_colab.id;
    if v_base is null then
      if v_colab.data_admissao is null or v_colab.data_admissao < (current_date - interval '1 year')::date then
        continue;
      end if;
      v_base := v_colab.data_admissao;
    end if;

    v_guarda := 0;
    while v_base <= current_date and v_guarda < 5 loop
      insert into public.ausencia_periodos
        (colaborador_id, inicio_periodo, fim_periodo, data_inicial, data_limite, origem)
      values
        (v_colab.id, v_base, (v_base + interval '1 year')::date,
         (v_base + interval '1 year')::date, (v_base + interval '2 years')::date, 'automatico')
      on conflict (colaborador_id, inicio_periodo) do nothing;
      if found then
        v_criados := v_criados + 1;
      end if;
      v_base := (v_base + interval '1 year')::date;
      v_guarda := v_guarda + 1;
    end loop;
  end loop;

  return v_criados;
end $$;
revoke all on function public.ausencia_gerar_periodos(uuid, boolean) from public;
revoke execute on function public.ausencia_gerar_periodos(uuid, boolean) from anon;
grant execute on function public.ausencia_gerar_periodos(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Os painéis do RH e do gestor
--
-- O escopo 'meus' fica de fora do filtro: a pessoa removida continua vendo o
-- que é dela.
-- ----------------------------------------------------------------------------
create or replace function public.ausencia_periodos_listar(p_escopo text default 'meus')
returns table (
  id uuid, colaborador_id uuid, colaborador_nome text, colaborador_funcao text,
  colaborador_formato text, superior_nome text,
  inicio_periodo date, fim_periodo date, data_inicial date, data_limite date,
  dias_direito int, dias_ajuste int, ajuste_motivo text, observacao text, origem text,
  dias_tirados int, dias_agendados int, dias_pendentes int, saldo int
)
language sql stable security definer set search_path = '' as $$
  with me as (select app_private.my_colaborador_id() as id)
  select p.id, p.colaborador_id, c.nome, c.funcao, c.formato, sup.nome,
         p.inicio_periodo, p.fim_periodo, p.data_inicial, p.data_limite,
         p.dias_direito, p.dias_ajuste, p.ajuste_motivo, p.observacao, p.origem,
         coalesce(u.tirados, 0), coalesce(u.agendados, 0), coalesce(u.pendentes, 0),
         p.dias_direito + p.dias_ajuste
           - coalesce(u.tirados, 0) - coalesce(u.agendados, 0) - coalesce(u.pendentes, 0)
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
  cross join me
  where (p_escopo = 'meus' or c.ausencia_fora_do_controle is not true)
    and case p_escopo
          when 'meus'   then p.colaborador_id = me.id
          when 'equipe' then p.colaborador_id in (select app_private.descendentes(me.id))
          when 'todos'  then app_private.is_ausencia_rh()
          else false
        end
  order by c.nome, p.inicio_periodo desc
$$;
revoke all on function public.ausencia_periodos_listar(text) from public;
revoke execute on function public.ausencia_periodos_listar(text) from anon;
grant execute on function public.ausencia_periodos_listar(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) A porta para a tela: só o RH liga e desliga a flag.
--
-- Devolve o que a pessoa TEM antes de sair (períodos, pedidos e saldo), porque
-- a tela precisa disso para avisar antes de confirmar — decisão de 29/09/2026:
-- remover quem já usa o controle é possível, mas nunca em silêncio.
-- ----------------------------------------------------------------------------
create or replace function public.ausencia_resumo_do_colaborador(p_colaborador uuid)
returns table (periodos int, pedidos int, saldo int)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.ausencia_periodos p where p.colaborador_id = p_colaborador),
    (select count(*)::int from public.ausencia_solicitacoes s
      where s.colaborador_id = p_colaborador and s.status in ('pendente', 'aprovada')),
    coalesce((
      select sum(p.dias_direito + p.dias_ajuste
                 - coalesce((select sum(s.dias)::int from public.ausencia_solicitacoes s
                              where s.periodo_id = p.id and s.status in ('pendente', 'aprovada')), 0))::int
        from public.ausencia_periodos p where p.colaborador_id = p_colaborador
    ), 0)
  where app_private.is_ausencia_rh()
$$;
revoke all on function public.ausencia_resumo_do_colaborador(uuid) from public;
revoke execute on function public.ausencia_resumo_do_colaborador(uuid) from anon;
grant execute on function public.ausencia_resumo_do_colaborador(uuid) to authenticated;

create or replace function public.ausencia_definir_controle(p_colaborador uuid, p_dentro boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_ausencia_rh() then
    raise exception 'Apenas o RH tira ou devolve alguém ao controle de ausência.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.colaboradores
     set ausencia_fora_do_controle = not coalesce(p_dentro, true)
   where id = p_colaborador;

  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
end $$;
revoke all on function public.ausencia_definir_controle(uuid, boolean) from public;
revoke execute on function public.ausencia_definir_controle(uuid, boolean) from anon;
grant execute on function public.ausencia_definir_controle(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
