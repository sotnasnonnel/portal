-- ============================================================================
-- Edição da requisição pelo SOLICITANTE (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Pedido: o solicitante pode editar a própria requisição ENQUANTO ela está em
-- andamento; ao salvar, ela volta para o INÍCIO da cadeia de aprovação (as
-- aprovações já registradas ficam obsoletas, porque o conteúdo mudou).
--
-- Isto NÃO mexe no fluxo de "Responder" da requisição REPROVADA (migração
-- requisicoes_cancelamento): lá a etapa de quem reprovou é reaberta e a cadeia
-- NÃO recomeça. São dois caminhos distintos e ambos continuam valendo.
--
-- A troca das etapas precisa ser ATÔMICA: um delete+insert em duas chamadas do
-- cliente deixaria a requisição sem nenhuma etapa se a segunda falhasse — e
-- requisição sem etapa não tem aprovador da vez nem aparece para ninguém
-- decidir. Daí a RPC. Ela também é o ÚNICO ponto que revalida dono e status no
-- banco (o cliente checa antes, mas só o banco decide de verdade).
--
-- A função reenviar_requisicao_rh já existiu aqui (feature "Devolver para
-- ajustes", removida da interface em ago/2026) com a assinatura (uuid, jsonb) e
-- guarda de status = 'devolvida'. Esta migração recria com o motivo da edição e
-- a guarda correta; os drops abaixo cobrem os dois casos (existindo ou não).
--
-- Não amplia a RLS: `etapas_write` (supabase_migration_rls_dp.sql) já permite ao
-- gestor-dono reescrever as etapas da própria requisição. A RPC é SECURITY
-- DEFINER pela atomicidade, não por privilégio extra.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Rastro da edição
--    Sem isto, quem já tinha aprovado voltaria a aprovar sem saber que o
--    conteúdo mudou nem por quê — as telas mostram estes campos.
-- ----------------------------------------------------------------------------
alter table public.solicitacoes_rh
  add column if not exists reenvios      int default 0,   -- já criado em jul/2026; idempotente
  add column if not exists edicao_motivo text,
  add column if not exists edicao_por    uuid references public.colaboradores(id),
  add column if not exists edicao_em     timestamptz;

comment on column public.solicitacoes_rh.edicao_motivo is
  'Motivo informado pelo solicitante na última edição que reiniciou a cadeia (obrigatório na tela).';
comment on column public.solicitacoes_rh.edicao_por is
  'Quem editou (sempre o solicitante/gestor_id — a RPC recusa qualquer outro).';
comment on column public.solicitacoes_rh.edicao_em is
  'Quando a última edição reiniciou a cadeia de aprovação.';

-- ----------------------------------------------------------------------------
-- 2) RPC: troca as etapas e volta para 'pendente', numa transação só.
-- ----------------------------------------------------------------------------
drop function if exists public.reenviar_requisicao_rh(uuid, jsonb);
drop function if exists public.reenviar_requisicao_rh(uuid, jsonb, text);

create function public.reenviar_requisicao_rh(p_sol uuid, p_etapas jsonb, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu     uuid := app_private.my_colaborador_id();
  v_dono   uuid;
  v_status text;
  v_qtd    int;
begin
  if v_eu is null then
    raise exception 'Sessão sem colaborador vinculado.' using errcode = '42501';
  end if;

  -- for update: segura a linha até o fim da transação, então um aprovador que
  -- decida no mesmo instante espera e a checagem de status abaixo vale.
  select gestor_id, status into v_dono, v_status
  from public.solicitacoes_rh where id = p_sol for update;

  if not found then
    raise exception 'Requisição não encontrada.' using errcode = 'P0002';
  end if;

  if v_dono is distinct from v_eu then
    raise exception 'Só o solicitante pode editar a própria requisição.' using errcode = '42501';
  end if;

  -- Em andamento apenas: concluída/reprovada/cancelada não voltam por aqui.
  if v_status <> 'pendente' then
    raise exception 'Esta requisição não está mais em andamento (situação: %).', v_status
      using errcode = '22023';
  end if;

  delete from public.solicitacoes_rh_etapas where solicitacao_id = p_sol;

  insert into public.solicitacoes_rh_etapas
    (solicitacao_id, ordem, aprovador_id, papel, tipo_etapa, status, decidido_em)
  select p_sol,
         (e ->> 'ordem')::int,
         (e ->> 'aprovador_id')::uuid,
         e ->> 'papel',
         e ->> 'tipo_etapa',
         e ->> 'status',
         nullif(e ->> 'decidido_em', '')::timestamptz
  from jsonb_array_elements(coalesce(p_etapas, '[]'::jsonb)) e;

  get diagnostics v_qtd = row_count;
  -- Cadeia vazia deixaria a requisição sem aprovador da vez (invisível para
  -- todos). O raise desfaz o delete junto — a transação inteira volta atrás.
  if v_qtd = 0 then
    raise exception 'A cadeia de aprovação veio vazia — nada foi alterado.' using errcode = '22023';
  end if;

  update public.solicitacoes_rh
     set status        = 'pendente',
         reenvios      = coalesce(reenvios, 0) + 1,
         edicao_motivo = p_motivo,
         edicao_por    = v_eu,
         edicao_em     = now(),
         updated_at    = now()
   where id = p_sol;
end;
$$;

revoke all on function public.reenviar_requisicao_rh(uuid, jsonb, text) from public;
grant execute on function public.reenviar_requisicao_rh(uuid, jsonb, text) to authenticated;

comment on function public.reenviar_requisicao_rh(uuid, jsonb, text) is
  'Solicitante edita a própria requisição em andamento: troca as etapas pela cadeia recalculada e volta para pendente, atomicamente.';
