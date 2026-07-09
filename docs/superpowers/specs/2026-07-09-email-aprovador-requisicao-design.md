# E-mail para o próximo aprovador da requisição DP

**Data:** 2026-07-09
**Status:** Aprovado

## Objetivo

Avisar por e-mail a pessoa cuja vez chegou no fluxo de uma requisição DP — tanto
etapas de aprovação quanto a etapa final de execução (decisão do Lennon).

## Contexto

- O módulo Reembolso já tem esse mecanismo em produção: Edge Function
  `notify-approver` envia e-mail via Microsoft Graph (secrets `GRAPH_TENANT_ID`,
  `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SENDER` já configurados no
  projeto Supabase `bogsuuhrgvopzgcceoqz`), chamada best-effort pelo front
  (`reimbursements.js#notifyApprover`).
- Requisições DP: envelope em `solicitacoes_rh`, cadeia em
  `solicitacoes_rh_etapas` (ordem, aprovador_id, tipo_etapa `aprovacao`/`execucao`,
  status). A "vez" é a etapa pendente de menor ordem (`etapaAtual` em
  `src/config/aprovacao.js`).
- Todos os 134 colaboradores ativos têm `email` preenchido.

## Decisões (com o Lennon)

- URL do botão do e-mail: `https://portal.phdengenharia.tech`.
- O executor da etapa final (DP/admin) também recebe o aviso.
- Abordagem: Edge Function nova + chamada best-effort do front (mesma receita do
  Reembolso). Descartados: trigger com `pg_net` (extensão não instalada, mais
  peças) e reaproveitar a `notify-approver` (misturaria domínios).

## Desenho

### 1. Edge Function `notify-solic-aprovador`

Fonte versionada em `supabase/functions/notify-solic-aprovador/index.ts`;
deploy no projeto `bogsuuhrgvopzgcceoqz` com `verify_jwt: true`.

- Body: `{ solicitacao_id, dry_run? }`.
- Com service role (ignora RLS): carrega a solicitação (tipo, status, gestor,
  colaborador); se não existir ou `status != 'pendente'` → `skipped`.
- Etapa da vez: pendente de menor ordem com `tipo_etapa in (aprovacao, execucao)`;
  sem etapa → `skipped`. Responsável sem e-mail → `skipped`.
- E-mail no mesmo template visual do Reembolso (cabeçalho PHD Portal), com:
  tipo da requisição (labels espelhados de `TIPO_LABEL`), solicitante,
  colaborador envolvido (quando houver) e botão para o portal
  (`PORTAL_URL`, default `https://portal.phdengenharia.tech`).
- Assunto: `Requisição — Aguardando sua Aprovação` (ou `…sua Execução`).
- `dry_run: true`: responde `{ would_send, to, tipo_etapa }` sem enviar —
  usado na verificação em produção.
- Envio via Microsoft Graph `sendMail`, mesmos secrets do Reembolso.

### 2. Front — helper best-effort

`src/services/notificarAprovadorSolic.js`: invoca a função com
`{ solicitacao_id }` dentro de try/catch com `console.warn` — nunca bloqueia
nem quebra o fluxo. Chamado após a mudança de "vez":

| Ponto | Arquivo | Quando |
|---|---|---|
| Criação (fluxo simples) | `useRequisicaoForm.criarComFluxo` | após inserir etapas |
| Criação (com detalhe) | `useRequisicaoForm.criarComDetalhe` | após inserir detalhe |
| Aprovação de etapa | `AcompanharRequisicoes.confirmarDecisao` | só quando aprova |
| Aprovação de etapa (admin) | `AdminSolicitacoes.confirmarDecisao` | só quando aprova |
| Forçar avanço | `AdminSolicitacoes.forcarAvanco` | sempre (função dá skip se acabou) |
| Reatribuir | `AdminSolicitacoes.confirmarReatribuir` | avisa o novo responsável |

Reprovação e execução final não notificam (fluxo encerra; a função daria skip
de qualquer forma).

### 3. Banco

Nenhuma migração.

## Fora de escopo

- Trigger no banco / fila; reenvio ou digest de pendências antigas;
  notificação por e-mail de reprovação/conclusão ao solicitante.

## Verificação

- `npm test`, `npm run build`, lint dos arquivos tocados.
- Deploy da função e `dry_run` contra uma requisição pendente real,
  conferindo destinatário e tipo de etapa.
- Merge `--no-ff` na main (sem push).
