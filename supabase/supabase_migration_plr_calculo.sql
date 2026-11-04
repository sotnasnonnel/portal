-- Migration: PLR por pessoa (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (04/11/2026): calcular o PLR de cada pessoa pela regra da
-- aba CALCULO PLR da planilha "Bônus 26.27 Análise final" e mostrar na página do
-- PLR, com o Fator PLR corporativo e a % de cada setor vindos do HUB.
--
-- Decisões (04/11/2026):
--   - Um total só, o YTD: a % do setor é o resultado acumulado, e o Fator PLR
--     corporativo vem da projeção de fechamento 2026 do HUB.
--   - Desligados não entram em lugar nenhum: só vêm os "Atual" da planilha, e
--     quem for desativado depois some sozinho (colaboradores.ativo, abaixo).
--   - Setor de cada pessoa pelo COD CT. Qualidade entra em Operação Leonardo e
--     BIM em Operação Bruno (o mapa fica em docs/gerar_carga_plr_pessoas.cjs).
--   - Gerência (Pedro Nery, Pedro Morais, Henrique Santos, Leonardo Drumond,
--     Bruno Azevedo, Eduardo Eller, Daniela Sebrian e André Guimarães): o valor
--     vem inteiro do HUB. Só a chave deles é guardada aqui, sem salário.
--   - Quem vê: admin e visualizador do PLR veem todo mundo (com salário); cada
--     um dos outros vê só a própria linha.
--
-- O cálculo NÃO fica no banco. Aqui se guarda quem é quem; a conta sai da Edge
-- Function plr-calculo (supabase/functions/plr-calculo/calculo.ts), que junta
-- estas linhas com o que o HUB diz na hora.
--
-- Acesso: tabela com RLS ligada e SEM policy, como as outras do PLR. Tudo passa
-- pela RPC abaixo. Salário nunca vai para o repositório: a carga sai de
-- docs/gerar_carga_plr_pessoas.cjs para um arquivo que está no .gitignore.
--
-- A visão de cada um tem chave própria, app_private.plr_aberto_a_cada_um(), e
-- nasce DESLIGADA: assim dá para conferir os números antes de abrir para ~130
-- pessoas. Para abrir, troque o `false` dela por `true` e reaplique só essa
-- função. Quem tem papel no PLR entra com ela ligada ou não.
--
-- Ordem:
--   1. esta migração (o card do PLR não muda para ninguém enquanto a chave estiver
--      desligada);
--   2. a carga (supabase_import_plr_pessoas.sql);
--   3. deploy da Edge Function plr-calculo;
--   4. deploy do front;
--   5. ligar a chave, quando os números estiverem conferidos.
-- ============================================================================

create table if not exists public.plr_pessoas (
  id              uuid primary key default gen_random_uuid(),
  ano             integer not null,
  -- O login que vê esta linha. Sem FK com o HUB: lá a ligação é pela chave.
  colaborador_id  uuid references public.colaboradores(id),
  nome            text not null,
  cod_ct          text not null,
  -- Colunas da conta do colaborador. Na gerência ficam vazias: o HUB responde.
  setor_hub       text,      -- id do setor no HUB ('opleo', 'fin', ...)
  cargo_plr       text,      -- nome da aba "Multiplic. Cargo"
  salario         numeric,   -- sem casas fixas: a planilha faz a conta com o valor inteiro
  data_admissao   date,
  -- plr_pessoa.chave no HUB ('nery', 'daniela', ...). Com ela, o valor vem de lá.
  hub_chave       text,
  atualizado_em   timestamptz not null default now(),
  constraint plr_pessoas_unico unique (ano, nome),
  constraint plr_pessoas_login_unico unique (ano, colaborador_id),
  constraint plr_pessoas_hub_unico unique (ano, hub_chave),
  constraint plr_pessoas_nome_tam check (char_length(btrim(nome)) between 1 and 200),
  constraint plr_pessoas_salario check (salario is null or salario >= 0),
  -- Ou vem do HUB, ou tem tudo o que a conta precisa.
  constraint plr_pessoas_origem check (
    hub_chave is not null
    or (setor_hub is not null and cargo_plr is not null and salario is not null and data_admissao is not null)
  )
);

alter table public.plr_pessoas enable row level security;
revoke all on public.plr_pessoas from anon, authenticated;

-- ---- Chave da visão de cada um -------------------------------------------------
create or replace function app_private.plr_aberto_a_cada_um()
 returns boolean language sql immutable set search_path to ''
as $$ select false $$;

revoke all on function app_private.plr_aberto_a_cada_um() from public;

-- ---- RPCs ---------------------------------------------------------------------

-- 'admin' | 'visualizador' | 'setor' | 'proprio' | NULL. É o gate da Home e da
-- rota (modules.plr, em AuthContext). 'proprio' = sem papel e sem setor visível,
-- mas com linha no cálculo do ano.
create or replace function public.plr_acesso(p_ano integer)
 returns text language sql stable security definer set search_path to ''
as $$
  select coalesce(
    app_private.plr_papel(),
    case when exists (select 1 from app_private.plr_setores_visiveis(p_ano)) then 'setor' end,
    case when app_private.plr_aberto_a_cada_um()
          and exists (select 1 from public.plr_pessoas p
                       where p.ano = p_ano and p.colaborador_id = app_private.plr_eu())
         then 'proprio' end
  )
$$;

-- As linhas que a pessoa pode ver, com salário. Com papel, todas. Sem papel, só a
-- dela (com a chave acima ligada). É a Edge Function plr-calculo quem chama, com
-- o token da pessoa; as colunas não passam disso:
--   { papel, ve_todos, pessoas: [{ id, nome, cod_ct, setor_hub, cargo_plr,
--       salario, data_admissao, hub_chave }] }
create or replace function public.plr_pessoas_visiveis(p_ano integer)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare
  v_eu uuid := app_private.plr_eu();
  v_ve_todos boolean := app_private.plr_papel() is not null;
begin
  if v_eu is null and not app_private.is_portal_super_admin() then
    raise exception 'Só colaboradores ativos veem o PLR.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'papel', public.plr_acesso(p_ano),
    've_todos', v_ve_todos,
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
         and (v_ve_todos
              or (app_private.plr_aberto_a_cada_um() and p.colaborador_id = v_eu))
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.plr_pessoas_visiveis(integer) from public, anon;
grant execute on function public.plr_pessoas_visiveis(integer) to authenticated;
