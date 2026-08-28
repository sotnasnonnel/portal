-- Marca a iniciativa do Campo de Ideias que a Inovação CLASSIFICOU: ela virou
-- item do catálogo da empresa (inovacao_pipeline, no backoffice) e passa a
-- aparecer em "Iniciativas em uso". (Aplicada no portal_phd em 2026-08-28.)
--
-- Guardamos o id que ela ganhou lá para (a) não classificar duas vezes e (b)
-- conseguir ir do registro daqui até o item de lá. É texto e sem FK: são bancos
-- diferentes, então a integridade fica com quem escreve — a Edge Function
-- classificar-iniciativa, que é a única que grava dos dois lados.
alter table public.programas_ideias
  add column if not exists pipeline_id     text,
  add column if not exists classificado_em timestamptz;

create unique index if not exists programas_ideias_pipeline_idx
  on public.programas_ideias (pipeline_id) where pipeline_id is not null;
