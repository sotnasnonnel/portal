-- ============================================================================
-- Fale conosco: canal de bug / melhoria / elogio sobre o próprio portal.
-- ============================================================================
-- Até aqui o portal recebia crítica e ideia por WhatsApp e conversa de
-- corredor: não havia fila, não havia prazo, e o que se perdia ninguém sabia
-- que tinha se perdido. Aqui a mensagem vira registro, com autor, módulo de
-- origem e PRAZO de resposta.
--
-- O SLA é de 48 HORAS CORRIDAS a partir do envio (não 48h úteis): é o número
-- que o botão promete a quem escreve, e contar dia útil tornaria a promessa
-- diferente da que está na tela.
--
-- Quem atende são duas pessoas, por e-mail do JWT — mesmo desenho do
-- app_private.is_portal_super_admin(). Espelha src/config/suporte.js: mexer
-- numa lista sem mexer na outra deixa a tela e o banco discordando.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Quem atende
-- ---------------------------------------------------------------------------
create or replace function app_private.is_suporte()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
    'lennon.santos@phdengenharia.eng.br',
    'andre.guimaraes@phdengenharia.eng.br'
  )
$$;
revoke all on function app_private.is_suporte() from public;
grant execute on function app_private.is_suporte() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tabela
-- ---------------------------------------------------------------------------
create table if not exists fale_conosco (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references colaboradores(id) on delete cascade,
  tipo text not null check (tipo in ('bug', 'melhoria', 'elogio')),
  -- De onde a pessoa estava quando escreveu. Guardado porque "não consigo
  -- salvar" sem saber a tela é um bug que ninguém reproduz.
  modulo text,
  rota text,
  mensagem text not null check (length(btrim(mensagem)) > 0),
  status text not null default 'aberto' check (status in ('aberto', 'respondido')),
  resposta text,
  respondido_por uuid references colaboradores(id),
  respondido_em timestamptz,
  -- Prazo do SLA, gravado no envio: se a regra mudar, o que foi prometido a
  -- quem já escreveu continua valendo.
  prazo_em timestamptz not null default now() + interval '48 hours',
  created_at timestamptz not null default now()
);

create index if not exists fale_conosco_autor_idx on fale_conosco (autor_id, created_at desc);
-- A fila de quem atende: abertos primeiro, do mais antigo (o mais perto de
-- estourar o prazo) para o mais novo.
create index if not exists fale_conosco_fila_idx on fale_conosco (status, prazo_em);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table fale_conosco enable row level security;

-- Cada um lê o que mandou; quem atende lê tudo.
drop policy if exists fale_conosco_select on fale_conosco;
create policy fale_conosco_select on fale_conosco
  for select to authenticated
  using (autor_id = app_private.my_colaborador_id() or app_private.is_suporte());

-- Envio sempre identificado: não dá para mandar em nome de outra pessoa.
drop policy if exists fale_conosco_insert on fale_conosco;
create policy fale_conosco_insert on fale_conosco
  for insert to authenticated
  with check (autor_id = app_private.my_colaborador_id());

-- Só quem atende responde. O autor não edita depois de enviar: a mensagem é o
-- registro do que foi dito, e o histórico é metade do valor da fila.
drop policy if exists fale_conosco_update on fale_conosco;
create policy fale_conosco_update on fale_conosco
  for update to authenticated
  using (app_private.is_suporte())
  with check (app_private.is_suporte());

-- ---------------------------------------------------------------------------
-- 4. Notificações
-- ---------------------------------------------------------------------------
-- Chegou mensagem nova -> avisa quem atende. Sem isso, a fila só existiria
-- para quem lembrasse de abri-la.
create or replace function app_private.notif_fale_conosco_nova()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  destino uuid;
  autor text;
begin
  select nome into autor from colaboradores where id = new.autor_id;
  for destino in
    select id from colaboradores
    where lower(email) in (
      'lennon.santos@phdengenharia.eng.br',
      'andre.guimaraes@phdengenharia.eng.br'
    )
  loop
    perform app_private.notificar(
      destino,
      'portal',
      'sua_vez',
      'Fale conosco: ' || new.tipo,
      coalesce(autor, 'Alguém') || ' escreveu — responder até ' ||
        to_char(new.prazo_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      '/fale-conosco',
      new.id
    );
  end loop;
  return new;
end $$;

drop trigger if exists trg_fale_conosco_nova on fale_conosco;
create trigger trg_fale_conosco_nova
  after insert on fale_conosco
  for each row execute function app_private.notif_fale_conosco_nova();

-- Respondeu -> avisa quem escreveu. É o fechamento do ciclo: sem ele, a pessoa
-- só descobriria a resposta se voltasse à tela por conta própria.
create or replace function app_private.notif_fale_conosco_respondida()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = 'respondido' and coalesce(old.status, '') <> 'respondido' then
    perform app_private.notificar(
      new.autor_id,
      'portal',
      'concluida',
      'Respondemos o seu fale conosco',
      left(coalesce(new.resposta, ''), 160),
      '/fale-conosco',
      new.id
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_fale_conosco_respondida on fale_conosco;
create trigger trg_fale_conosco_respondida
  after update on fale_conosco
  for each row execute function app_private.notif_fale_conosco_respondida();
