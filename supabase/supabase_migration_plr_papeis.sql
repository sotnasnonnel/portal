-- Migration: PLR, os três papéis: admin, gestor e usuário (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (05/11/2026): o PLR passa a ter três papéis.
--   - admin:   vê e edita tudo.
--   - gestor:  Metas por setor só do setor dele; Resultado por pessoa só das
--              pessoas do setor dele (com salário), mais a própria linha. O resumo
--              em R$ é o da empresa: esse número sai da Edge Function plr-calculo,
--              porque as linhas que somam nele não vêm para esta pessoa.
--   - usuário: só o Resultado por pessoa, com a própria linha, o Multiplicador
--              empresa e o cabeçalho do setor. Não vê os totais da empresa.
--
-- Decisões (05/11/2026):
--   - Gestor é quem aparece como responsável do setor em qualquer uma das duas
--     telas. Metas por setor usa plr_setores.responsavel_id, o Resultado usa o
--     HUB, e as duas divergem em RH (Lucas Ferraz × Pedro Morais) e Marketing
--     (Ana Regina × Henrique Santos): os dois de cada par são gestores.
--     Quem está em plr_setor_gestores é gestor daquele setor. Mudou, é mudar a
--     linha; os coordenadores abaixo deles são usuários.
--   - Sai a visão pelo organograma (a equipe do responsável via o setor dele):
--     agora quem não é gestor não vê a aba Metas por setor.
--   - Sai o papel 'visualizador' (ninguém tinha).
--   - plr_setores (aba SETORES) e plr_pessoas (setor do HUB) falavam de setores sem
--     ligação entre si. plr_setores.setor_hub faz essa ligação.
--
-- As duas chaves gerais NÃO mudam aqui e continuam desligadas:
--   app_private.plr_aberto_aos_setores() abre o gestor para quem está em
--   plr_setor_gestores; app_private.plr_aberto_a_cada_um() abre o usuário para quem
--   tem linha em plr_pessoas. Para abrir, troque o `false` da função por `true` e
--   reaplique só ela. O papel em Gerenciar acessos vale com as chaves ligadas ou
--   não, e ganha delas: 'usuario' explícito em um gestor o deixa só com a própria
--   linha. 'gestor' sem linha em plr_setor_gestores vê só a própria linha.
--
-- Substitui supabase_migration_plr_papel_proprio.sql, que nunca foi aplicada e foi
-- apagada.
--
-- Pré-requisito: supabase_migration_plr_calculo.sql e a carga de plr_pessoas.
--
-- Ordem: esta migração, deploy da Edge Function plr-calculo, deploy do front. Com
-- as chaves desligadas, só admins entram, e para eles nada muda na troca.
-- ============================================================================

-- ---- Papel no Gerenciar acessos ----------------------------------------------
-- NULL = segue as chaves gerais.
alter table public.colaboradores drop constraint if exists colaboradores_plr_role_check;
alter table public.colaboradores add constraint colaboradores_plr_role_check
  check (plr_role is null or plr_role = any (array['admin'::text, 'gestor'::text, 'usuario'::text]));

-- ---- Setor da aba SETORES × setor do HUB --------------------------------------
alter table public.plr_setores add column if not exists setor_hub text;

update public.plr_setores st
   set setor_hub = case st.nome
         when 'Recursos Humanos' then 'rh'
         when 'Administrativo e TI' then 'adm'
         when 'Financeiro e Contratos' then 'fin'
         when 'Marketing' then 'mkt'
         when 'Comercial' then 'com'
         when 'PMO' then 'pmo'
         -- Operação aparece três vezes, uma por responsável.
         when 'Operação' then (
           select case p.hub_chave when 'leo' then 'opleo' when 'bruno' then 'opbru' when 'eduardo' then 'opedu' end
             from public.plr_pessoas p
            where p.ano = st.ano and p.colaborador_id = st.responsavel_id)
       end
 where st.ano = 2026 and st.setor_hub is null;

create unique index if not exists plr_setores_hub_unico on public.plr_setores (ano, setor_hub);

-- ---- Quem é gestor de qual setor ----------------------------------------------
-- Como as outras tabelas do PLR: RLS ligada, sem policy, tudo pelas RPCs abaixo.
create table if not exists public.plr_setor_gestores (
  setor_id        uuid not null references public.plr_setores(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  primary key (setor_id, colaborador_id)
);
create index if not exists plr_setor_gestores_colab_idx on public.plr_setor_gestores (colaborador_id);

alter table public.plr_setor_gestores enable row level security;
revoke all on public.plr_setor_gestores from anon, authenticated;

-- Os responsáveis de Metas por setor...
insert into public.plr_setor_gestores (setor_id, colaborador_id)
select st.id, st.responsavel_id
  from public.plr_setores st
 where st.ano = 2026
on conflict do nothing;

-- ...e os do HUB (plr_pessoa.setores, no backoffice).
insert into public.plr_setor_gestores (setor_id, colaborador_id)
select st.id, p.colaborador_id
  from (values
    ('rh', 'morais'), ('com', 'henrique'), ('mkt', 'henrique'), ('opleo', 'leo'),
    ('opbru', 'bruno'), ('opedu', 'eduardo'), ('fin', 'daniela'), ('adm', 'daniela'),
    ('pmo', 'andre')
  ) as v(setor_hub, hub_chave)
  join public.plr_setores st on st.ano = 2026 and st.setor_hub = v.setor_hub
  join public.plr_pessoas p on p.ano = 2026 and p.hub_chave = v.hub_chave
 where p.colaborador_id is not null
on conflict do nothing;

-- Falha aqui, e não em silêncio na tela de alguém, se a carga não casou.
do $$
begin
  if exists (select 1 from public.plr_setores where ano = 2026 and setor_hub is null) then
    raise exception 'plr_setores: setor de 2026 sem setor_hub.';
  end if;
  if exists (select 1 from public.plr_setores st
              where st.ano = 2026
                and not exists (select 1 from public.plr_setor_gestores g where g.setor_id = st.id)) then
    raise exception 'plr_setor_gestores: setor de 2026 sem gestor.';
  end if;
end $$;

-- ---- Trigger: o login de quem é gestor também é protegido ---------------------
-- O gestor vê salários, como quem tem papel: o admin do DP não pode pôr o próprio
-- login na linha dele. Fora isso, igual a supabase_migration_plr.sql.
create or replace function app_private.plr_role_so_super_admin()
 returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') not in ('anon', 'authenticated')
     or app_private.is_portal_super_admin() then
    return new;
  end if;

  if new.plr_role is distinct from (case when tg_op = 'UPDATE' then old.plr_role end) then
    raise exception 'Só o super admin muda o papel no PLR.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and (old.plr_role is not null
          or exists (select 1 from public.plr_setor_gestores g where g.colaborador_id = old.id))
     and (lower(new.email) is distinct from lower(old.email)
          or (new.auth_id is distinct from old.auth_id
              and not (old.auth_id is null
                       and new.auth_id = (select auth.uid())
                       and lower(new.email) = lower((select auth.jwt() ->> 'email'))))) then
    raise exception 'Só o super admin muda o login de quem tem papel no PLR.' using errcode = '42501';
  end if;

  return new;
end
$$;

-- ---- Quem é quem --------------------------------------------------------------

-- 'admin' ou NULL. De propósito não devolve 'gestor' nem 'usuario': quem chama
-- trata "tem papel" como "vê tudo", e um chamador esquecido não pode abrir o PLR.
create or replace function app_private.plr_papel()
 returns text language sql stable security definer set search_path to ''
as $$
  select case
    when app_private.is_portal_super_admin() then 'admin'
    else (select c.plr_role from public.colaboradores c
           where c.id = app_private.plr_eu() and c.plr_role = 'admin')
  end
$$;

-- A pessoa logada pode agir como gestor: o papel dela diz, ou a chave geral.
create or replace function app_private.plr_atua_como_gestor()
 returns boolean language sql stable security definer set search_path to ''
as $$
  select case (select c.plr_role from public.colaboradores c where c.id = app_private.plr_eu())
    when 'gestor' then true
    when 'usuario' then false
    else app_private.plr_aberto_aos_setores()
  end
$$;

-- A pessoa logada pode ver a própria linha: chave geral ligada ou papel.
create or replace function app_private.plr_ve_a_propria_linha()
 returns boolean language sql stable security definer set search_path to ''
as $$
  select app_private.plr_aberto_a_cada_um()
      or exists (select 1 from public.colaboradores c
                  where c.id = app_private.plr_eu() and c.plr_role in ('gestor', 'usuario'))
$$;

-- Setores que a pessoa enxerga no ano. Admin, todos. Gestor, os dele. Mais ninguém.
create or replace function app_private.plr_setores_visiveis(p_ano integer)
 returns setof uuid language sql stable security definer set search_path to ''
as $$
  select st.id
    from public.plr_setores st
   where st.ano = p_ano
     and (app_private.plr_papel() = 'admin'
          or (app_private.plr_atua_como_gestor()
              and exists (select 1 from public.plr_setor_gestores g
                           where g.setor_id = st.id and g.colaborador_id = app_private.plr_eu())))
$$;

revoke all on function app_private.plr_atua_como_gestor() from public;
revoke all on function app_private.plr_ve_a_propria_linha() from public;

-- ---- RPCs ---------------------------------------------------------------------

-- 'admin' | 'gestor' | 'usuario' | NULL. É o gate da Home e da rota (modules.plr,
-- em AuthContext), e plr_pessoas_visiveis decide por ele.
create or replace function public.plr_acesso(p_ano integer)
 returns text language sql stable security definer set search_path to ''
as $$
  select coalesce(
    app_private.plr_papel(),
    case when exists (select 1 from app_private.plr_setores_visiveis(p_ano)) then 'gestor' end,
    case when app_private.plr_ve_a_propria_linha()
          and exists (select 1 from public.plr_pessoas p
                       where p.ano = p_ano and p.colaborador_id = app_private.plr_eu())
         then 'usuario' end
  )
$$;

-- As linhas que a pessoa pode ver, com salário. Admin, todas. Gestor, as dos setores
-- dele e a própria. Usuário, só a própria. É a Edge Function plr-calculo quem chama,
-- com o token da pessoa; as colunas não passam disso:
--   { papel, ve_todos, pessoas: [{ id, nome, cod_ct, setor_hub, cargo_plr,
--       salario, data_admissao, hub_chave }] }
create or replace function public.plr_pessoas_visiveis(p_ano integer)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu uuid := app_private.plr_eu();
  v_papel text := public.plr_acesso(p_ano);
begin
  if v_eu is null and not app_private.is_portal_super_admin() then
    raise exception 'Só colaboradores ativos veem o PLR.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'papel', v_papel,
    've_todos', v_papel is not distinct from 'admin',
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'nome', p.nome,
               'cod_ct', p.cod_ct,
               'setor_hub', p.setor_hub,
               'cargo_plr', p.cargo_plr,
               'salario', p.salario,
               'data_admissao', p.data_admissao,
               'hub_chave', p.hub_chave)
             order by p.nome)
        from public.plr_pessoas p
        left join public.colaboradores c on c.id = p.colaborador_id
       where p.ano = p_ano
         and c.ativo is distinct from false
         and (v_papel = 'admin'
              or (v_papel in ('gestor', 'usuario') and p.colaborador_id = v_eu)
              or (v_papel = 'gestor'
                  and p.setor_hub in (select st.setor_hub from public.plr_setores st
                                       where st.id in (select app_private.plr_setores_visiveis(p_ano)))))
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.plr_acesso(integer) from public, anon;
revoke all on function public.plr_pessoas_visiveis(integer) from public, anon;
grant execute on function public.plr_acesso(integer) to authenticated;
grant execute on function public.plr_pessoas_visiveis(integer) to authenticated;
