# Plano: número sequencial da requisição

Spec: `docs/superpowers/specs/2026-07-09-numero-requisicao-design.md`
Branch: `feat/numero-requisicao`

## Tarefa 1 — Migração

- [ ] `supabase_migration_solicitacoes_rh_numero.sql`: coluna + backfill por
      created_at + sequência/default/not null/único. Aplicar no projeto
      `bogsuuhrgvopzgcceoqz` (pede confirmação do Lennon).

## Tarefa 2 — Front

- [ ] `RequisicoesRh`: coluna Nº + `#N` no modal.
- [ ] `AcompanharRequisicoes`: `numero` no SELECT + `#N` no card.
- [ ] `AdminSolicitacoes`: idem.
- [ ] `HistoricoRequisicoes`: `numero` no SELECT + `#N` no card.
- [ ] `requisicaoPdf`: título `Requisição #N — Tipo`.

## Verificação

- [ ] npm test / build / eslint tocados.
- [ ] Banco: numero único, sem nulos, ordenado por created_at.
- [ ] Merge --no-ff na main (após migração aplicada; sem push).
