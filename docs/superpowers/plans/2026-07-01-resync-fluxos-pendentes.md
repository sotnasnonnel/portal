# Re-sincronizar Requisições Pendentes ao Editar Fluxo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao salvar um fluxo de aprovação no `AdminFluxos`, atualizar as etapas das requisições PENDENTES do mesmo gestor+tipo, preservando as etapas já decididas e substituindo só o trecho ainda pendente pelo molde novo.

**Architecture:** Uma função pura `reconciliarEtapas` calcula as etapas a apagar/inserir a partir das etapas atuais e do molde novo. Uma função de I/O `resincronizarPendentes` busca as requisições pendentes, roda a pura em cada uma e aplica delete+insert. O `AdminFluxos.salvar` chama a I/O após gravar o molde. Ambas vivem em `src/config/aprovacao.js`, ao lado de `montarEtapasDeConfig`.

**Tech Stack:** React + Vite (ESM, `"type": "module"`), Supabase JS (chave anônima), Node v22 test runner nativo (`node --test`).

## Global Constraints

- **Sem framework de teste instalado:** usar o runner nativo `node --test` (Node 22). Import ESM direto de `src/config/aprovacao.js` (o módulo não importa o cliente supabase no topo — as funções de I/O recebem `supabase` por parâmetro, então importar é seguro fora do Vite).
- **Sem commits git:** o repositório git deste ambiente aponta para a pasta home do usuário; NÃO rodar `git add`/`git commit`. O gate de cada task é o teste passando (e, na última, `npm run build`).
- **IDs normalizados:** aprovador_id é comparado e gravado em lowercase+trim (consistente com `montarEtapasDeConfig`, que já grava lowercase).
- **Executor final fixo:** a última etapa é sempre `tipo_etapa='execucao'`, `aprovador_id = APROVADORES.admin`, `papel = 'Admin (execução)'`, `status='pendente'`.
- **"Decidida"** = etapa com `status !== 'pendente'` (nunca é apagada). **"Pendente"** = `status === 'pendente'`.
- **Escopo:** re-sincroniza só requisições `status='pendente'` do mesmo `tipo` salvo. Sem cascata de fallback para o molde geral.

---

### Task 1: Função pura `reconciliarEtapas`

**Files:**
- Modify: `src/config/aprovacao.js` (adicionar `reconciliarEtapas` no fim, usando o `APROVADORES` já existente no topo)
- Test: `src/config/reconciliarEtapas.test.js` (criar)

**Interfaces:**
- Consumes: `APROVADORES.admin` (constante já exportada em `aprovacao.js`).
- Produces:
  ```
  reconciliarEtapas(etapasAtuais, moldeIds, nomePorId, criadorId, agora) -> {
    semMudanca: boolean,
    apagarIds: string[],          // ids das etapas pendentes a apagar
    inserir: Array<{ ordem:number, aprovador_id:string, papel:string,
                     tipo_etapa:'aprovacao'|'execucao', status:string, decidido_em:string|null }>
  }
  ```
  - `etapasAtuais`: array de `{ id, ordem, aprovador_id, papel, tipo_etapa, status }`.
  - `moldeIds`: array ordenado de aprovador_id (strings).
  - `nomePorId`: objeto `{ id -> nome }` (chaves serão normalizadas internamente).
  - `criadorId`: id do gestor criador (para auto-aprovação).
  - `agora`: ISO string (injetada para testabilidade).
  - Rows em `inserir` NÃO trazem `solicitacao_id` (o chamador injeta).

- [ ] **Step 1: Write the failing test**

Create `src/config/reconciliarEtapas.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconciliarEtapas, APROVADORES } from './aprovacao.js';

const ADMIN = APROVADORES.admin;
const nomes = { a: 'Ana', b: 'Bruno', c: 'Carla', d: 'Davi', g: 'Gestor' };
const AGORA = '2026-07-01T00:00:00.000Z';

test('sem nenhuma decisão: cauda = molde inteiro', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'pendente' },
    { id: 'e2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['b', 'c'], nomes, 'g', AGORA);
  assert.equal(r.semMudanca, false);
  assert.deepEqual(r.apagarIds, ['e1', 'e2']);
  assert.deepEqual(r.inserir, [
    { ordem: 1, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 2, aprovador_id: 'c', papel: 'Carla', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null },
  ]);
});

test('uma aprovação feita + molde reordenado: mantém decidida, cauda sem repetir quem decidiu', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'aprovada' },
    { id: 'e2', ordem: 2, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente' },
    { id: 'e3', ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['a', 'c', 'd'], nomes, 'g', AGORA);
  assert.equal(r.semMudanca, false);
  assert.deepEqual(r.apagarIds, ['e2', 'e3']);
  assert.deepEqual(r.inserir, [
    { ordem: 2, aprovador_id: 'c', papel: 'Carla', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 3, aprovador_id: 'd', papel: 'Davi', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 4, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null },
  ]);
});

test('aprovador decidido que sumiu do molde: decisão preservada, não reaparece na cauda', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'aprovada' },
    { id: 'e2', ordem: 2, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente' },
    { id: 'e3', ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['c', 'd'], nomes, 'g', AGORA);
  // e1 (a, aprovada) não está em apagarIds -> preservada
  assert.deepEqual(r.apagarIds, ['e2', 'e3']);
  assert.deepEqual(r.inserir.map((x) => x.aprovador_id), ['c', 'd', ADMIN]);
  assert.deepEqual(r.inserir.map((x) => x.ordem), [2, 3, 4]);
});

test('pronta pra execução + molde adiciona aprovador: novo aprovador antes da execução', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'aprovada' },
    { id: 'e2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['a', 'b'], nomes, 'g', AGORA);
  assert.deepEqual(r.apagarIds, ['e2']);
  assert.deepEqual(r.inserir, [
    { ordem: 2, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null },
  ]);
});

test('molde inclui o criador na cauda: etapa auto_aprovada', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['g', 'a'], nomes, 'g', AGORA);
  assert.deepEqual(r.inserir, [
    { ordem: 1, aprovador_id: 'g', papel: 'Gestor', tipo_etapa: 'aprovacao', status: 'auto_aprovada', decidido_em: AGORA },
    { ordem: 2, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null },
    { ordem: 3, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null },
  ]);
});

test('pendentes já iguais à cauda: semMudanca = true', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'pendente' },
    { id: 'e2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  const r = reconciliarEtapas(etapas, ['a'], nomes, 'g', AGORA);
  assert.equal(r.semMudanca, true);
});

test('nome não resolvido lança erro', () => {
  const etapas = [
    { id: 'e1', ordem: 1, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
  ];
  assert.throws(() => reconciliarEtapas(etapas, ['zzz'], nomes, 'g', AGORA), /sem nome resolvido/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/config/reconciliarEtapas.test.js`
Expected: FAIL — `reconciliarEtapas` is not exported (`SyntaxError`/`is not a function`).

- [ ] **Step 3: Write minimal implementation**

Append to `src/config/aprovacao.js`:

```js
/**
 * Reconcilia as etapas de UMA requisição pendente com um molde novo.
 * Preserva as etapas já decididas (status != 'pendente') e substitui só o
 * trecho pendente pela parte do molde que ainda não agiu ("substitui o que
 * falta"). A execução do Admin entra sempre por último.
 *
 * Puro (sem I/O). `agora` é injetado para testabilidade.
 * Contrato: nomePorId pode ter chaves em qualquer caixa; são normalizadas.
 * Rows de `inserir` NÃO trazem solicitacao_id — o chamador injeta.
 */
export function reconciliarEtapas(etapasAtuais, moldeIds, nomePorId, criadorId, agora) {
  const norm = (x) => (typeof x === 'string' ? x.trim().toLowerCase() : '');
  const lista = Array.isArray(etapasAtuais) ? etapasAtuais : [];

  const nomeNorm = {};
  for (const [k, v] of Object.entries(nomePorId || {})) nomeNorm[norm(k)] = v;

  const mantidas = lista
    .filter((e) => e.status !== 'pendente')
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const pendentes = lista
    .filter((e) => e.status === 'pendente')
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  const idsDecididos = new Set(mantidas.map((e) => norm(e.aprovador_id)));
  const base = mantidas.reduce((m, e) => Math.max(m, e.ordem || 0), 0);
  const cri = norm(criadorId);

  const caudaIds = (Array.isArray(moldeIds) ? moldeIds : [])
    .map(norm)
    .filter(Boolean)
    .filter((id) => !idsDecididos.has(id));

  const novasAprovacoes = caudaIds.map((id, i) => {
    const nome = nomeNorm[id];
    if (!nome) throw new Error(`Aprovador sem nome resolvido (id ${id}).`);
    const auto = id === cri;
    return {
      ordem: base + i + 1,
      aprovador_id: id,
      papel: nome,
      tipo_etapa: 'aprovacao',
      status: auto ? 'auto_aprovada' : 'pendente',
      decidido_em: auto ? agora : null,
    };
  });

  const execucao = {
    ordem: base + caudaIds.length + 1,
    aprovador_id: APROVADORES.admin,
    papel: 'Admin (execução)',
    tipo_etapa: 'execucao',
    status: 'pendente',
    decidido_em: null,
  };

  const inserir = [...novasAprovacoes, execucao];

  const key = (e) => `${norm(e.aprovador_id)}|${e.tipo_etapa}|${e.status}`;
  const semMudanca = pendentes.map(key).join(',') === inserir.map(key).join(',');

  return { semMudanca, apagarIds: pendentes.map((e) => e.id), inserir };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/config/reconciliarEtapas.test.js`
Expected: PASS — 7 tests ok.

- [ ] **Step 5: Verify no lint regressions**

Run: `npm run lint`
Expected: no new errors in `src/config/aprovacao.js` / `src/config/reconciliarEtapas.test.js`.

---

### Task 2: Função de I/O `resincronizarPendentes`

**Files:**
- Modify: `src/config/aprovacao.js` (adicionar `resincronizarPendentes` após `reconciliarEtapas`)
- Test: `src/config/resincronizarPendentes.test.js` (criar)

**Interfaces:**
- Consumes: `reconciliarEtapas` (Task 1).
- Produces:
  ```
  async resincronizarPendentes(supabase, { solicitanteId, tipo, moldeIds, nomePorId, agora }) -> number
  ```
  Retorna a quantidade de requisições efetivamente atualizadas. Para cada
  requisição pendente do gestor+tipo que mudou: apaga as etapas pendentes e
  insere as novas (com `solicitacao_id`). Requisições `semMudanca` são puladas.

- [ ] **Step 1: Write the failing test**

Create `src/config/resincronizarPendentes.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resincronizarPendentes, APROVADORES } from './aprovacao.js';

const ADMIN = APROVADORES.admin;
const AGORA = '2026-07-01T00:00:00.000Z';

// Fake supabase: uma sol muda (S1) e uma não muda (S2 já bate com molde ['a']).
function fakeSupabase(calls) {
  const sols = [
    {
      id: 'S1',
      etapas: [
        { id: 'x1', ordem: 1, aprovador_id: 'a', papel: 'Ana', tipo_etapa: 'aprovacao', status: 'pendente' },
        { id: 'x2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
      ],
    },
    {
      id: 'S2',
      etapas: [
        { id: 'y1', ordem: 1, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente' },
        { id: 'y2', ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente' },
      ],
    },
  ];
  return {
    from(table) {
      if (table === 'solicitacoes_rh') {
        const b = { select: () => b, eq: () => b, then: (res) => res({ data: sols, error: null }) };
        return b;
      }
      // solicitacoes_rh_etapas
      return {
        delete: () => ({ eq: () => ({ eq: () => { calls.push({ op: 'delete' }); return Promise.resolve({ error: null }); } }) }),
        insert: (rows) => { calls.push({ op: 'insert', rows }); return Promise.resolve({ error: null }); },
      };
    },
  };
}

test('atualiza só as requisições que mudaram e retorna a contagem', async () => {
  const calls = [];
  const nomes = { a: 'Ana', b: 'Bruno' };
  // molde ['b']: S1 (tinha 'a') muda; S2 (já 'b') fica igual.
  const n = await resincronizarPendentes(fakeSupabase(calls), {
    solicitanteId: 'g', tipo: 'aumento_salario', moldeIds: ['b'], nomePorId: nomes, agora: AGORA,
  });
  assert.equal(n, 1);
  const dels = calls.filter((c) => c.op === 'delete');
  const ins = calls.filter((c) => c.op === 'insert');
  assert.equal(dels.length, 1);
  assert.equal(ins.length, 1);
  assert.deepEqual(ins[0].rows, [
    { ordem: 1, aprovador_id: 'b', papel: 'Bruno', tipo_etapa: 'aprovacao', status: 'pendente', decidido_em: null, solicitacao_id: 'S1' },
    { ordem: 2, aprovador_id: ADMIN, papel: 'Admin (execução)', tipo_etapa: 'execucao', status: 'pendente', decidido_em: null, solicitacao_id: 'S1' },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/config/resincronizarPendentes.test.js`
Expected: FAIL — `resincronizarPendentes` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/config/aprovacao.js`:

```js
/**
 * Aplica o molde novo às requisições PENDENTES de um gestor+tipo.
 * Usa reconciliarEtapas por requisição; nas que mudaram, apaga as etapas
 * pendentes e insere as novas. Nunca toca em etapas decididas.
 * Retorna quantas requisições foram atualizadas.
 */
export async function resincronizarPendentes(supabase, { solicitanteId, tipo, moldeIds, nomePorId, agora }) {
  const { data: sols, error } = await supabase
    .from('solicitacoes_rh')
    .select('id, etapas:solicitacoes_rh_etapas(id, ordem, aprovador_id, papel, tipo_etapa, status)')
    .eq('gestor_id', solicitanteId)
    .eq('tipo', tipo)
    .eq('status', 'pendente');
  if (error) throw error;

  let atualizadas = 0;
  for (const sol of sols || []) {
    const { semMudanca, inserir } = reconciliarEtapas(sol.etapas, moldeIds, nomePorId, solicitanteId, agora);
    if (semMudanca) continue;

    const { error: eDel } = await supabase
      .from('solicitacoes_rh_etapas')
      .delete()
      .eq('solicitacao_id', sol.id)
      .eq('status', 'pendente');
    if (eDel) throw eDel;

    const rows = inserir.map((r) => ({ ...r, solicitacao_id: sol.id }));
    const { error: eIns } = await supabase.from('solicitacoes_rh_etapas').insert(rows);
    if (eIns) throw eIns;

    atualizadas += 1;
  }
  return atualizadas;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/config/resincronizarPendentes.test.js`
Expected: PASS — 1 test ok.

- [ ] **Step 5: Verify full suite + lint**

Run: `node --test src/config/*.test.js && npm run lint`
Expected: all tests PASS; no new lint errors.

---

### Task 3: Chamar a re-sincronização no `AdminFluxos.salvar`

**Files:**
- Modify: `src/pages/Admin/AdminFluxos.jsx` (import + corpo do `salvar`)

**Interfaces:**
- Consumes: `resincronizarPendentes` (Task 2). Reaproveita o `nomePorId` já calculado no componente (linha ~25) e o `aprovadores` já montado dentro de `salvar`.

- [ ] **Step 1: Adicionar o import**

Em `src/pages/Admin/AdminFluxos.jsx`, alterar a linha de import de `../../config/aprovacao`:

De:
```js
import { FLUXO_GERAL, normIniciativa, TIPOS_FLUXO, TIPO_LABEL_CURTO, APROVADOR_MAPEAMENTO } from '../../config/aprovacao';
```
Para:
```js
import { FLUXO_GERAL, normIniciativa, TIPOS_FLUXO, TIPO_LABEL_CURTO, APROVADOR_MAPEAMENTO, resincronizarPendentes } from '../../config/aprovacao';
```

- [ ] **Step 2: Chamar a re-sincronização após o upsert bem-sucedido**

No `salvar`, substituir o bloco entre o `if (error) throw error;` e o `await carregarBase();`.

De:
```js
      if (error) throw error;
      setSucesso(`Fluxo salvo: ${TIPO_LABEL_CURTO[tipoSel]} — ${solicitante?.nome || ''}`);
      setTimeout(() => setSucesso(''), 4000);
      await carregarBase();
```
Para:
```js
      if (error) throw error;

      let extra = '';
      try {
        const n = await resincronizarPendentes(supabase, {
          solicitanteId,
          tipo: tipoSel,
          moldeIds: aprovadores,
          nomePorId,
          agora: new Date().toISOString(),
        });
        if (n > 0) {
          extra = ` · ${n} pendente(s) atualizada(s)`;
          window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
        }
      } catch (errSync) {
        console.error('Erro ao re-sincronizar pendentes:', errSync);
        extra = ' · (aviso: houve erro ao atualizar pendentes — reabra e salve de novo)';
      }

      setSucesso(`Fluxo salvo: ${TIPO_LABEL_CURTO[tipoSel]} — ${solicitante?.nome || ''}${extra}`);
      setTimeout(() => setSucesso(''), 5000);
      await carregarBase();
```

Nota: `nomePorId` já existe no escopo do componente (`const nomePorId = Object.fromEntries(pool.map((c) => [c.id, c.nome]));`, ~linha 25) e `aprovadores` já foi montado no início de `salvar`. O molde já foi gravado, então o erro de re-sincronização é não-bloqueante (só avisa).

- [ ] **Step 3: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros (o chunk de `AdminFluxos` compila com o novo import).

- [ ] **Step 4: Verificação manual (documentar resultado)**

Com `npm run dev`:
1. Entrar em **Fluxos de Aprovação** como admin, escolher um gestor que tenha requisição PENDENTE de um tipo.
2. Editar a cadeia daquele tipo (ex.: adicionar/remover um aprovador) e clicar **Salvar fluxo**.
3. Conferir a mensagem verde: deve incluir `· N pendente(s) atualizada(s)`.
4. Abrir a requisição pendente daquele gestor+tipo (Acompanhar/Admin) e confirmar que a timeline reflete o molde novo, com as etapas já aprovadas preservadas.
5. Salvar de novo sem mudar nada → mensagem NÃO deve mostrar "pendente(s) atualizada(s)" (no-op).

---

## Self-Review

**Spec coverage:**
- Objetivo (atualizar pendentes preservando decididas) → Tasks 1+2+3. ✓
- Reconciliação "substitui o que falta" → `reconciliarEtapas` (Task 1), casos 2/3. ✓
- Opção A (roda no cliente, no salvar) → Task 3. ✓
- Escopo por tipo → filtro `.eq('tipo', tipo)` na Task 2. ✓
- Pronta pra execução + molde adiciona aprovador → Task 1, caso "pronta pra execução". ✓
- No-op quando nada muda → Task 1 caso semMudanca + Task 2 pula. ✓
- Nunca deletar decididas (segurança sem transação) → delete filtra `status='pendente'`. ✓
- Feedback de quantas atualizadas + refresh das listas → Task 3 (mensagem + evento). ✓

**Placeholder scan:** nenhum TBD/TODO; todo código está completo. ✓

**Type consistency:** `reconciliarEtapas(etapasAtuais, moldeIds, nomePorId, criadorId, agora)` e `resincronizarPendentes(supabase, {solicitanteId, tipo, moldeIds, nomePorId, agora})` usados de forma idêntica entre tasks; `inserir` rows têm o mesmo shape em Task 1 e Task 2 (com `solicitacao_id` adicionado). ✓
