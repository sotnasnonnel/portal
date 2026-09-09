-- Torre: de-para de "centro de custo" para RESPONSÁVEL
-- ============================================================================
-- O PROBLEMA (revisão da Torre, item adiado)
--
-- O filtro "Centro de custo" da Torre mistura duas coisas que nunca se
-- encontram, porque cada lado guarda o CC de um jeito:
--
--   chamado do Adm    campos->>'cc'  = "Equipe LUCAS FERRAZ GONCALVES"  (13 valores)
--   mobilização       cod_ct         = "ATNI-CT01"                      (44 valores)
--
-- Resultado: 57 opções no seletor, metade nome e metade código, e filtrar por
-- uma pessoa não traz o trabalho dela — traz metade dele.
--
-- O QUE A REVISÃO PEDIU: "Relacionar os códigos dos projetos aos nomes e deixar
-- apenas os nomes no filtro."
--
-- ONDE ESTAVA A BASE (a pergunta que ficou esperando o Lennon)
--
-- Em dois lugares, os dois já dentro do banco:
--
--   1. A PRÓPRIA PLANILHA. 126 dos 130 processos (97%) já trazem o responsável
--      escrito: as colunas GER PHD e COO PHD viraram mobilizacao_processos.
--      ger_phd / coo_phd. É a fonte mais atual, porque o time a mantém.
--
--   2. horas_projetos.origem_cod_phd -> gerencia_id -> horas_gerencias.nome.
--      É o mesmo horas_gerencias de onde o Adm tira o "Equipe X", então esse
--      caminho fecha o círculo. Cobre 28 dos 36 códigos em uso — os contratos
--      novos (GERD-CT21/23/25, VALE-CT01/05, TERE-CT02, ADMB-CT27/29...) ainda
--      não entraram lá, porque aquela carga foi única.
--
--      ATENÇÃO: cada código aparece DUAS vezes em horas_projetos — o projeto e
--      uma sombra "PBI-<codigo>", toda atribuída à mesma equipe de BI. Sem
--      descartar as sombras, metade dos códigos apontaria para a pessoa errada.
--
-- POR QUE UMA TABELA, E NÃO UMA REGRA NO CÓDIGO
--
-- Porque o casamento de nomes é aproximado ("PAULO PAIVA" -> "PAULO CEZAR DE
-- PAIVA NETO") e aproximação precisa ser CONFERÍVEL. Numa tabela, o time olha,
-- corrige a linha errada e pronto. Escondida numa função, cada correção vira
-- deploy — e ninguém de fora consegue auditar por que a Torre atribuiu o
-- trabalho a fulano.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Normalização de nome: sem acento, sem caixa, sem espaço sobrando.
-- IMMUTABLE porque é usada dentro de índice e de comparação em massa.
-- ---------------------------------------------------------------------------
create or replace function app_private.torre_nome_norm(p_texto text)
returns text
language sql
immutable
as $$
  select upper(trim(regexp_replace(
    translate(coalesce(p_texto, ''),
              'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
              'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '\s+', ' ', 'g')));
$$;

create table if not exists public.torre_responsavel_de_para (
  -- A chave é o valor CRU, exatamente como aparece no dado de origem: pode ser
  -- "Equipe LUCAS FERRAZ GONCALVES", "PAULO PAIVA" ou "ATNI-CT01-GERE". Guardar
  -- o cru (e não uma versão normalizada) é o que deixa a tabela legível para
  -- quem for conferir: a linha diz de onde veio.
  chave           text primary key,
  colaborador_id  uuid references public.colaboradores(id) on delete set null,
  nome            text not null,
  origem          text not null check (origem in ('equipe_adm', 'nome_planilha', 'codigo_projeto')),
  -- false = casamento automático, ainda não olhado por gente. A tela não
  -- distingue os dois; a coluna existe para o time saber o que revisar.
  conferido       boolean not null default false,
  observacao      text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

comment on table public.torre_responsavel_de_para is
  'De-para de centro de custo (equipe do Adm, nome da planilha ou código de projeto) para o responsável canônico da Torre.';

create index if not exists torre_de_para_colaborador_idx
  on public.torre_responsavel_de_para (colaborador_id);

alter table public.torre_responsavel_de_para enable row level security;

-- Leitura para qualquer logado: sem ela o seletor da Torre nasce vazio, e a
-- tabela não guarda nada sensível — é nome de equipe e código de contrato.
drop policy if exists torre_de_para_select on public.torre_responsavel_de_para;
create policy torre_de_para_select on public.torre_responsavel_de_para
  for select to authenticated using (true);

-- Escrita só para o admin do Adm, o mesmo que já configura catálogo e SLA.
drop policy if exists torre_de_para_write on public.torre_responsavel_de_para;
create policy torre_de_para_write on public.torre_responsavel_de_para
  for all to authenticated
  using (app_private.is_adm_admin())
  with check (app_private.is_adm_admin());

revoke all on public.torre_responsavel_de_para from anon;

-- ---------------------------------------------------------------------------
-- SEMEADURA
--
-- É `on conflict do nothing` de propósito: rodar de novo acrescenta o que
-- apareceu de novo e NÃO desfaz correção feita à mão. Uma linha conferida por
-- gente vale mais que o palpite do casamento automático.
-- ---------------------------------------------------------------------------

-- Candidatos: todo valor cru que a Torre pode encontrar, dos três formatos.
create or replace view app_private.torre_de_para_candidatos as
  -- 1. Equipes do Adm (campos->>'cc' dos chamados).
  select distinct trim(c.campos ->> 'cc') as chave,
         regexp_replace(trim(c.campos ->> 'cc'), '^Equipe\s+', '', 'i') as nome_bruto,
         'equipe_adm'::text as origem
    from public.chamados_adm c
   where coalesce(trim(c.campos ->> 'cc'), '') <> ''

  union
  -- 2. Nomes escritos na planilha de mobilização (gerente e coordenador).
  select distinct trim(p.ger_phd), trim(p.ger_phd), 'nome_planilha'
    from public.mobilizacao_processos p where coalesce(trim(p.ger_phd), '') <> ''
  union
  select distinct trim(p.coo_phd), trim(p.coo_phd), 'nome_planilha'
    from public.mobilizacao_processos p where coalesce(trim(p.coo_phd), '') <> ''

  union
  -- 3. Códigos de projeto, resolvidos pela cadeia horas_projetos -> gerência.
  --    O filtro `nome not like 'PBI-%'` descarta a sombra de BI; sem ele cada
  --    código traria duas equipes e a errada poderia ganhar.
  select distinct hp.origem_cod_phd,
         regexp_replace(hg.nome, '^Equipe\s+', '', 'i'),
         'codigo_projeto'
    from public.horas_projetos hp
    join public.horas_gerencias hg on hg.id = hp.gerencia_id
   where hp.origem_cod_phd is not null and hp.nome not like 'PBI-%';

-- O casamento: o nome cru bate com o colaborador cujo nome completo contém
-- TODOS os pedaços dele. "PAULO PAIVA" acha "PAULO CEZAR DE PAIVA NETO".
--
-- Só entra quando o resultado é ÚNICO. Nome que casa com duas pessoas fica de
-- fora e aparece na conferência do fim — um chute aqui atribuiria o trabalho de
-- alguém a outra pessoa, em silêncio, e é exatamente o erro que a Torre não
-- pode cometer.
insert into public.torre_responsavel_de_para (chave, colaborador_id, nome, origem)
select cand.chave, unico.id, unico.nome, cand.origem
  from app_private.torre_de_para_candidatos cand
  cross join lateral (
    select c.id, c.nome
      from public.colaboradores c
     where (select bool_and(app_private.torre_nome_norm(c.nome) like '%' || app_private.torre_nome_norm(t) || '%')
              from regexp_split_to_table(cand.nome_bruto, '\s+') t)
     limit 2
  ) unico
 where (select count(*) from public.colaboradores c2
         where (select bool_and(app_private.torre_nome_norm(c2.nome) like '%' || app_private.torre_nome_norm(t) || '%')
                  from regexp_split_to_table(cand.nome_bruto, '\s+') t)) = 1
on conflict (chave) do nothing;

-- Segunda passada: o que NÃO casou com pessoa entra mesmo assim, sem vínculo.
--
-- É o caso de "Gerência Geral" (um centro corporativo, que não é pessoa) e de
-- nome ambíguo como "ALEX SILVA". O rótulo continua sendo um NOME, que é o que
-- o filtro precisa; o que falta é só a ligação com o cadastro — e ela não muda
-- o que a tela mostra, muda a possibilidade de consolidar duas grafias da mesma
-- pessoa numa opção só.
--
-- Sem esta passada, esses itens cairiam todos em "(nao identificado)", que é
-- pior: some a informação que existe.
insert into public.torre_responsavel_de_para (chave, colaborador_id, nome, origem, observacao)
select cand.chave, null, cand.nome_bruto, cand.origem,
       'Sem vínculo com o cadastro: nome não casou com nenhum colaborador, ou casou com mais de um.'
  from app_private.torre_de_para_candidatos cand
 where not exists (select 1 from public.torre_responsavel_de_para d where d.chave = cand.chave)
on conflict (chave) do nothing;

notify pgrst, 'reload schema';

-- ============================================================================
-- RESULTADO EM 09/09/2026
--
--   115 chaves -> 23 nomes distintos (105 com vínculo, 10 sem).
--   O filtro da Torre saiu de 57 opções misturadas para 14 nomes de fato em uso.
--   Cobertura: 124 de 132 linhas de mobilização e 88 de 95 chamados.
--   Os 15 restantes são 4 processos sem gerente na planilha e 7 chamados sem
--   centro de custo preenchido — vão para "(nao identificado)", que é uma opção
--   do filtro e não uma linha escondida.
--
-- CONFERÊNCIA — rode isto e olhe o resultado antes de dar por pronto.
--
-- (1) O que NÃO casou. São os que a Torre vai mostrar como "não identificado".
--     Para resolver, insira a linha à mão com o colaborador certo:
--
--       insert into public.torre_responsavel_de_para (chave, colaborador_id, nome, origem, conferido)
--       select 'ALEX SILVA', id, nome, 'nome_planilha', true
--         from public.colaboradores where nome = '<o nome certo>';
--
-- (2) Os casamentos que merecem um olhar: nome curto que virou nome comprido.
--     A conta acerta quase sempre, mas alguns homônimos são reais — há pessoas
--     que aparecem tanto como responsável quanto como profissional mobilizado.
-- ============================================================================

-- (1) sem de-para
select cand.origem, cand.chave, cand.nome_bruto
  from app_private.torre_de_para_candidatos cand
 where not exists (select 1 from public.torre_responsavel_de_para d where d.chave = cand.chave)
 order by 1, 2;

-- (2) casamentos aproximados, para revisão
select d.origem, d.chave, d.nome as virou, d.conferido
  from public.torre_responsavel_de_para d
 where app_private.torre_nome_norm(d.chave) <> app_private.torre_nome_norm(d.nome)
   and d.origem <> 'codigo_projeto'
 order by 1, 2;
