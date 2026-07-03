# Máscara de moeda nos valores das requisições — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formatar automaticamente, em padrão pt-BR, os campos de valor (R$) das requisições enquanto o usuário digita (ponto = milhar, vírgula = centavos).

**Architecture:** Um utilitário puro (`currencyMask.js`) com a máscara e o parse; um componente `CurrencyInput` que aplica a máscara; os 6 campos de dinheiro das requisições passam a usá-lo, e a conversão pra número no envio passa a usar `parseCurrency` em vez de `Number()`.

**Tech Stack:** React 19, Vite 8, Vanilla CSS, testes com `node --test` (runner nativo).

## Global Constraints

- Comportamento da máscara (confirmado): **agrupar milhar; vírgula = centavos** (NÃO é centavos automáticos). `12000`→`12.000`; `1200000`→`1.200.000`; a vírgula só entra quando digitada; decimais limitados a 2 casas; não força 2 casas.
- Envio ao banco: `"12.000"`→`12000`, `"12.000,50"`→`12000.50`, vazio→`null`.
- O estado do formulário passa a guardar a **string mascarada**; a conversão para número acontece só no envio, via `parseCurrency`.
- Campos afetados (todos rotulados "(R$)"): Ajuda de Custo (`alimentacao_valor`, `mobilidade_valor`, `moradia_valor`), Nova Vaga (`valor_orcado_contrato`, `valor_margem_proposta`), Alteração de Cargo (`salario_proposto`).
- Fora de escopo: campos fora das requisições (reembolso tem formato próprio), prefill de valores existentes, centavos automáticos, exibição read-only (segue `formatarMoeda`).
- Vanilla CSS / classes existentes (`form-input`). Sem novas dependências.

---

### Task 1: Utilitário `currencyMask.js` + testes

**Files:**
- Create: `src/utils/currencyMask.js`
- Test: `src/utils/currencyMask.test.js`
- Modify: `package.json` (script `test` passa a descobrir todos os testes)

**Interfaces:**
- Produces:
  - `maskCurrencyInput(texto: string) => string`
  - `parseCurrency(mascarado: string) => number | null`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/utils/currencyMask.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskCurrencyInput, parseCurrency } from './currencyMask.js';

test('maskCurrencyInput agrupa milhar sem casas decimais', () => {
  assert.equal(maskCurrencyInput('1'), '1');
  assert.equal(maskCurrencyInput('12'), '12');
  assert.equal(maskCurrencyInput('1200'), '1.200');
  assert.equal(maskCurrencyInput('12000'), '12.000');
  assert.equal(maskCurrencyInput('1200000'), '1.200.000');
});

test('maskCurrencyInput trata a vírgula como centavos, no máx 2 casas', () => {
  assert.equal(maskCurrencyInput('12000,5'), '12.000,5');
  assert.equal(maskCurrencyInput('12000,50'), '12.000,50');
  assert.equal(maskCurrencyInput('12000,509'), '12.000,50');
});

test('maskCurrencyInput preserva a vírgula pendente enquanto digita', () => {
  assert.equal(maskCurrencyInput('12000,'), '12.000,');
});

test('maskCurrencyInput assume 0 quando começa pela vírgula', () => {
  assert.equal(maskCurrencyInput(',50'), '0,50');
});

test('maskCurrencyInput descarta letras e vírgulas extras', () => {
  assert.equal(maskCurrencyInput('R$ 12abc00'), '1.200');
  assert.equal(maskCurrencyInput('12,,5'), '12,5');
});

test('maskCurrencyInput remove zeros à esquerda, preservando um zero', () => {
  assert.equal(maskCurrencyInput('01'), '1');
  assert.equal(maskCurrencyInput('00'), '0');
  assert.equal(maskCurrencyInput('0'), '0');
});

test('maskCurrencyInput trata vazio e null', () => {
  assert.equal(maskCurrencyInput(''), '');
  assert.equal(maskCurrencyInput(null), '');
});

test('parseCurrency converte a string mascarada em número', () => {
  assert.equal(parseCurrency('12.000'), 12000);
  assert.equal(parseCurrency('12.000,50'), 12000.5);
  assert.equal(parseCurrency('1.200.000'), 1200000);
  assert.equal(parseCurrency('0'), 0);
});

test('parseCurrency retorna null para vazio/nulo', () => {
  assert.equal(parseCurrency(''), null);
  assert.equal(parseCurrency(null), null);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test "src/utils/currencyMask.test.js"`
Expected: FAIL — `Cannot find module './currencyMask.js'`.

- [ ] **Step 3: Implementar o utilitário**

Create `src/utils/currencyMask.js`:

```js
// Máscara de moeda pt-BR para inputs das requisições: ponto = milhar,
// vírgula = centavos. Puro (sem React), testável com `node --test`.

/**
 * Formata o texto digitado no padrão pt-BR enquanto o usuário digita.
 * Mantém apenas dígitos e a 1ª vírgula; agrupa a parte inteira com pontos
 * de milhar; limita a parte decimal a 2 casas. '' e null => ''.
 */
export function maskCurrencyInput(texto) {
  if (texto == null) return '';
  const s = String(texto);
  const iVirgula = s.indexOf(',');

  let inteiroRaw;
  let decimalRaw = '';
  const temVirgula = iVirgula !== -1;

  if (temVirgula) {
    inteiroRaw = s.slice(0, iVirgula).replace(/\D/g, '');
    decimalRaw = s.slice(iVirgula + 1).replace(/\D/g, '').slice(0, 2);
  } else {
    inteiroRaw = s.replace(/\D/g, '');
  }

  // Remove zeros à esquerda, preservando um único zero.
  inteiroRaw = inteiroRaw.replace(/^0+(?=\d)/, '');
  if (inteiroRaw === '' && temVirgula) inteiroRaw = '0';

  const inteiroFmt = inteiroRaw === ''
    ? ''
    : inteiroRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return temVirgula ? `${inteiroFmt},${decimalRaw}` : inteiroFmt;
}

/**
 * Converte a string mascarada em número para envio ao banco.
 * '' / null => null. Ex.: '12.000,50' => 12000.5.
 */
export function parseCurrency(mascarado) {
  if (mascarado == null) return null;
  const s = String(mascarado).trim();
  if (s === '') return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test "src/utils/currencyMask.test.js"`
Expected: PASS — `# pass 9`, `# fail 0`.

- [ ] **Step 5: Ajustar o script de teste para descobrir todos os testes**

Modify `package.json` — trocar a linha `test` para descobrir todos os `*.test.js` (inclui o de organograma e o novo):

```json
    "test": "node --test",
```

Rodar `npm test` e confirmar que os testes existentes + os novos passam (deve incluir os do organograma e os de config já presentes). Se algum teste PRÉ-EXISTENTE e não relacionado falhar, apenas registrar no report (não corrigir aqui); os testes de `currencyMask` e `organograma` devem passar.

- [ ] **Step 6: Commit**

```bash
git add "src/utils/currencyMask.js" "src/utils/currencyMask.test.js" package.json
git commit -m "feat(requisicoes): utilitario de mascara de moeda pt-BR + testes"
```

---

### Task 2: Componente `CurrencyInput` + Alteração de Cargo

**Files:**
- Create: `src/components/CurrencyInput.jsx`
- Modify: `src/pages/Gestor/requisicoes/FormAlteracao.jsx`

**Interfaces:**
- Consumes (Task 1): `maskCurrencyInput`, `parseCurrency` de `src/utils/currencyMask.js`.
- Produces: `CurrencyInput` — default export, props `{ value, onChange, placeholder, id, className }`, chama `onChange(stringMascarada)`.

- [ ] **Step 1: Criar o componente**

Create `src/components/CurrencyInput.jsx`:

```jsx
import { maskCurrencyInput } from '../utils/currencyMask';

/**
 * Input de moeda pt-BR (ponto = milhar, vírgula = centavos). Controlado:
 * guarda/devolve a STRING mascarada; a conversão p/ número é no envio.
 */
export default function CurrencyInput({ value, onChange, placeholder, id, className = 'form-input' }) {
  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      id={id}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => onChange(maskCurrencyInput(e.target.value))}
    />
  );
}
```

- [ ] **Step 2: Usar o componente no FormAlteracao**

Modify `src/pages/Gestor/requisicoes/FormAlteracao.jsx`:

(a) Adicionar imports (junto aos imports existentes do topo do arquivo):

```jsx
import CurrencyInput from '../../../components/CurrencyInput';
import { parseCurrency } from '../../../utils/currencyMask';
```

(b) Trocar o input de "Novo valor (R$)". Substituir este bloco:

```jsx
            <input className="form-input" type="number" min="0" step="0.01" placeholder="Ex: 9500.00"
              value={form.salario_proposto}
              onChange={(e) => setForm((p) => ({ ...p, salario_proposto: e.target.value }))} />
```

por:

```jsx
            <CurrencyInput placeholder="Ex: 9.500,00"
              value={form.salario_proposto}
              onChange={(v) => setForm((p) => ({ ...p, salario_proposto: v }))} />
```

(c) No `onSubmit`, converter com `parseCurrency`. Substituir a linha:

```jsx
        salario_proposto: temValor ? Number(form.salario_proposto) : null,
```

por:

```jsx
        salario_proposto: temValor ? parseCurrency(form.salario_proposto) : null,
```

Observação: `const temValor = form.salario_proposto !== '';` continua igual (string vazia = sem valor).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros novos vindos de `CurrencyInput.jsx` / `FormAlteracao.jsx`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 5: Commit**

```bash
git add "src/components/CurrencyInput.jsx" "src/pages/Gestor/requisicoes/FormAlteracao.jsx"
git commit -m "feat(requisicoes): mascara de moeda no campo de valor da Alteracao de Cargo"
```

---

### Task 3: Ajuda de Custo e Nova Vaga (campos por config)

**Files:**
- Modify: `src/config/ajudaCusto.js`
- Modify: `src/config/novaVaga.js`
- Modify: `src/pages/Gestor/requisicoes/FormAjudaCusto.jsx`
- Modify: `src/pages/Gestor/requisicoes/FormNovaVaga.jsx`

**Interfaces:**
- Consumes (Task 1): `parseCurrency`. Consumes (Task 2): `CurrencyInput`.

- [ ] **Step 1: Ajuda de Custo — marcar campos como `moeda` e converter no payload**

Modify `src/config/ajudaCusto.js`:

(a) No topo do arquivo, adicionar o import:

```js
import { parseCurrency } from '../utils/currencyMask';
```

(b) Trocar `tipo: 'number'` por `tipo: 'moeda'` nos três campos de valor. Linhas atuais:

```js
  { id: 'alimentacao_valor', n: 4, label: 'Alimentação - Valor (R$)', tipo: 'number', obrigatorio: true, mostrar: tem('Alimentação') },
```
```js
  { id: 'mobilidade_valor', n: 6, label: 'Mobilidade - Valor (R$)', tipo: 'number', obrigatorio: true, mostrar: tem('Mobilidade') },
```
```js
  { id: 'moradia_valor', n: 8, label: 'Moradia - Valor (R$)', tipo: 'number', obrigatorio: true, mostrar: tem('Moradia') },
```

Em cada uma, trocar `tipo: 'number'` → `tipo: 'moeda'`.

(c) Em `montarPayloadAjudaCusto`, tratar `moeda`. Substituir a linha:

```js
    if (c.tipo === 'number') out[c.id] = v === '' || v == null ? null : (c.inteiro ? Math.trunc(Number(v)) : Number(v));
```

por:

```js
    if (c.tipo === 'moeda') out[c.id] = parseCurrency(v);
    else if (c.tipo === 'number') out[c.id] = v === '' || v == null ? null : (c.inteiro ? Math.trunc(Number(v)) : Number(v));
```

- [ ] **Step 2: Nova Vaga — marcar campos como `moeda` e converter no payload**

Modify `src/config/novaVaga.js`:

(a) No topo do arquivo, adicionar o import:

```js
import { parseCurrency } from '../utils/currencyMask';
```

(b) Trocar `tipo: 'number'` por `tipo: 'moeda'` nos dois campos de valor. Linhas atuais:

```js
  { id: 'valor_orcado_contrato', n: 9, secao: 'Informações adicionais', label: 'Valor do profissional orçado no contrato Comercial (R$)', tipo: 'number', obrigatorio: true },
```
```js
  { id: 'valor_margem_proposta', n: 10, secao: 'Informações adicionais', label: 'Valor/margem salarial para a proposta ao Candidato (R$)', tipo: 'number', obrigatorio: true },
```

Em cada uma, trocar `tipo: 'number'` → `tipo: 'moeda'`.

(c) Em `montarPayloadNovaVaga`, tratar `moeda`. Substituir a linha:

```js
    if (c.tipo === 'number') out[c.id] = v === '' || v == null ? null : (c.inteiro ? Math.trunc(Number(v)) : Number(v));
```

por:

```js
    if (c.tipo === 'moeda') out[c.id] = parseCurrency(v);
    else if (c.tipo === 'number') out[c.id] = v === '' || v == null ? null : (c.inteiro ? Math.trunc(Number(v)) : Number(v));
```

- [ ] **Step 3: FormAjudaCusto — renderizar `moeda` com CurrencyInput**

Modify `src/pages/Gestor/requisicoes/FormAjudaCusto.jsx`:

(a) Adicionar o import (junto aos imports do topo):

```jsx
import CurrencyInput from '../../../components/CurrencyInput';
```

(b) Em `renderCampo`, adicionar um ramo para `moeda` ANTES do `return` final do input genérico (logo após o bloco `if (c.tipo === 'textarea') { ... }`):

```jsx
    if (c.tipo === 'moeda') {
      return <CurrencyInput value={val} onChange={(v) => set(c.id, v)} />;
    }
```

- [ ] **Step 4: FormNovaVaga — renderizar `moeda` com CurrencyInput**

Modify `src/pages/Gestor/requisicoes/FormNovaVaga.jsx`:

(a) Adicionar o import (junto aos imports do topo):

```jsx
import CurrencyInput from '../../../components/CurrencyInput';
```

(b) Em `renderCampo`, adicionar um ramo para `moeda` ANTES do `return` final do input genérico (logo após o bloco `if (c.tipo === 'textarea') { ... }`):

```jsx
    if (c.tipo === 'moeda') {
      return <CurrencyInput value={val} onChange={(v) => set(c.id, v)} />;
    }
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sem erros novos vindos dos 4 arquivos.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 7: Smoke manual (checklist para o controller/usuário)**

Run: `npm run dev`. Em Gestor → Requisição:
1. **Alteração de Cargo / Função**: no "Novo valor (R$)", digitar `12000` mostra `12.000`; `1200000` mostra `1.200.000`; `12000,5` mostra `12.000,5`. Enviar e conferir no banco/acompanhamento que gravou 12000 / 1200000 / 12000.5.
2. **Ajuda de Custo**: marcar Alimentação/Mobilidade/Moradia e digitar valores — a máscara aplica nos 3 campos; enviar e conferir os valores numéricos.
3. **Nova Vaga**: os dois campos de valor (orçado no contrato / margem da proposta) aplicam a máscara; enviar e conferir.

- [ ] **Step 8: Commit**

```bash
git add "src/config/ajudaCusto.js" "src/config/novaVaga.js" "src/pages/Gestor/requisicoes/FormAjudaCusto.jsx" "src/pages/Gestor/requisicoes/FormNovaVaga.jsx"
git commit -m "feat(requisicoes): mascara de moeda nos campos de Ajuda de Custo e Nova Vaga"
```

---

## Notas de execução

- Depois da Task 1, os imports relativos: de `src/config/*` para o util é `../utils/currencyMask`; de `src/pages/Gestor/requisicoes/*` para o componente é `../../../components/CurrencyInput` e para o util `../../../utils/currencyMask`; de `src/components/CurrencyInput.jsx` para o util é `../utils/currencyMask`.
- `npm run lint`/`npm run build` cobrem o repo inteiro e podem mostrar problemas PRÉ-EXISTENTES de outros arquivos — o critério é não introduzir erros novos e o build passar.
