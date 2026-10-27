-- Migration: Mobilização mostra o número do chamado do Atendimento (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Processo e chamado tinham numerações próprias: o processo #163 nascia do
-- chamado #367, e a pessoa via um número no Atendimento e outro na Mobilização.
-- Agora o número que aparece é o do chamado. Processo sem chamado ganha prefixo,
-- para nunca coincidir com o número de um chamado:
--     P-61   veio da carga da planilha (origem 'planilha')
--     E-145  mobilização de empresa aberta à mão (origem 'manual')
-- A regra mora numa coluna gerada, `numero_exibicao`, que a tela e as
-- notificações leem — um lugar só para mudar.
--
-- Por que uma coluna copiada, e não um join na tela: o join passaria pela RLS
-- de chamados_adm, e quem enxerga o processo mas não o chamado veria o outro
-- número — o mesmo processo com dois números conforme quem olha.
--
-- O número fica no processo mesmo se o chamado for apagado (a FK põe
-- origem_chamado_id em null): identidade não muda depois de nascer.
--
-- APLIQUE ANTES DO DEPLOY DO FRONT: o front novo lê `numero_exibicao`, e sem a
-- coluna as telas da Mobilização dão erro. A ordem inversa é segura: até o front
-- subir, as telas seguem mostrando `numero` e só as notificações novas saem com
-- o do chamado.
--
-- Para derrubar:
--     drop trigger if exists mob_chamado_numero on public.mobilizacao_processos;
--     drop function if exists app_private.mob_chamado_numero();
--     alter table public.mobilizacao_processos drop column numero_exibicao;
--     alter table public.mobilizacao_processos drop column chamado_numero;
--   e recrie as três notif_mob_* de supabase_migration_mobilizacao_notificacoes.sql.

alter table public.mobilizacao_processos
  add column if not exists chamado_numero bigint;

create or replace function app_private.mob_chamado_numero()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.origem_chamado_id is not null then
    select c.numero into new.chamado_numero
    from chamados_adm c where c.id = new.origem_chamado_id;
  end if;
  return new;
end $$;

drop trigger if exists mob_chamado_numero on public.mobilizacao_processos;
create trigger mob_chamado_numero
  before insert or update of origem_chamado_id on public.mobilizacao_processos
  for each row execute function app_private.mob_chamado_numero();

-- Carga dos existentes sem mexer no updated_at: preencher o número não é
-- edição do processo.
alter table public.mobilizacao_processos disable trigger mobilizacao_processo_before_trg;
update public.mobilizacao_processos p
set chamado_numero = c.numero
from public.chamados_adm c
where c.id = p.origem_chamado_id
  and p.chamado_numero is distinct from c.numero;
alter table public.mobilizacao_processos enable trigger mobilizacao_processo_before_trg;

alter table public.mobilizacao_processos
  add column if not exists numero_exibicao text generated always as (
    case
      when chamado_numero is not null then chamado_numero::text
      when origem = 'planilha' then 'P-' || numero::text
      else 'E-' || numero::text
    end
  ) stored;

-- Notificações: mesmo número que a tela mostra.
create or replace function app_private.notif_mob_etapa_atribuida()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p record;
begin
  if new.responsavel_id is null or new.responsavel_id is not distinct from old.responsavel_id then
    return null;
  end if;
  -- Etapa já encerrada não gera tarefa para ninguém.
  if new.status in ('concluida', 'dispensada') then return null; end if;

  select numero_exibicao as numero, titulo, status into p
  from mobilizacao_processos where id = new.processo_id;
  if p is null or p.status = 'cancelado' then return null; end if;

  perform app_private.notificar(
    new.responsavel_id, 'mobilizacao', 'sua_vez',
    format('Mobilização #%s: %s está com você', coalesce(p.numero::text, ''), new.titulo),
    p.titulo,
    '/mobilizacao/processo/' || new.processo_id,
    new.id
  );
  return null;
end $function$;

create or replace function app_private.notif_mob_etapa_inserida()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p record;
begin
  if new.responsavel_id is null then return null; end if;

  select numero_exibicao as numero, titulo into p
  from mobilizacao_processos where id = new.processo_id;
  if p is null then return null; end if;

  perform app_private.notificar(
    new.responsavel_id, 'mobilizacao', 'sua_vez',
    format('Mobilização #%s: %s está com você', coalesce(p.numero::text, ''), new.titulo),
    p.titulo,
    '/mobilizacao/processo/' || new.processo_id,
    new.id
  );
  return null;
end $function$;

create or replace function app_private.notif_mob_processo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = old.status then return null; end if;

  if new.status = 'finalizado' then
    perform app_private.notificar(new.solicitante_id, 'mobilizacao', 'concluida',
      format('Mobilização #%s concluída', coalesce(new.numero_exibicao, '')),
      new.titulo, '/mobilizacao/processo/' || new.id, new.id);

  elsif new.status = 'cancelado' then
    perform app_private.notificar(new.solicitante_id, 'mobilizacao', 'reprovada',
      format('Mobilização #%s cancelada', coalesce(new.numero_exibicao, '')),
      new.titulo, '/mobilizacao/processo/' || new.id, new.id);
  end if;

  return null;
end $function$;
