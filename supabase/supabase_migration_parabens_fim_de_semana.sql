-- Migration: aniversário do fim de semana segue até a segunda (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (19/10/2026): o Paulo Paiva fez aniversário no domingo
-- 18/10, ninguém abriu o portal no fim de semana e na segunda a comemoração já
-- tinha sumido da Home — ninguém deu os parabéns.
--
-- Regra (a JANELA): o aniversário fica em cartaz no próprio dia e, quando cai
-- no fim de semana, até o primeiro dia útil seguinte. Na prática:
--   segunda  -> mostra sábado, domingo e segunda;
--   domingo  -> mostra sábado e domingo;
--   outros   -> só o próprio dia, como antes.
-- Vale para a lista da Home, para o e-mail que monta o link do Teams, para o
-- mural de parabéns e para os 10 pontos do recado.
--
-- Feriado NÃO entra: o portal não tem calendário de feriados — a mesma
-- limitação conhecida de src/utils/diasUteis.js. Quando existir a tabela, é só
-- filtrar em app_private.inicio_janela_parabens E no espelho do front
-- (src/pages/Home/comemoracao.js, função diasEmCartaz).
--
-- Sem dependência de deploy, nas duas ordens:
--   - banco novo + front antigo: as colunas que o front lê continuam lá (as
--     novas são ignoradas) e ele segue mostrando só quem faz no dia;
--   - front novo + banco antigo: sem a coluna celebra_em o front cai na regra
--     antiga (dia == hoje).
--
-- Já aplicada em 19/10/2026 (migration parabens_fim_de_semana).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) A janela
-- ----------------------------------------------------------------------------
create or replace function app_private.bissexto(p_ano int)
returns boolean language sql immutable set search_path = '' as $$
  select (p_ano % 4 = 0 and p_ano % 100 <> 0) or p_ano % 400 = 0
$$;

-- Primeiro dia que ainda está em cartaz hoje. isodow: 1 = segunda, 7 = domingo.
create or replace function app_private.inicio_janela_parabens(p_hoje date default null)
returns date language sql stable set search_path = '' as $$
  select h - case extract(isodow from h)::int when 1 then 2 when 7 then 1 else 0 end
    from (select coalesce(p_hoje, app_private.hoje_brasil()) as h) t
$$;

-- Os dias da janela (1 a 3), do mais antigo até hoje.
create or replace function app_private.dias_em_cartaz()
returns setof date language sql stable set search_path = '' as $$
  select g::date
    from generate_series(app_private.inicio_janela_parabens(),
                         app_private.hoje_brasil(), interval '1 day') g
$$;

-- A pessoa comemora no dia p_dia? Mesmo dia e mês, sem olhar o ano. Quem nasceu
-- (ou entrou) em 29/02 comemora em 28/02 nos anos não bissextos — a mesma regra
-- do front (src/pages/Home/comemoracao.js), que o banco não tinha.
create or replace function app_private.comemora_em(p_data date, p_dia date)
returns boolean language sql immutable set search_path = '' as $$
  select p_data is not null and p_dia is not null and p_dia =
    case
      when extract(month from p_data) = 2 and extract(day from p_data) = 29
       and not app_private.bissexto(extract(year from p_dia)::int)
      then make_date(extract(year from p_dia)::int, 2, 28)
      else make_date(extract(year from p_dia)::int,
                     extract(month from p_data)::int,
                     extract(day from p_data)::int)
    end
$$;

-- O dia em que a pessoa comemorou o aniversário que ainda está em cartaz.
-- NULL = o aniversário dela não está em cartaz hoje. É o que destrava o mural.
create or replace function app_private.comemoracao_em_cartaz(p_colab uuid)
returns date language sql stable security definer set search_path = '' as $$
  select max(d)
    from public.colaboradores c cross join app_private.dias_em_cartaz() d
   where c.id = p_colab
     and c.ativo is distinct from false
     and app_private.comemora_em(c.data_nascimento, d)
$$;

-- ----------------------------------------------------------------------------
-- 2) A lista da Home
--
-- Duas colunas novas:
--   mes        -> o mês do aniversário. A janela cruza o mês (sábado 31/10 e
--                 segunda 02/11), então a lista pode trazer linha de outro mês
--                 e o front precisa saber para não escrever "31/11".
--   celebra_em -> o dia em cartaz (NULL = não está). Substitui o "dia == hoje"
--                 que o front fazia de cabeça.
--
-- O e-mail continua saindo SÓ de quem está em cartaz: a RPC é security definer
-- e pedir os 12 meses não pode virar uma lista de e-mails da empresa (ver
-- supabase_migration_aniversariantes_email_so_hoje.sql).
--
-- O tipo de retorno muda, então a função é recriada (create or replace não
-- troca colunas de saída).
-- ----------------------------------------------------------------------------
drop function if exists public.aniversariantes_mes(int);

create function public.aniversariantes_mes(p_mes int default null)
returns table (colaborador_id uuid, nome text, funcao text, tipo text,
               dia int, mes int, anos_casa int, email text, celebra_em date)
language sql stable security definer set search_path = '' as $$
  with ref as (
    select coalesce(p_mes, extract(month from app_private.hoje_brasil())::int) as mes,
           extract(year from app_private.hoje_brasil())::int as ano,
           -- Só a lista do mês corrente (p_mes null) ganha os de fora do mês
           -- que ainda estão em cartaz.
           p_mes is null as inclui_janela
  ), janela as (
    select d from app_private.dias_em_cartaz() d
  ), aniv as (
    select c.id, c.nome, c.funcao, c.email,
           extract(day from c.data_nascimento)::int as dia,
           extract(month from c.data_nascimento)::int as mes,
           (select max(j.d) from janela j
             where app_private.comemora_em(c.data_nascimento, j.d)) as cartaz
      from public.colaboradores c
     where c.ativo is distinct from false
       and c.data_nascimento is not null
  ), casa as (
    select c.id, c.nome, c.funcao,
           extract(day from c.data_admissao)::int as dia,
           extract(month from c.data_admissao)::int as mes,
           extract(year from c.data_admissao)::int as ano_adm,
           (select max(j.d) from janela j
             where app_private.comemora_em(c.data_admissao, j.d)) as cartaz
      from public.colaboradores c
     where c.ativo is distinct from false
       and c.data_admissao is not null
  )
  select a.id, a.nome, a.funcao, 'aniversario', a.dia, a.mes, null::int,
         case when a.cartaz is not null then a.email end, a.cartaz
    from aniv a cross join ref
   where a.mes = ref.mes
      or (ref.inclui_janela and a.cartaz is not null)
  union all
  -- Os anos de casa saem do ano da comemoração, não do ano de hoje: na segunda
  -- 02/01, quem entrou num 31/12 completou os anos no sábado anterior.
  select k.id, k.nome, k.funcao, 'tempo_casa', k.dia, k.mes,
         coalesce(extract(year from k.cartaz)::int, ref.ano) - k.ano_adm,
         null::text, k.cartaz
    from casa k cross join ref
   where coalesce(extract(year from k.cartaz)::int, ref.ano) - k.ano_adm >= 1
     and (k.mes = ref.mes
       or (ref.inclui_janela and k.cartaz is not null))
  order by 6, 5, 2
$$;
revoke all on function public.aniversariantes_mes(int) from public;
revoke execute on function public.aniversariantes_mes(int) from anon;
grant execute on function public.aniversariantes_mes(int) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Mural de parabéns: a mesma janela
-- ----------------------------------------------------------------------------
-- O ANO do recado é o do aniversário em cartaz, e não o de hoje: um recado
-- dado na segunda 02/01 para quem fez aniversário no sábado 31/12 pertence
-- àquele aniversário — é o que mantém o mural, a chave única e os 10 pontos
-- apontando para o mesmo lugar.
create or replace function public.parabens_enviar(p_para uuid, p_texto text, p_icones text[] default '{}'::text[])
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
  v_cartaz date := app_private.comemoracao_em_cartaz(p_para);
  v_ano int;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_icones text[] := coalesce(p_icones, '{}');
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  if p_para = v_me then raise exception 'O recado é para os colegas.'; end if;
  if v_texto = '' then raise exception 'Escreva o recado.'; end if;
  if char_length(v_texto) > 500 then raise exception 'Recado longo demais (máximo de 500 caracteres).'; end if;
  if cardinality(v_icones) > 3 then raise exception 'Escolha até 3 ícones.'; end if;
  if v_cartaz is null then
    raise exception 'O mural recebe recados no dia do aniversário e, quando ele cai no fim de semana, até a segunda.';
  end if;
  v_ano := extract(year from v_cartaz)::int;

  insert into public.parabens_recados (para_id, de_id, ano, texto, icones)
  values (p_para, v_me, v_ano, v_texto, v_icones)
  on conflict (para_id, de_id, ano) do update set texto = excluded.texto, icones = excluded.icones;
  insert into public.pontos_movimentos (colaborador_id, pontos, motivo, ref, descricao)
  values (v_me, 10, 'parabens', p_para::text || ':' || v_ano, 'Recado de aniversário')
  on conflict do nothing;
  return app_private.pontos_saldo(v_me);
end $$;
revoke all on function public.parabens_enviar(uuid, text, text[]) from public, anon;
grant execute on function public.parabens_enviar(uuid, text, text[]) to authenticated;

-- O mural mostra o aniversário em cartaz; fora da janela, o deste ano (como antes).
create or replace function public.parabens_mural(p_para uuid)
returns table (id uuid, de_id uuid, de_nome text, texto text, criado_em timestamptz,
               moldura text, mural text[], icones text[])
language sql stable security definer set search_path = '' as $$
  select r.id, r.de_id, c.nome, r.texto, r.criado_em, p.moldura, coalesce(p.mural, '{}'), r.icones
    from public.parabens_recados r
    join public.colaboradores c on c.id = r.de_id
    left join public.pontos_perfil p on p.colaborador_id = r.de_id
   where r.para_id = p_para
     and r.ano = coalesce(extract(year from app_private.comemoracao_em_cartaz(p_para))::int,
                          extract(year from app_private.hoje_brasil())::int)
   order by r.criado_em
$$;
revoke all on function public.parabens_mural(uuid) from public, anon;
grant execute on function public.parabens_mural(uuid) to authenticated;

create or replace function public.parabens_excluir(p_para uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app_private.my_colaborador_id();
begin
  if v_me is null then raise exception 'Seu usuário não está vinculado a um colaborador.'; end if;
  -- Só o próprio recado, do aniversário em cartaz (fora da janela, o deste ano).
  delete from public.parabens_recados
   where para_id = p_para and de_id = v_me
     and ano = coalesce(extract(year from app_private.comemoracao_em_cartaz(p_para))::int,
                        extract(year from app_private.hoje_brasil())::int);
end $$;
revoke all on function public.parabens_excluir(uuid) from public, anon;
grant execute on function public.parabens_excluir(uuid) to authenticated;

notify pgrst, 'reload schema';
