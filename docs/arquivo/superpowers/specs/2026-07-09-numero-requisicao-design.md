# Número sequencial da requisição

**Data:** 2026-07-09
**Status:** Aprovado

## Objetivo

Dar às requisições DP um número sequencial curto e estável (#1, #2, …) para
referência entre as pessoas ("requisição 24"), exibido nas telas e no PDF —
conforme mockup `num.png` (coluna à esquerda da tabela do RH/DP).

## Contexto

- `solicitacoes_rh.id` é UUID — inutilizável como referência falada.
- O número deve nascer no banco e nunca mudar (não pode ser posição na lista,
  que muda com filtro/exclusão).

## Desenho

### 1. Banco (migração `solicitacoes_rh_numero`)

- Coluna `numero bigint` em `solicitacoes_rh`.
- Backfill das existentes por ordem de criação (`created_at, id`): mais antiga = 1.
- Sequência own da coluna, `setval` para o máximo, `default nextval(...)`,
  `not null` e índice único.
- Policies inalteradas (coluna nova herda as regras da tabela).

### 2. Exibição (`numero` entra nos SELECTs)

| Tela | Onde |
|---|---|
| RH/DP — tabela (`RequisicoesRh`) | nova 1ª coluna **Nº** |
| RH/DP — modal de detalhe | `#N` antes do tipo no título do modal |
| Aprovar/Acompanhar (gestor) | `#N · ` antes do tipo no cabeçalho do card |
| Requisições DP (admin) | idem |
| Histórico do gestor | `#N` na linha "Aberta em …" |
| PDF | título vira `Requisição #N — Tipo` (quando houver número) |

Fallback: se `numero` vier nulo (não deve ocorrer após o backfill), a UI
simplesmente omite o `#N`.

## Fora de escopo

- Número em e-mails de notificação (pode entrar depois num ajuste da Edge
  Function); renumeração retroativa por tipo.

## Verificação

- `npm test`, `npm run build`, lint dos tocados.
- Pós-migração: conferir no banco `numero` único, sem nulos e crescente por
  `created_at`; merge na main só depois da migração aplicada (o front passa a
  selecionar a coluna).
