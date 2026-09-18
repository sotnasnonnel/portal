-- Carga da Ausência Programada (projeto bogsuuhrgvopzgcceoqz)
-- GERADO por docs/gerar_carga_ausencia_programada.cjs a partir de referencia/Controle de Ausência SC e PJ Consolidado 1.xlsx
-- PILOTO: só nomes com "MAICON". Não editar à mão: gere de novo.
-- Rodar DEPOIS de supabase_migration_ausencia_programada.sql. Idempotente:
-- período repetido e lançamento repetido (mesma pessoa e início) são ignorados.
--
-- RELATÓRIO PARA O RH
--  Períodos importados: 2 · lançamentos: 3
--  Nomes sem colaborador ativo no portal (não importados): 0
--  Períodos sem saldo na planilha (não importados): 0
--  Saldo digitado não fecha com os dias lançados (conferir): 0
--  Períodos que terminam negativos (conferir): 0

begin;

create temp table _aus_per (nome text, inicio date, fim date, data_inicial date, limite date, credito int, obs text) on commit drop;
create temp table _aus_sol (nome text, periodo_inicio date, inicio date, fim date) on commit drop;

insert into _aus_per values
  ('MAICON HENRIQUE VIEIRA MORAIS', '2024-08-20', '2025-08-20', '2025-08-20', '2026-08-20', 21, null),
  ('MAICON HENRIQUE VIEIRA MORAIS', '2025-08-20', '2026-08-20', '2026-08-20', '2027-08-20', 21, null);

insert into _aus_sol values
  ('MAICON HENRIQUE VIEIRA MORAIS', '2024-08-20', '2025-08-18', '2025-09-02'),
  ('MAICON HENRIQUE VIEIRA MORAIS', '2024-08-20', '2026-06-08', '2026-06-12'),
  ('MAICON HENRIQUE VIEIRA MORAIS', '2025-08-20', '2026-11-03', '2026-11-17');

create temp table _aus_colab on commit drop as
  select distinct on (regexp_replace(upper(translate(trim(c.nome), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')), '\s+', ' ', 'g')) c.id, regexp_replace(upper(translate(trim(c.nome), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')), '\s+', ' ', 'g') as nome
  from public.colaboradores c
  where c.ativo is distinct from false
  order by regexp_replace(upper(translate(trim(c.nome), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')), '\s+', ' ', 'g'), c.auth_id is null, c.id;

insert into public.ausencia_periodos
  (colaborador_id, inicio_periodo, fim_periodo, data_inicial, data_limite, dias_direito, observacao, origem)
select k.id, p.inicio, p.fim, p.data_inicial, p.limite, p.credito, p.obs, 'importacao'
from _aus_per p join _aus_colab k on k.nome = p.nome
on conflict (colaborador_id, inicio_periodo) do nothing;

insert into public.ausencia_solicitacoes
  (colaborador_id, periodo_id, data_inicio, data_fim, status, origem, observacao, decidido_em)
select k.id, ap.id, s.inicio, s.fim, 'aprovada', 'importacao', 'Importado da planilha de controle', now()
from _aus_sol s
join _aus_colab k on k.nome = s.nome
join public.ausencia_periodos ap on ap.colaborador_id = k.id and ap.inicio_periodo = s.periodo_inicio
where not exists (
  select 1 from public.ausencia_solicitacoes x
  where x.colaborador_id = k.id and x.data_inicio = s.inicio and x.origem = 'importacao'
);

commit;
