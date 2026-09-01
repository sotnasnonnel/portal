-- ROLLBACK da migração supabase_migration_alavanca_encerrada.sql
--
-- Desfaz a troca de status 'cancelada'/'em_evolucao' -> 'encerrada', devolvendo
-- cada uma das 60 indicações ao status que tinha antes. Depois que 'encerrada'
-- passar a ser usada de verdade pelo comercial, este arquivo perde a validade:
-- ele restaura o estado de 2026-08-31, não o estado atual.
--
-- O CHECK precisa aceitar os dois valores antigos de novo, e o trigger do sino
-- fica desligado durante a troca — senão quem indicou recebe 60 notificações de
-- uma correção administrativa que não mudou nada para ele.

begin;

alter table public.programas_alavanca disable trigger trg_notif_prog_alavanca;

alter table public.programas_alavanca drop constraint programas_alavanca_status_check;
alter table public.programas_alavanca add constraint programas_alavanca_status_check
  check (status = any (array['em_analise', 'nao_elegivel', 'em_evolucao', 'concluida', 'cancelada']));

update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000001';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000013';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000011';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000006';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000003';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000004';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000024';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000017';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000027';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000018';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000026';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000019';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000022';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000020';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000025';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000023';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000045';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000044';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000043';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000042';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000041';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000050';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000047';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000046';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000060';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000058';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000053';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000052';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000055';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000054';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000057';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000056';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000048';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000049';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000063';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000069';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000062';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000066';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000068';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000067';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000065';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000071';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000088';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000078';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000086';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000080';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000077';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000087';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000079';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000083';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000082';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000084';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000090';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000085';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000094';
update public.programas_alavanca set status = 'em_evolucao' where id = 'a1a10000-0000-4000-8000-000000000093';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000095';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000099';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000091';
update public.programas_alavanca set status = 'cancelada' where id = 'a1a10000-0000-4000-8000-000000000103';

alter table public.programas_alavanca enable trigger trg_notif_prog_alavanca;

commit;
