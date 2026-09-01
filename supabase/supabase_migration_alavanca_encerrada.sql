-- Aplicada em 2026-08-31 (versão 20260831162910, "alavanca_status_encerrada").
-- Rollback em supabase/rollback_alavanca_encerrada.sql.
--
-- "Cancelada" vira "Encerrada": o rótulo antigo dizia que alguém desistiu, e o
-- que o comercial registra ali é a oportunidade que não foi adiante — inclusive
-- as que evoluíram e pararam. As duas situações passam a ter um nome só.
--
-- Dois triggers ficam desligados durante a troca:
--  - trg_notif_prog_alavanca manda notificação do sino a cada mudança de status,
--    e são 60 linhas de correção administrativa — quem indicou não tem o que
--    fazer com 60 avisos de algo que não mudou para ele.
--  - programas_alavanca_protege exige que quem mexe em status seja do comercial;
--    esta migração roda como serviço, sem colaborador por trás.
alter table public.programas_alavanca disable trigger trg_notif_prog_alavanca;
alter table public.programas_alavanca disable trigger programas_alavanca_protege;

alter table public.programas_alavanca drop constraint programas_alavanca_status_check;

update public.programas_alavanca
   set status = 'encerrada'
 where status in ('cancelada', 'em_evolucao');

-- 'em_evolucao' CONTINUA na lista: é etapa viva do funil para indicação nova.
-- O que saiu foi 'cancelada', que não existe mais em lugar nenhum.
alter table public.programas_alavanca add constraint programas_alavanca_status_check
  check (status = any (array['em_analise', 'nao_elegivel', 'em_evolucao', 'concluida', 'encerrada']));

alter table public.programas_alavanca enable trigger programas_alavanca_protege;
alter table public.programas_alavanca enable trigger trg_notif_prog_alavanca;
