-- Migration: programas_awards_reiniciar (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- PHD Awards: botão "Reiniciar premiação" para quem avalia. Antes de as inscrições
-- abrirem, eles conhecem o fluxo inteiro (finalistas, votação, resultado,
-- revelação) e voltam ao começo quantas vezes quiserem, sem depender de SQL.
--
-- Apaga pódio, votos e finalistas e volta a fase para 'validacao'. Os projetos
-- cadastrados ficam: cada um apaga os seus de teste pelo botão Excluir, que
-- também tira o arquivo do bucket.
--
-- SÓ ANTES DAS INSCRIÇÕES (até 15/11/2026, horário de Brasília): depois disso
-- os votos são de verdade. A data repete AWARDS_INSCRICOES.abre
-- (src/config/programas.js): prorrogar exige mudar os dois.
--
-- PRÉ-REQUISITO: supabase_migration_programas_awards_votacao.sql, na versão
-- de 11/11 (com o Pedro em awards_avaliador e o "where true" do awards_revelar).
-- Idempotente: pode rodar de novo.
-- ============================================================================

create or replace function public.awards_reiniciar_premiacao()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.awards_avaliador() then
    raise exception 'Só quem avalia reinicia a premiação.';
  end if;
  if (timezone('America/Sao_Paulo', now()))::date >= date '2026-11-16' then
    raise exception 'As inscrições já abriram: não dá mais para reiniciar.';
  end if;

  perform 1 from public.programas_awards_estado where id = 1 for update;
  -- "where true": o safeupdate das chamadas do app recusa DELETE sem WHERE.
  delete from public.programas_awards_podio where true;
  delete from public.programas_awards_votos where true;
  delete from public.programas_awards_finalistas where true;
  update public.programas_awards_estado
  set fase = 'validacao', mudou_em = now(), mudou_por = app_private.my_colaborador_id()
  where id = 1;
end;
$$;

revoke all on function public.awards_reiniciar_premiacao() from public;
revoke execute on function public.awards_reiniciar_premiacao() from anon;
grant execute on function public.awards_reiniciar_premiacao() to authenticated;

notify pgrst, 'reload schema';
