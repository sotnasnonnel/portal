-- ============================================================================
-- Programas — ficha de ROI só para INICIATIVA.
-- Ideia é o que ainda não existe: não tem antes e depois para medir. O front já
-- não oferece a ficha para ideia; esta policy fecha a mesma porta no banco.
--
-- (Aplicada no portal_phd em 2026-10-28.) Em 2026-10-28 não havia nenhuma
-- ficha de ideia gravada, então não há o que limpar. A forma (`tipo`) do
-- registro não muda depois de criada (lib/ideias.js não a edita), então
-- conferir só na criação basta.
-- ============================================================================

drop policy if exists programas_roi_insert on public.programas_roi;
create policy programas_roi_insert on public.programas_roi
  for insert to authenticated
  with check (
    autor_id = app_private.my_colaborador_id()
    and exists (
      select 1 from public.programas_ideias i
      where i.id = ideia_id
        and i.autor_id = app_private.my_colaborador_id()
        and i.tipo = 'iniciativa'
    )
  );
