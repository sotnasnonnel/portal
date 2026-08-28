-- ============================================================================
-- Carga única: obras do ORGANOGRAMA (backoffice_phd) -> horas_projetos (portal)
-- ============================================================================
-- Origem : dvvqgoxqawyhycakppps.organograma_obra, snapshot de 2026-07-23
--          (84 obras com status='ATIVO'; nenhuma INATIVA existia na origem)
-- Destino : bogsuuhrgvopzgcceoqz.horas_projetos
--
-- Por que um snapshot e não uma leitura ao vivo: são dois projetos Supabase
-- distintos, não há FK possível entre eles. Esta é uma carga PONTUAL — a partir
-- daqui a manutenção volta a ser manual, pela tela Configuração da Área.
--
-- Nomenclatura: nome = cod_phd (ex.: ADMB-CT10-GRMS), a mesma granularidade que
-- o Financeiro já usa como "contrato" em modules/financeiro/.../contratos.js.
-- O prefixo "PBI-" dos 2 projetos já existentes NÃO é convenção geral: é o tipo
-- de entrega do time de PMO (Power BI por contrato), por isso não se repete aqui.
--
-- Cliente: vem de contratos_realizados.cliente_phd, casando por cod_phd e, na
-- falta, pelo prefixo de 4 letras do cod_ct. Cobre ~40 das 84; o resto fica NULL
-- (o campo é opcional). Mantido em CAIXA ALTA como na origem — ajuste pela tela
-- se preferir "ADM do Brasil" ao invés de "ADM DO BRASIL".
--
-- SEGURO DE RODAR AGORA: horas_apontamentos e horas_timer_ativo estão VAZIAS
-- (0 linhas), então nenhum histórico depende de projeto_id.
--
-- Idempotente: o NOT EXISTS impede duplicar em uma segunda execução.
-- Reversível: DELETE FROM horas_projetos WHERE origem_cod_phd IS NOT NULL;
-- ============================================================================

begin;

-- Marca a procedência para tornar a carga rastreável e reversível, e para não
-- confundir projeto vindo do organograma com projeto criado à mão na tela.
alter table public.horas_projetos
  add column if not exists origem_cod_phd text;

comment on column public.horas_projetos.origem_cod_phd is
  'cod_phd da obra no organograma (backoffice_phd) quando o projeto veio da carga inicial; NULL para projetos criados manualmente.';

with map_gerente(curto, gerencia_nome) as (values
  ('Eduardo Eler',     'Equipe EDUARDO DOS REIS ELER'),
  ('Paulo Paiva',      'Equipe PAULO CEZAR DE PAIVA NETO'),
  ('Ivano Cruz',       'Equipe IVANO ROBERTO SILVA DA CRUZ'),
  ('Tulio Morais',     'Equipe TULIO RAFAEL DE MORAIS NEIVA'),
  ('Leonardo Drumond', 'Equipe LEONARDO AUGUSTO OLIVEIRA DRUMOND'),
  ('Pedro Morais',     'Equipe PEDRO HENRIQUE BRAGA DE MORAIS'),
  ('André Guimaraes',  'Equipe ANDRE LUIZ COSTA GUIMARAES'),
  ('Bruno Azevedo',    'Equipe BRUNO ALBERTO AZEVEDO')
),
-- Cor por produto, dentro da paleta de modules/horas/lib/cores.js.
map_cor(produto, cor) as (values
  ('GERE',  '#26405d'),
  ('PLAN',  '#00a49a'),
  ('LPS',   '#C44A28'),
  ('EXCE',  '#F59E0B'),
  ('CONST', '#b85236'),
  ('BIM',   '#9a3412'),
  ('',      '#64748b')   -- centros corporativos (CORP>, CSPI>GDB)
),
obras(cod_phd, gerente_curto, cliente, produto) as (values
  ('ADMB-CT10-GRMS', 'Eduardo Eler',     'ADM DO BRASIL',        'GERE'),
  ('ADMB-CT16-PORT', 'Leonardo Drumond', 'ADM DO BRASIL',        'GERE'),
  ('ADMB-CT17-ROND', 'Eduardo Eler',     'ADM DO BRASIL',        'GERE'),
  ('ADMB-CT20-GERE', 'Eduardo Eler',     'ADM DO BRASIL',        'GERE'),
  ('ADMB-CT21-GERE', 'Eduardo Eler',     'ADM DO BRASIL',        'GERE'),
  ('ADMB-CT22-GERE', 'Eduardo Eler',     'ADM DO BRASIL',        'GERE'),
  ('ADMB-CT25-GERE', 'Eduardo Eler',     'ADM DO BRASIL',        'GERE'),
  ('ASCE-CT02-SUMA', 'Eduardo Eler',     'ASCENTY',              'GERE'),
  ('ATER-CT04-PLAN', 'Ivano Cruz',       null,                   'PLAN'),
  ('ATNI-CT01-GERE', 'Tulio Morais',     null,                   'GERE'),
  ('AURA-CT01-GERE', 'Leonardo Drumond', null,                   'GERE'),
  ('AURA-CT02-GUAT', 'Leonardo Drumond', null,                   'GERE'),
  ('AURA-CT03-BORB', 'Leonardo Drumond', null,                   'GERE'),
  ('AURA-CT04-ALMA', 'Leonardo Drumond', null,                   'GERE'),
  ('AURA-CT05-HOND', 'Leonardo Drumond', null,                   'GERE'),
  ('AURA-CT06-EDMX', 'Leonardo Drumond', null,                   'GERE'),
  ('AURA-CT07-ENBH', 'Leonardo Drumond', null,                   'GERE'),
  ('AURI-CT01-GERE', 'Paulo Paiva',      'AURIVERDE',            'GERE'),
  ('AUSE-CT01-PLAN', 'Ivano Cruz',       null,                   'PLAN'),
  ('BEMI-CT02-GERE', 'Paulo Paiva',      'BEMISA',               'GERE'),
  ('CCAP-CT15-PLAN', 'Paulo Paiva',      'CONSTRUCAP',           'PLAN'),
  ('CCAP-CT17-ARAU', 'Paulo Paiva',      'CONSTRUCAP',           'PLAN'),
  ('CCAP-CT18-PLAN', 'Paulo Paiva',      'CONSTRUCAP',           'PLAN'),
  ('CCAP-CT19-ACEL', 'Paulo Paiva',      'CONSTRUCAP',           'PLAN'),
  ('CCAP-CT20-SUPR', 'Ivano Cruz',       'CONSTRUCAP',           'PLAN'),
  ('CGCO-CT01-PLAN', 'Paulo Paiva',      'CG CONSTRUÇÕES',       'PLAN'),
  ('CIVM-CT01-PLAN', 'Paulo Paiva',      'CIVIL MASTER',         'PLAN'),
  ('COFC-CT01-GEST', 'André Guimaraes',  null,                   'PLAN'),
  ('CORP>ADM',       'Pedro Morais',     null,                   ''),
  ('CORP>COM',       'Pedro Morais',     null,                   ''),
  ('CORP>DIR',       null,               null,                   ''),
  ('CORP>FIN',       'Pedro Morais',     null,                   ''),
  ('CORP>INV',       'André Guimaraes',  null,                   ''),
  ('CORP>MKT',       null,               null,                   ''),
  ('CORP>PMO',       'André Guimaraes',  null,                   ''),
  ('CORP>QUAL',      'Ivano Cruz',       null,                   ''),
  ('CORP>RH',        null,               null,                   ''),
  ('COTR-CT01-LPSA', 'Eduardo Eler',     null,                   'LPS'),
  ('CRET-CT01-PLAN', 'Tulio Morais',     'CRETA',                'PLAN'),
  ('CRET-CT01-TANQ', 'Tulio Morais',     'CRETA',                'PLAN'),
  ('CSPI>BIM',       null,               null,                   'BIM'),
  ('CSPI>GBA',       'Bruno Azevedo',    null,                   'CONST'),
  ('CSPI>GDB',       null,               null,                   ''),
  ('CSPI>GEE',       'Eduardo Eler',     null,                   ''),
  ('CSPI>GIC',       'Ivano Cruz',       null,                   'PLAN'),
  ('CSPI>GLD',       'Leonardo Drumond', null,                   'PLAN'),
  ('ELEV-CT02-PLAN', null,               null,                   'PLAN'),
  ('ENGF-CT03-PLAN', 'Tulio Morais',     'ENGEFORM',             'PLAN'),
  ('ENGF-CT04-LNTR', 'Tulio Morais',     'ENGEFORM',             'PLAN'),
  ('FIDE-CT02-PDER', 'Paulo Paiva',      null,                   'PLAN'),
  ('GCES-CT01-PLAN', 'Paulo Paiva',      null,                   'PLAN'),
  ('GERD-CT14-PIND', 'Paulo Paiva',      'GERDAU',               'GERE'),
  ('GOIA-CT01-GERE', 'Ivano Cruz',       null,                   'GERE'),
  ('GOIA-CT02-GERE', 'Ivano Cruz',       null,                   'GERE'),
  ('GONT-CT02-EXCE', 'Eduardo Eler',     null,                   'GERE'),
  ('HERC-CT01-GERE', 'Paulo Paiva',      'HERCULANO MINERAÇÃO',  'GERE'),
  ('IMCS-CT09-PLAN', 'Tulio Morais',     'IMC SASTE',            'PLAN'),
  ('INOV-CT01-GERE', 'Eduardo Eler',     null,                   'EXCE'),
  ('JMAL-CT01-PLAN', 'Ivano Cruz',       'JMALUCELLI',           'PLAN'),
  ('JMAL-CT02-PLAN', 'Ivano Cruz',       'JMALUCELLI',           'PLAN'),
  ('MONT-CT01-EXCE', 'Eduardo Eler',     null,                   'EXCE'),
  ('MROS-CT02-CAIN', 'Eduardo Eler',     null,                   'LPS'),
  ('MROS-CT03-PLAN', 'Eduardo Eler',     null,                   'LPS'),
  ('NEXA-CT03-GERE', 'Paulo Paiva',      null,                   'GERE'),
  ('NOBR-CT06-GERE', null,               'NÓBREGA PIMENTA',      'GERE'),
  ('NOBR-CT07-MOSA', null,               'NÓBREGA PIMENTA',      'GERE'),
  ('OPER>BIM',       null,               null,                   'BIM'),
  ('OPER>CONST',     'Bruno Azevedo',    null,                   'CONST'),
  ('OPER>QUAL',      'Ivano Cruz',       null,                   'PLAN'),
  ('PARE-CT04-P1P3', 'Eduardo Eler',     'PAREX',                'LPS'),
  ('PAVI-CT01-PLAN', 'Ivano Cruz',       null,                   'PLAN'),
  ('REDE-CT01-EXCE', 'Eduardo Eler',     null,                   'EXCE'),
  ('REFR-CT03-EXCE', 'Eduardo Eler',     'REFRAMAX',             'EXCE'),
  ('REFR-CT05-EXCE', 'Eduardo Eler',     'REFRAMAX',             'EXCE'),
  ('SALU-CT04-DISP', 'Tulio Morais',     null,                   'PLAN'),
  ('SALU-CT08-TAMA', 'Paulo Paiva',      null,                   'PLAN'),
  ('SALU-CT09-COBR', 'Paulo Paiva',      null,                   'PLAN'),
  ('SALU-CT11-DTOR', 'Paulo Paiva',      null,                   'PLAN'),
  ('SEEL-CT01-LPSA', 'Eduardo Eler',     null,                   'LPS'),
  ('SUPE-CT01-EXCE', 'Eduardo Eler',     'SUPERUS',              'EXCE'),
  ('U&MM-CT02-PLAN', 'Tulio Morais',     'U&M',                  'PLAN'),
  ('VABM-CT01-CONS', 'Tulio Morais',     'VALE BASE METALS',     'GERE'),
  ('VALE-CT03-TPDT', 'Eduardo Eler',     'VALE',                 'GERE'),
  ('VLIM-CT01-GERE', 'Tulio Morais',     null,                   'PLAN')
)
insert into public.horas_projetos (nome, cliente, gerencia_id, cor, origem_cod_phd)
select
  o.cod_phd,
  o.cliente,
  -- Obra sem gerente no organograma (9 casos) cai na Gerência Geral.
  -- ATENÇÃO: a Gerência Geral tem gestor_id NULL, e horas_gerencias_visiveis()
  -- só devolve área cujo gestor_id esteja na sua cadeia de superiores. Com
  -- gestor NULL, ela é visível APENAS aos 3 colaboradores cujo
  -- horas_gerencia_id aponta para ela. Rode o bloco "Gerência Geral" abaixo
  -- se quiser que esses 9 projetos corporativos apareçam para a empresa toda.
  coalesce(g.id, geral.id),
  coalesce(c.cor, '#C44A28'),
  o.cod_phd
from obras o
left join map_gerente m on m.curto = o.gerente_curto
left join public.horas_gerencias g on g.nome = m.gerencia_nome
left join map_cor c on c.produto = o.produto
cross join lateral (
  select id from public.horas_gerencias where nome = 'Gerência Geral' limit 1
) geral
where not exists (
  select 1 from public.horas_projetos p where p.nome = o.cod_phd
);

commit;

-- ---------------------------------------------------------------------------
-- OPCIONAL — "Gerência Geral" visível para a empresa toda
-- ---------------------------------------------------------------------------
-- Hoje ela tem gestor_id NULL, então horas_gerencias_visiveis() nunca a devolve
-- por herança: só os 3 membros diretos a enxergam. Isso já afeta o projeto
-- "Interno / Administrativo" que existe lá desde antes desta carga.
-- Apontar o gestor para o CEO (raiz da árvore) faz 127 dos 134 ativos passarem
-- a enxergá-la — os 7 restantes são raízes sem superior, que precisam de
-- superior_id preenchido na Gestão de Pessoas.
--
-- update public.horas_gerencias
--    set gestor_id = (select id from public.colaboradores
--                      where nome = 'PEDRO HENRIQUE BOSCO NERY' and ativo)
--  where nome = 'Gerência Geral' and gestor_id is null;

-- ---------------------------------------------------------------------------
-- Conferência (rode depois; esperado: 84 projetos novos, 0 na Gerência Geral
-- por falta de mapeamento de gerente conhecido além dos 9 casos sem gerente).
-- ---------------------------------------------------------------------------
-- select g.nome as area, count(*) as projetos
--   from horas_projetos p join horas_gerencias g on g.id = p.gerencia_id
--  where p.origem_cod_phd is not null
--  group by g.nome order by 2 desc;
