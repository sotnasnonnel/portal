# Layout Genérico — Design System Reutilizável

Documento de referência para aplicar **o mesmo visual e estrutura** deste app
(PHD View) em qualquer projeto novo. É um guia "copia e cola": os blocos de
código abaixo são autocontidos e prontos para uso.

> **Filosofia:** CSS puro com **design tokens** (variáveis CSS), sem Tailwind,
> sem CSS-in-JS de runtime. Tudo gira em torno de `variables.css` (tokens) +
> `globals.css` (componentes base por classe). Trocar a identidade visual =
> trocar tokens, não reescrever componentes.

---

## 1. Stack base

| Item            | Escolha                                  |
| --------------- | ---------------------------------------- |
| Framework       | React 19                                 |
| Build           | Vite                                     |
| Roteamento      | `react-router-dom` (HashRouter)          |
| Ícones          | `lucide-react`                           |
| Backend/Auth    | `@supabase/supabase-js` (opcional)       |
| Estilização     | **CSS puro** + variáveis CSS (sem Tailwind) |
| Fonte           | Inter (fallback system-ui)               |

```bash
npm create vite@latest meu-app -- --template react
cd meu-app
npm i react-router-dom lucide-react
# opcional: npm i @supabase/supabase-js
```

### Estrutura de pastas recomendada

```
src/
├── assets/
├── components/
│   └── ui/            # Componentes reutilizáveis (Modal, Sidebar, Logo, TopNav…)
├── contexts/          # AuthContext, WorkspaceContext…
├── lib/               # supabase.js, helpers de baixo nível
├── pages/             # Uma pasta/arquivo por rota (+ CSS irmão opcional)
├── services/          # Camada de dados (preload, fetchers)
├── styles/
│   ├── variables.css  # ⭐ Design tokens
│   └── globals.css    # ⭐ Reset + classes base
├── App.jsx            # Rotas + layout
└── main.jsx           # Importa globals.css
```

No `main.jsx`, importe os estilos globais uma única vez:

```jsx
import './styles/globals.css'
```

---

## 2. Design Tokens — `src/styles/variables.css`

Núcleo de toda a identidade. **Para rebrandar um app inteiro, mude só
`--color-brand` e suas variações.**

```css
:root {
  /* ── Marca ─────────────────────────────────────────── */
  --color-brand: #c35e1e;          /* cor primária da marca */
  --color-brand-hover: #a34c16;
  --color-brand-light: #fdf3ec;    /* fundo suave (chips, links ativos) */
  --color-brand-subtle: #f0c49a;   /* bordas suaves */

  /* ── Superfícies ───────────────────────────────────── */
  --color-bg: #f8f9fb;             /* fundo da página */
  --color-surface: #ffffff;        /* cards, modais, sidebar */
  --color-surface-raised: #ffffff;
  --color-surface-hover: #f1f3f7;
  --color-surface-active: #e8ebf1;

  /* ── Bordas ────────────────────────────────────────── */
  --color-border: #e4e7ed;
  --color-border-strong: #c9cdd6;
  --color-border-focus: #c35e1e;

  /* ── Texto ─────────────────────────────────────────── */
  --color-text: #0f1117;
  --color-text-secondary: #3d4350;
  --color-text-muted: #6b7385;
  --color-text-placeholder: #a0a8b8;
  --color-text-inverse: #ffffff;

  /* ── Estados (feedback) ────────────────────────────── */
  --color-success: #16a34a;  --color-success-bg: #f0fdf4;  --color-success-border: #bbf7d0;
  --color-error:   #dc2626;  --color-error-bg:   #fef2f2;  --color-error-border:   #fecaca;
  --color-warning: #d97706;  --color-warning-bg: #fffbeb;  --color-warning-border: #fde68a;
  --color-info:    #2563eb;  --color-info-bg:    #eff6ff;  --color-info-border:    #bfdbfe;

  /* ── Botões ────────────────────────────────────────── */
  --color-btn-primary: #0f1117;  --color-btn-primary-hover: #1e2330;
  --color-btn-brand:   #c35e1e;  --color-btn-brand-hover:   #a34c16;
  --color-btn-danger:  #dc2626;  --color-btn-danger-hover:  #b91c1c;

  /* ── Espaçamento (escala de 0.25rem) ───────────────── */
  --spacing-1: 0.25rem;  --spacing-2: 0.5rem;  --spacing-3: 0.75rem;
  --spacing-4: 1rem;     --spacing-5: 1.25rem; --spacing-6: 1.5rem;
  --spacing-8: 2rem;     --spacing-10: 2.5rem; --spacing-12: 3rem;
  /* aliases semânticos */
  --spacing-xs: 0.25rem; --spacing-sm: 0.5rem; --spacing-md: 1rem;
  --spacing-lg: 1.5rem;  --spacing-xl: 2rem;   --spacing-2xl: 3rem;

  /* ── Raios ─────────────────────────────────────────── */
  --radius-xs: 0.2rem;  --radius-sm: 0.3rem;  --radius-md: 0.5rem;
  --radius-lg: 0.75rem; --radius-xl: 1rem;    --radius-2xl: 1.25rem;
  --radius-full: 9999px;

  /* ── Sombras ───────────────────────────────────────── */
  --shadow-xs: 0 1px 2px 0 rgb(15 17 23 / 0.04);
  --shadow-sm: 0 1px 3px 0 rgb(15 17 23 / 0.08), 0 1px 2px -1px rgb(15 17 23 / 0.06);
  --shadow-md: 0 4px 8px -2px rgb(15 17 23 / 0.1), 0 2px 4px -2px rgb(15 17 23 / 0.06);
  --shadow-lg: 0 10px 24px -4px rgb(15 17 23 / 0.12), 0 4px 8px -4px rgb(15 17 23 / 0.08);
  --shadow-xl: 0 20px 40px -8px rgb(15 17 23 / 0.16), 0 8px 16px -8px rgb(15 17 23 / 0.1);

  /* ── Tipografia ────────────────────────────────────── */
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-size-xs: 0.6875rem;  --font-size-sm: 0.8125rem;  --font-size-md: 0.9375rem;
  --font-size-base: 1rem;     --font-size-lg: 1.0625rem;  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;    --font-size-3xl: 1.875rem;

  --font-weight-normal: 400; --font-weight-medium: 500;
  --font-weight-semibold: 600; --font-weight-bold: 700;

  --line-height-tight: 1.25; --line-height-normal: 1.5; --line-height-relaxed: 1.65;

  --letter-spacing-tight: -0.02em; --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.04em;   --letter-spacing-wider: 0.08em;

  /* ── Transições ────────────────────────────────────── */
  --transition-fast: 0.1s ease; --transition-base: 0.15s ease; --transition-slow: 0.25s ease;

  /* ── Layout ────────────────────────────────────────── */
  --nav-height: 3.25rem;
  --container-max: 96rem;   /* 1536px */
  --sidebar-width: 16rem;   /* ver nota na seção Sidebar */
}
```

### Princípios dos tokens

- **Cor de marca laranja** (`#c35e1e`) é o destaque; **preto/grafite** (`#0f1117`)
  é a cor de ação primária neutra. Botão "primary" é escuro; botão "brand" é laranja.
- **Texto em 5 níveis**: `text` → `secondary` → `muted` → `placeholder` → `inverse`.
- **Espaçamento numérico** (`--spacing-4`) para precisão, **aliases semânticos**
  (`--spacing-md`) para conveniência. Use o que ler melhor.
- **Bordas de 1.5px** em inputs/cards dão um traço mais definido que 1px.

---

## 3. Estilos base — `src/styles/globals.css`

Importa os tokens e define o reset + todas as classes de componente.

```css
@import './variables.css';

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background-color: var(--color-bg);
  line-height: var(--line-height-normal);
  font-feature-settings: 'cv11', 'ss01';
}

a { color: var(--color-brand); text-decoration: none; transition: color var(--transition-base); }
a:hover { color: var(--color-brand-hover); }

h1 { font-size: var(--font-size-2xl); font-weight: var(--font-weight-semibold); color: var(--color-text); letter-spacing: var(--letter-spacing-tight); line-height: var(--line-height-tight); }
h2 { font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--color-text); letter-spacing: var(--letter-spacing-tight); }
h3 { font-size: var(--font-size-lg); font-weight: var(--font-weight-medium); color: var(--color-text); }
```

### 3.1 Botões

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--spacing-2);
  padding: 0.5rem 0.875rem;
  font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); font-family: var(--font-family);
  border-radius: var(--radius-md); border: 1px solid transparent;
  cursor: pointer; white-space: nowrap; text-decoration: none;
  line-height: 1.4; letter-spacing: var(--letter-spacing-normal);
  position: relative; user-select: none;
  transition: background-color var(--transition-base), border-color var(--transition-base),
              color var(--transition-base), box-shadow var(--transition-base), opacity var(--transition-base);
}
.btn:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

.btn-primary   { background: var(--color-btn-primary); color: var(--color-text-inverse); border-color: var(--color-btn-primary); box-shadow: var(--shadow-xs); }
.btn-primary:hover:not(:disabled)   { background: var(--color-btn-primary-hover); border-color: var(--color-btn-primary-hover); box-shadow: var(--shadow-sm); }

.btn-brand     { background: var(--color-brand); color: var(--color-text-inverse); border-color: var(--color-brand); box-shadow: var(--shadow-xs); }
.btn-brand:hover:not(:disabled)     { background: var(--color-brand-hover); border-color: var(--color-brand-hover); box-shadow: var(--shadow-sm); }

.btn-secondary { background: var(--color-surface); color: var(--color-text-secondary); border-color: var(--color-border-strong); box-shadow: var(--shadow-xs); }
.btn-secondary:hover:not(:disabled) { background: var(--color-surface-hover); color: var(--color-text); }

.btn-danger    { background: var(--color-btn-danger); color: var(--color-text-inverse); border-color: var(--color-btn-danger); box-shadow: var(--shadow-xs); }
.btn-danger:hover:not(:disabled)    { background: var(--color-btn-danger-hover); border-color: var(--color-btn-danger-hover); }

.btn-ghost     { background: transparent; color: var(--color-text-muted); border-color: transparent; }
.btn-ghost:hover:not(:disabled)     { background: var(--color-surface-hover); color: var(--color-text-secondary); }

.btn-sm   { padding: 0.3125rem 0.625rem; font-size: var(--font-size-xs); border-radius: var(--radius-sm); gap: var(--spacing-1); }
.btn-icon { padding: 0.4375rem; border-radius: var(--radius-md); }
.btn-sm.btn-icon { padding: 0.3125rem; border-radius: var(--radius-sm); }
```

Uso: `<button className="btn btn-brand">Salvar</button>` ·
`<button className="btn btn-ghost btn-sm btn-icon"><X size={16} /></button>`

### 3.2 Formulários

```css
.form-group { display: flex; flex-direction: column; gap: var(--spacing-1); }
.form-label { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); letter-spacing: 0.01em; }
.form-label-required::after { content: ' *'; color: var(--color-error); }

.form-input, .form-select, .form-textarea {
  width: 100%; padding: 0.5rem 0.75rem;
  font-size: var(--font-size-sm); font-family: var(--font-family);
  color: var(--color-text); background: var(--color-surface);
  border: 1.5px solid var(--color-border); border-radius: var(--radius-md);
  outline: none; line-height: 1.5; -webkit-appearance: none;
  transition: border-color var(--transition-base), box-shadow var(--transition-base), background-color var(--transition-base);
}
.form-input:hover:not(:disabled), .form-select:hover:not(:disabled), .form-textarea:hover:not(:disabled) { border-color: var(--color-border-strong); }
.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px rgb(234 88 12 / 0.12);   /* halo de foco na cor da marca */
}
.form-input::placeholder, .form-textarea::placeholder { color: var(--color-text-placeholder); }
.form-input:disabled, .form-select:disabled, .form-textarea:disabled { background: var(--color-bg); cursor: not-allowed; opacity: 0.6; }

.form-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7385' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.625rem center;
  padding-right: 2rem; cursor: pointer;
}
.form-textarea { resize: vertical; min-height: 5.5rem; }
.form-hint  { font-size: var(--font-size-xs); color: var(--color-text-muted); line-height: 1.4; }
.form-error { font-size: var(--font-size-xs); color: var(--color-error); font-weight: var(--font-weight-medium); }
.form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }
@media (max-width: 640px) { .form-row { grid-template-columns: 1fr; } }
```

### 3.3 Cards, seções e divisores

```css
.card { background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--spacing-6); box-shadow: var(--shadow-sm); }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-4); }
.card-title  { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--color-text); letter-spacing: var(--letter-spacing-tight); }

.section-label { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); letter-spacing: var(--letter-spacing-wider); text-transform: uppercase; color: var(--color-text-muted); }

.divider { border: none; border-top: 1.5px solid var(--color-border); margin: var(--spacing-6) 0; }
```

### 3.4 Badges (chips de status)

```css
.badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; font-size: 0.6875rem; font-weight: var(--font-weight-semibold); border-radius: var(--radius-full); letter-spacing: 0.01em; border: 1px solid transparent; }
.badge-green  { background: var(--color-success-bg); color: var(--color-success); border-color: var(--color-success-border); }
.badge-red    { background: var(--color-error-bg);   color: var(--color-error);   border-color: var(--color-error-border); }
.badge-gray   { background: var(--color-surface-hover); color: var(--color-text-muted); border-color: var(--color-border); }
.badge-orange { background: var(--color-brand-light); color: var(--color-brand); border-color: var(--color-brand-subtle); }
.badge-blue   { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
```

### 3.5 Alerts (mensagens de feedback)

```css
.alert { display: flex; align-items: flex-start; gap: var(--spacing-2); padding: 0.625rem var(--spacing-3); border-radius: var(--radius-md); font-size: var(--font-size-sm); border: 1.5px solid transparent; line-height: var(--line-height-relaxed); }
.alert-error   { background: var(--color-error-bg);   color: var(--color-error);   border-color: var(--color-error-border); }
.alert-success { background: var(--color-success-bg); color: var(--color-success); border-color: var(--color-success-border); }
.alert-info    { background: var(--color-info-bg);    color: var(--color-info);    border-color: var(--color-info-border); }
.alert-warning { background: var(--color-warning-bg); color: var(--color-warning); border-color: var(--color-warning-border); }
```

### 3.6 Tabelas

```css
.table-wrapper { overflow-x: auto; border-radius: var(--radius-lg); border: 1.5px solid var(--color-border); background: var(--color-surface); }
table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
thead { background: var(--color-bg); }
th { padding: 0.625rem 1rem; text-align: left; font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); letter-spacing: var(--letter-spacing-wider); text-transform: uppercase; color: var(--color-text-muted); border-bottom: 1.5px solid var(--color-border); white-space: nowrap; }
td { padding: 0.75rem 1rem; color: var(--color-text); border-bottom: 1px solid var(--color-border); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tbody tr { transition: background-color var(--transition-fast); }
tbody tr:hover { background: var(--color-surface-hover); }
.td-actions { display: flex; align-items: center; gap: var(--spacing-1); }
```

### 3.7 Loading: spinner e skeleton

```css
.spinner { width: 1.125rem; height: 1.125rem; border: 2px solid var(--color-border); border-top-color: var(--color-brand); border-radius: 50%; animation: spin 0.65s linear infinite; display: inline-block; flex-shrink: 0; }
.spinner-lg { width: 2rem; height: 2rem; border-width: 3px; }
@keyframes spin { to { transform: rotate(360deg); } }

@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skeleton {
  background: linear-gradient(90deg, var(--color-surface-hover) 25%, var(--color-surface-active) 50%, var(--color-surface-hover) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  border-radius: var(--radius-md);
}
.skeleton-select { height: 2.375rem; width: 100%; }
.skeleton-line   { height: 0.875rem; border-radius: var(--radius-full); }
.skeleton-card   { height: 5.5rem; border-radius: var(--radius-xl); margin-bottom: 1rem; }
.skeleton-table-row { height: 3.25rem; border-bottom: 1px solid var(--color-border); border-radius: 0; margin-bottom: 0; }
```

### 3.8 Empty state (estado vazio)

```css
.empty-state { padding: var(--spacing-10) var(--spacing-8); text-align: center; color: var(--color-text-muted); display: flex; flex-direction: column; align-items: center; gap: var(--spacing-3); }
.empty-state-icon { color: var(--color-border-strong); }
.empty-state p { font-size: var(--font-size-sm); max-width: 24rem; line-height: var(--line-height-relaxed); }
```

### 3.9 Modais

```css
.modal-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgb(15 17 23 / 0.45); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: var(--spacing-md); animation: backdropIn 0.15s ease;
}
@keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
.modal {
  background: var(--color-surface); border: 1.5px solid var(--color-border);
  border-radius: var(--radius-xl); box-shadow: var(--shadow-xl);
  width: 100%; max-width: 28rem; max-height: 92vh; overflow-y: auto;
  animation: modalIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-5) var(--spacing-6); border-bottom: 1.5px solid var(--color-border); }
.modal-title  { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--color-text); letter-spacing: var(--letter-spacing-tight); }
.modal-body   { padding: var(--spacing-6); display: flex; flex-direction: column; gap: var(--spacing-4); }
.modal-footer { display: flex; justify-content: flex-end; gap: var(--spacing-2); padding: var(--spacing-4) var(--spacing-6); border-top: 1.5px solid var(--color-border); background: var(--color-bg); border-radius: 0 0 var(--radius-xl) var(--radius-xl); }
```

### 3.10 Shell de layout (app + página)

```css
.app-layout { display: flex; min-height: 100vh; background: var(--color-bg); }
.app-body   { flex: 1; display: flex; flex-direction: column; min-width: 0; } /* min-width:0 evita estouro do flex */
.page-content { flex: 1; padding: var(--spacing-8) var(--spacing-6); max-width: var(--container-max); margin: 0 auto; width: 100%; }

.app-footer { border-top: 1px solid var(--color-border); padding: 0.875rem var(--spacing-6); display: flex; justify-content: center; align-items: center; background: var(--color-surface); font-size: var(--font-size-xs); color: var(--color-text-placeholder); letter-spacing: 0.01em; }

.page-header   { margin-bottom: var(--spacing-8); }
.page-title    { font-size: var(--font-size-2xl); font-weight: var(--font-weight-semibold); color: var(--color-text); letter-spacing: var(--letter-spacing-tight); }
.page-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: 0.25rem; line-height: var(--line-height-relaxed); }

@media (max-width: 768px) {
  .app-layout { flex-direction: column; }
  .page-content { padding: var(--spacing-5) var(--spacing-4); }
}
```

---

## 4. Arquitetura de layout

```
┌──────────────────────────────────────────────────────┐
│ .app-layout (flex, row)                                │
│ ┌──────────┐ ┌─────────────────────────────────────┐ │
│ │ <Sidebar>│ │ .app-body (flex, column)            │ │
│ │  220px   │ │ ┌─────────────────────────────────┐ │ │
│ │  sticky  │ │ │ <main .page-content>            │ │ │
│ │          │ │ │   max-width 96rem, centralizado │ │ │
│ │  logo    │ │ │   padding 2rem 1.5rem           │ │ │
│ │  switcher│ │ │                                 │ │ │
│ │  nav     │ │ │   ← conteúdo da página          │ │ │
│ │  footer  │ │ │                                 │ │ │
│ └──────────┘ │ └─────────────────────────────────┘ │ │
│              └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘

Mobile (≤768px): sidebar vira barra horizontal no topo (flex-direction muda).
```

Duas variantes de navegação disponíveis — escolha **uma**:

- **Sidebar vertical** (`.sidebar`) → apps com várias seções/admin. Usado neste app.
- **TopNav horizontal** (`.topnav`) → apps mais simples, foco em conteúdo.

Composição em `App.jsx`:

```jsx
function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-body">
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
```

E o cabeçalho de cada página:

```jsx
<div className="page-header">
  <h1 className="page-title">Título da página</h1>
  <p className="page-subtitle">Descrição curta do que a página faz.</p>
</div>
```

---

## 5. Sidebar — `src/components/ui/Sidebar.css`

> **Nota:** o `Sidebar.css` redefine `--sidebar-width: 220px` localmente (o token
> global é `16rem`). Use o valor que preferir, mas mantenha um único.

```css
:root { --sidebar-width: 220px; }

.sidebar { width: var(--sidebar-width); min-width: var(--sidebar-width); height: 100vh; position: sticky; top: 0; display: flex; flex-direction: column; background: var(--color-surface); border-right: 1px solid var(--color-border); overflow: hidden; flex-shrink: 0; }

.sidebar-logo { padding: 1.25rem 1.25rem 1rem; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }

/* Navegação */
.sidebar-nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; overflow-y: auto; }
.sidebar-section-label { font-size: 0.625rem; font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.1em; text-transform: uppercase; padding: 0.625rem 0.75rem 0.25rem; margin-top: 0.5rem; }
.sidebar-section-label:first-child { margin-top: 0; }

.sidebar-link { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.75rem; border-radius: var(--radius-md); color: var(--color-text-muted); font-size: var(--font-size-sm); font-weight: 500; text-decoration: none; transition: background-color 0.15s, color 0.15s; white-space: nowrap; }
.sidebar-link:hover { background: var(--color-surface-hover); color: var(--color-text); text-decoration: none; }
.sidebar-link.active { background: var(--color-brand-light); color: var(--color-brand); font-weight: 600; }

/* Rodapé com avatar do usuário */
.sidebar-footer { padding: 1rem 1.25rem; border-top: 1px solid var(--color-border); display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.sidebar-avatar { width: 2rem; height: 2rem; border-radius: var(--radius-full); background: linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-hover) 100%); display: flex; align-items: center; justify-content: center; font-size: 0.6875rem; font-weight: 700; color: var(--color-text-inverse); letter-spacing: 0.04em; flex-shrink: 0; }
.sidebar-user-name { font-size: var(--font-size-xs); font-weight: 500; color: var(--color-text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-logout { color: var(--color-text-muted); flex-shrink: 0; }
.sidebar-logout:hover:not(:disabled) { color: var(--color-error); background: var(--color-error-bg); }

/* Mobile: sidebar vira barra horizontal */
@media (max-width: 768px) {
  .sidebar { width: 100%; min-width: 0; height: auto; flex-direction: row; position: sticky; top: 0; z-index: 100; border-right: none; border-bottom: 1px solid var(--color-border); backdrop-filter: blur(12px); background: rgba(255, 255, 255, 0.92); }
  .sidebar-logo { border-bottom: none; padding: 0.75rem 1rem; }
  .sidebar-nav { flex-direction: row; flex: 1; padding: 0; align-items: center; justify-content: center; gap: 0; overflow-x: auto; }
  .sidebar-section-label { display: none; }
  .sidebar-link span { display: none; }              /* só ícones no mobile */
  .sidebar-footer { border-top: none; padding: 0.5rem 0.75rem; border-left: 1px solid var(--color-border); }
  .sidebar-user-name { display: none; }
}
```

Componente (esqueleto — adapte os links às suas rotas):

```jsx
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Settings, Eye } from 'lucide-react'
import Logo from './Logo'
import './Sidebar.css'

function getInitials(name) {
  if (!name) return '?'
  const p = name.trim().split(' ').filter(Boolean)
  return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export default function Sidebar({ user, onSignOut }) {
  const navigate = useNavigate()
  const linkClass = ({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo"><Logo iconSize={32} textVariant="md" /></div>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Operação</span>
        <NavLink to="/visualizar" className={linkClass}>
          <Eye size={16} aria-hidden="true" /><span>Visualizar</span>
        </NavLink>
        <NavLink to="/configuracao" className={linkClass}>
          <Settings size={16} aria-hidden="true" /><span>Configuração</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-avatar">{getInitials(user?.name)}</div>
        <span className="sidebar-user-name">{user?.name ?? '—'}</span>
        <button onClick={onSignOut} className="btn btn-ghost btn-sm btn-icon sidebar-logout" aria-label="Sair">
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
```

---

## 6. TopNav (alternativa horizontal) — `src/components/ui/TopNav.css`

```css
.topnav { position: sticky; top: 0; z-index: 100; height: var(--nav-height); background: rgb(255 255 255 / 0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--color-border); }
.topnav-inner { max-width: var(--container-max); margin: 0 auto; padding: 0 var(--spacing-6); height: 100%; display: flex; align-items: center; gap: var(--spacing-6); }
.topnav-divider { width: 1px; height: 1.25rem; background: var(--color-border-strong); flex-shrink: 0; }
.topnav-links { display: flex; align-items: center; gap: 0.125rem; flex: 1; }
.topnav-link { display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.625rem; font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-text-muted); border-radius: var(--radius-md); text-decoration: none; white-space: nowrap; position: relative; transition: background-color var(--transition-base), color var(--transition-base); }
.topnav-link:hover { background: var(--color-surface-hover); color: var(--color-text-secondary); }
.topnav-link.active { color: var(--color-text); background: var(--color-surface-active); font-weight: var(--font-weight-semibold); }
.topnav-link.active::after { content: ''; position: absolute; bottom: -0.125rem; left: 50%; transform: translateX(-50%); width: 1.25rem; height: 2px; background: var(--color-brand); border-radius: var(--radius-full); }
.topnav-user { display: flex; align-items: center; gap: var(--spacing-2); flex-shrink: 0; margin-left: auto; }
.topnav-avatar { width: 1.75rem; height: 1.75rem; background: linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-hover) 100%); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; font-size: 0.6875rem; font-weight: var(--font-weight-bold); color: var(--color-text-inverse); flex-shrink: 0; }

@media (max-width: 640px) {
  .topnav-user-name { display: none; }
  .topnav-link span { display: none; }
  .topnav-divider { display: none; }
}
```

Com TopNav, o shell muda: a barra fica dentro de `.app-body`, acima de `.page-content`.

---

## 7. Componentes reutilizáveis

### Modal — `src/components/ui/Modal.jsx`

Fecha com `Esc` e clique no backdrop. Footer opcional.

```jsx
import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <span id="modal-title" className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
```

Uso:

```jsx
<Modal
  title="Editar item"
  onClose={() => setOpen(false)}
  footer={<>
    <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
    <button className="btn btn-brand" onClick={save}>Salvar</button>
  </>}
>
  <div className="form-group">
    <label className="form-label form-label-required">Nome</label>
    <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
  </div>
</Modal>
```

### Logo — `src/components/ui/Logo.jsx`

SVG inline com cores via token (`var(--color-brand)`), texto opcional em 4 tamanhos.
Troque o `<svg>` pela marca do seu projeto e mantenha a API (`iconSize`, `showText`,
`textVariant`, `light`).

```jsx
export default function Logo({ iconSize = 36, showText = true, textVariant = 'md', light = false }) {
  const sizes = { sm: {a:13,b:10}, md: {a:16,b:12}, lg: {a:22,b:16}, xl: {a:32,b:22} }
  const ts = sizes[textVariant] ?? sizes.md
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: showText ? '0.6rem' : 0, userSelect: 'none' }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect width="40" height="40" rx="10" style={{ fill: 'var(--color-brand)' }} />
        {/* … desenho da marca … */}
      </svg>
      {showText && (
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontSize: ts.a, fontWeight: 700, color: 'var(--color-brand)', letterSpacing: '-0.025em' }}>NOME</div>
          <div style={{ fontSize: ts.b, fontWeight: 600, color: light ? 'rgba(255,255,255,0.5)' : '#6b7385', letterSpacing: '0.1em', textTransform: 'uppercase' }}>SUB</div>
        </div>
      )}
    </div>
  )
}
```

---

## 8. Tela de Login (split com imagem) — `src/pages/Login.css`

Padrão: painel esquerdo com imagem de fundo escurecida por gradiente + painel
direito (420px) translúcido com o formulário.

```css
.login-page { position: relative; min-height: 100vh; display: flex; overflow: hidden; }
.login-bg { position: absolute; inset: 0; background: #0a0c12 url('/fundo.png') center 30% / cover; z-index: 0; }
.login-bg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, rgba(10,12,18,0.85) 0%, rgba(10,12,18,0.68) 55%, rgba(10,12,18,0.42) 100%); }
.login-content { position: relative; z-index: 1; display: flex; width: 100%; min-height: 100vh; }

.login-left { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 3.5rem 4rem; }
.login-left-desc { font-size: var(--font-size-sm); color: rgba(255,255,255,0.45); line-height: 1.7; max-width: 26rem; }

.login-right { display: flex; align-items: center; justify-content: center; padding: 3rem; flex-shrink: 0; width: 420px; min-height: 100vh; background: rgba(255,255,255,0.88); backdrop-filter: blur(16px); }
.login-card { width: 100%; max-width: 22rem; }
.login-card-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); letter-spacing: var(--letter-spacing-tight); margin-bottom: 0.25rem; }
.login-card-sub { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: 1.5rem; }
.login-form { display: flex; flex-direction: column; gap: var(--spacing-4); }

.login-submit { width: 100%; padding: 0.675rem 1rem; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); background: var(--color-brand); color: #fff; border: none; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: var(--spacing-2); box-shadow: 0 4px 14px rgba(234,88,12,0.4); letter-spacing: 0.02em; transition: background-color var(--transition-base), transform var(--transition-fast), box-shadow var(--transition-base); }
.login-submit:hover:not(:disabled) { background: var(--color-brand-hover); box-shadow: 0 6px 20px rgba(234,88,12,0.5); transform: translateY(-1px); }
.login-submit:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

@media (max-width: 768px) {
  .login-left { display: none; }
  .login-right { width: 100%; padding: 3rem 1.75rem; }
}
```

---

## 9. Responsividade — breakpoints

| Largura     | Comportamento                                                   |
| ----------- | --------------------------------------------------------------- |
| `≤ 768px`   | Sidebar → barra horizontal; `page-content` com padding menor; login esconde o painel esquerdo; `form-row` ainda 2 colunas |
| `≤ 640px`   | `form-row` vira 1 coluna; TopNav esconde labels (só ícones) e nome do usuário |

Sempre **mobile-aware**: textos viram só-ícone, nomes longos usam
`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.

---

## 10. Como aplicar num app novo (checklist)

1. **Criar projeto** Vite + React e instalar `react-router-dom` + `lucide-react`.
2. **Copiar** `src/styles/variables.css` e `src/styles/globals.css` (seções 2 e 3).
3. **Importar** `globals.css` no `main.jsx`.
4. **Rebrandar**: editar só os tokens de marca em `variables.css`
   (`--color-brand`, `-hover`, `-light`, `-subtle`) — e, se quiser, o halo de foco
   `rgb(234 88 12 / 0.12)` em `.form-input:focus`/`.login-submit` para combinar.
5. **Escolher navegação**: Sidebar (seção 5) ou TopNav (seção 6). Copiar o CSS e o
   componente, ajustar os `NavLink` às suas rotas.
6. **Copiar** `Modal.jsx` e `Logo.jsx` (seção 7). Substituir o SVG da Logo.
7. **Montar o shell** em `App.jsx` com `AppLayout` (seção 4) e usar `page-header`
   em cada página.
8. **(Opcional)** Login split (seção 8) — colocar `fundo.png` em `public/`.

### Convenções de nomenclatura

- Classes em **kebab-case** com prefixo do bloco: `.sidebar-link`, `.modal-footer`,
  `.card-title`. Modificadores: `.btn-brand`, `.badge-green`, `.alert-error`.
- Estado ativo de navegação sempre `.active`.
- CSS de página/componente fica num arquivo **irmão** (`Login.jsx` + `Login.css`),
  importado no topo do componente. Tokens e classes globais ficam em `styles/`.

### Regras de ouro

- **Nunca** hardcode cor/espaçamento/raio fora de `variables.css`. Sempre `var(--…)`.
- Bordas de **1.5px** em inputs e cards (não 1px).
- Foco visível sempre: `outline: 2px solid var(--color-brand)` ou halo `box-shadow`.
- Ícones `lucide-react` a **16px** em nav, **15–16px** em botões-ícone.
- Transições curtas (`--transition-base` 0.15s) em hover/focus — nada lento.
- Avatares e ícones de workspace usam **gradiente da marca** `135deg`.
