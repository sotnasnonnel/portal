# Consulta Organograma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar a tela read-only "Consulta Organograma" que lista, por mês, as alocações de colaboradores em contratos (com % e gerente), lidas do projeto Supabase `backoffice_phd`.

**Architecture:** Uma página React (`ConsultaOrganograma.jsx`) consome a tabela `organograma_alocacao` (com colaborador embutido) via o client read-only dedicado `supabaseBackoffice`. Toda a lógica de transformação/filtro fica num módulo puro (`organogramaData.js`) testável isoladamente. O carregamento fica num hook (`useOrganograma.js`). A tela é acessada pelo dispatcher de requisições existente.

**Tech Stack:** React 19, react-router-dom 7, lucide-react 1.7, Vanilla CSS (sem Tailwind), @supabase/supabase-js 2, testes com `node --test` (runner nativo, sem dependência nova).

## Global Constraints

- Vanilla CSS usando os tokens/estilo das telas existentes (`Gestor.css`, `Requisicoes.css`) — tema terracota. Sem Tailwind.
- Leitura SOMENTE via `src/services/supabaseBackoffice.js` (client read-only já existente). Nunca usar o client principal do Portal para dados de organograma.
- Coluna `%`: mostra `percentual` quando existir; `null`/vazio → `—`.
- A tela é read-only: não grava nada, não usa `tipoDb`.
- Origem: `organograma_alocacao` no projeto `backoffice_phd`. Colunas: `percentual`, `obra_cod_phd` (= contrato), `mes` (date `YYYY-MM-01`); `nome` e `gerente` vêm de `organograma_colaborador` via FK `colaborador_id`.
- Faixa de meses vem dos próprios dados (não hardcodar). Mês padrão = mês corrente se existir na base; senão o mais recente.

---

### Task 1: Módulo puro de dados (`organogramaData.js`) + testes

Lógica de normalização, meses, opções de filtro, filtragem e formatação — sem React nem Supabase, testada com `node --test`.

**Files:**
- Create: `src/pages/Gestor/requisicoes/organograma/organogramaData.js`
- Test: `src/pages/Gestor/requisicoes/organograma/organogramaData.test.js`
- Modify: `package.json` (adicionar script `test`)

**Interfaces:**
- Produces:
  - `mapAlocacoes(rows) -> Array<{colaborador:string, contrato:string, gerente:string, percentual:number|null}>`
  - `distinctMonths(rows) -> string[]` (ISO `YYYY-MM-01`, desc)
  - `resolveDefaultMonth(months:string[], today:Date) -> string|null`
  - `deriveFilterOptions(rows) -> {gerentes:string[], contratos:string[]}`
  - `applyFilters(rows, {gerente, contrato, nome}) -> rows`
  - `formatPercent(value) -> string`
  - `formatMonthLabel(iso) -> string` (`MM/AAAA`)
  - `countColaboradores(rows) -> number`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/pages/Gestor/requisicoes/organograma/organogramaData.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapAlocacoes, distinctMonths, resolveDefaultMonth, deriveFilterOptions,
  applyFilters, formatPercent, formatMonthLabel, countColaboradores,
} from './organogramaData.js';

const CRU = [
  { percentual: null, obra_cod_phd: 'AURI-CT01-GERE', mes: '2026-05-01', colaborador: { nome: 'ADAILTON ANDRADE', gerente: 'Paulo Paiva' } },
  { percentual: 50, obra_cod_phd: 'GOIA-CT01-GERE', mes: '2026-05-01', colaborador: { nome: 'ADAILTON ANDRADE', gerente: 'Paulo Paiva' } },
  { percentual: null, obra_cod_phd: 'CORP>ADM', mes: '2026-01-01', colaborador: { nome: 'ALESSANDRA SOBRAL', gerente: 'Pedro Morais' } },
];

test('mapAlocacoes achata colaborador embutido', () => {
  const out = mapAlocacoes(CRU);
  assert.deepEqual(out[0], { colaborador: 'ADAILTON ANDRADE', contrato: 'AURI-CT01-GERE', gerente: 'Paulo Paiva', percentual: null });
  assert.equal(out[1].percentual, 50);
});

test('mapAlocacoes tolera entrada inválida', () => {
  assert.deepEqual(mapAlocacoes(null), []);
});

test('distinctMonths retorna meses únicos em ordem desc', () => {
  assert.deepEqual(distinctMonths(CRU), ['2026-05-01', '2026-01-01']);
});

test('resolveDefaultMonth usa o mês corrente quando existe', () => {
  const months = ['2026-05-01', '2026-01-01'];
  assert.equal(resolveDefaultMonth(months, new Date('2026-05-15T12:00:00')), '2026-05-01');
});

test('resolveDefaultMonth cai no mais recente quando o corrente não existe', () => {
  const months = ['2026-05-01', '2026-01-01'];
  assert.equal(resolveDefaultMonth(months, new Date('2026-09-10T12:00:00')), '2026-05-01');
});

test('resolveDefaultMonth com lista vazia retorna null', () => {
  assert.equal(resolveDefaultMonth([], new Date('2026-05-15')), null);
});

test('deriveFilterOptions distingue e ordena gerentes e contratos', () => {
  const opts = deriveFilterOptions(mapAlocacoes(CRU));
  assert.deepEqual(opts.gerentes, ['Paulo Paiva', 'Pedro Morais']);
  assert.deepEqual(opts.contratos, ['AURI-CT01-GERE', 'CORP>ADM', 'GOIA-CT01-GERE']);
});

test('applyFilters combina gerente, contrato e nome', () => {
  const rows = mapAlocacoes(CRU);
  assert.equal(applyFilters(rows, { gerente: 'Paulo Paiva' }).length, 2);
  assert.equal(applyFilters(rows, { contrato: 'CORP>ADM' }).length, 1);
  assert.equal(applyFilters(rows, { nome: 'alessandra' }).length, 1);
  assert.equal(applyFilters(rows, {}).length, 3);
});

test('formatPercent mostra — para null e N% para número', () => {
  assert.equal(formatPercent(null), '—');
  assert.equal(formatPercent(undefined), '—');
  assert.equal(formatPercent(''), '—');
  assert.equal(formatPercent(50), '50%');
});

test('formatMonthLabel formata YYYY-MM-01 como MM/AAAA', () => {
  assert.equal(formatMonthLabel('2026-05-01'), '05/2026');
  assert.equal(formatMonthLabel(''), '');
});

test('countColaboradores conta pessoas distintas', () => {
  assert.equal(countColaboradores(mapAlocacoes(CRU)), 2);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test "src/pages/Gestor/requisicoes/organograma/organogramaData.test.js"`
Expected: FAIL — `Cannot find module './organogramaData.js'` (o módulo ainda não existe).

- [ ] **Step 3: Implementar o módulo**

Create `src/pages/Gestor/requisicoes/organograma/organogramaData.js`:

```js
// Helpers puros da Consulta Organograma. Sem dependências de React/Supabase,
// para serem testados isoladamente com `node --test`.

/**
 * Normaliza linhas cruas de organograma_alocacao (colaborador embutido)
 * para o formato plano da tabela.
 */
export function mapAlocacoes(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    colaborador: r.colaborador?.nome ?? '',
    contrato: r.obra_cod_phd ?? '',
    gerente: r.colaborador?.gerente ?? '',
    percentual: r.percentual ?? null,
  }));
}

/** Meses distintos em ISO 'YYYY-MM-01', ordem desc. */
export function distinctMonths(rows) {
  const set = new Set();
  for (const r of rows ?? []) {
    if (r?.mes) set.add(String(r.mes).slice(0, 10));
  }
  return [...set].sort().reverse();
}

/** Mês corrente (primeiro dia) se existir; senão o mais recente. */
export function resolveDefaultMonth(months, today) {
  if (!months || months.length === 0) return null;
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const currentIso = `${y}-${m}-01`;
  if (months.includes(currentIso)) return currentIso;
  return [...months].sort().reverse()[0];
}

/** Opções distintas e ordenadas (pt-BR) para os dropdowns. */
export function deriveFilterOptions(rows) {
  const gerentes = new Set();
  const contratos = new Set();
  for (const r of rows ?? []) {
    if (r.gerente) gerentes.add(r.gerente);
    if (r.contrato) contratos.add(r.contrato);
  }
  const byPtBr = (a, b) => a.localeCompare(b, 'pt-BR');
  return {
    gerentes: [...gerentes].sort(byPtBr),
    contratos: [...contratos].sort(byPtBr),
  };
}

/** Filtra por gerente, contrato e nome (case-insensitive). '' = sem filtro. */
export function applyFilters(rows, { gerente = '', contrato = '', nome = '' } = {}) {
  const alvo = nome.trim().toLowerCase();
  return (rows ?? []).filter((r) => {
    if (gerente && r.gerente !== gerente) return false;
    if (contrato && r.contrato !== contrato) return false;
    if (alvo && !r.colaborador.toLowerCase().includes(alvo)) return false;
    return true;
  });
}

/** '—' quando null/undefined/''; senão 'N%'. */
export function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${value}%`;
}

/** 'YYYY-MM-01' -> 'MM/AAAA'. */
export function formatMonthLabel(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}

/** Nº de colaboradores distintos. */
export function countColaboradores(rows) {
  return new Set((rows ?? []).map((r) => r.colaborador)).size;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test "src/pages/Gestor/requisicoes/organograma/organogramaData.test.js"`
Expected: PASS — todos os testes (`# pass 11`, `# fail 0`).

- [ ] **Step 5: Adicionar script de teste**

Modify `package.json` — dentro de `"scripts"`, acrescentar a linha `test` (após `"lint"`):

```json
    "lint": "eslint .",
    "test": "node --test \"src/pages/Gestor/requisicoes/organograma/organogramaData.test.js\"",
```

- [ ] **Step 6: Commit**

```bash
git add "src/pages/Gestor/requisicoes/organograma/organogramaData.js" "src/pages/Gestor/requisicoes/organograma/organogramaData.test.js" package.json
git commit -m "feat(organograma): helpers puros de dados + testes"
```

---

### Task 2: Hook de carga + página `ConsultaOrganograma` + CSS

O hook busca os dados no `backoffice_phd`; a página monta filtros + tabela. Verificação por `lint` + `build` (a tela ainda não está roteada — isso vem na Task 3).

**Files:**
- Create: `src/pages/Gestor/requisicoes/organograma/useOrganograma.js`
- Create: `src/pages/Gestor/requisicoes/ConsultaOrganograma.jsx`
- Create: `src/pages/Gestor/requisicoes/organograma/ConsultaOrganograma.css`

**Interfaces:**
- Consumes (da Task 1): `mapAlocacoes`, `distinctMonths`, `resolveDefaultMonth`, `deriveFilterOptions`, `applyFilters`, `formatPercent`, `formatMonthLabel`, `countColaboradores`.
- Consumes: `supabaseBackoffice` de `src/services/supabaseBackoffice.js`.
- Produces:
  - `useOrganograma(mes:string) -> { months:string[], rows:Array, loading:boolean, error:string|null, recarregar:()=>void }`
  - `ConsultaOrganograma` — default export (componente sem props).

- [ ] **Step 1: Criar o hook de carga**

Create `src/pages/Gestor/requisicoes/organograma/useOrganograma.js`:

```js
import { useState, useEffect, useCallback } from 'react';
import { supabaseBackoffice } from '../../../../services/supabaseBackoffice';
import { mapAlocacoes, distinctMonths } from './organogramaData';

/**
 * Carrega a lista de meses (uma vez) e as alocações do mês selecionado
 * do projeto backoffice_phd. Read-only.
 */
export function useOrganograma(mes) {
  const [months, setMonths] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lista de meses disponíveis (só a coluna mes de toda a tabela).
  useEffect(() => {
    let ativo = true;
    supabaseBackoffice
      .from('organograma_alocacao')
      .select('mes')
      .then(({ data, error: err }) => {
        if (!ativo) return;
        if (err) { setError(err.message); return; }
        setMonths(distinctMonths(data));
      });
    return () => { ativo = false; };
  }, []);

  const carregar = useCallback(() => {
    if (!mes) return undefined;
    let ativo = true;
    setLoading(true);
    setError(null);
    supabaseBackoffice
      .from('organograma_alocacao')
      .select('percentual, obra_cod_phd, colaborador:organograma_colaborador(nome, gerente)')
      .eq('mes', mes)
      .then(({ data, error: err }) => {
        if (!ativo) return;
        if (err) { setError(err.message); setRows([]); }
        else setRows(mapAlocacoes(data));
        setLoading(false);
      });
    return () => { ativo = false; };
  }, [mes]);

  useEffect(() => carregar(), [carregar]);

  return { months, rows, loading, error, recarregar: carregar };
}
```

- [ ] **Step 2: Criar a página**

Create `src/pages/Gestor/requisicoes/ConsultaOrganograma.jsx`:

```jsx
import { useMemo, useState, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useOrganograma } from './organograma/useOrganograma';
import {
  resolveDefaultMonth, deriveFilterOptions, applyFilters,
  formatPercent, formatMonthLabel, countColaboradores,
} from './organograma/organogramaData';
import './organograma/ConsultaOrganograma.css';

export default function ConsultaOrganograma() {
  const [mes, setMes] = useState('');
  const { months, rows, loading, error, recarregar } = useOrganograma(mes);
  const [gerente, setGerente] = useState('');
  const [contrato, setContrato] = useState('');
  const [nome, setNome] = useState('');

  // Define o mês padrão assim que a lista de meses chega.
  useEffect(() => {
    if (!mes && months.length) setMes(resolveDefaultMonth(months, new Date()));
  }, [months, mes]);

  // Trocar de mês zera os filtros dependentes (evita filtro "fantasma").
  const [mesAnterior, setMesAnterior] = useState(mes);
  if (mes !== mesAnterior) {
    setMesAnterior(mes);
    setGerente('');
    setContrato('');
  }

  const opcoes = useMemo(() => deriveFilterOptions(rows), [rows]);
  const filtradas = useMemo(
    () => applyFilters(rows, { gerente, contrato, nome }),
    [rows, gerente, contrato, nome],
  );

  return (
    <div className="org-consulta">
      <div className="org-filtros">
        <label className="org-filtro">
          <span>Mês</span>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
        </label>
        <label className="org-filtro">
          <span>Gerente</span>
          <select value={gerente} onChange={(e) => setGerente(e.target.value)}>
            <option value="">Todos</option>
            {opcoes.gerentes.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="org-filtro">
          <span>Contrato</span>
          <select value={contrato} onChange={(e) => setContrato(e.target.value)}>
            <option value="">Todos</option>
            {opcoes.contratos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="org-filtro org-busca">
          <span>Buscar</span>
          <span className="org-busca-input">
            <Search size={15} />
            <input type="text" placeholder="Nome do colaborador"
              value={nome} onChange={(e) => setNome(e.target.value)} />
          </span>
        </label>
      </div>

      {loading && <p className="org-status">Carregando…</p>}

      {error && !loading && (
        <p className="org-status org-erro">
          Erro ao carregar: {error}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={recarregar}>
            <RefreshCw size={14} /> Tentar de novo
          </button>
        </p>
      )}

      {!loading && !error && (
        <>
          <p className="org-contador">
            {filtradas.length} alocações · {countColaboradores(filtradas)} colaboradores
          </p>
          {filtradas.length === 0 ? (
            <p className="org-status">Sem alocações neste mês.</p>
          ) : (
            <div className="org-tabela-wrap">
              <table className="org-tabela">
                <thead>
                  <tr>
                    <th>Colaborador</th><th>Contrato</th><th>%</th><th>Gerente</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((r, i) => (
                    <tr key={`${r.colaborador}-${r.contrato}-${i}`}>
                      <td>{r.colaborador}</td>
                      <td>{r.contrato}</td>
                      <td className="org-perc">{formatPercent(r.percentual)}</td>
                      <td>{r.gerente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Criar o CSS**

Create `src/pages/Gestor/requisicoes/organograma/ConsultaOrganograma.css`:

```css
.org-consulta {
  margin-top: var(--space-md);
}

.org-filtros {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  align-items: flex-end;
  margin-bottom: var(--space-lg);
}

.org-filtro {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.org-filtro select,
.org-filtro input {
  padding: 8px 10px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-bg-white);
  font-size: 13px;
  color: var(--color-text-secondary);
  min-width: 160px;
}

.org-busca-input {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-left: 8px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-bg-white);
  color: var(--color-text-muted);
}

.org-busca-input input {
  border: none;
  padding-left: 0;
  min-width: 180px;
}

.org-contador {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: var(--space-sm);
}

.org-status {
  font-size: 14px;
  color: var(--color-text-muted);
  padding: var(--space-md) 0;
}

.org-erro {
  color: var(--color-danger);
}

.org-tabela-wrap {
  overflow-x: auto;
}

.org-tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.org-tabela th,
.org-tabela td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.org-tabela th {
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.03em;
}

.org-tabela tbody tr:hover {
  background: var(--color-bg-subtle);
}

.org-perc {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: sem erros nos arquivos novos (`useOrganograma.js`, `ConsultaOrganograma.jsx`).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `vite build` conclui sem erro (imports resolvem, JSX válido).

- [ ] **Step 6: Commit**

```bash
git add "src/pages/Gestor/requisicoes/organograma/useOrganograma.js" "src/pages/Gestor/requisicoes/ConsultaOrganograma.jsx" "src/pages/Gestor/requisicoes/organograma/ConsultaOrganograma.css"
git commit -m "feat(organograma): tela de consulta (hook + filtros + tabela)"
```

---

### Task 3: Rotear a tela no dispatcher de requisições

Ligar o card "Consulta Organograma" à nova página e remover o badge "Em breve".

**Files:**
- Modify: `src/config/requisicoes.js` (item `consulta-organograma`)
- Modify: `src/pages/Gestor/requisicoes/NovaRequisicao.jsx`

**Interfaces:**
- Consumes (da Task 2): `ConsultaOrganograma` (default export de `./ConsultaOrganograma`).

- [ ] **Step 1: Marcar a requisição como pronta**

Modify `src/config/requisicoes.js` — no item do slug `consulta-organograma`, trocar `status: 'em_breve'` por `status: 'pronto'` (mantém sem `tipoDb`):

```js
  { slug: 'consulta-organograma', label: 'Consulta Organograma', icon: Network, status: 'pronto' },
```

- [ ] **Step 2: Renderizar a consulta no dispatcher**

Modify `src/pages/Gestor/requisicoes/NovaRequisicao.jsx`:

Adicionar o import (junto aos outros de formulários, ~linha 12):

```jsx
import ConsultaOrganograma from './ConsultaOrganograma';
```

Logo após a guarda de slug inexistente (`if (!req) return <Navigate ... />;`, ~linha 41), inserir o caso especial da consulta (é read-only, sem abas Nova/Histórico):

```jsx
  // Consulta Organograma é uma visualização read-only, não um formulário:
  // renderiza direto, sem as abas Nova requisição / Histórico.
  if (req.slug === 'consulta-organograma') {
    return (
      <div className="gestor-page animate-fade-in-up">
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-md)' }}
          onClick={() => navigate('/gestor/solicitacoes/nova')}>
          <ArrowLeft size={16} /> Voltar para requisições
        </button>
        <h1 className="page-title"><Icon size={28} /> {req.label}</h1>
        <ConsultaOrganograma />
      </div>
    );
  }
```

Nota: `Icon` é definido mais abaixo no arquivo (`const Icon = req.icon;`). Mover a linha `const Icon = req.icon;` para ANTES deste bloco (logo após a guarda `if (!req) ...`), e removê-la da posição original para não duplicar.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 5: Smoke manual no app**

Run: `npm run dev` (reiniciar se já estava rodando, para carregar as envs `VITE_BACKOFFICE_*` do `.env.local`).
Passos e resultado esperado:
1. Logar e ir em **Gestor → Requisição** (`/gestor/solicitacoes/nova`).
2. O card **Consulta Organograma** aparece **sem** o badge "Em breve".
3. Clicar no card → abre a tela com barra de filtros e tabela.
4. O seletor **Mês** vem preenchido (mês corrente ou o mais recente); a tabela lista alocações com colunas Colaborador / Contrato / % / Gerente. Coluna % mostra `—` na maioria.
5. Trocar **Gerente**/**Contrato** e digitar um **nome** filtra a tabela; o contador ("N alocações · M colaboradores") atualiza.
6. Trocar o **Mês** recarrega os dados e zera Gerente/Contrato.

- [ ] **Step 6: Commit**

```bash
git add "src/config/requisicoes.js" "src/pages/Gestor/requisicoes/NovaRequisicao.jsx"
git commit -m "feat(organograma): rotear Consulta Organograma no hub de requisicoes"
```

---

## Notas de execução

- O client `src/services/supabaseBackoffice.js` e as envs `VITE_BACKOFFICE_SUPABASE_URL` / `VITE_BACKOFFICE_SUPABASE_ANON_KEY` já existem (fase de setup). Se o build/dev reclamar de env ausente, confirmar o `.env.local` e reiniciar o Vite.
- Fora de escopo (não implementar): exportar CSV, edição, coluna Produto, liderança da obra, percentual inferido, visão matriz/por colaborador.
