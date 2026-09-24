# Devolver para ajustes + reenvio · Mapeamento → Nova Vaga

Dois ajustes nas Requisições DP (`solicitacoes_rh`). Decisões confirmadas com o
usuário em 2026-07-27.

---

## Feature 1 — Devolver para ajustes e reenviar

**Problema:** reprovar encerrava a requisição de vez (não havia volta) e a
justificativa era opcional.

**Solução:** três desfechos no aprovador — **Aprovar**, **Reprovar** (encerra,
como antes) e **Devolver para ajustes** (novo). Justificativa **obrigatória** em
Reprovar e Devolver. Devolvida volta ao solicitante, que corrige no Histórico
("Editar e reenviar") e reenvia a **mesma** requisição.

**Decisões:**
- Devolver e Reprovar coexistem (Reprovar = recusa definitiva).
- No reenvio a **cadeia recomeça do 1º aprovador** — o conteúdo mudou, então as
  aprovações anteriores ficam obsoletas. Reconstruída pela MESMA via da criação
  (`resolverCadeia` + `aplicarAlcadaGC`), então se o ajuste muda o que define a
  alçada (ex.: função proposta numa Movimentação), os aprovadores certos entram.

**Banco** (`supabase_migration_...` aplicada como `requisicoes_devolver_reenviar_e_origem`):
- `solicitacoes_rh.status` CHECK += `'devolvida'`.
- Colunas: `devolucao_motivo`, `devolucao_por`, `devolucao_em`, `reenvios int`.
- RPC `reenviar_requisicao_rh(p_sol, p_etapas jsonb)` SECURITY DEFINER: troca as
  etapas e volta para `pendente` **atomicamente** (delete+insert numa transação),
  evitando requisição sem etapas se o insert falhasse no meio. Guardas testados:
  recusa não-dono, recusa quando não está `devolvida`, exige requisição existente.
  Não amplia a RLS (o gestor-dono já podia reescrever etapas via `etapas_write`).

**Código:**
- `config/aprovacao.js`: `etapaAtual` trata `devolvida` como terminal (sem
  aprovador da vez até reenviar); `resumoAndamento` nomeia quem devolveu.
- `AcompanharRequisicoes.jsx`: botão Devolver + modal com 3 modos + justificativa
  obrigatória (botão desabilita sem motivo em Reprovar/Devolver).
- `HistoricoRequisicoes.jsx`: banner do motivo + "Editar e reenviar" quando
  `status='devolvida'`.
- `EditarReenviarModal.jsx` + `config/reenvio.js`: editor genérico que reaproveita
  os `CAMPOS_*`/`validar*`/`montarPayload*` de cada tipo (detalhe) e edita campos
  do envelope para `aumento_salario`/`desligamento`. Cobre todos os 6 tipos.
- `useRequisicaoForm.js`: `reenviarRequisicao` (grava ajustes → reconstrói cadeia
  → RPC → audita/notifica).
- `FluxoTimeline.jsx` + CSS: visual `devolvida` (âmbar, ícone RotateCcw); `.btn-warning`.

Testes: `config/devolucao.test.js` (6). Ciclo devolver→reenviar validado no banco
(transação + rollback).

---

## Feature 2 — Gerar Nova Vaga a partir de um Mapeamento

**Decisões:** só depois do Mapeamento **aprovado** (`concluida`); cria uma **nova
requisição vinculada e pré-preenchida** (não muda o registro do mapeamento).

**Fluxo:** no Histórico de Mapeamento aprovado, botão "Gerar Nova Vaga" leva ao
formulário de Nova Vaga já preenchido com os campos correspondentes; o gestor
completa o resto e envia. A Nova Vaga passa pela **própria cadeia** (§5: Diretor
da área + Financeiro, e Trava Headcount se liderança).

**Banco:** `solicitacoes_rh.origem_solicitacao_id uuid` (vínculo origem→destino).

**Código:**
- `config/mapeamento.js`: `prefillNovaVagaDeMapeamento(dados)` — mapeia os ~11
  campos com correspondência clara (função, gerência, cidade/estado, modalidade,
  horário, formação, experiência, atividades, conhecimentos→requisitos, código).
  Valores monetários ficam de fora de propósito (semântica diferente).
- `HistoricoRequisicoes.jsx`: botão "Gerar Nova Vaga" (mapeamento concluído).
- `FormNovaVaga.jsx`: lê `location.state.origemMapeamento`, pré-preenche, mostra
  banner de origem e passa `origemSolicitacaoId` ao criar.
- `useRequisicaoForm.js`: `criarComDetalhe` grava `origem_solicitacao_id`.

---

## Notificação ao solicitante na devolução (FEITO)
Edge Function `notify-solic-devolvida` (ACTIVE, verify_jwt), clonada de
`notify-solic-aprovador`: e-mail Microsoft Graph ao SOLICITANTE (gestor_id) com
quem devolveu + o motivo (`devolucao_motivo`), e botão para o portal. Front:
`services/notificarSolicitanteDevolucao.js`, chamado em `AcompanharRequisicoes`
após a devolução (best-effort). Não testado ao vivo (o dry_run exigiria uma
requisição real em `devolvida`); código espelha a função irmã já comprovada.

## Edição de anexos no reenvio (FEITO)
`EditarReenviarModal` edita anexos para os tipos com bucket (mapeamento,
ajuda_custo, nova_vaga): lista os existentes com remover, aceita novos via
`useAnexos`, e no salvar grava `anexos = mantidos + novos` no payload do detalhe.
Sobe os novos ANTES de gravar (rollback do bucket se o reenvio falhar) e remove
do storage os que o solicitante tirou, após sucesso (best-effort).

## Pontos em aberto / follow-ups
- Editor de reenvio não usa o fluxo "Outro" de função/departamento (usa selects
  com o valor atual garantido na lista).
- Um Mapeamento pode gerar **mais de uma** Nova Vaga (não bloqueado); o vínculo
  origem→destino fica registrado em cada uma.
