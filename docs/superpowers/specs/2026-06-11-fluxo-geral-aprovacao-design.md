# Fluxo de Aprovação Geral por Gestor — Design

**Data:** 2026-06-11
**App:** App Dp (Gestão de Pessoas) — React + Vite + Supabase

## Objetivo

Substituir os **3 fluxos de aprovação por gestor** (um por caso: `aumento_salario`,
`desligamento::empresa`, `desligamento::empregado`) por **um único fluxo geral por
gestor**, que vale para todas as requisições — incluindo as futuras. Reaproveitar o que
já foi salvo no caso `aumento_salario` (que o admin configurou para todos os gestores)
como esse fluxo geral, **sem migração de banco**.

## Decisões (confirmadas com o usuário)

- **Armazenamento:** reaproveitar a linha existente `(solicitante_id, 'aumento_salario', '')`
  de `solicitacoes_rh_fluxos` como o fluxo geral. Zero alteração de banco; os dados salvos
  passam a valer imediatamente.
- **Desligamento:** empresa e empregado usam o MESMO fluxo geral. A iniciativa continua
  sendo escolhida no formulário e gravada na solicitação, mas não seleciona mais cadeias
  diferentes.
- **Limpeza:** remover `buscarFluxo` e `CASOS_FLUXO` (sem uso após a mudança) e simplificar
  o AdminFluxos para um único card de fluxo por gestor.

## Modelo de dados (inalterado)

`solicitacoes_rh_fluxos` permanece com a chave única `(solicitante_id, tipo, iniciativa)`
e o array ordenado `aprovadores`. A novidade é puramente de convenção: a linha
`tipo='aumento_salario', iniciativa=''` é tratada como **o fluxo geral** do gestor.
Linhas antigas de `desligamento::empresa/empregado` ficam órfãs (ignoradas pelo lookup),
sem necessidade de limpeza.

## Mudanças por arquivo

### `src/config/aprovacao.js`
- Adicionar `export const FLUXO_GERAL = { tipo: 'aumento_salario', iniciativa: '' };`
  documentado como o slot canônico do fluxo geral (reaproveita a chave legada).
- Adicionar `buscarFluxoGeral(supabase, solicitanteId)` — consulta sempre a linha
  `FLUXO_GERAL`, retornando `{ fluxo, erro }` (mesma semântica de erro vs. não-configurado
  do antigo `buscarFluxo`).
- Remover `buscarFluxo` e `CASOS_FLUXO` (sem mais consumidores).
- Manter `montarEtapasDeConfig`, `normIniciativa`, `etapaAtual`, `resumoAndamento`,
  `acaoDisponivel`, `TIPO_LABEL`, `INICIATIVA_LABEL`, `APROVADORES`, etc.

### `src/pages/Gestor/requisicoes/useRequisicaoForm.js`
- A pré-checagem (hoje um loop sobre 3 casos preenchendo um mapa `fluxoOk`) colapsa para
  **um booleano** `fluxoOk` = "este gestor tem fluxo geral configurado?", via
  `buscarFluxoGeral`.
- `criarComFluxo(tipo, iniciativa, dadosSolicitacao)` passa a usar `buscarFluxoGeral` em vez
  de `buscarFluxo(tipo, iniciativa)`. `tipo`/`iniciativa` continuam sendo gravados em
  `dadosSolicitacao` (registro da solicitação), só não influenciam o lookup do fluxo.
- Retorno do hook: `fluxoOk` vira `boolean` (era objeto/mapa).

### `src/pages/Gestor/requisicoes/FormAlteracao.jsx`
- Trocar `const semFluxo = fluxoOk['aumento_salario::'] === false;` por
  `const semFluxo = fluxoOk === false;`.
- Texto do aviso passa a referir-se ao "fluxo de aprovação" (geral).

### `src/pages/Gestor/requisicoes/FormDesligamento.jsx`
- Trocar `const semFluxo = form.iniciativa && fluxoOk['desligamento::${form.iniciativa}'] === false;`
  por `const semFluxo = fluxoOk === false;`.
- O seletor de iniciativa permanece (gravado na solicitação).

### `src/pages/Admin/AdminFluxos.jsx`
- Vira editor de **um fluxo por gestor**:
  - Estado `cadeias` (mapa por caso) → `cadeia` (uma lista de aprovadores).
  - Carregar da linha `FLUXO_GERAL` do gestor selecionado.
  - Salvar via `upsert` em `(solicitanteId, 'aumento_salario', '')` com
    `onConflict: 'solicitante_id,tipo,iniciativa'`.
  - Remover o `CASOS_FLUXO.map(...)`; renderizar um único `fluxo-card`
    (mesmo diagrama: Solicitante → aprovadores ordenáveis → Execução Admin).
  - Indicador no dropdown de gestor: **✅ configurado / ⚠️ não configurado** (boolean),
    no lugar de `n/3`.
  - Subtítulo: "Monte a cadeia de aprovação geral de cada gestor. Vale para todas as
    requisições: parte do gestor, passa por cada aprovador na ordem e termina sempre na
    execução do Admin (DP)."
  - `setEtapa/addEtapa/removeEtapa/moverEtapa` operam sobre a lista única `cadeia`.
  - Remover importações não usadas (`CASOS_FLUXO`, `ICONE_CASO`, ícones de caso) conforme
    necessário para passar no lint.

## Fluxo de dados

1. Gestor abre uma requisição → `useRequisicaoForm` chama `buscarFluxoGeral(user.id)`.
2. Achou a linha `aumento_salario::''` com `aprovadores` → `montarEtapasDeConfig` monta as
   etapas (aprovadores na ordem + execução final do Admin). Comportamento idêntico ao atual,
   só que a cadeia é a geral.
3. Admin configura/edita a cadeia única em AdminFluxos, salvando na mesma linha.

## Tratamento de erros (inalterado)

- `buscarFluxoGeral` distingue erro de rede de "não configurado" (mesma lógica do antigo
  `buscarFluxo`).
- `criarComFluxo` lança `SEM_FLUXO` se o gestor não tem fluxo geral; o form mostra o aviso e
  bloqueia o envio (`fluxoOk === false`).

## Verificação

Sem framework de testes (projeto usa ESLint + Vite). Verificação: `npm run lint` +
`npm run build`, e checagem visual no `npm run dev`:
- Admin: selecionar um gestor mostra UM fluxo (carregado dos dados existentes); salvar funciona.
- Gestor: abrir Alteração e Desligamento usa o fluxo geral; envio gera as etapas corretas.

## Fora de escopo

- Migração ou renomeação de chave no banco.
- Limpeza das linhas órfãs de desligamento.
- Mudança na tabela de etapas, em `FluxoTimeline` ou no acompanhamento/aprovação.
