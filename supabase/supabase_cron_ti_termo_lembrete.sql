-- Agendamento: lembrete diário do termo de responsabilidade da TI
-- (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Todo dia às 08:00 de Brasília (11:00 UTC) o banco chama a edge function
-- notify-termo-ti, que manda um e-mail para cada pessoa com equipamento em uso
-- e termo ainda não aceito. Ela trava um envio por pessoa por dia
-- (ti_termo_lembretes), então chamar de novo no mesmo dia não duplica.
--
-- É o primeiro agendamento do portal: liga pg_cron e pg_net.
--
-- ORDEM (aplicar POR ÚLTIMO):
--   1. supabase_migration_ti_termo_aceite.sql
--   2. deploy da edge function notify-termo-ti (verify_jwt = false)
--   3. deploy do front com a tela /ti/termos nova — o e-mail aponta para ela
--   4. este arquivo. O primeiro envio sai às 08:00 do dia seguinte; para
--      disparar na hora, rode o select net.http_post(...) do final à mão.
--
-- Para desligar: select cron.unschedule('ti-termo-lembrete');
-- Idempotente.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'ti-termo-lembrete';

select cron.schedule(
  'ti-termo-lembrete',
  '0 11 * * *',
  $$
    select net.http_post(
      url := 'https://bogsuuhrgvopzgcceoqz.supabase.co/functions/v1/notify-termo-ti',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);

-- Disparo manual (mesma chamada do agendamento):
-- select net.http_post(
--   url := 'https://bogsuuhrgvopzgcceoqz.supabase.co/functions/v1/notify-termo-ti',
--   headers := '{"Content-Type": "application/json"}'::jsonb,
--   body := '{}'::jsonb,
--   timeout_milliseconds := 120000
-- );
