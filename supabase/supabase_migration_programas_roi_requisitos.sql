-- ============================================================================
-- Programas — 4 requisitos da equipe de Inovação na ficha de ROI.
--
-- (Aplicada no portal_phd em 2026-11-19, antes do deploy do front.)
-- APLICAR ANTES DO DEPLOY DO FRONT: o Ranking e a ficha passam a ler estas
-- colunas, e um select com coluna inexistente derruba as duas telas.
--
-- Cada requisito é ✓ (true, +1 ponto no ranking) ou ✗ (false, 0). NULL = ainda
-- não avaliado (vale 0). As 14 fichas já validadas em 19/11/2026 ficam NULL até
-- o admin abrir o parecer e marcar.
--
--   req_usabilidade   Usabilidade em obra de uso corporativo
--                     (trocado em 19/11 por req_continuidade:
--                     supabase_migration_programas_roi_req_continuidade.sql)
--   req_qtd_obras     Aplicado em mais de uma obra
--   req_semelhantes   NÃO tem iniciativas semelhantes já implementadas
--   req_resolve_obra  Resolve o problema da obra
--
-- São do AVALIADOR, não do autor: entram na mesma trava da validação (só o
-- admin do módulo escreve). Mexer no conteúdo da ficha devolve a validação para
-- "pendente", mas os requisitos ficam: o admin revê ao validar de novo.
-- ============================================================================

alter table public.programas_roi
  add column if not exists req_usabilidade  boolean,
  add column if not exists req_qtd_obras    boolean,
  add column if not exists req_semelhantes  boolean,
  add column if not exists req_resolve_obra boolean;

create or replace function app_private.programas_roi_protege()
returns trigger language plpgsql security definer set search_path to '' as $fn$
declare
  sou_admin boolean := coalesce(app_private.is_programas_admin(), false);
  sou_autor boolean;
  mudou_conteudo boolean;
begin
  if tg_op = 'INSERT' then
    -- Ficha nasce aguardando validação, seja quem for que a crie.
    new.validacao := 'pendente';
    new.parecer := null;
    new.validado_por := null;
    new.validado_em := null;
    new.req_usabilidade := null;
    new.req_qtd_obras := null;
    new.req_semelhantes := null;
    new.req_resolve_obra := null;
    return new;
  end if;

  sou_autor := coalesce(old.autor_id = app_private.my_colaborador_id(), false);

  if new.ideia_id is distinct from old.ideia_id
     or new.autor_id is distinct from old.autor_id
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Registro, autor e data de criacao da ficha nao podem ser alterados.';
  end if;

  mudou_conteudo := (
       new.workshop is distinct from old.workshop
    or new.workshop_qual is distinct from old.workshop_qual
    or new.problema is distinct from old.problema
    or new.medicao_inicio is distinct from old.medicao_inicio
    or new.medicao_fim is distinct from old.medicao_fim
    or new.tempo_antes is distinct from old.tempo_antes
    or new.tempo_depois is distinct from old.tempo_depois
    or new.tempo_unidade is distinct from old.tempo_unidade
    or new.tempo_execucoes is distinct from old.tempo_execucoes
    or new.detalhe_tempo is distinct from old.detalhe_tempo
    or new.gasto_descricao is distinct from old.gasto_descricao
    or new.gasto_antes is distinct from old.gasto_antes
    or new.gasto_atual is distinct from old.gasto_atual
    or new.custo_solucao is distinct from old.custo_solucao
    or new.detalhe_financeiro is distinct from old.detalhe_financeiro
    or new.fac_desenvolver is distinct from old.fac_desenvolver
    or new.fac_implantar is distinct from old.fac_implantar
    or new.fac_treinamento is distinct from old.fac_treinamento
    or new.fac_autonomia is distinct from old.fac_autonomia
  );

  if mudou_conteudo and not sou_autor then
    raise exception 'So quem registrou a solucao pode alterar a ficha de ROI.';
  end if;

  if not sou_admin and (
       new.validacao is distinct from old.validacao
    or new.parecer is distinct from old.parecer
    or new.validado_por is distinct from old.validado_por
    or new.validado_em is distinct from old.validado_em
    or new.req_usabilidade is distinct from old.req_usabilidade
    or new.req_qtd_obras is distinct from old.req_qtd_obras
    or new.req_semelhantes is distinct from old.req_semelhantes
    or new.req_resolve_obra is distinct from old.req_resolve_obra
  ) then
    raise exception 'So a equipe de Inovacao (admin do modulo) valida a ficha de ROI.';
  end if;

  if mudou_conteudo then
    new.validacao := 'pendente';
    new.validado_por := null;
    new.validado_em := null;
  end if;

  new.updated_at := now();
  return new;
end
$fn$;
