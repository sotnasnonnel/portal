-- Migration: folga_campo (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- FOLGA DE CAMPO — o colaborador avisa que vai ficar ausente da obra por alguns
-- dias, o responsável aprova, e o registro fica para consulta.
--
-- NÃO tem saldo, período aquisitivo nem data limite. A primeira versão disto
-- (aplicada em 23/09/2026) era uma cópia da Ausência Programada, com saldo por
-- período — o usuário corrigiu: folga de campo não tem saldo. Como nada chegou
-- a ser usado (zero linhas), esta migração DERRUBA aquelas tabelas e refaz o
-- módulo na forma certa, em vez de deixar colunas mortas.
--
-- Decisões:
--  * APROVADOR = superior direto (colaboradores.superior_id), resolvido no
--    envio. Se ele estiver inativo ou sem login, sobe a árvore — mesma regra do
--    resto do portal. O RH/admin também decide (reserva para quem não tem
--    ninguém acima).
--  * MOTIVO é obrigatório: é com ele que o responsável decide.
--  * Sem rascunho. O registro nasce pendente de aprovação — guardar rascunho de
--    um aviso de três dias só adiciona um botão.
--  * Datas no passado são BLOQUEADAS no envio: isto é aviso de ausência futura,
--    não lançamento retroativo.
--  * Sobreposição com outro registro pendente ou aprovado é bloqueada: duas
--    ausências da mesma pessoa no mesmo dia é erro de digitação.
--  * "Concluída" não é gravada: é a aprovada cujo fim já passou (a tela deriva).
--  * Escrita do colaborador e do gestor passa por RPC com erro legível. A
--    escrita direta na tabela é só do RH.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Limpeza da versão com saldo (nunca usada)
-- ----------------------------------------------------------------------------
drop table if exists public.folga_campo_solicitacoes cascade;
drop table if exists public.folga_campo_periodos cascade;
drop function if exists public.folga_campo_periodos_listar(text);
drop function if exists public.folga_campo_solicitacoes_listar(text);
drop function if exists public.folga_campo_sem_periodo();
drop function if exists public.folga_campo_gerar_periodos(uuid, boolean);
drop function if exists public.folga_campo_gerar_alertas();
drop function if exists public.folga_campo_salvar(uuid, uuid, date, date, text, boolean);
drop function if exists public.folga_campo_excluir_rascunho(uuid);
drop function if exists app_private.folga_campo_saldo(uuid, uuid);
drop function if exists app_private.folga_campo_sol_confere_periodo();
drop function if exists app_private.folga_campo_per_carimbo();

-- ----------------------------------------------------------------------------
-- 1) Helpers
-- ----------------------------------------------------------------------------
-- RH da folga de campo: enxerga e corrige a empresa toda.
create or replace function app_private.is_folga_campo_rh()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_rh_dp()
      or app_private.is_admin()
      or app_private.is_portal_super_admin()
$$;
revoke all on function app_private.is_folga_campo_rh() from public;
grant execute on function app_private.is_folga_campo_rh() to authenticated;

-- Quem aprova a folga de um colaborador: o superior direto ou, se ele não
-- consegue entrar no portal, o primeiro acima dele que consegue.
create or replace function app_private.folga_campo_aprovador_de(p_colab uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_atual uuid;
  v_ok    uuid;
  v_depth int := 0;
begin
  select c.superior_id into v_atual from public.colaboradores c where c.id = p_colab;
  while v_atual is not null and v_depth < 60 loop
    select c.id into v_ok
    from public.colaboradores c
    where c.id = v_atual and c.ativo is distinct from false and c.auth_id is not null;
    if v_ok is not null then
      return v_ok;
    end if;
    select c.superior_id into v_atual from public.colaboradores c where c.id = v_atual;
    v_depth := v_depth + 1;
  end loop;
  return null;
end $$;
revoke all on function app_private.folga_campo_aprovador_de(uuid) from public;

-- ----------------------------------------------------------------------------
-- 2) Registros
-- ----------------------------------------------------------------------------
create table if not exists public.folga_campo_registros (
  id              uuid primary key default gen_random_uuid(),
  numero          bigint,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  aprovador_id    uuid references public.colaboradores(id),
  -- Obra/local de onde a pessoa vai se ausentar. Texto livre: a alocação em
  -- obra não está no cadastro de todo mundo, e exigir um código travaria o
  -- registro de quem está em obra nova.
  obra            text,
  data_inicio     date not null,
  data_fim        date not null,
  dias            int generated always as (data_fim - data_inicio + 1) stored,
  motivo          text not null,
  status          text not null default 'pendente'
                    check (status in ('pendente', 'aprovada', 'reprovada', 'cancelada')),
  motivo_reprovacao   text,
  motivo_cancelamento text,
  enviado_em      timestamptz not null default now(),
  decidido_em     timestamptz,
  decidido_por    uuid references public.colaboradores(id),
  cancelado_em    timestamptz,
  cancelado_por   uuid references public.colaboradores(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  constraint fcampo_datas check (data_fim >= data_inicio),
  constraint fcampo_motivo check (nullif(trim(motivo), '') is not null),
  constraint fcampo_reprovacao check (status <> 'reprovada' or nullif(trim(motivo_reprovacao), '') is not null)
);

create sequence if not exists public.folga_campo_registros_numero_seq
  owned by public.folga_campo_registros.numero;
alter table public.folga_campo_registros
  alter column numero set default nextval('public.folga_campo_registros_numero_seq');
alter table public.folga_campo_registros alter column numero set not null;
create unique index if not exists folga_campo_numero_key on public.folga_campo_registros (numero);
create index if not exists folga_campo_colab_idx on public.folga_campo_registros (colaborador_id, data_inicio);
create index if not exists folga_campo_aprov_idx on public.folga_campo_registros (aprovador_id, status);
create index if not exists folga_campo_periodo_idx on public.folga_campo_registros (data_inicio, data_fim);

create or replace function app_private.folga_campo_carimbo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists folga_campo_carimbo_trg on public.folga_campo_registros;
create trigger folga_campo_carimbo_trg
before update on public.folga_campo_registros
for each row execute function app_private.folga_campo_carimbo();

-- ----------------------------------------------------------------------------
-- 3) RLS — vê quem é dono, quem aprova, quem está acima no organograma, e o RH
-- ----------------------------------------------------------------------------
alter table public.folga_campo_registros enable row level security;

drop policy if exists folga_campo_select on public.folga_campo_registros;
create policy folga_campo_select on public.folga_campo_registros
for select to authenticated
using (
  app_private.is_folga_campo_rh()
  or colaborador_id = app_private.my_colaborador_id()
  or aprovador_id = app_private.my_colaborador_id()
  or colaborador_id in (select app_private.descendentes(app_private.my_colaborador_id()))
);

drop policy if exists folga_campo_rh on public.folga_campo_registros;
create policy folga_campo_rh on public.folga_campo_registros
for all to authenticated
using ( app_private.is_folga_campo_rh() )
with check ( app_private.is_folga_campo_rh() );

-- ----------------------------------------------------------------------------
-- 4) Leitura (RPC resolve os nomes: o RH sem perfil admin não lê a tabela
--    colaboradores inteira pela RLS)
-- ----------------------------------------------------------------------------
-- p_escopo: 'meus' | 'aprovar' | 'equipe' (subárvore) | 'todos' (só RH).
create or replace function public.folga_campo_listar(p_escopo text default 'meus')
returns table (
  id uuid, numero bigint, status text,
  colaborador_id uuid, colaborador_nome text, colaborador_funcao text,
  aprovador_id uuid, aprovador_nome text,
  obra text, data_inicio date, data_fim date, dias int, motivo text,
  motivo_reprovacao text, motivo_cancelamento text,
  enviado_em timestamptz, decidido_em timestamptz, decidido_por_nome text,
  cancelado_em timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with me as (select app_private.my_colaborador_id() as id)
  select r.id, r.numero, r.status,
         r.colaborador_id, c.nome, c.funcao,
         r.aprovador_id, a.nome,
         r.obra, r.data_inicio, r.data_fim, r.dias, r.motivo,
         r.motivo_reprovacao, r.motivo_cancelamento,
         r.enviado_em, r.decidido_em, d.nome,
         r.cancelado_em, r.created_at
  from public.folga_campo_registros r
  join public.colaboradores c on c.id = r.colaborador_id
  left join public.colaboradores a on a.id = r.aprovador_id
  left join public.colaboradores d on d.id = r.decidido_por
  cross join me
  where case p_escopo
          when 'meus'    then r.colaborador_id = me.id
          when 'aprovar' then r.aprovador_id = me.id
                              or (r.aprovador_id is null and app_private.is_folga_campo_rh())
          when 'equipe'  then r.colaborador_id in (select app_private.descendentes(me.id))
          when 'todos'   then app_private.is_folga_campo_rh()
          else false
        end
  order by r.data_inicio desc, r.numero desc
$$;
revoke all on function public.folga_campo_listar(text) from public;
revoke execute on function public.folga_campo_listar(text) from anon;
grant execute on function public.folga_campo_listar(text) to authenticated;

-- Quem vai decidir a MINHA folga (a tela mostra antes de enviar).
create or replace function public.folga_campo_meu_aprovador()
returns table (id uuid, nome text, email text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.email
  from public.colaboradores c
  where c.id = app_private.folga_campo_aprovador_de(app_private.my_colaborador_id())
$$;
revoke all on function public.folga_campo_meu_aprovador() from public;
revoke execute on function public.folga_campo_meu_aprovador() from anon;
grant execute on function public.folga_campo_meu_aprovador() to authenticated;

-- ----------------------------------------------------------------------------
-- 5) Escrita
-- ----------------------------------------------------------------------------
-- Registra a ausência de obra do PRÓPRIO colaborador. Sempre nasce pendente.
create or replace function public.folga_campo_registrar(
  p_inicio date,
  p_fim date,
  p_motivo text,
  p_obra text default null
)
returns table (id uuid, numero bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Seu usuário não está vinculado a um colaborador.';
  end if;
  if p_inicio is null or p_fim is null then
    raise exception 'Informe a data de início e a data fim.';
  end if;
  if p_fim < p_inicio then
    raise exception 'A data fim não pode ser anterior à data de início.';
  end if;
  if p_inicio < current_date then
    raise exception 'A data de início não pode estar no passado.';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo da ausência.';
  end if;
  if exists (
    select 1 from public.folga_campo_registros r
    where r.colaborador_id = v_me
      and r.status in ('pendente', 'aprovada')
      and r.data_inicio <= p_fim and r.data_fim >= p_inicio
  ) then
    raise exception 'Você já tem uma folga de campo pendente ou aprovada nessas datas.';
  end if;

  insert into public.folga_campo_registros as r
    (colaborador_id, aprovador_id, obra, data_inicio, data_fim, motivo)
  values
    (v_me, app_private.folga_campo_aprovador_de(v_me), nullif(trim(p_obra), ''),
     p_inicio, p_fim, trim(p_motivo))
  returning r.id into v_id;

  return query select r.id, r.numero from public.folga_campo_registros r where r.id = v_id;
end $$;
revoke all on function public.folga_campo_registrar(date, date, text, text) from public;
revoke execute on function public.folga_campo_registrar(date, date, text, text) from anon;
grant execute on function public.folga_campo_registrar(date, date, text, text) to authenticated;

-- Decisão: o aprovador do registro ou o RH. Reprovar exige motivo.
create or replace function public.folga_campo_decidir(p_id uuid, p_aprovar boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me  uuid := app_private.my_colaborador_id();
  v_reg public.folga_campo_registros;
begin
  select * into v_reg from public.folga_campo_registros r where r.id = p_id for update;
  if v_reg.id is null then
    raise exception 'Registro não encontrado.';
  end if;
  if not (v_reg.aprovador_id = v_me or app_private.is_folga_campo_rh()) then
    raise exception 'Você não é o responsável por este registro.';
  end if;
  if v_reg.colaborador_id = v_me then
    raise exception 'Não é possível decidir a própria folga de campo.';
  end if;
  if v_reg.status <> 'pendente' then
    raise exception 'Este registro não está pendente de aprovação.';
  end if;
  if not p_aprovar and nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo da reprovação.';
  end if;

  update public.folga_campo_registros r
     set status            = case when p_aprovar then 'aprovada' else 'reprovada' end,
         motivo_reprovacao = case when p_aprovar then null else trim(p_motivo) end,
         decidido_em       = now(),
         decidido_por      = v_me
   where r.id = p_id;
end $$;
revoke all on function public.folga_campo_decidir(uuid, boolean, text) from public;
revoke execute on function public.folga_campo_decidir(uuid, boolean, text) from anon;
grant execute on function public.folga_campo_decidir(uuid, boolean, text) to authenticated;

-- Cancelamento: o dono cancela o que ainda não começou; o responsável e o RH
-- cancelam pendente ou aprovada, com motivo.
create or replace function public.folga_campo_cancelar(p_id uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me   uuid := app_private.my_colaborador_id();
  v_reg  public.folga_campo_registros;
  v_dono boolean;
  v_gest boolean;
begin
  select * into v_reg from public.folga_campo_registros r where r.id = p_id for update;
  if v_reg.id is null then
    raise exception 'Registro não encontrado.';
  end if;
  if v_reg.status not in ('pendente', 'aprovada') then
    raise exception 'Só é possível cancelar um registro pendente ou aprovado.';
  end if;

  v_dono := v_reg.colaborador_id = v_me;
  v_gest := v_reg.aprovador_id = v_me or app_private.is_folga_campo_rh();

  if not (v_dono or v_gest) then
    raise exception 'Você não pode cancelar este registro.';
  end if;
  if not v_gest and v_reg.status = 'aprovada' and v_reg.data_inicio <= current_date then
    raise exception 'A folga já começou. Peça o cancelamento ao seu responsável ou ao RH.';
  end if;
  if not v_dono and nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  update public.folga_campo_registros r
     set status              = 'cancelada',
         motivo_cancelamento = nullif(trim(p_motivo), ''),
         cancelado_em        = now(),
         cancelado_por       = v_me
   where r.id = p_id;
end $$;
revoke all on function public.folga_campo_cancelar(uuid, text) from public;
revoke execute on function public.folga_campo_cancelar(uuid, text) from anon;
grant execute on function public.folga_campo_cancelar(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Notificações (módulo 'dp') — por gatilho, como no resto do portal
-- ----------------------------------------------------------------------------
create or replace function app_private.notif_folga_campo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  quem    text;
  periodo text;
begin
  if tg_op = 'UPDATE' and new.status = old.status then return null; end if;
  select nome into quem from colaboradores where id = new.colaborador_id;
  periodo := format('%s a %s (%s dia(s))',
    to_char(new.data_inicio, 'DD/MM/YYYY'), to_char(new.data_fim, 'DD/MM/YYYY'), new.dias);

  if new.status = 'pendente' then
    perform app_private.notificar(new.aprovador_id, 'dp', 'sua_vez',
      format('Folga de campo #%s aguarda sua aprovação', new.numero),
      format('%s · %s', quem, periodo),
      '/folga-de-campo/aprovacoes', new.id);
  elsif new.status = 'aprovada' then
    perform app_private.notificar(new.colaborador_id, 'dp', 'concluida',
      format('Folga de campo #%s aprovada', new.numero), periodo,
      '/folga-de-campo', new.id);
  elsif new.status = 'reprovada' then
    perform app_private.notificar(new.colaborador_id, 'dp', 'reprovada',
      format('Folga de campo #%s reprovada', new.numero), new.motivo_reprovacao,
      '/folga-de-campo', new.id);
  elsif new.status = 'cancelada' and tg_op = 'UPDATE' then
    if new.cancelado_por = new.colaborador_id then
      -- O colaborador desistiu: o responsável precisa saber, a escala da obra mudou.
      perform app_private.notificar(new.aprovador_id, 'dp', 'andamento',
        format('Folga de campo #%s cancelada por %s', new.numero, quem), periodo,
        '/folga-de-campo/aprovacoes', new.id);
    else
      perform app_private.notificar(new.colaborador_id, 'dp', 'reprovada',
        format('Folga de campo #%s cancelada', new.numero),
        coalesce(new.motivo_cancelamento, periodo), '/folga-de-campo', new.id);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists trg_notif_folga_campo on public.folga_campo_registros;
create trigger trg_notif_folga_campo
after insert or update of status on public.folga_campo_registros
for each row execute function app_private.notif_folga_campo();

notify pgrst, 'reload schema';
