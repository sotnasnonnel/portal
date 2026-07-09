# Plano: data de abertura + vaga sigilosa

Spec: `docs/superpowers/specs/2026-07-09-data-abertura-e-vaga-sigilosa-design.md`
Branch: `feat/data-abertura-vaga-sigilosa`

## Tarefa 1 — Data de abertura nas telas de acompanhamento

- [ ] `AcompanharRequisicoes.jsx`: acrescentar `· Aberta em {toLocaleDateString('pt-BR')}`
      na linha `sol-card-tipo` do card expandido.
- [ ] `RequisicoesRh.jsx`: coluna **Abertura** na tabela; mesma data na linha do tipo no modal.

## Tarefa 2 — Campo sigilosa (schema + form + banco)

- [ ] Migração Supabase: `alter table public.vagas add column if not exists sigilosa boolean not null default false;`
      aplicar no projeto `bogsuuhrgvopzgcceoqz` e salvar `supabase_migration_vagas_sigilosa.sql`.
- [ ] `src/config/novaVaga.js`: campo `sigilosa` tipo `check` após Equipamento; renumerar `n`;
      estado inicial `false`; payload booleano; comentário de tipos atualizado.
- [ ] `FormNovaVaga.jsx`: render do tipo `check` (estilo `contratacao-opcao`, texto
      "Sim, esta vaga é sigilosa").
- [ ] `ModalRespostas.jsx`: `fmtResposta` trata `check` como Sim/Não (cobre PDF).

## Verificação

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npx eslint <arquivos tocados>`
- [ ] Merge `--no-ff` na main (sem push).
