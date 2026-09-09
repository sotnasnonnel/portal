-- ============================================================================
-- Aprovação de ausência: fila só com os subordinados DIRETOS, por pessoa
-- (projeto bogsuuhrgvopzgcceoqz — rodar no SQL Editor, como postgres)
--
-- A fila de /gestor/aprovacoes e o badge de pendências da sidebar usam
-- `get_minha_equipe()`, que é RECURSIVA: devolve a árvore inteira abaixo da
-- pessoa. Para quem está no topo do organograma isso não é uma equipe, é a
-- empresa — o CEO recebia as 155 pessoas da árvore dele, incluindo gente três
-- e quatro níveis abaixo que já tem gestor imediato para decidir.
--
-- POR QUE POR PESSOA, e não mudando `get_minha_equipe()` para todo mundo: a
-- recursão existe de propósito. O gestor de um coordenador precisa enxergar a
-- equipe do coordenador, senão a ausência dorme quando o coordenador falta.
-- Cortar a recursão no geral consertaria o topo e quebraria o meio.
--
-- POR QUE NÃO É "tirar o acesso": ele continua enxergando a árvore toda no
-- Organograma, na Minha Equipe e no Dashboard. O que muda é só a FILA — o que
-- é apresentado como pendência dele para decidir.
--
-- A ausência não fica órfã: ela continua na fila do gestor imediato, que é
-- quem sempre decidiu. O que some é a cópia que subia até o topo.
-- ============================================================================

alter table public.colaboradores
  add column if not exists ausencias_apenas_diretos boolean not null default false;

comment on column public.colaboradores.ausencias_apenas_diretos is
  'true limita a FILA de aprovação de ausência aos subordinados diretos, em '
  'vez da árvore recursiva inteira. Não mexe no que a pessoa enxerga no '
  'Organograma, na Minha Equipe nem no Dashboard.';

-- Equipe que alimenta a FILA de aprovação de ausência. Separada de
-- `get_minha_equipe()` de propósito: aquela é "quem está abaixo de mim" e é
-- usada por várias telas; esta é "quem eu decido", que é outra pergunta.
create or replace function public.get_minha_equipe_aprovacoes()
returns table(id uuid)
language sql stable security definer set search_path to '' as $$
  with eu as (
    select c.id, c.ausencias_apenas_diretos
      from public.colaboradores c
     where c.id = app_private.my_colaborador_id()
  )
  select c.id
    from public.colaboradores c, eu
   where c.superior_id = eu.id
     and eu.ausencias_apenas_diretos
  union
  select d.id
    from app_private.descendentes((select id from eu)) as d(id), eu
   where not eu.ausencias_apenas_diretos
$$;

-- Pedro Nery (CEO): topo do organograma, 155 pessoas na árvore e 4 diretos.
update public.colaboradores
   set ausencias_apenas_diretos = true
 where email = 'pedro.nery@phdengenharia.eng.br';

notify pgrst, 'reload schema';
