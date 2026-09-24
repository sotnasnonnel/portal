# Re-sincronizar requisições pendentes ao editar o fluxo de aprovação

**Data:** 2026-07-01
**Status:** aprovado (aguardando revisão do spec)

## Problema

Hoje, ao editar um fluxo em **Fluxos de Aprovação** (`AdminFluxos.jsx`), o *molde*
(`solicitacoes_rh_fluxos`) é salvo corretamente. Mas as etapas de cada requisição são
**fotografadas** em `solicitacoes_rh_etapas` no momento da criação (via
`montarEtapasDeConfig`) e a timeline (`FluxoTimeline`) lê essa foto. Resultado: editar o
molde depois **não afeta** requisições já criadas — o usuário percebe como "salvei, mas
ao abrir a requisição continua o fluxo antigo".

Requisições **novas** já pegam o molde atualizado por tipo (`resolverCadeia` →
`buscarFluxoPorTipo`). O problema é só com as já existentes.

## Objetivo

Ao salvar um fluxo, **re-sincronizar as requisições PENDENTES** do mesmo gestor e do
mesmo tipo, preservando integralmente as etapas já decididas e substituindo apenas o
trecho ainda pendente pela parte nova do molde.

Fora de escopo (YAGNI):
- Requisições concluídas ou reprovadas — nunca são tocadas.
- Cascata via fallback: editar o molde geral (`aumento_salario`) **não** re-sincroniza
  pendentes de outros tipos que herdavam o geral. Re-sincroniza só o tipo salvo.
- RPC/transação no Postgres (mantém o padrão client-side do app).

## Decisões (confirmadas com o usuário)

1. **Escopo temporal:** só requisições `status = 'pendente'`; decididas são preservadas.
2. **Reconciliação:** mantém as etapas decididas; substitui só o trecho pendente pela
   parte do molde novo que ainda não agiu ("substitui o que falta").
3. **Onde roda:** Opção A — no cliente, dentro do `salvar` do `AdminFluxos`. Sem
   transação; mitigado por **nunca deletar etapas decididas**.
4. **Escopo por tipo:** re-sincroniza apenas requisições do mesmo `tipo` que foi salvo.
5. **Requisição já na execução + molde adiciona aprovador:** o novo aprovador é
   inserido **antes** da execução do Admin (a requisição volta a exigir aprovação).

## Definições

- "Decidida" = etapa com `status != 'pendente'` (`aprovada`, `auto_aprovada`,
  `executada`, `ciencia`, etc.). São **preservadas** e nunca deletadas.
- "Pendente" (etapa) = `status = 'pendente'` (aprovações pendentes + a execução).
- Como o fluxo é sequencial (aprova-se da frente pra trás), as etapas decididas formam
  o prefixo da ordem. O algoritmo não depende disso ser contíguo (usa `max(ordem)`
  das mantidas como base), então é robusto mesmo com gaps.

## Algoritmo (por requisição pendente do gestor+tipo salvo)

Entrada: etapas atuais da requisição, `moldeIds` (array ordenado de aprovador_id),
`nomePorId` (id → nome, para o `papel`), `criadorId` (= `gestor_id` da requisição).

Parte **pura** (testável, sem I/O) — `reconciliarEtapas(etapasAtuais, moldeIds, nomePorId, criadorId)`:

1. `mantidas` = etapas com `status != 'pendente'`, ordenadas por `ordem`.
2. `idsDecididos` = `aprovador_id` (lowercase) das `mantidas`.
3. `base` = `max(ordem das mantidas)` ou `0`.
4. `caudaIds` = `moldeIds` normalizados (trim/lowercase/filter), **removendo** os que já
   estão em `idsDecididos`, na ordem do molde.
5. `novasAprovacoes` = para cada id da `caudaIds`, uma etapa `tipo_etapa='aprovacao'`,
   `ordem = base + i + 1`, `papel = nomePorId[id]` (erro se nome não resolve),
   `status = 'auto_aprovada'` + `decidido_em=agora` se `id === criadorId` (senão
   `'pendente'`).
6. `execucao` = etapa `tipo_etapa='execucao'`, `aprovador_id = APROVADORES.admin`,
   `papel='Admin (execução)'`, `ordem = base + caudaIds.length + 1`, `status='pendente'`.
7. Retorna `{ inserir: [...novasAprovacoes, execucao] }` e o conjunto de etapas
   pendentes atuais a apagar (todas as `status='pendente'` da requisição).
8. **No-op:** se a sequência de `(aprovador_id, status)` das pendentes atuais já for
   idêntica à `inserir`, retorna `semMudanca: true` e nada é gravado.

Parte de **I/O** — `resincronizarPendentes(supabase, { solicitanteId, tipo, moldeIds, nomePorId })`:

1. Busca `solicitacoes_rh` com `gestor_id = solicitanteId`, `tipo = tipo`,
   `status = 'pendente'`, e suas etapas.
2. Para cada uma: roda `reconciliarEtapas`. Se `semMudanca`, pula.
3. Senão: **apaga** as etapas pendentes (`delete ... where solicitacao_id = X and
   status = 'pendente'`) e **insere** `inserir`.
4. Ordem segura: deletar pendentes → inserir novas. Decididas nunca são tocadas, então
   falha parcial não perde histórico (no pior caso o admin re-salva).
5. Retorna a contagem de requisições efetivamente atualizadas.

## Integração no `AdminFluxos.salvar`

Depois do `upsert` do molde bem-sucedido (antes do `carregarBase`):

```js
const nomePorId = Object.fromEntries(pool.map((c) => [c.id, c.nome]));
const n = await resincronizarPendentes(supabase, {
  solicitanteId, tipo: tipoSel, moldeIds: aprovadores, nomePorId,
});
setSucesso(`Fluxo salvo: ${TIPO_LABEL_CURTO[tipoSel]} — ${solicitante?.nome || ''}`
  + (n > 0 ? ` · ${n} pendente(s) atualizada(s)` : ''));
window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
```

`pool` já contém gestores+admin (os únicos aprovadores possíveis), então `nomePorId`
resolve todos os ids do molde. Se um erro ocorrer na re-sincronização, o molde já foi
salvo — mostra aviso não-bloqueante ("Fluxo salvo, mas houve erro ao atualizar
pendentes; reabra e salve de novo").

## Onde fica o código

- `src/config/aprovacao.js`: adicionar `reconciliarEtapas` (pura) e
  `resincronizarPendentes` (I/O). Reaproveita `APROVADORES.admin`.
- `src/pages/Admin/AdminFluxos.jsx`: chamar `resincronizarPendentes` no `salvar`.

## Testes

- Unitários (vitest, padrão de `autoPeriod.test.js`) para `reconciliarEtapas`:
  - Nenhuma decisão ainda → cauda = molde inteiro.
  - Uma aprovação feita + molde reordenado → mantém a decidida, cauda segue novo molde
    sem repetir quem já decidiu.
  - Aprovador decidido que sumiu do molde → decisão preservada mesmo assim.
  - Requisição na execução + molde adiciona aprovador → novo aprovador antes da execução.
  - Molde inclui o criador na cauda → etapa `auto_aprovada`.
  - Pendentes já iguais à cauda → `semMudanca`.

## Riscos

- Sem transação no delete+insert: mitigado por não tocar decididas e por permitir
  re-salvar. Aceito pelo usuário.
- Requisição pronta pra execução pode "regredir" ao ganhar aprovador novo — comportamento
  desejado e confirmado.
