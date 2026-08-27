-- PMO (Solicitações): "concluída" some da lista uma semana DEPOIS de o status
-- virar concluído.
--
-- Contexto: o front já escondia concluídas há mais de 7 dias, mas usava
-- solic_surveys.completed_at — e nada preenchia essa coluna. Resultado: 34 das
-- 131 concluídas estavam sem carimbo e ficavam na lista para sempre. A data de
-- ENTREGA (delivery_date) não serve de referência: está vazia em 100% das
-- linhas, porque nem toda solicitação tem entrega marcada.
--
-- Com esta migração o banco vira a garantia: qualquer caminho que mude o status
-- (tela da solicitação, kanban, SQL manual) carimba completed_at sozinho.

-- 1) Backfill das concluídas sem carimbo. Roda ANTES do gatilho de propósito:
--    o gatilho reescreve updated_at, que é justamente a referência usada aqui.
update public.solic_surveys
   set completed_at = coalesce(updated_at, created_at, now())
 where status = 'COMPLETED'
   and completed_at is null;

-- 2) Higiene: quem não está concluída não deve carregar carimbo.
update public.solic_surveys
   set completed_at = null
 where status <> 'COMPLETED'
   and completed_at is not null;

-- 3) Carimbo automático de completed_at (e updated_at) a cada mudança.
create or replace function public.solic_surveys_carimbar_conclusao()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'COMPLETED' then
    -- Só carimba ao ENTRAR em concluído; reeditar uma concluída não reinicia a
    -- contagem da semana.
    if tg_op = 'INSERT' or old.status is distinct from 'COMPLETED' or new.completed_at is null then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  else
    -- Voltou para aberta/andamento/cancelada: o carimbo não vale mais.
    new.completed_at := null;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_solic_surveys_carimbar_conclusao on public.solic_surveys;

create trigger trg_solic_surveys_carimbar_conclusao
before insert or update on public.solic_surveys
for each row
execute function public.solic_surveys_carimbar_conclusao();
