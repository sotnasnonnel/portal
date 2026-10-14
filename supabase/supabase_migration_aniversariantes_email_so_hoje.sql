-- Migration: e-mail só de quem faz aniversário HOJE (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Corrige supabase_migration_aniversariantes_email.sql (13/10/2026).
--
-- O problema: a RPC é security definer (passa por cima da RLS de
-- colaboradores) e aceita p_mes. Pedindo os 12 meses, qualquer logado montava
-- a lista de nome + cargo + e-mail de quase todo colaborador ativo.
--
-- O único uso do e-mail é o botão "Dar parabéns" da Home, que só aparece para
-- quem faz aniversário no dia. Então a RPC devolve o e-mail só nessas linhas;
-- nas demais (outros dias, outros meses, tempo de casa) ele vem null.
--
-- Sem dependência de deploy: o front já esconde o botão quando o e-mail vem
-- null, e o tipo de retorno não muda (create or replace basta).

create or replace function public.aniversariantes_mes(p_mes int default null)
returns table (colaborador_id uuid, nome text, funcao text, tipo text, dia int, anos_casa int, email text)
language sql stable security definer set search_path = '' as $$
  with ref as (
    select coalesce(p_mes, extract(month from app_private.hoje_brasil())::int) as mes,
           extract(year from app_private.hoje_brasil())::int as ano,
           extract(month from app_private.hoje_brasil())::int as mes_hoje,
           extract(day from app_private.hoje_brasil())::int as dia_hoje
  )
  select c.id, c.nome, c.funcao, 'aniversario', extract(day from c.data_nascimento)::int, null::int,
         case
           when ref.mes = ref.mes_hoje
            and extract(day from c.data_nascimento)::int = ref.dia_hoje
           then c.email
         end
    from public.colaboradores c cross join ref
   where c.ativo is distinct from false
     and c.data_nascimento is not null
     and extract(month from c.data_nascimento)::int = ref.mes
  union all
  select c.id, c.nome, c.funcao, 'tempo_casa', extract(day from c.data_admissao)::int,
         ref.ano - extract(year from c.data_admissao)::int, null::text
    from public.colaboradores c cross join ref
   where c.ativo is distinct from false
     and c.data_admissao is not null
     and extract(month from c.data_admissao)::int = ref.mes
     and ref.ano - extract(year from c.data_admissao)::int >= 1
  order by 5, 2
$$;
revoke all on function public.aniversariantes_mes(int) from public;
revoke execute on function public.aniversariantes_mes(int) from anon;
grant execute on function public.aniversariantes_mes(int) to authenticated;

notify pgrst, 'reload schema';
