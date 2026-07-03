# Filtro por tipo no Acompanhar Requisições — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um filtro por tipo de requisição (chips) na tela do gestor "Aprovar / Acompanhar", espelhando a visualização do Admin.

**Architecture:** Mudança em um único componente (`AcompanharRequisicoes.jsx`): estado `filtroTipo`, uma linha de chips no cabeçalho (reusando `TIPO_LABEL`/`TIPO_LABEL_CURTO` e a classe `filter-chip`), e a lista renderiza `participa` filtrado por tipo.

**Tech Stack:** React 19, lucide-react, Vanilla CSS (classe `filter-chip` já existente). Sem dependências novas.

## Global Constraints

- Um arquivo: `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`. Não tocar `RequisicoesRh.jsx`.
- Reusar `TIPO_LABEL` e `TIPO_LABEL_CURTO` de `src/config/aprovacao.js` e a classe CSS `filter-chip` (sem CSS novo).
- Chips espelham o Admin (`AdminSolicitacoes.jsx:332-340`): ícone `Filter` + `Todos os tipos` + um chip por tipo com `title={TIPO_LABEL[t]}` e rótulo `TIPO_LABEL_CURTO[t]`. Mostrar sempre os 6 tipos.
- `filtradas = filtroTipo === 'todos' ? participa : participa.filter((s) => s.tipo === filtroTipo)`. A lista, `todasExpandidas` e `alternarTodas` passam a usar `filtradas`.
- Chips só aparecem quando `participa.length > 0`. Vazio filtrado: "Nenhuma requisição desse tipo."
- Não adicionar filtro de status, contadores nos chips, nem agrupamento em seções.

---

### Task 1: Filtro por tipo em `AcompanharRequisicoes.jsx`

**Files:**
- Modify: `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`

**Interfaces:**
- Consumes: `TIPO_LABEL`, `TIPO_LABEL_CURTO` de `src/config/aprovacao.js`; `Filter` de `lucide-react`.

- [ ] **Step 1: Importar `Filter` e `TIPO_LABEL_CURTO`**

Na linha de import do lucide-react, adicionar `Filter`. Trocar:

```jsx
import { Check, X, Loader2, ClipboardCheck, FileText, ChevronDown } from 'lucide-react';
```

por:

```jsx
import { Check, X, Loader2, ClipboardCheck, FileText, ChevronDown, Filter } from 'lucide-react';
```

No import de `../../../config/aprovacao`, adicionar `TIPO_LABEL_CURTO`. Trocar:

```jsx
import {
  etapaAtual, acaoDisponivel, resumoAndamento,
  INICIATIVA_LABEL, TIPO_LABEL,
} from '../../../config/aprovacao';
```

por:

```jsx
import {
  etapaAtual, acaoDisponivel, resumoAndamento,
  INICIATIVA_LABEL, TIPO_LABEL, TIPO_LABEL_CURTO,
} from '../../../config/aprovacao';
```

- [ ] **Step 2: Adicionar o estado `filtroTipo`**

Logo após a linha `const [verRespostas, setVerRespostas] = useState(null);`, adicionar:

```jsx
  const [filtroTipo, setFiltroTipo] = useState('todos');
```

- [ ] **Step 3: Derivar `filtradas` e usá-la em `todasExpandidas`/`alternarTodas`**

Substituir este bloco:

```jsx
  const todasExpandidas = participa.length > 0 && participa.every((s) => expandido.has(s.id));
  const alternarTodas = () => setExpandido(todasExpandidas ? new Set() : new Set(participa.map((s) => s.id)));
```

por:

```jsx
  const filtradas = filtroTipo === 'todos' ? participa : participa.filter((s) => s.tipo === filtroTipo);
  const todasExpandidas = filtradas.length > 0 && filtradas.every((s) => expandido.has(s.id));
  const alternarTodas = () => setExpandido(todasExpandidas ? new Set() : new Set(filtradas.map((s) => s.id)));
```

- [ ] **Step 4: Adicionar a linha de chips no cabeçalho**

Substituir este bloco do cabeçalho:

```jsx
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="table-header-title"><ClipboardCheck size={16} /> Requisições que você participa</div>
          {participa.length > 1 && (
            <button className="btn btn-outline btn-sm" onClick={alternarTodas}>
              {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
            </button>
          )}
        </div>
```

por:

```jsx
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <div className="table-header-title"><ClipboardCheck size={16} /> Requisições que você participa</div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
            {participa.length > 0 && (
              <>
                <Filter size={15} color="var(--color-text-muted)" />
                {['todos', ...Object.keys(TIPO_LABEL)].map((t) => (
                  <button key={t} type="button" className={`filter-chip ${filtroTipo === t ? 'active' : ''}`}
                    onClick={() => setFiltroTipo(t)}
                    title={t === 'todos' ? undefined : TIPO_LABEL[t]}>
                    {t === 'todos' ? 'Todos os tipos' : TIPO_LABEL_CURTO[t]}
                  </button>
                ))}
              </>
            )}
            {participa.length > 1 && (
              <button className="btn btn-outline btn-sm" onClick={alternarTodas}>
                {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
              </button>
            )}
          </div>
        </div>
```

- [ ] **Step 5: Renderizar `filtradas` e o vazio filtrado**

Substituir este bloco:

```jsx
        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>Carregando...</div>
        ) : participa.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma requisição para acompanhar.</div>
        ) : (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {participa.map((s) => {
```

por:

```jsx
        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>Carregando...</div>
        ) : participa.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma requisição para acompanhar.</div>
        ) : filtradas.length === 0 ? (
          <div className="table-empty" style={{ padding: 'var(--space-3xl)' }}>Nenhuma requisição desse tipo.</div>
        ) : (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {filtradas.map((s) => {
```

(Não alterar o corpo do `.map`, apenas a fonte `participa` → `filtradas`.)

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: sem erros novos vindos de `AcompanharRequisicoes.jsx` (o repo pode ter problemas pré-existentes; critério é +0 novos).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 8: Smoke manual (checklist para o controller/usuário)**

Run: `npm run dev`. Como gestor (não RH/DP), abrir Gestor → Aprovar / Acompanhar:
1. A linha de chips aparece (Todos os tipos + os 6 tipos), com o "Todos os tipos" ativo.
2. Clicar num tipo (ex.: Ajuda de Custo) filtra a lista só para aquele tipo; o contador/expandir respeita o filtro.
3. Um tipo sem requisições mostra "Nenhuma requisição desse tipo."
4. "Todos os tipos" volta a mostrar tudo. "Expandir todas" expande só as visíveis do filtro atual.

- [ ] **Step 9: Commit**

```bash
git add "src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx"
git commit -m "feat(requisicoes): filtro por tipo no Acompanhar (chips como no Admin)"
```

---

## Notas de execução

- É um único arquivo; ler o arquivo antes de editar e casar os blocos exatos mostrados.
- `npm run lint`/`npm run build` cobrem o repo inteiro e podem exibir problemas pré-existentes de outros arquivos — o critério é não introduzir erros novos e o build passar. Verificação funcional real é o smoke manual (o subagente não roda o navegador).
