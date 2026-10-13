-- Migration: e-mail na lista de aniversariantes (bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Pedido do usuário (13/10/2026): na Home, o aniversariante do dia ganha um
-- botão "Dar parabéns" que abre a conversa do Teams com a pessoa, já com uma
-- mensagem pronta. O link do Teams precisa do e-mail corporativo, que a RPC
-- não devolvia. (A migration original dizia "sem botão de mensagem": a decisão
-- mudou.)
--
-- Continua sem a data completa de nascimento: só o DIA.
--
-- Sem dependência de deploy: o front só mostra o botão quando o e-mail vem, então
-- tanto faz aplicar antes ou depois do front novo.
--
-- O tipo de retorno muda, então a função é recriada (create or replace não
-- troca colunas de saída).

drop function if exists public.aniversariantes_mes(int);

create function public.aniversariantes_mes(p_mes int default null)
returns table (colaborador_id uuid, nome text, funcao text, tipo text, dia int, anos_casa int, email text)
language sql stable security definer set search_path = '' as $$
  with ref as (
    select coalesce(p_mes, extract(month from app_private.hoje_brasil())::int) as mes,
           extract(year from app_private.hoje_brasil())::int as ano
  )
  select c.id, c.nome, c.funcao, 'aniversario', extract(day from c.data_nascimento)::int, null::int, c.email
    from public.colaboradores c cross join ref
   where c.ativo is distinct from false
     and c.data_nascimento is not null
     and extract(month from c.data_nascimento)::int = ref.mes
  union all
  select c.id, c.nome, c.funcao, 'tempo_casa', extract(day from c.data_admissao)::int,
         ref.ano - extract(year from c.data_admissao)::int, c.email
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
