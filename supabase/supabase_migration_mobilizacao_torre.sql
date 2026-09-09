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
    null::uuid                 as processo_id,
    null::text                 as obra,
    null::text                 as gestor,
    null::text                 as obra_cod_phd,
    -- Responsável pelo CONTRATO (não pelo atendimento). Ver
    -- supabase_migration_torre_responsavel.sql: é o que o filtro da Torre usa,
    -- porque `cc` cru nunca funcionou como filtro — cada lado guarda um formato.
    d.nome                     as responsavel_contrato
  from public.chamados_adm c
  left join public.torre_responsavel_de_para d
    on d.chave = trim(c.campos ->> 'cc')
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
    null::text,
    p.id,
    p.cod_ct,
    p.ger_phd,
    p.cod_phd,
    d.nome
  from public.mobilizacao_etapas e
  join public.mobilizacao_processos p on p.id = e.processo_id
  -- A ordem do coalesce é a ordem de CONFIANÇA: o nome que a planilha escreveu
  -- vale mais que o código, porque é o time que o mantém e ele não depende de a
  -- carga de horas_projetos estar em dia. Gerente antes de coordenador, para
  -- casar com o "Equipe X" do Adm, que é a gerência.
  left join public.torre_responsavel_de_para d
    on d.chave = coalesce(nullif(trim(p.ger_phd), ''), nullif(trim(p.coo_phd), ''),
                          nullif(trim(p.cod_phd), ''), nullif(trim(p.cod_ct), ''))
  where p.status <> 'cancelado'
    and (e.status not in ('concluida', 'dispensada')
      or e.data_real >= current_date - 15);

alter view public.mobilizacao_torre_v set (security_invoker = on);

revoke all on public.mobilizacao_torre_v from public, anon;
grant select on public.mobilizacao_torre_v to authenticated;

-- Nomes de pessoas NÃO entram na view: a policy de colaboradores não deixaria,
-- e o join devolveria nulo calado. Quem resolve é o cliente, com uma chamada de
-- rpc('nomes_colaboradores') para a lista inteira — o padrão que listarQuadro e
-- listarFila já usam.

notify pgrst, 'reload schema';

-- ============================================================================
-- HISTÓRICO DESTE ARQUIVO
--
-- Em 09/09/2026 a view em PRODUÇÃO estava à frente deste arquivo: alguém
-- aplicou à mão as colunas `obra`, `gestor` e `obra_cod_phd`, e o repositório
-- não sabia. Elas estão preservadas acima, com o mesmo conteúdo que tinham.
--
-- Duas coisas para lembrar ao mexer aqui de novo:
--
--   1. `create or replace view` NÃO deixa inserir coluna no meio nem reordenar
--      — só acrescentar no fim. Foi por isso que `responsavel_contrato` ficou
--      por último, e não ao lado de `cc`, onde faria mais sentido ler.
--
--   2. Antes de editar, rode `pg_get_viewdef('public.mobilizacao_torre_v')` e
--      compare com este arquivo. Se divergirem de novo, a produção é a verdade
--      e este arquivo é que precisa ser atualizado primeiro — sobrescrever sem
--      olhar apagaria a coluna que alguém precisava.
-- ============================================================================
