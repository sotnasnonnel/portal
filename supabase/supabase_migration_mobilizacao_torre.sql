-- Migration: torre de controle (projeto bogsuuhrgvopzgcceoqz)
-- ============================================================================
-- Um quadro só com os chamados do Administrativo e as etapas de Mobilização.
--
-- É o mesmo pessoal que toca os dois, e hoje precisa abrir duas telas para
-- saber o que está aberto e o que venceu.
--
-- UMA VIEW, e não duas listagens costuradas no cliente: duas idas ao banco
-- seriam dois recortes que podem discordar, e o `union all` aqui deixa a
-- ordenação e a paginação com o Postgres.
--
-- O VOCABULÁRIO comum (a fazer / em andamento / aguardando / concluído) NÃO é
-- traduzido aqui: fica em src/modules/mobilizacao/lib/torre.js, puro e testado
-- contra os status dos DOIS módulos, de modo que um status novo quebra o teste
-- em vez de sumir calado do quadro. A view entrega o status cru de cada lado.
-- ============================================================================

create or replace view public.mobilizacao_torre_v as
  select
    'adm'::text                as origem,
    c.id                       as id,
    c.numero                   as numero,
    c.assunto                  as titulo,
    c.status                   as status,
    c.atendente_id             as responsavel_id,
    c.sla_vence_em::date       as prazo,
    c.criado_em                as criado_em,
    c.campos ->> 'cc'          as cc,
    null::uuid                 as processo_id
  from public.chamados_adm c
  -- Mesma janela do listarQuadro do Adm: encerrado antigo não é o que se olha,
  -- e sem o corte a torre cresce para sempre.
  where c.status not in ('fechado', 'reprovado', 'cancelado')
     or c.updated_at >= now() - interval '15 days'

  union all

  select
    'mobilizacao'::text,
    e.id,
    p.numero,
    e.titulo,
    e.status,
    e.responsavel_id,
    e.data_prevista,
    p.criado_em,
    p.cod_ct,
    p.id
  from public.mobilizacao_etapas e
  join public.mobilizacao_processos p on p.id = e.processo_id
  where p.status <> 'cancelado'
    and (e.status not in ('concluida', 'dispensada')
      or e.data_real >= current_date - 15);

-- OBRIGATÓRIO, e fácil de esquecer: sem isto a view roda com os direitos do
-- DONO e devolve a base inteira, ignorando a RLS das tabelas de baixo. Com ele,
-- cada policy continua valendo e quem não é do time vê o que já veria.
alter view public.mobilizacao_torre_v set (security_invoker = on);

revoke all on public.mobilizacao_torre_v from public, anon;
grant select on public.mobilizacao_torre_v to authenticated;

-- Nomes de pessoas NÃO entram na view: a policy de colaboradores não deixaria,
-- e o join devolveria nulo calado. Quem resolve é o cliente, com uma chamada de
-- rpc('nomes_colaboradores') para a lista inteira — o padrão que listarQuadro e
-- listarFila já usam.

notify pgrst, 'reload schema';
