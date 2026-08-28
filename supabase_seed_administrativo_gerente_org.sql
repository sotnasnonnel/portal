-- Seed: aprovador do Administrativo = GER PHD (org.xlsx)
-- (projeto bogsuuhrgvopzgcceoqz) -- decisao da diretoria, ago/2026
--
-- A coluna GER PHD de org.xlsx e a fonte de verdade de QUEM aprova o chamado do
-- Administrativo. Ela substitui a escada Coordenador -> Gerente para as pessoas
-- listadas: a cadeia delas passa a ser UMA etapa, o gerente da planilha.
--
-- Nao mexe em regra nenhuma de codigo: grava em chamados_adm_fluxos, que ja tem
-- precedencia sobre a escada do organograma (ver cabecaDaCadeia em
-- src/modules/administrativo/lib/chamados.js). A alcada por valor continua
-- somando depois, inalterada. Quem NAO esta aqui segue no automatico.
--
-- Quem ficou de fora, de proposito:
--   * 5 gerentes que a planilha lista sob o proprio nome (aprovariam a si mesmos);
--   * 4 marcados "Sem Gerente" -- Nery, Pedro Morais, Daniela Sebrian e Henrique
--     Santos, que sao o topo e nao tem a quem subir;
--   * inativos, barrados pelo c.ativo = true abaixo.
--
-- Os 9 casos em que a planilha trazia a pessoa duas vezes com gerentes diferentes
-- foram decididos pela diretoria e ja entram resolvidos aqui.
--
-- Idempotente: reexecutar reafirma as mesmas cadeias.
-- ============================================================================

with mapa(ger, membros) as (values
  ('eduardo.eler', 'alexander.rodrigues pedro.filho gutemberg.silva paulo.junior joao.catarino matheus.dias thales.padua marcio.junior marcos.chaves mauro.filho jakeline.felix diego.rodrigues yan.moreira gustavo.lana andrey.sousa jader.correa'),
  ('leonardo.drumond', 'jeferson.expedito paulohenrique.costa talles.goncalves thiago.letro aline.lage diogo.soares alexandre.moreira arthur.andrade fernando.menezes carlos.vasconcelos felipe.costanzi wantuil.oliveira luiz.fernandes renata.costa deividy.gomes geraldo.oliveira roberto.espinosa fabricio.souza julio.cesar paulo.paiva tulio.rafael'),
  ('andre.guimaraes', 'milena.neves lennon.santos vinicius.costa'),
  ('ivano.cruz', 'marlon.mueller mateus.cerejo michel.santos lucas.assis rodrigo.teixeira daniel.carlos alessandro.moreira jefferson.magalhaes rodrigo.brandolt raykleison.costa'),
  ('tulio.rafael', 'fabio.santos roney.silva ramon.medeiros artur.januth diego.antunes raimundo.silva matheus.morais mateus.souza marcelo.lima divino.santos lucas.zacarias silas.moreira yitalon.brito guilherme.silva rodolpho.fonseca victor.aguiar pedro.chaves getulio.pedrosa'),
  ('paulo.paiva', 'adailton.andrade nilton.netto wanderson.silva andre.campos luiz.lopes francisco.junior fernanda.ligorio matheus.pera angela.campos arthur.benedito hudson.vilela gabriel.abud marcos.ferrais roberto.medeiros polyane.lanes'),
  ('daniela.sebrian', 'alessandra.sobral edijane.rodrigues jarbas.junior marlene.mozer mauricio.silva perla.passos alinne.oliveira leticia.nascimento'),
  ('henrique.santos', 'andre.gomes daniel.almeida mylena.zoqbi ana.caldeira fernando.silva'),
  ('pedro.morais', 'anaclaudia.costa lucas.ferraz maicon.morais tamiris.machado washington.maciel'),
  ('bruno.azevedo', 'ronaldo.machado brendo.lopes daniel.sousa eduardo.ferreira fabio.oliveira filiphe.santos giovanna.braga icaro.bahia ivan.silva karine.vitoria paulo.anastacio pietro.rosa rhavi.soares tainara.rodrigues victor.mota yan.silva gustavo.marques jose.vargas mariana.silva matheus.costa igor.guilherme')
),
pares as (
  select ger, unnest(string_to_array(membros, ' ')) as pes from mapa
)
insert into public.chamados_adm_fluxos (solicitante_id, classe, aprovadores, updated_at)
select c.id, '', array[g.id], now()
  from pares p
  join public.colaboradores c on lower(c.email) = p.pes || '@phdengenharia.eng.br' and c.ativo = true
  join public.colaboradores g on lower(g.email) = p.ger || '@phdengenharia.eng.br' and g.ativo = true
on conflict (solicitante_id, classe)
do update set aprovadores = excluded.aprovadores, updated_at = now();
