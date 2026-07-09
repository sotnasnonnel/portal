-- Migration: vagas_sigilosa (aplicada em 2026-07-09 no projeto bogsuuhrgvopzgcceoqz)

-- Campo "Vaga sigilosa" na requisição de Nova Vaga (checkbox no front, padrão Não).
-- Apenas informativo: não altera regras de visibilidade/RLS.
alter table public.vagas add column if not exists sigilosa boolean not null default false;
