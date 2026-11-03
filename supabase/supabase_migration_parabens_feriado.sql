-- Migration: feriado conta na janela dos parabéns (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (03/11/2026): a Ana fez aniversário na segunda 02/11, que
-- foi Finados. Ninguém abriu o portal no feriado e na terça a comemoração já
-- tinha sumido da Home — ninguém deu os parabéns. É o mesmo caso do Paulo
-- Paiva, que caiu num domingo e criou a janela do fim de semana
-- (supabase_migration_parabens_fim_de_semana.sql, 19/10/2026).
--
-- A JANELA, agora: o aniversário fica em cartaz no próprio dia e, enquanto os
-- dias anteriores forem dias SEM EXPEDIENTE, continua em cartaz até o primeiro
-- dia útil. Na prática:
--   terça depois de Finados   -> mostra sábado, domingo, a segunda e a terça;
--   segunda comum             -> mostra o fim de semana, como antes;
--   sexta depois de Corpus    -> mostra a quinta e a sexta;
--   quarta de cinzas          -> mostra o Carnaval inteiro;
--   dia comum                 -> só ele mesmo.
--
-- O calendário de feriados é CALCULADO: fixos por lei e móveis tirados da
-- Páscoa (algoritmo gregoriano anônimo). Não há tabela para manter ano a ano.
-- Entram os nacionais, o municipal de Belo Horizonte (08/12, onde fica a sede)
-- e os pontos facultativos em que ninguém trabalha — segunda de Carnaval e
-- Corpus Christi. A pergunta que este calendário responde é "tinha gente no
-- portal?", não "era feriado oficial?".
--
-- ESPELHO NO FRONT: src/utils/feriados.js (pascoa, ehFeriado, semExpediente) e
-- src/pages/Home/comemoracao.js (diasEmCartaz). Mexeu aqui, mexa lá.
--
-- ONDE ISSO NÃO VALE: os prazos em dias úteis do Atendimento e da Mobilização
-- (app_private.mob_dias_uteis_apos e companhia) continuam sem feriado DE
-- PROPÓSITO — ligar o calendário lá mexeria em vencimento já gravado e nos
-- indicadores de atraso de chamado fechado.
--
-- Sem dependência de deploy, nas duas ordens:
--   - banco novo + front antigo: o front lê celebra_em da RPC, então a lista e
--     o mural já respeitam o feriado; só o destaque do topo (que o front
--     calcula sozinho) segue parando no fim de semana;
--   - front novo + banco antigo: o destaque do topo já conta o feriado e o
--     resto espera esta migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) O calendário
-- ----------------------------------------------------------------------------

-- Domingo de Páscoa do ano. Espelho de `pascoa` em src/utils/feriados.js.
-- As divisões são inteiras nos dois lados, e nenhum termo fica negativo.
create or replace function app_private.pascoa(p_ano int)
returns date language plpgsql immutable set search_path = '' as $$
declare
  a int; b int; c int; d int; e int; f int; g int;
  h int; i int; k int; l int; m int; n int;
begin
  if p_ano is null then return null; end if;
  a := p_ano % 19;
  b := p_ano / 100;
  c := p_ano % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  n := h + l - 7 * m + 114;
  return make_date(p_ano, n / 31, (n % 31) + 1);
end $$;

-- Espelho de FIXOS + MOVEIS + DIAS_PARADOS de src/utils/feriados.js.
-- Acrescentar emenda ou feriado novo é mexer nesta função E naquela lista.
create or replace function app_private.feriado(p_dia date)
returns boolean language sql immutable set search_path = '' as $$
  select p_dia is not null and (
      -- Nacionais de data fixa, mais o municipal de BH em 08/12.
      (t.mes, t.dia) in ((1, 1), (4, 21), (5, 1), (9, 7), (10, 12),
                         (11, 2), (11, 15), (12, 8), (12, 25))
      -- Consciência Negra: nacional só a partir de 2024 (Lei 14.759/2023).
      or (t.mes = 11 and t.dia = 20 and t.ano >= 2024)
      -- Móveis: Carnaval (segunda e terça), Sexta-feira Santa, Corpus Christi.
      or p_dia in (t.pascoa - 48, t.pascoa - 47, t.pascoa - 2, t.pascoa + 60)
    )
    from (select extract(month from p_dia)::int as mes,
                 extract(day from p_dia)::int as dia,
                 extract(year from p_dia)::int as ano,
                 app_private.pascoa(extract(year from p_dia)::int) as pascoa) t
$$;

-- Dia em que a empresa não abre: fim de semana ou feriado.
-- isodow: 1 = segunda ... 6 = sábado, 7 = domingo.
create or replace function app_private.sem_expediente(p_dia date)
returns boolean language sql immutable set search_path = '' as $$
  select p_dia is not null
     and (extract(isodow from p_dia)::int >= 6 or app_private.feriado(p_dia))
$$;

-- ----------------------------------------------------------------------------
-- 2) A janela anda para trás enquanto não houve expediente
--
-- Substitui o cálculo fixo (segunda volta 2, domingo volta 1). Teto de 6 dias,
-- igual ao MAX_VOLTA do front: no sétimo dia para trás dois dias da janela
-- teriam o mesmo nome e "na terça-feira" ficaria ambíguo na tela. Serve também
-- de trava contra laço infinito. O Carnaval, a emenda mais longa do ano, usa 4.
-- ----------------------------------------------------------------------------
create or replace function app_private.inicio_janela_parabens(p_hoje date default null)
returns date language plpgsql stable set search_path = '' as $$
declare
  v_ini date := coalesce(p_hoje, app_private.hoje_brasil());
  i int;
begin
  for i in 1..6 loop
    exit when not app_private.sem_expediente(v_ini - 1);
    v_ini := v_ini - 1;
  end loop;
  return v_ini;
end $$;

-- app_private.dias_em_cartaz(), comemoracao_em_cartaz(), a RPC
-- aniversariantes_mes e o mural saem todos desta função: não precisam ser
-- recriados. Só a MENSAGEM de recusa do mural fala do fim de semana.

-- ----------------------------------------------------------------------------
-- 3) O texto que o mural devolve quando está fora da janela
-- ----------------------------------------------------------------------------
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
    raise exception 'O mural recebe recados no dia do aniversário e, quando ele cai em fim de semana ou feriado, até o primeiro dia útil seguinte.';
  end if;
  -- O ANO do recado é o do aniversário em cartaz, e não o de hoje: é o que
  -- mantém o mural, a chave única e os 10 pontos apontando para o mesmo lugar.
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

-- ----------------------------------------------------------------------------
-- 4) Conferência rápida depois de aplicar
-- ----------------------------------------------------------------------------
-- A terça 03/11/2026 tem de enxergar 31/10, 01/11, 02/11 e 03/11:
--   select app_private.inicio_janela_parabens('2026-11-03');  -- 2026-10-31
-- A segunda 19/10/2026 segue vendo o fim de semana:
--   select app_private.inicio_janela_parabens('2026-10-19');  -- 2026-10-17
-- Um dia comum é só ele mesmo:
--   select app_private.inicio_janela_parabens('2026-11-05');  -- 2026-11-05
-- A Páscoa, que manda nos móveis:
--   select app_private.pascoa(2026), app_private.pascoa(2027);  -- 05/04, 28/03

notify pgrst, 'reload schema';
