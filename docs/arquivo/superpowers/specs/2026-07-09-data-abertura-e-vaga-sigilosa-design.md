# Data de abertura nas requisições + campo "Vaga sigilosa" na Nova Vaga

**Data:** 2026-07-09
**Status:** Aprovado

## Objetivo

1. Exibir a data de abertura (`created_at`) das requisições nas telas onde ela ainda não aparece.
2. Permitir marcar uma requisição de Nova Vaga como sigilosa.

## Contexto

- O Histórico (`HistoricoRequisicoes.jsx`) e o PDF já exibem a data de abertura; faltam a tela
  Aprovar/Acompanhar (cards do gestor) e a visão RH/DP (tabela + modal de detalhe).
- O `created_at` já vem na query (`SELECT_SOL`) — nenhuma mudança de banco para o item 1.
- O formulário de Nova Vaga é dirigido pelo schema `CAMPOS_NOVA_VAGA` (`src/config/novaVaga.js`);
  "Ver respostas" (`ModalRespostas.jsx`) e o PDF (`requisicaoPdf.js`, via `fmtResposta`) leem o
  mesmo schema, então um campo novo propaga automaticamente.

## Decisões (com o Lennon)

- **Sigilosa é apenas informativo**: aparece no formulário, no "Ver respostas" e no PDF.
  Não altera regras de visibilidade/RLS.
- **Padrão é "Não"**: o campo é um checkbox desmarcado por padrão; o gestor marca somente
  quando a vaga for sigilosa. Não há estado "não respondido".

## Desenho

### 1. Data de abertura

- `AcompanharRequisicoes.jsx`: no corpo expandido do card, a linha do tipo
  (`sol-card-tipo`) ganha `· Aberta em dd/mm/aaaa`.
- `RequisicoesRh.jsx`: nova coluna **Abertura** na tabela (dd/mm/aaaa) e a mesma
  informação na linha do tipo dentro do modal de detalhe.
- Formato: `new Date(created_at).toLocaleDateString('pt-BR')`, igual ao Histórico.

### 2. Vaga sigilosa

- Novo tipo de campo no schema: `check` — checkbox único, valor booleano, inicial `false`,
  payload sempre `true`/`false` (nunca `null`). Nunca entra em `faltando` (sempre tem valor).
- Campo `{ id: 'sigilosa', secao: 'Dados da vaga', label: 'Vaga sigilosa', tipo: 'check' }`
  após "Equipamento"; campos seguintes renumeram (`n`).
- `FormNovaVaga.jsx`: renderiza `check` reutilizando o estilo `contratacao-opcao`
  (mesmo visual dos checkboxes da Contratação), com o texto "Sim, esta vaga é sigilosa".
- `fmtResposta` (ModalRespostas): `check` formata como Sim/Não — cobre modal e PDF.
- Banco: `alter table public.vagas add column if not exists sigilosa boolean not null default false;`
  aplicada no projeto Supabase e registrada em `supabase_migration_vagas_sigilosa.sql`.

## Fora de escopo

- Restringir visibilidade de requisições sigilosas.
- Data de abertura em outras telas (Histórico e PDF já têm).

## Testes / verificação

- `npm test` (helpers puros existentes continuam passando).
- `npm run build`.
- Lint apenas dos arquivos tocados (lint global tem erros pré-existentes).
