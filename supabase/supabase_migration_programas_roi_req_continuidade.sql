-- ============================================================================
-- Programas — troca o requisito "Usabilidade em obra de uso corporativo" por
-- "Tem continuidade garantida".
-- (Aplicada no portal_phd em 2026-11-19, antes do deploy do front: a tela le
-- req_continuidade.)
--
-- Pré-requisito: supabase_migration_programas_roi_requisitos.sql.
-- Na aplicação nenhuma ficha tinha o requisito antigo marcado, então a coluna
-- é só renomeada. A trava é recriada porque o corpo plpgsql cita a coluna pelo
-- nome e não acompanha o rename.
-- ============================================================================

alter table public.programas_roi rename column req_usabilidade to req_continuidade;

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
    new.req_continuidade := null;
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
    or new.req_continuidade is distinct from old.req_continuidade
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
