-- Migration: notificações da Mobilização (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- O sino do portal passa a avisar sobre as etapas de mobilização.
--
-- Segue o padrão já estabelecido em supabase_migration_notificacoes.sql: quem
-- CRIA a notificação é um gatilho no banco, não a tela. A razão está escrita
-- lá — "a ação vale por qualquer caminho (tela, script, correção manual) — uma
-- tela nova não tem como esquecer de notificar" — e aqui pesa mais ainda,
-- porque as etapas mudam de dono e de situação por três caminhos diferentes
-- (o quadro, a tela do processo e o gatilho do Administrativo).
--
-- O QUE AVISA, e por quê só isto:
--
--   * A etapa caiu no seu nome  -> 'sua_vez'. É o aviso que substitui o
--     "eu te mando um WhatsApp" de hoje. Sem ele, o responsável só descobre
--     abrindo a tela.
--
--   * O processo terminou       -> 'concluida', para quem o abriu.
--
--   * O processo foi cancelado  -> 'reprovada', para quem o abriu. Vale
--     principalmente quando o chamado do Adm é reprovado e o cancelamento vem
--     em cascata: sem aviso, o processo some do quadro sem explicação.
--
-- O que NÃO avisa, de propósito: cada etapa concluída. Um processo tem até 11
-- passos, e avisar todos transformaria o sino em ruído — que é o jeito mais
-- rápido de as pessoas pararem de olhar para ele.
--
-- Repetição é barrada pelo índice único parcial `notificacoes_vez_idx`
-- (destinatario_id, referencia_id) where tipo = 'sua_vez': reatribuir a mesma
-- etapa à mesma pessoa duas vezes avisa uma só.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Etapa que ganhou dono
-- ----------------------------------------------------------------------------
create or replace function app_private.notif_mob_etapa_atribuida()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare p record;
begin
  if new.responsavel_id is null or new.responsavel_id is not distinct from old.responsavel_id then
    return null;
  end if;
  -- Etapa já encerrada não gera tarefa para ninguém.
  if new.status in ('concluida', 'dispensada') then return null; end if;

  select numero, titulo, status into p from mobilizacao_processos where id = new.processo_id;
  if p is null or p.status = 'cancelado' then return null; end if;

  perform app_private.notificar(
    new.responsavel_id, 'mobilizacao', 'sua_vez',
    format('Mobilização #%s: %s está com você', coalesce(p.numero::text, ''), new.titulo),
    p.titulo,
    '/mobilizacao/processo/' || new.processo_id,
    new.id
  );
  return null;
end $$;

drop trigger if exists trg_notif_mob_etapa_atribuida on public.mobilizacao_etapas;
create trigger trg_notif_mob_etapa_atribuida
  after update of responsavel_id on public.mobilizacao_etapas
  for each row execute function app_private.notif_mob_etapa_atribuida();

-- Etapa que já NASCE com dono (responsável padrão do catálogo).
--
-- Row-level, e não statement-level com transition table como o
-- notif_adm_etapas_insert: mobilizacao_etapas JÁ tem um gatilho de statement
-- com transition table (o do recálculo, em supabase_migration_mobilizacao.sql),
-- e duas transition tables na mesma tabela e no mesmo evento é terreno que não
-- vale apostar. Lá a passada única importava porque o recálculo é caro; aqui
-- são onze inserts numa tabela pequena.
create or replace function app_private.notif_mob_etapa_inserida()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare p record;
begin
  if new.responsavel_id is null then return null; end if;

  select numero, titulo into p from mobilizacao_processos where id = new.processo_id;
  if p is null then return null; end if;

  perform app_private.notificar(
    new.responsavel_id, 'mobilizacao', 'sua_vez',
    format('Mobilização #%s: %s está com você', coalesce(p.numero::text, ''), new.titulo),
    p.titulo,
    '/mobilizacao/processo/' || new.processo_id,
    new.id
  );
  return null;
end $$;

drop trigger if exists trg_notif_mob_etapas_inseridas on public.mobilizacao_etapas;
drop trigger if exists trg_notif_mob_etapa_inserida on public.mobilizacao_etapas;
create trigger trg_notif_mob_etapa_inserida
  after insert on public.mobilizacao_etapas
  for each row execute function app_private.notif_mob_etapa_inserida();

-- ----------------------------------------------------------------------------
-- Processo que acabou
-- ----------------------------------------------------------------------------
create or replace function app_private.notif_mob_processo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = old.status then return null; end if;

  if new.status = 'finalizado' then
    perform app_private.notificar(new.solicitante_id, 'mobilizacao', 'concluida',
      format('Mobilização #%s concluída', coalesce(new.numero::text, '')),
      new.titulo, '/mobilizacao/processo/' || new.id, new.id);

  elsif new.status = 'cancelado' then
    perform app_private.notificar(new.solicitante_id, 'mobilizacao', 'reprovada',
      format('Mobilização #%s cancelada', coalesce(new.numero::text, '')),
      new.titulo, '/mobilizacao/processo/' || new.id, new.id);
  end if;

  return null;
end $$;

drop trigger if exists trg_notif_mob_processo on public.mobilizacao_processos;
create trigger trg_notif_mob_processo
  after update of status on public.mobilizacao_processos
  for each row execute function app_private.notif_mob_processo();

notify pgrst, 'reload schema';
