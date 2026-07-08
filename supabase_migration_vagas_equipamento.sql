-- Migration: vagas_equipamento (aplicada em 2026-07-08 no projeto bogsuuhrgvopzgcceoqz)

-- Campo Equipamento na requisição de Nova Vaga (select com opções fixas no front:
-- Notebook Padrão, Gamer 16RAM + 512SSD, Gamer 32RAM + 512SSD, Gamer 32RAM + 1TB, Gamer 32RAM + 2TBSSD).
alter table public.vagas add column if not exists equipamento text;
