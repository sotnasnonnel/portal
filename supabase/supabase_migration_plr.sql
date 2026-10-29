-- Migration: PLR por setor (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (29/10/2026): um módulo para visualizar a aba SETORES da
-- plr.xlsx — as metas e os resultados de PLR de cada setor —, cada pessoa vendo
-- o do próprio setor.
--
-- Decisões (29/10/2026):
--   - Quem vê um setor: o responsável que está ao lado dele na planilha e a
--     EQUIPE dele, pelo organograma (colaboradores.superior_id). "A equipe" é
--     quem tem esse responsável como o MAIS PRÓXIMO acima de si: a Ana Regina
--     (Marketing) responde ao Henrique (Comercial), e ela e o time dela veem o
--     Marketing, não o Comercial. O responsável de dois setores (a Daniela, em
--     Administrativo e TI e em Financeiro e Contratos) leva os dois, e a
--     equipe dela também — o organograma não diz de qual dos dois cada um é.
--   - Quem vê todos os setores: o super admin e quem tiver
--     colaboradores.plr_role = 'visualizador' (Gerenciar acessos).
--   - Quem edita: o super admin e plr_role = 'admin'. Por enquanto, só o
--     usuário e o André Guimarães (carregado abaixo).
--   - Por enquanto o módulo inteiro é só do usuário e do André: a visão pelo
--     setor está desligada em app_private.plr_aberto_aos_setores(). Para
--     abrir para todos, troque o `false` dela por `true` e reaplique só essa
--     função; os papéis do Gerenciar acessos valem com ela ligada ou não.
--   - Só 2026 por enquanto. As tabelas já têm `ano`: a aba "SETORES - 2027"
--     entra como outra carga, sem mudar a estrutura.
--
-- O cálculo NÃO fica no banco. Aqui se guardam meta, resultado, peso e a regra
-- de aderência; resultado %, aderência e total do setor são contas da tela
-- (src/modules/plr/lib/plr.js), as mesmas fórmulas da planilha:
--   'proporcional': resultado/meta >= 95% -> min(resultado/meta, 100%);
--                   >= 90% -> 50%; abaixo -> zero.
--   'teto':         resultado/meta > 100% -> zero; senão 100%. É a dos custos
--                   e dos prazos, onde menos é melhor.
--
-- Acesso: tabelas com RLS ligada e SEM policy; tudo passa pelas RPCs abaixo
-- (security definer), como nos Avisos.
--
-- Ordem: aplicar ANTES do deploy do front. Sem a migração, o front trata a RPC
-- ausente como "sem acesso" e o card simplesmente não aparece.
-- ============================================================================

-- ---- Papel no Gerenciar acessos ----------------------------------------------
-- NULL = vê pelo setor (organograma). 'visualizador' = vê todos os setores.
-- 'admin' = vê todos e edita.
alter table public.colaboradores add column if not exists plr_role text;
alter table public.colaboradores drop constraint if exists colaboradores_plr_role_check;
alter table public.colaboradores add constraint colaboradores_plr_role_check
  check (plr_role is null or plr_role in ('visualizador', 'admin'));

-- ---- Tabelas ------------------------------------------------------------------

create table if not exists public.plr_setores (
  id              uuid primary key default gen_random_uuid(),
  ano             integer not null,
  ordem           integer not null,
  nome            text not null,
  responsavel_id  uuid not null references public.colaboradores(id),
  -- Período a que os resultados se referem ("YTD Julho"). Na planilha vinha
  -- repetido em cada indicador, sempre igual dentro do setor.
  referencia      text not null default '',
  atualizado_em   timestamptz,
  atualizado_por  uuid references public.colaboradores(id),
  criado_em       timestamptz not null default now(),
  -- Operação aparece três vezes, uma por responsável.
  constraint plr_setores_unico unique (ano, nome, responsavel_id),
  constraint plr_setores_nome_tam check (char_length(btrim(nome)) between 1 and 120),
  constraint plr_setores_referencia_tam check (char_length(referencia) <= 120)
);

create table if not exists public.plr_indicadores (
  id         uuid primary key default gen_random_uuid(),
  setor_id   uuid not null references public.plr_setores(id) on delete cascade,
  ordem      integer not null,
  nome       text not null,
  -- 'percentual': guardado em fração (0,9 = 90%), como na planilha.
  -- 'reais_mi': em milhões de reais (9,49 = R$ 9,49 mi).
  unidade    text not null,
  regra      text not null,
  meta       numeric not null,
  -- NULL = ainda não informado (não é zero).
  resultado  numeric,
  -- Fração do setor (0,3 = 30%).
  peso       numeric not null,
  constraint plr_ind_nome_tam check (char_length(btrim(nome)) between 1 and 300),
  constraint plr_ind_unidade check (unidade in ('percentual', 'reais_mi', 'dias', 'numero')),
  constraint plr_ind_regra check (regra in ('proporcional', 'teto')),
  constraint plr_ind_meta check (meta <> 0),
  constraint plr_ind_peso check (peso >= 0 and peso <= 1)
);
create index if not exists plr_indicadores_setor_idx on public.plr_indicadores (setor_id, ordem);

alter table public.plr_setores enable row level security;
alter table public.plr_indicadores enable row level security;
revoke all on public.plr_setores from anon, authenticated;
revoke all on public.plr_indicadores from anon, authenticated;

-- ---- Quem é quem --------------------------------------------------------------

-- Colaborador ativo logado. O e-mail cobre o primeiro login, em que o auth_id
-- ainda está sendo gravado (AuthContext chama plr_acesso em paralelo).
create or replace function app_private.plr_eu()
 returns uuid language sql stable security definer set search_path to ''
as $$
  select c.id from public.colaboradores c
   where (c.auth_id = (select auth.uid())
          or lower(c.email) = lower((select auth.jwt() ->> 'email')))
     and c.ativo is distinct from false
   order by (c.auth_id = (select auth.uid())) desc nulls last
   limit 1
$$;

-- 'admin' | 'visualizador' | NULL (vê pelo setor).
create or replace function app_private.plr_papel()
 returns text language sql stable security definer set search_path to ''
as $$
  select case
    when app_private.is_portal_super_admin() then 'admin'
    else (select c.plr_role from public.colaboradores c where c.id = app_private.plr_eu())
  end
$$;

-- Chave da visão pelo setor. Desligada: só quem tem papel entra no módulo.
create or replace function app_private.plr_aberto_aos_setores()
 returns boolean language sql immutable set search_path to ''
as $$ select false $$;

-- Setores que a pessoa enxerga no ano. Com papel, todos. Sem papel (e com a
-- chave acima ligada), os do responsável mais próximo dela no organograma: ela
-- mesma, se for responsável, ou o primeiro acima dela que seja. O corte em 12
-- níveis é guarda contra ciclo em superior_id, como em
-- app_private.cadeia_superiores.
create or replace function app_private.plr_setores_visiveis(p_ano integer)
 returns setof uuid language sql stable security definer set search_path to ''
as $$
  with recursive cadeia as (
    select 0 as nivel, c.id, c.superior_id
      from public.colaboradores c
     where c.id = app_private.plr_eu()
    union all
    select ca.nivel + 1, s.id, s.superior_id
      from cadeia ca
      join public.colaboradores s on s.id = ca.superior_id
     where ca.nivel < 12
  ),
  dono as (
    select ca.id
      from cadeia ca
     where exists (select 1 from public.plr_setores st
                    where st.ano = p_ano and st.responsavel_id = ca.id)
     order by ca.nivel
     limit 1
  )
  select st.id
    from public.plr_setores st
   where st.ano = p_ano
     and (app_private.plr_papel() is not null
          or (app_private.plr_aberto_aos_setores()
              and st.responsavel_id = (select dono.id from dono)))
$$;

revoke all on function app_private.plr_aberto_aos_setores() from public;
revoke all on function app_private.plr_eu() from public;
revoke all on function app_private.plr_papel() from public;
revoke all on function app_private.plr_setores_visiveis(integer) from public;

-- ---- RPCs ---------------------------------------------------------------------

-- O que a pessoa tem no módulo: 'admin' | 'visualizador' | 'setor' | NULL.
-- É o gate da Home e da rota (modules.plr, em AuthContext).
create or replace function public.plr_acesso(p_ano integer)
 returns text language sql stable security definer set search_path to ''
as $$
  select coalesce(
    app_private.plr_papel(),
    case when exists (select 1 from app_private.plr_setores_visiveis(p_ano)) then 'setor' end
  )
$$;

-- Os setores visíveis, com os indicadores, em um JSON só:
--   { papel, setores: [{ id, ordem, nome, responsavel_id, responsavel_nome,
--       referencia, atualizado_em, atualizado_por_nome,
--       indicadores: [{ id, ordem, nome, unidade, regra, meta, resultado, peso }] }] }
create or replace function public.plr_painel(p_ano integer)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $$
begin
  if app_private.plr_eu() is null and not app_private.is_portal_super_admin() then
    raise exception 'Só colaboradores ativos veem o PLR.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'papel', public.plr_acesso(p_ano),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', st.id,
               'ordem', st.ordem,
               'nome', st.nome,
               'responsavel_id', st.responsavel_id,
               'responsavel_nome', r.nome,
               'referencia', st.referencia,
               'atualizado_em', st.atualizado_em,
               'atualizado_por_nome', a.nome,
               'indicadores', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', i.id, 'ordem', i.ordem, 'nome', i.nome,
                          'unidade', i.unidade, 'regra', i.regra,
                          'meta', i.meta, 'resultado', i.resultado, 'peso', i.peso)
                        order by i.ordem)
                   from public.plr_indicadores i
                  where i.setor_id = st.id), '[]'::jsonb))
             order by st.ordem)
        from public.plr_setores st
        join public.colaboradores r on r.id = st.responsavel_id
        left join public.colaboradores a on a.id = st.atualizado_por
       where st.id in (select app_private.plr_setores_visiveis(p_ano))
    ), '[]'::jsonb)
  );
end $$;

-- Salva a referência do setor e os indicadores enviados (pelo id). Não cria nem
-- apaga indicador: a tela de edição mexe nos que a carga trouxe. A soma dos
-- pesos não é travada — o Comercial veio da planilha com 85% —, a tela avisa.
create or replace function public.plr_salvar_setor(
  p_setor_id uuid, p_referencia text, p_indicadores jsonb)
 returns void language plpgsql security definer set search_path to ''
as $$
declare
  e jsonb;
begin
  if app_private.plr_papel() is distinct from 'admin' then
    raise exception 'Só o admin do PLR edita os resultados.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.plr_setores where id = p_setor_id) then
    raise exception 'Setor não encontrado.';
  end if;
  if jsonb_typeof(coalesce(p_indicadores, 'null'::jsonb)) <> 'array' then
    raise exception 'Lista de indicadores inválida.';
  end if;

  for e in select * from jsonb_array_elements(p_indicadores) loop
    update public.plr_indicadores i
       set nome      = btrim(e ->> 'nome'),
           unidade   = e ->> 'unidade',
           regra     = e ->> 'regra',
           meta      = (e ->> 'meta')::numeric,
           resultado = (e ->> 'resultado')::numeric,
           peso      = (e ->> 'peso')::numeric
     where i.id = (e ->> 'id')::uuid
       and i.setor_id = p_setor_id;
    if not found then
      raise exception 'Indicador % não pertence ao setor.', e ->> 'id';
    end if;
  end loop;

  update public.plr_setores
     set referencia = btrim(coalesce(p_referencia, '')),
         atualizado_em = now(),
         atualizado_por = app_private.plr_eu()
   where id = p_setor_id;
end $$;

revoke all on function public.plr_acesso(integer) from public, anon;
revoke all on function public.plr_painel(integer) from public, anon;
revoke all on function public.plr_salvar_setor(uuid, text, jsonb) from public, anon;
grant execute on function public.plr_acesso(integer) to authenticated;
grant execute on function public.plr_painel(integer) to authenticated;
grant execute on function public.plr_salvar_setor(uuid, text, jsonb) to authenticated;

-- ---- Carga: aba SETORES da plr.xlsx (2026, YTD Julho) -------------------------
-- Gerada da planilha. A regra de cada indicador saiu da FÓRMULA da coluna
-- Aderência, não do texto da coluna Tolerância: em quatro linhas os dois
-- discordam (Turnover e Lead time do RH, Contratos no prazo do Financeiro,
-- Vendas Novos Segmentos do Comercial), e é a fórmula que dá o número que a
-- planilha mostra. Responsável pelo e-mail; a planilha só tinha o nome.
-- Idempotente: setor que já existe não é recarregado.
with dados(ordem, nome, email, referencia, indicadores) as (values
  (1, 'Recursos Humanos', 'lucas.ferraz@phdengenharia.eng.br', 'YTD Julho', jsonb_build_array(
    jsonb_build_object('nome', 'Índice de clima organizacional', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.9, 'resultado', 0.9, 'peso', 0.2),
    jsonb_build_object('nome', 'Índice de Prontidão dos Colaboradores Mapeados para Posições Estratégicas (%)', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.8, 'resultado', 0, 'peso', 0.1),
    jsonb_build_object('nome', 'Custos do setor - Recursos Humanos', 'unidade', 'percentual', 'regra', 'teto', 'meta', 1, 'resultado', 1.004, 'peso', 0.3),
    jsonb_build_object('nome', 'Taxa de Rotatividade Média Talentos (Turnover) (%)', 'unidade', 'percentual', 'regra', 'teto', 'meta', 0.018, 'resultado', 0.016, 'peso', 0.1),
    jsonb_build_object('nome', 'Tempo Médio de Ciclo de Atração e Seleção (Lead time) (Dias)', 'unidade', 'dias', 'regra', 'teto', 'meta', 30, 'resultado', 23.7, 'peso', 0.3)
  )),
  (2, 'Administrativo e TI', 'daniela.sebrian@phdengenharia.eng.br', 'YTD Julho', jsonb_build_array(
    jsonb_build_object('nome', 'Índice de Satisfação em Atendimento de Chamados (CSAT) (Nota de 1 a 5)', 'unidade', 'numero', 'regra', 'proporcional', 'meta', 4.5, 'resultado', 4.7, 'peso', 0.1),
    jsonb_build_object('nome', 'Tempo Médio de Mobilização de Recursos Humanos (Pessoas) (Dias)', 'unidade', 'dias', 'regra', 'teto', 'meta', 30, 'resultado', 24.86, 'peso', 0.3),
    jsonb_build_object('nome', 'Tempo Médio de Mobilização Organizacional (Empresa) (Dias)', 'unidade', 'dias', 'regra', 'teto', 'meta', 30, 'resultado', 19.57, 'peso', 0.3),
    jsonb_build_object('nome', 'Custos do setor - Administrativo + TI', 'unidade', 'percentual', 'regra', 'teto', 'meta', 1, 'resultado', 1.01, 'peso', 0.3)
  )),
  (3, 'Financeiro e Contratos', 'daniela.sebrian@phdengenharia.eng.br', 'YTD Julho', jsonb_build_array(
    jsonb_build_object('nome', '% de Boletins de Medição Elaborados no Prazo', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.95, 'resultado', 1, 'peso', 0.3),
    jsonb_build_object('nome', '% de Contratos Assinados Dentro do Prazo Esperado', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.85, 'resultado', 0.857, 'peso', 0.3),
    jsonb_build_object('nome', 'Custos do setor - Financeiro', 'unidade', 'percentual', 'regra', 'teto', 'meta', 1, 'resultado', 1.01, 'peso', 0.4)
  )),
  (4, 'Marketing', 'ana.caldeira@phdengenharia.eng.br', 'YTD Julho - Indicadores Operacionais', jsonb_build_array(
    jsonb_build_object('nome', 'Número de Premiações e Reconhecimentos Conquistados', 'unidade', 'numero', 'regra', 'proporcional', 'meta', 2, 'resultado', 0, 'peso', 0.4),
    jsonb_build_object('nome', 'Custos do setor - Marketing', 'unidade', 'percentual', 'regra', 'teto', 'meta', 1, 'resultado', 0.9, 'peso', 0.6)
  )),
  (5, 'Comercial', 'henrique.santos@phdengenharia.eng.br', 'YTD Julho', jsonb_build_array(
    jsonb_build_object('nome', 'Taxa de Conversão Financeira de Propostas - Novos Clientes (Hunter) (%)', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.15, 'resultado', 0.063, 'peso', 0.15),
    jsonb_build_object('nome', 'Vendas Novos Segmentos (Energia/Agro/Infra) (R$)', 'unidade', 'reais_mi', 'regra', 'proporcional', 'meta', 9.49, 'resultado', 5.19, 'peso', 0.2),
    jsonb_build_object('nome', 'Receita Contratada para Realização em 2027 (Backlog) (R$)', 'unidade', 'reais_mi', 'regra', 'proporcional', 'meta', 11.99, 'resultado', 6.41, 'peso', 0.2),
    jsonb_build_object('nome', 'Vendas de Novos Clientes (Hunter) (R$)', 'unidade', 'reais_mi', 'regra', 'proporcional', 'meta', 8.16, 'resultado', 6.44, 'peso', 0.15),
    jsonb_build_object('nome', 'Custos do setor - Comercial', 'unidade', 'percentual', 'regra', 'teto', 'meta', 1, 'resultado', 1.01, 'peso', 0.15)
  )),
  (6, 'PMO', 'andre.guimaraes@phdengenharia.eng.br', 'YTD Julho', jsonb_build_array(
    jsonb_build_object('nome', 'Índice de Atendimento da Governança Corporativa (%)', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.95, 'resultado', 0.9489, 'peso', 0.2),
    jsonb_build_object('nome', 'Processos Operacionais Automatizados (Unidade)', 'unidade', 'numero', 'regra', 'proporcional', 'meta', 7, 'resultado', 7, 'peso', 0.3),
    jsonb_build_object('nome', 'Taxa de projetos com ferramentas PHD aplicadas (%)', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.5, 'resultado', 0.4, 'peso', 0.2),
    jsonb_build_object('nome', 'Custos do setor - PMO + Inovação', 'unidade', 'percentual', 'regra', 'teto', 'meta', 1, 'resultado', 0.9019, 'peso', 0.3)
  )),
  (7, 'Operação', 'leonardo.drumond@phdengenharia.eng.br', 'YTD Julho', jsonb_build_array(
    jsonb_build_object('nome', 'Faturamento Bruto', 'unidade', 'reais_mi', 'regra', 'proporcional', 'meta', 9.9, 'resultado', 12.24, 'peso', 0.3),
    jsonb_build_object('nome', 'Margem de Contribuição', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.3037, 'resultado', 0.3862, 'peso', 0.3),
    jsonb_build_object('nome', 'Nota CSAT (+aderência emissão)', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.092, 'resultado', 0.0918, 'peso', 0.2),
    jsonb_build_object('nome', 'Apresentação de ROI', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.9, 'resultado', 0.7619, 'peso', 0.15),
    jsonb_build_object('nome', 'Utilização de ferramentas PHD', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.5, 'resultado', 0.6, 'peso', 0.05)
  )),
  (8, 'Operação', 'bruno.azevedo@phdengenharia.eng.br', 'YTD Julho', jsonb_build_array(
    jsonb_build_object('nome', 'Faturamento Bruto', 'unidade', 'reais_mi', 'regra', 'proporcional', 'meta', 6.24, 'resultado', 3.31, 'peso', 0.3),
    jsonb_build_object('nome', 'Margem de Contribuição', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.4387, 'resultado', 0.0736, 'peso', 0.3),
    jsonb_build_object('nome', 'Nota CSAT (+aderência emissão)', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.092, 'resultado', 0.0921, 'peso', 0.2),
    jsonb_build_object('nome', 'Apresentação de ROI', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.9, 'resultado', 0, 'peso', 0.15),
    jsonb_build_object('nome', 'Utilização de ferramentas PHD', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.5, 'resultado', 0, 'peso', 0.05)
  )),
  (9, 'Operação', 'eduardo.eler@phdengenharia.eng.br', 'YTD Julho', jsonb_build_array(
    jsonb_build_object('nome', 'Faturamento Bruto', 'unidade', 'reais_mi', 'regra', 'proporcional', 'meta', 4.3, 'resultado', 3.07, 'peso', 0.3),
    jsonb_build_object('nome', 'Margem de Contribuição', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.4103, 'resultado', 0.3188, 'peso', 0.3),
    jsonb_build_object('nome', 'Nota CSAT (+aderência emissão)', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.092, 'resultado', 0.0959, 'peso', 0.2),
    jsonb_build_object('nome', 'Apresentação de ROI', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.9, 'resultado', 0, 'peso', 0.15),
    jsonb_build_object('nome', 'Utilização de ferramentas PHD', 'unidade', 'percentual', 'regra', 'proporcional', 'meta', 0.5, 'resultado', 0.6, 'peso', 0.05)
  ))
),
novos as (
  insert into public.plr_setores (ano, ordem, nome, responsavel_id, referencia)
  select 2026, d.ordem, d.nome, c.id, d.referencia
    from dados d
    join public.colaboradores c on lower(c.email) = d.email
  on conflict (ano, nome, responsavel_id) do nothing
  returning id, ordem
)
insert into public.plr_indicadores (setor_id, ordem, nome, unidade, regra, meta, resultado, peso)
select n.id, i.ord, i.e ->> 'nome', i.e ->> 'unidade', i.e ->> 'regra',
       (i.e ->> 'meta')::numeric, (i.e ->> 'resultado')::numeric, (i.e ->> 'peso')::numeric
  from novos n
  join dados d on d.ordem = n.ordem
 cross join lateral jsonb_array_elements(d.indicadores) with ordinality as i(e, ord);

-- Os 9 setores têm de ter entrado: um e-mail que não casasse sumiria com o
-- setor sem erro nenhum.
do $$
begin
  if (select count(*) from public.plr_setores where ano = 2026) <> 9 then
    raise exception 'Carga do PLR 2026 incompleta: esperava 9 setores.';
  end if;
end $$;

-- Quem edita, por enquanto: o super admin (pela função) e o André Guimarães.
update public.colaboradores set plr_role = 'admin'
 where lower(email) = 'andre.guimaraes@phdengenharia.eng.br';
