# Organograma como Aba Própria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover a Consulta Organograma de dentro do hub de Requisições DP para uma página própria em `/organograma`, com item de menu na Sidebar visível para os perfis `gestor`, `admin` e `rh`.

**Architecture:** SPA React 19 + Vite com `react-router-dom` v7 (HashRouter). Rotas do módulo DP vivem em `src/routes/AppRoutes.jsx` dentro de `<Layout />`, protegidas por `ModuleRoute module="dp"` + `ProtectedRoute allowedRoles`. O menu lateral é declarativo em `menuConfig` (`src/components/Layout/Sidebar.jsx`), chaveado por `user.perfil`. A consulta já existe e funciona; o trabalho é mover arquivos, criar rota/menu e limpar o acoplamento com Requisições.

**Tech Stack:** React 19, react-router-dom 7, lucide-react (ícones), Supabase (inalterado), testes com `node --test` (`npm test`).

## Global Constraints

- Roles são strings minúsculas: `'gestor'`, `'admin'`, `'rh'`, `'usuario'` (spec, decisão 1: acesso = `['gestor', 'admin', 'rh']`).
- Rota nova: `/organograma` (spec, decisão 2).
- Label do menu: `Organograma`, ícone `Network` de lucide-react (spec, decisão 3).
- Nenhuma mudança de backend/Supabase (spec, fora de escopo).
- Nenhuma mudança visual na consulta além da remoção do botão "Voltar" (spec, decisões 5 e fora de escopo).
- Commits frequentes, um por task.

---

### Task 1: Mover os arquivos do organograma para `src/pages/Gestor/organograma/` e transformar ConsultaOrganograma em página

A pasta atual é `src/pages/Gestor/requisicoes/organograma/` + `src/pages/Gestor/requisicoes/ConsultaOrganograma.jsx`. Tudo vai para uma pasta achatada `src/pages/Gestor/organograma/` (sem subpasta). `ConsultaOrganograma.jsx` passa a ser a página da rota: ganha o wrapper `gestor-page` e o título com ícone (que hoje quem fornece é `NovaRequisicao.jsx`).

**Files:**
- Move (git mv): `src/pages/Gestor/requisicoes/ConsultaOrganograma.jsx` → `src/pages/Gestor/organograma/ConsultaOrganograma.jsx`
- Move (git mv): `src/pages/Gestor/requisicoes/organograma/useOrganograma.js` → `src/pages/Gestor/organograma/useOrganograma.js`
- Move (git mv): `src/pages/Gestor/requisicoes/organograma/organogramaData.js` → `src/pages/Gestor/organograma/organogramaData.js`
- Move (git mv): `src/pages/Gestor/requisicoes/organograma/organogramaData.test.js` → `src/pages/Gestor/organograma/organogramaData.test.js`
- Move (git mv): `src/pages/Gestor/requisicoes/organograma/ConsultaOrganograma.css` → `src/pages/Gestor/organograma/ConsultaOrganograma.css`
- Modify (após o move): `src/pages/Gestor/organograma/ConsultaOrganograma.jsx` (imports + wrapper de página)
- Modify (após o move): `src/pages/Gestor/organograma/useOrganograma.js` (profundidade do import de services)

**Interfaces:**
- Consumes: `supabaseBackoffice` de `src/services/supabaseBackoffice.js` (inalterado).
- Produces: componente default export `ConsultaOrganograma` em `src/pages/Gestor/organograma/ConsultaOrganograma.jsx` — página completa (com wrapper e título), pronta para ser usada como element de rota na Task 2. Nenhuma prop.

**Nota:** neste ponto o build quebra de propósito? NÃO — `NovaRequisicao.jsx` ainda importa `./ConsultaOrganograma`, que deixará de existir. Para manter cada task verde, esta task TAMBÉM atualiza o import em `NovaRequisicao.jsx` para o novo caminho (a remoção completa do desvio fica na Task 4).

- [ ] **Step 1: Mover os arquivos com git mv**

```bash
mkdir -p src/pages/Gestor/organograma
git mv src/pages/Gestor/requisicoes/ConsultaOrganograma.jsx src/pages/Gestor/organograma/ConsultaOrganograma.jsx
git mv src/pages/Gestor/requisicoes/organograma/useOrganograma.js src/pages/Gestor/organograma/useOrganograma.js
git mv src/pages/Gestor/requisicoes/organograma/organogramaData.js src/pages/Gestor/organograma/organogramaData.js
git mv src/pages/Gestor/requisicoes/organograma/organogramaData.test.js src/pages/Gestor/organograma/organogramaData.test.js
git mv src/pages/Gestor/requisicoes/organograma/ConsultaOrganograma.css src/pages/Gestor/organograma/ConsultaOrganograma.css
```

(A pasta `src/pages/Gestor/requisicoes/organograma/` fica vazia e some do git automaticamente.)

- [ ] **Step 2: Corrigir o import de services em `useOrganograma.js`**

O arquivo subiu um nível (de `pages/Gestor/requisicoes/organograma/` para `pages/Gestor/organograma/`). Trocar a linha 2:

```js
// antes
import { supabaseBackoffice } from '../../../../services/supabaseBackoffice';
// depois
import { supabaseBackoffice } from '../../../services/supabaseBackoffice';
```

O import `./organogramaData` (linha 3) continua correto — os arquivos agora são irmãos.

- [ ] **Step 3: Atualizar `ConsultaOrganograma.jsx` — imports irmãos + wrapper de página**

Os imports `./organograma/...` viram `./...`, e o componente ganha o wrapper `gestor-page` + título (copiado do desvio que hoje vive em `NovaRequisicao.jsx:50-57`, sem o botão "Voltar"). Topo do arquivo:

```jsx
import { useMemo, useState, useEffect } from 'react';
import { Search, RefreshCw, Network } from 'lucide-react';
import { useOrganograma } from './useOrganograma';
import {
  resolveDefaultMonth, deriveFilterOptions, applyFilters,
  formatPercent, formatMonthLabel, countColaboradores,
} from './organogramaData';
import '../Gestor.css';
import './ConsultaOrganograma.css';
```

E o `return` passa a ser envolvido pelo wrapper de página (todo o conteúdo atual de `<div className="org-consulta">` permanece idêntico dentro dele):

```jsx
  return (
    <div className="gestor-page animate-fade-in-up">
      <h1 className="page-title"><Network size={28} /> Consulta Organograma</h1>
      <div className="org-consulta">
        {/* ...conteúdo atual inalterado (filtros, status, tabela)... */}
      </div>
    </div>
  );
```

Atenção: reindentar o conteúdo interno conforme necessário; nenhuma outra linha do corpo muda.

- [ ] **Step 4: Apontar o import de `NovaRequisicao.jsx` para o novo caminho (correção temporária)**

Em `src/pages/Gestor/requisicoes/NovaRequisicao.jsx:11`:

```js
// antes
import ConsultaOrganograma from './ConsultaOrganograma';
// depois
import ConsultaOrganograma from '../organograma/ConsultaOrganograma';
```

(O desvio inteiro sai na Task 4; isso só mantém o app compilando entre tasks. O desvio em `NovaRequisicao.jsx:48-59` renderizará o título duplicado temporariamente — aceitável entre commits, resolvido na Task 4.)

- [ ] **Step 5: Rodar testes e build**

```bash
npm test
```
Expected: suíte de `organogramaData.test.js` PASS (o test importa `./organogramaData`, caminho relativo preservado pelo move).

```bash
npm run build
```
Expected: build Vite conclui sem erro de resolução de módulo.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move ConsultaOrganograma para src/pages/Gestor/organograma como pagina propria"
```

---

### Task 2: Rota `/organograma` em AppRoutes.jsx

**Files:**
- Modify: `src/routes/AppRoutes.jsx` (lazy import no topo, ~linha 21; nova `<Route>` no bloco DP, após `/gestor/solicitacoes/acompanhar`, ~linha 288)

**Interfaces:**
- Consumes: `ConsultaOrganograma` (default export, sem props) de `src/pages/Gestor/organograma/ConsultaOrganograma.jsx` (Task 1).
- Produces: rota `/organograma` com gate `['gestor', 'admin', 'rh']`, usada pelo menu da Task 3.

- [ ] **Step 1: Adicionar o lazy import**

Junto aos demais lazy imports (após a linha do `AcompanharRequisicoes`, linha 21):

```js
const ConsultaOrganograma = lazy(() => import('../pages/Gestor/organograma/ConsultaOrganograma'));
```

- [ ] **Step 2: Adicionar a rota**

Dentro do `<Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>`, logo após o bloco da rota `/gestor/solicitacoes/acompanhar` (linha 288) e antes da rota `/usuario`:

```jsx
          <Route
            path="/organograma"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'admin', 'rh']}>
                  <LazyPage>
                    <ConsultaOrganograma />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```
Expected: conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/routes/AppRoutes.jsx
git commit -m "feat: rota /organograma para gestor, admin e rh"
```

---

### Task 3: Item "Organograma" no menu (admin, gestor, rh)

**Files:**
- Modify: `src/components/Layout/Sidebar.jsx` (import do ícone `Network`, ~linha 4-20; `menuConfig` linhas 25-65)

**Interfaces:**
- Consumes: rota `/organograma` (Task 2).
- Produces: entrada de menu visível nos três perfis.

- [ ] **Step 1: Importar o ícone `Network`**

Adicionar `Network` à lista de imports do lucide-react (bloco das linhas 4-20), em ordem junto aos demais:

```js
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  CalendarClock,
  UserPlus,
  List,
  CalendarDays,
  FileText,
  Network,
  PlusCircle,
  Workflow,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  LogOut,
} from 'lucide-react';
```

- [ ] **Step 2: Adicionar o item nos três perfis do `menuConfig`**

O item é o mesmo objeto nos três arrays: `{ label: 'Organograma', icon: Network, path: '/organograma' }`.

`admin` — após "Fluxos de Aprovação":

```js
  admin: [
    { label: 'Cadastro', icon: UserPlus, path: '/admin/cadastro' },
    { label: 'Listagem', icon: List, path: '/admin/listagem' },
    { label: 'Requisições DP', icon: FileText, path: '/admin/solicitacoes', solicitacaoBadge: true },
    { label: 'Fluxos de Aprovação', icon: Workflow, path: '/admin/fluxos' },
    { label: 'Organograma', icon: Network, path: '/organograma' },
  ],
```

`gestor` — após o grupo "Requisições DP" (último item do array):

```js
    {
      group: true,
      key: 'solicitacoes',
      label: 'Requisições DP',
      icon: FileText,
      children: [
        { label: 'Requisição', icon: PlusCircle, path: '/gestor/solicitacoes/nova' },
        { label: 'Acompanhar', icon: ClipboardCheck, path: '/gestor/solicitacoes/acompanhar', solicitacaoBadge: true },
      ],
    },
    { label: 'Organograma', icon: Network, path: '/organograma' },
```

`rh` — após "Requisições":

```js
  rh: [
    { label: 'Nova Requisição', icon: PlusCircle, path: '/gestor/solicitacoes/nova' },
    { label: 'Requisições', icon: ClipboardCheck, path: '/gestor/solicitacoes/acompanhar', solicitacaoBadge: true },
    { label: 'Organograma', icon: Network, path: '/organograma' },
  ],
```

(`usuario` NÃO recebe o item.)

- [ ] **Step 3: Verificar lint e build**

```bash
npm run lint
npm run build
```
Expected: ambos concluem sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/Layout/Sidebar.jsx
git commit -m "feat: item Organograma no menu de admin, gestor e rh"
```

---

### Task 4: Remover o organograma de Requisições

Remove o card do hub e o desvio especial, desfazendo o acoplamento.

**Files:**
- Modify: `src/config/requisicoes.js` (remover linha 14 e o import não usado `Network`)
- Modify: `src/pages/Gestor/requisicoes/NovaRequisicao.jsx` (remover import e desvio das linhas 46-59)

**Interfaces:**
- Consumes: nada novo.
- Produces: hub de Requisições sem o card "Consulta Organograma"; slug `consulta-organograma` passa a cair no fallback `if (!req)` de `NovaRequisicao.jsx:42` (redirect ao hub) — comportamento desejado para links antigos.

- [ ] **Step 1: Remover o item e o import em `requisicoes.js`**

```js
// linha 1 — antes
import { ClipboardList, UserPlus, FileText, Network, Wallet, TrendingUp, UserMinus } from 'lucide-react';
// depois
import { ClipboardList, UserPlus, FileText, Wallet, TrendingUp, UserMinus } from 'lucide-react';
```

E apagar a linha 14 inteira:

```js
  { slug: 'consulta-organograma', label: 'Consulta Organograma', icon: Network, status: 'pronto' },
```

- [ ] **Step 2: Remover o desvio e o import em `NovaRequisicao.jsx`**

Apagar a linha do import (ajustada na Task 1):

```js
import ConsultaOrganograma from '../organograma/ConsultaOrganograma';
```

Apagar o bloco inteiro (comentário incluído, linhas 46-59 do arquivo original):

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

- [ ] **Step 3: Rodar lint, testes e build**

```bash
npm run lint
npm test
npm run build
```
Expected: todos concluem sem erros (lint pegaria import não usado se algo ficasse para trás).

- [ ] **Step 4: Commit**

```bash
git add src/config/requisicoes.js src/pages/Gestor/requisicoes/NovaRequisicao.jsx
git commit -m "refactor: remove Consulta Organograma do hub de Requisicoes"
```

---

### Task 5: Verificação manual no app

- [ ] **Step 1: Subir o dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verificar no navegador**

- Logar como **gestor**: item "Organograma" visível no menu; `/organograma` (hash route `#/organograma`) carrega filtros + tabela; hub de Requisições **sem** o card "Consulta Organograma".
- Logar como **admin**: item "Organograma" visível e funcional.
- Logar como **rh**: item "Organograma" visível e funcional.
- Logar como **usuario** (ou verificar por código): sem item de menu; acessar `#/organograma` direto redireciona para `/home`.
- Acessar `#/gestor/solicitacoes/nova/consulta-organograma` (link antigo): redireciona para o hub de Requisições.

- [ ] **Step 3: Nada a commitar (verificação apenas)**
