-- ============================================================================
-- Programas — quem cadastrou passa a poder EXCLUIR o próprio registro, e o
-- autor da indicação passa a poder EDITÁ-LA enquanto o comercial não a
-- trabalhou. (Aplicada no portal_phd em 2026-08-27.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Campo de Ideias: excluir o que é meu (o admin do módulo pode qualquer um).
-- Os eventos saem por cascade.
-- ---------------------------------------------------------------------------
drop policy if exists programas_ideias_delete on public.programas_ideias;
create policy programas_ideias_delete on public.programas_ideias
  for delete to authenticated
  using (autor_id = app_private.my_colaborador_id() or app_private.is_programas_admin());

-- ---------------------------------------------------------------------------
-- Alavanca: o autor volta a editar, mas só ENQUANTO a indicação está em
-- análise. Depois que o comercial mexeu (em evolução ou concluída), mudar a
-- empresa por baixo dele quebraria a avaliação já feita.
-- ---------------------------------------------------------------------------
drop policy if exists programas_alavanca_update on public.programas_alavanca;
create policy programas_alavanca_update on public.programas_alavanca
  for update to authenticated
  using (
    app_private.is_programas_comercial()
    or (indicado_por = app_private.my_colaborador_id() and status = 'em_analise')
  )
  with check (
    app_private.is_programas_comercial()
    or (indicado_por = app_private.my_colaborador_id() and status = 'em_analise')
  );

-- Excluir: o autor, enquanto não concluída. Indicação concluída tem prêmio
-- calculado (às vezes já pago) e vira registro financeiro — some do mapa de
-- vencedores se apagada. Só o admin do módulo apaga essas.
drop policy if exists programas_alavanca_delete on public.programas_alavanca;
create policy programas_alavanca_delete on public.programas_alavanca
  for delete to authenticated
  using (
    (indicado_por = app_private.my_colaborador_id() and status <> 'concluida')
    or app_private.is_programas_admin()
  );

-- ---------------------------------------------------------------------------
-- Trava de coluna. A RLS decide QUEM escreve na linha, não QUAIS colunas — sem
-- isto, o autor que agora pode dar UPDATE poderia gravar status='concluida' e
-- valor_premio, ou seja, premiar a si mesmo. O trigger é o que separa "os
-- campos do formulário" (do autor) de "a avaliação" (do comercial).
--
-- Editar empresa/contato ainda pode mexer em `elegibilidade`, e isso é de
-- propósito: a checagem é recalculada no cliente quando o alvo muda, e deixar o
-- veredito antigo colado numa empresa nova seria pior.
-- ---------------------------------------------------------------------------
create or replace function app_private.alavanca_protege_avaliacao()
returns trigger language plpgsql security definer set search_path to '' as $fn$
begin
  if app_private.is_programas_comercial() then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.comentario is distinct from old.comentario
     or new.valor_contrato is distinct from old.valor_contrato
     or new.valor_premio is distinct from old.valor_premio
     or new.pago_em is distinct from old.pago_em
     or new.concluida_em is distinct from old.concluida_em
     or new.indicado_por is distinct from old.indicado_por
     or new.numero is distinct from old.numero
     or new.criado_em is distinct from old.criado_em then
    raise exception
      'Só o time comercial pode alterar status, comentário e premiação da indicação.';
  end if;

  return new;
end
$fn$;

drop trigger if exists programas_alavanca_protege on public.programas_alavanca;
create trigger programas_alavanca_protege
  before update on public.programas_alavanca
  for each row execute function app_private.alavanca_protege_avaliacao();
