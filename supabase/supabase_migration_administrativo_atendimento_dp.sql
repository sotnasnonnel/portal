-- Atendimento DP: chamados do Departamento Pessoal dentro do Atendimento.
--
-- A classe 'dp' (config/administrativo.js) é atendida pelo DP, NÃO pelo time do
-- Atendimento, e é sigilosa para este: plano de saúde, dependentes e ponto não
-- são assunto de quem cuida de frota e compras. Quem vê um chamado de DP:
-- solicitante, responsável, aprovador da cadeia (se um dia houver) e o DP —
-- perfil admin ou flag rh_dp, a mesma régua de solicitacoes_rh.
--
-- Como: onde as policies diziam "is_adm_time()", passam a perguntar "é do time
-- DESTA classe?". Para as outras classes nada muda — o helper devolve o mesmo
-- is_adm_time() de antes.
--
-- ORDEM: aplicar ANTES do deploy do front. Sem isto, o card aparece mas o DP não
-- enxerga os chamados que caem para ele. Sem efeito em chamado existente: até o
-- deploy não há nenhum de classe 'dp'.

-- ---------------------------------------------------------------- helpers
create or replace function app_private.adm_time_da_classe(p_classe text)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select case when p_classe = 'dp'
              then app_private.is_admin() or app_private.is_rh_dp()
              else app_private.is_adm_time()
         end
$$;

-- SECURITY DEFINER pelo mesmo motivo de adm_e_atendente: ler chamados_adm de
-- dentro da policy de uma tabela filha sem passar pela RLS dele (recursão).
create or replace function app_private.adm_time_do_chamado(p_chamado uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select coalesce(
    (select app_private.adm_time_da_classe(c.classe) from public.chamados_adm c where c.id = p_chamado),
    false)
$$;

revoke all on function app_private.adm_time_da_classe(text) from public;
revoke all on function app_private.adm_time_do_chamado(uuid) from public;
grant execute on function app_private.adm_time_da_classe(text) to authenticated;
grant execute on function app_private.adm_time_do_chamado(uuid) to authenticated;

-- ---------------------------------------------------------------- chamados_adm
drop policy if exists chamados_adm_select on public.chamados_adm;
create policy chamados_adm_select on public.chamados_adm for select to authenticated using (
  solicitante_id = app_private.my_colaborador_id()
  or atendente_id = app_private.my_colaborador_id()
  or app_private.adm_time_da_classe(classe)
  or app_private.adm_e_aprovador(id)
);

drop policy if exists chamados_adm_update on public.chamados_adm;
create policy chamados_adm_update on public.chamados_adm for update to authenticated
using (
  solicitante_id = app_private.my_colaborador_id()
  or atendente_id = app_private.my_colaborador_id()
  or app_private.adm_time_da_classe(classe)
  or app_private.adm_e_aprovador(id)
)
with check (
  solicitante_id = app_private.my_colaborador_id()
  or atendente_id = app_private.my_colaborador_id()
  or app_private.adm_time_da_classe(classe)
  or app_private.adm_e_aprovador(id)
);

-- ---------------------------------------------------------------- avaliações
drop policy if exists chamados_adm_avaliacoes_select on public.chamados_adm_avaliacoes;
create policy chamados_adm_avaliacoes_select on public.chamados_adm_avaliacoes for select to authenticated using (
  app_private.adm_time_do_chamado(chamado_id)
  or app_private.adm_e_solicitante(chamado_id)
  or app_private.adm_e_atendente(chamado_id)
);

-- ---------------------------------------------------------------- etapas
drop policy if exists chamados_adm_etapas_insert on public.chamados_adm_etapas;
create policy chamados_adm_etapas_insert on public.chamados_adm_etapas for insert to authenticated with check (
  app_private.adm_time_do_chamado(chamado_id)
  or app_private.adm_e_solicitante(chamado_id)
);

drop policy if exists chamados_adm_etapas_select on public.chamados_adm_etapas;
create policy chamados_adm_etapas_select on public.chamados_adm_etapas for select to authenticated using (
  aprovador_id = app_private.my_colaborador_id()
  or app_private.adm_time_do_chamado(chamado_id)
  or app_private.adm_e_solicitante(chamado_id)
  or app_private.adm_e_aprovador(chamado_id)
);

drop policy if exists chamados_adm_etapas_update on public.chamados_adm_etapas;
create policy chamados_adm_etapas_update on public.chamados_adm_etapas for update to authenticated
using (aprovador_id = app_private.my_colaborador_id() or app_private.adm_time_do_chamado(chamado_id))
with check (aprovador_id = app_private.my_colaborador_id() or app_private.adm_time_do_chamado(chamado_id));

-- ---------------------------------------------------------------- eventos
drop policy if exists chamados_adm_eventos_select on public.chamados_adm_eventos;
create policy chamados_adm_eventos_select on public.chamados_adm_eventos for select to authenticated using (
  app_private.adm_time_do_chamado(chamado_id)
  or app_private.adm_e_solicitante(chamado_id)
  or app_private.adm_e_atendente(chamado_id)
  or app_private.adm_e_aprovador(chamado_id)
);

-- ---------------------------------------------------------------- interações
drop policy if exists chamados_adm_interacoes_insert on public.chamados_adm_interacoes;
create policy chamados_adm_interacoes_insert on public.chamados_adm_interacoes for insert to authenticated with check (
  autor_id = app_private.my_colaborador_id()
  and (app_private.adm_time_do_chamado(chamado_id)
       or app_private.adm_e_atendente(chamado_id)
       or app_private.adm_e_solicitante(chamado_id))
  and (interna = false or app_private.adm_time_do_chamado(chamado_id))
);

drop policy if exists chamados_adm_interacoes_select on public.chamados_adm_interacoes;
create policy chamados_adm_interacoes_select on public.chamados_adm_interacoes for select to authenticated using (
  app_private.adm_time_do_chamado(chamado_id)
  or app_private.adm_e_atendente(chamado_id)
  or (interna = false and app_private.adm_e_solicitante(chamado_id))
);

drop policy if exists chamados_adm_interacoes_update on public.chamados_adm_interacoes;
create policy chamados_adm_interacoes_update on public.chamados_adm_interacoes for update to authenticated
using (
  app_private.adm_time_do_chamado(chamado_id)
  or app_private.adm_e_atendente(chamado_id)
  or app_private.adm_e_solicitante(chamado_id)
)
with check (
  app_private.adm_time_do_chamado(chamado_id)
  or app_private.adm_e_atendente(chamado_id)
  or app_private.adm_e_solicitante(chamado_id)
);

-- ---------------------------------------------------------------- assumir
-- Assumir para si era liberado a todo o time do Adm; agora, ao time da classe.
create or replace function public.chamados_adm_guarda_reatribuicao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.atendente_id is not distinct from old.atendente_id then
    return new;                       -- nao mexeu no responsavel
  end if;

  -- Sem usuario logado e manutencao pelo painel/service role, que ja passa por
  -- cima da RLS de qualquer forma: barrar aqui so atrapalharia.
  if app_private.my_colaborador_id() is null then
    return new;
  end if;

  if app_private.pode_reatribuir_adm() then
    return new;                       -- coordenacao: pode por no nome de qualquer um
  end if;

  -- Assumir para si segue liberado a quem atende a classe (DP no chamado de DP).
  if new.atendente_id = app_private.my_colaborador_id() and app_private.adm_time_da_classe(new.classe) then
    return new;
  end if;

  raise exception 'Voce nao tem permissao para trocar o responsavel deste chamado.'
    using errcode = 'insufficient_privilege';
end;
$function$;

-- ---------------------------------------------------------------- torre
-- A Torre é do Adm e lê por SECURITY DEFINER, por cima da RLS: o DP fica de fora.
create or replace function public.torre_chamados(p_dias_fechados integer default 15)
returns table(id uuid, numero bigint, classe text, servico text, assunto text, status text,
              criado_em timestamp with time zone, sla_vence_em timestamp with time zone,
              fechado_em timestamp with time zone, atendente_id uuid, responsavel_contrato text)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select c.id, c.numero, c.classe, c.servico, c.assunto, c.status,
         c.criado_em, c.sla_vence_em, c.fechado_em, c.atendente_id,
         d.nome
    from public.chamados_adm c
    left join public.torre_responsavel_de_para d on d.chave = trim(c.campos->>'cc')
   where app_private.pode_torre()
     and c.classe <> 'dp'
     and (c.status not in ('fechado','reprovado','cancelado')
       or c.updated_at >= now() - make_interval(days => p_dias_fechados));
$function$;

create or replace function public.torre_ultima_mensagem_chamados(p_chamados uuid[])
returns table(chamado_id uuid, autor_id uuid, mensagem text, qtd_anexos integer,
              created_at timestamp with time zone, do_solicitante boolean)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select distinct on (i.chamado_id)
         i.chamado_id, i.autor_id, i.mensagem,
         jsonb_array_length(i.anexos)::int, i.created_at,
         (i.autor_id = c.solicitante_id)
    from public.chamados_adm_interacoes i
    join public.chamados_adm c on c.id = i.chamado_id
   where app_private.pode_torre()
     and c.classe <> 'dp'
     and i.chamado_id = any(p_chamados)
     and i.interna = false
   order by i.chamado_id, i.created_at desc;
$function$;

-- ---------------------------------------------------------------- configuração
-- Ponto de partida, ajustável em /administrativo/config: sem aprovação (vai
-- direto para o DP), responsável Washington (analista de DP, que pediu o card) e
-- 5 dias úteis. Sem linha aqui o chamado nasceria sem responsável, e ninguém
-- seria avisado por e-mail de que ele chegou.
insert into public.chamados_adm_config (classe, servico, atendente_id, sla_dias_uteis, exige_aprovacao)
select 'dp', s.servico, c.id, 5, false
  from (values ('plano-saude'), ('ponto'), ('beneficios'), ('atualizacao-cadastral'), ('outras-demandas')) s(servico)
  cross join (select id from public.colaboradores where id = '15b4ea86-44de-4937-9624-7cd4a997ab0a') c
on conflict (classe, servico) do nothing;
