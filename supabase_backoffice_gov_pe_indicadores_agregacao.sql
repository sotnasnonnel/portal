-- ============================================================================
-- ATENÇÃO: migração do projeto BACKOFFICE (dvvqgoxqawyhycakppps), não do
-- portal_phd. Versionada aqui porque foi daqui que ela saiu.
-- (Aplicada em 2026-08-28.)
--
-- A tela "Editar indicador" da Torre de Controle passou a gravar `agregacao` e
-- quebrava com "Could not find the 'agregacao' column of 'gov_pe_indicadores'
-- in the schema cache": a coluna existe em gov_pe_ind_estrategicos
-- (Indicadores Estratégicos), mas nunca foi criada aqui.
--
-- Espelha a irmã exatamente — text, anulável, mesmos valores — para as duas
-- telas continuarem falando a mesma língua. Anulável de propósito: as linhas
-- que já existem não têm agregação definida, e um NOT NULL exigiria inventar
-- um valor para todas elas.
-- ============================================================================

alter table public.gov_pe_indicadores
  add column if not exists agregacao text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'gov_pe_ind_agregacao_chk'
  ) then
    alter table public.gov_pe_indicadores
      add constraint gov_pe_ind_agregacao_chk
      check (agregacao is null or agregacao in ('soma', 'media', 'ultimo', 'manual'));
  end if;
end $$;

comment on column public.gov_pe_indicadores.agregacao is
  'Como os valores mensais formam o do periodo: soma | media | ultimo | manual. Espelha gov_pe_ind_estrategicos.agregacao.';
