-- Migration: RH corrige os dias TIRADOS de um lançamento (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do Maicon (29/09/2026): "está como tirado, mas a pessoa de fato não
-- tirou os dias. Editar, colocar 0 — ou quantos tirou."
--
-- "Tirados" NÃO é um número gravado: é a soma dos lançamentos aprovados que já
-- terminaram (ausencia_periodos_listar). Editar um número solto deixaria o
-- lançamento dizendo que a pessoa esteve fora em datas em que não esteve — e
-- essas datas valem para outras coisas (o SLA dos chamados pausa na ausência).
-- Por isso a correção é NO LANÇAMENTO:
--   - 0 dias  → a tela usa ausencia_cancelar, que já existe e já exige motivo
--               do RH (o lançamento fica no histórico como cancelado);
--   - N dias  → esta função encurta (ou estende) o lançamento a partir do mesmo
--               início: data_fim = data_inicio + N - 1.
--
-- A correção fica registrada no próprio lançamento: quantos dias havia antes,
-- quem corrigiu, quando e por quê. `dias_antes_correcao` guarda o valor da
-- PRIMEIRA correção, que é o que veio da planilha ou do pedido original.
--
-- Não depende de deploy: colunas novas são opcionais e a função é nova.
--
-- Para derrubar:
--     drop function if exists public.ausencia_corrigir_dias(uuid, int, text);
--     alter table public.ausencia_solicitacoes
--       drop column dias_antes_correcao, drop column corrigido_em,
--       drop column corrigido_por, drop column motivo_correcao;
-- ============================================================================

alter table public.ausencia_solicitacoes
  add column if not exists dias_antes_correcao int,
  add column if not exists corrigido_em timestamptz,
  add column if not exists corrigido_por uuid references public.colaboradores(id),
  add column if not exists motivo_correcao text;

comment on column public.ausencia_solicitacoes.dias_antes_correcao is
  'Dias do lançamento antes da primeira correção do RH (ausencia_corrigir_dias).';

create or replace function public.ausencia_corrigir_dias(p_id uuid, p_dias int, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me  uuid := app_private.my_colaborador_id();
  v_sol public.ausencia_solicitacoes;
begin
  if not app_private.is_ausencia_rh() then
    raise exception 'Apenas o RH corrige os dias de um lançamento.'
      using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo da correção.';
  end if;
  if p_dias is null or p_dias < 1 then
    raise exception 'Para zerar o lançamento, cancele-o.';
  end if;

  select * into v_sol from public.ausencia_solicitacoes s where s.id = p_id for update;
  if v_sol.id is null then
    raise exception 'Lançamento não encontrado.';
  end if;
  if v_sol.status <> 'aprovada' then
    raise exception 'Só um lançamento aprovado pode ter os dias corrigidos.';
  end if;
  if p_dias = v_sol.dias then return; end if;

  -- Aumentar não pode deixar o período negativo: o saldo sem este lançamento
  -- precisa comportar os dias novos.
  if p_dias > v_sol.dias and app_private.ausencia_saldo(v_sol.periodo_id, v_sol.id) < p_dias then
    raise exception 'O período não tem saldo para % dia(s).', p_dias;
  end if;

  update public.ausencia_solicitacoes s
     set data_fim            = s.data_inicio + (p_dias - 1),
         dias_antes_correcao = coalesce(s.dias_antes_correcao, s.dias),
         corrigido_em        = now(),
         corrigido_por       = v_me,
         motivo_correcao     = trim(p_motivo)
   where s.id = p_id;
end $$;
revoke all on function public.ausencia_corrigir_dias(uuid, int, text) from public;
revoke execute on function public.ausencia_corrigir_dias(uuid, int, text) from anon;
grant execute on function public.ausencia_corrigir_dias(uuid, int, text) to authenticated;

notify pgrst, 'reload schema';
