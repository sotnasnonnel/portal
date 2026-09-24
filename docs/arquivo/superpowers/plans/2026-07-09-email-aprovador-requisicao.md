# Plano: e-mail para o próximo aprovador da requisição

Spec: `docs/superpowers/specs/2026-07-09-email-aprovador-requisicao-design.md`
Branch: `feat/email-aprovador-requisicao`

## Tarefa 1 — Edge Function

- [ ] `supabase/functions/notify-solic-aprovador/index.ts`: service role; etapa
      pendente de menor ordem; e-mail Graph com template PHD; `dry_run`.
- [ ] Deploy no projeto `bogsuuhrgvopzgcceoqz` (`verify_jwt: true`).

## Tarefa 2 — Front

- [ ] `src/services/notificarAprovadorSolic.js` (best-effort, nunca lança).
- [ ] `useRequisicaoForm`: chamar em `criarComFluxo` e `criarComDetalhe`.
- [ ] `AcompanharRequisicoes.confirmarDecisao`: chamar ao aprovar.
- [ ] `AdminSolicitacoes`: chamar em `confirmarDecisao` (aprovar),
      `forcarAvanco` e `confirmarReatribuir`.

## Verificação

- [ ] `npm test` / `npm run build` / `npx eslint <tocados>`.
- [ ] `dry_run` em produção com requisição pendente real → destinatário correto.
- [ ] Merge `--no-ff` na main (sem push).
