# Padrão visual dos módulos do portal

Fonte da verdade dos tokens: **`src/styles/ui.css`** (carregado em `main.jsx`
depois de `theme.css` e `index.css`, portanto vale sobre os dois).

Vale para: **Gestão de Pessoas** (`src/pages/**` + `src/components/**`),
**PMO — Controle de Horas** (`src/modules/horas`), **Administrativo**
(`src/modules/administrativo`), **Financeiro** (`src/modules/financeiro`) e
**Programas** (`src/modules/programas`).

> Regra de ouro: **nenhum CSS/JSX declara `font-size`, altura de controle,
> padding de célula ou largura de sidebar em valor solto.** Sempre um token.

---

## 1. Neutros

Uma rampa só no portal inteiro (`--neutral-*` em `ui.css`), consumida por
`theme.css`, `index.css` e pelos tokens locais de cada módulo:

| Token                     | Valor    | Uso                      |
| ------------------------- | -------- | ------------------------ |
| `--neutral-bg`            | #f8fafc  | fundo de página          |
| `--neutral-surface`       | #ffffff  | cartões, sidebar         |
| `--neutral-border`        | #e2e8f0  | traço padrão             |
| `--neutral-border-strong` | #cbd5e1  | traço de destaque        |
| `--neutral-ink`           | #0f172a  | texto principal          |
| `--neutral-muted`         | #64748b  | texto de apoio           |

Antes havia duas: a slate dos módulos novos e um cinza quente
(#f2f2f2/#1b2735/#6b7280) no portal e no PMO — lado a lado, uma parecia mais
fria que a outra.

## 2. Tipografia

Uma única escala, base **14px** (raiz do `html` continua 16px):

| Token                 | px | Uso                                             |
| --------------------- | -- | ----------------------------------------------- |
| `--font-size-2xs`     | 11 | badges, chips, `th` de tabela, micro-rótulos     |
| `--font-size-xs`      | 12 | rótulo de campo (`label`), meta, botão pequeno   |
| `--font-size-sm`      | 13 | corpo de tabela, texto de apoio                  |
| `--font-size-md`/`base` | 14 | corpo padrão, inputs, botões, itens de menu    |
| `--font-size-lg`      | 16 | título de card, subtítulo forte                  |
| `--font-size-xl`      | 18 | título de seção                                  |
| `--font-size-2xl`     | 22 | título de bloco grande                           |
| `--font-size-3xl`     | 24 | **título de página** (`.horasRoot h1`, `.adm-title`, `.fin-title`, `.pg-title`, `.page-title`) |
| `--font-size-4xl`     | 28 | número de destaque de KPI/tile                   |
| `--font-size-display` | 40 | cronômetro / hero numérico                       |

11px é o piso — nada menor, por legibilidade. Família única:
`--font-family` (Inter + fallbacks), exposta também como `--font-sans`.

Rótulo de seção (todos os módulos): `--font-size-2xs`, peso 700,
`letter-spacing: 0.06em`, `text-transform: uppercase`.

## 3. Controles

| Token             | Valor | Uso                                        |
| ----------------- | ----- | ------------------------------------------ |
| `--ctl-h`         | 40px  | input, select, botão padrão                |
| `--ctl-h-sm`      | 32px  | botão/chip de barra de filtros             |
| `--ctl-h-lg`      | 44px  | ação principal / alvo de toque             |
| `--ctl-h-icon`    | 36px  | botão só-ícone                             |
| `--ctl-pad-y/x`   | 9/12px| padding interno de campo                   |
| `--ctl-border`    | 1.5px | traço do campo                             |
| `--ctl-radius`    | 10px  | campo e botão                              |
| `--ctl-radius-sm` | 8px   | botão-ícone, item de menu                  |

Cobre `.form-input`/`.form-select`/`.btn*` (GP + Financeiro),
`.adm-input`/`.adm-btn`, `.pg-input`/`.pg-btn` e os campos/botões escopados em
`.horasRoot`.

## 4. Tabelas

`--table-fs` (13px) no corpo, `--table-head-fs` (11px, caixa alta) no `th`,
`--table-cell-pad` (`10px 12px`) em `th` e `td` — igual em `.data-table`,
`.adm-tabela`, `.pg-tabela`, `.fin-table` e nas tabelas do Horas.

## 5. Cartões

`--card-radius` (14px) e `--card-pad` (`18px 20px`).

## 6. Sidebar (uma só para todos os módulos)

Componente único: **`src/components/Layout/ModuleSidebar.jsx`** + `ModuleSidebar.css`.
Usado por Controle de Horas, Administrativo, Financeiro, Programas e PMO. A
divisão é a do Financeiro:

- **Grupo colapsável** (`group: true`): cabeçalho com ícone + rótulo + seta,
  filhos recuados com fio-guia. Abre por padrão; só fecha por clique.
- **Seção simples** (sem `group`): rótulo em caixa alta (`--font-size-2xs`) +
  links diretos. É o formato de "Administração", sempre no fim.

Formato de `secoes`:

```js
[{ label, key, group?, Icon?, items: [
     { label, href, Icon, exato?, badge?, locked? } ] }]
```

Cada módulo entrega só o `nav.js` (quem vê o quê) e o título/ícone; estrutura,
métricas e comportamento (drawer no mobile, Esc, item ativo pelo href mais
longo, recolher no desktop) ficam no componente.

O **acento** vem da raiz do módulo, que define `--mod-accent`,
`--mod-accent-soft` e `--mod-accent-ink` (`.horasRoot`, `.admRoot`, `.finRoot`,
`.pgRoot`, `.solicRoot`). Nunca declare esses tokens dentro do `.modSb`: a
declaração local venceria o valor herdado e pintaria todos os módulos igual.

Gestão de Pessoas usa o mesmo componente: `components/Layout/Sidebar.jsx` só
resolve perfil e contadores e passa o `nav.js` de lá. Os extras que eram só
dela viraram parte do padrão — `badge` por item (somado no cabeçalho quando o
grupo está fechado) e `locked` em item ou grupo (cadeado, "Em breve").

## 7. Shell (idêntico nos cinco módulos)

| Token                        | Valor              |
| ---------------------------- | ------------------ |
| `--shell-sidebar-w`          | 256px              |
| `--shell-sidebar-collapsed-w`| 64px               |
| `--shell-topbar-h`           | 64px (marca da sidebar e `PortalHeader`) |
| `--shell-main-pad-*`         | `26px 32px 60px`   |
| `--shell-main-pad-mobile`    | `20px 16px 48px`   |
| `--shell-page-max*`          | 900 / 1180 / 1600px|

Item de menu da sidebar: `padding: 9px 12px`, raio `--ctl-radius-sm`, texto
`--font-size-md`; rótulo de grupo em `--font-size-2xs` com `padding: 12px 12px 4px`.

## 8. Usabilidade

- Foco visível padronizado (`:focus-visible` com contorno da cor primária)
  aplicado a links, botões e campos em todo o portal.
- No mobile (≤768px) todo controle interativo respeita `--touch-min` (44px).
- Subtítulo de página: `--font-size-md`, `margin: 0 0 20px` em todos os módulos.

## 9. Fora do padrão (pendente)

`src/modules/reembolso` ainda tem escala própria. Migrar quando for mexido:
trocar os `font-size` soltos pelos tokens acima e apontar os tokens locais para
os do `ui.css`.

O PMO (`src/modules/solic`) já está no padrão: tipografia, pesos (era tudo 800),
controles, tabelas, cartões, shell e sidebar.

## 10. Como alterar

Mudou a identidade? Mexa **só** em `src/styles/ui.css`. Ao criar tela nova,
use as classes já existentes do módulo — se precisar de um tamanho novo,
escolha o token mais próximo em vez de inventar valor.
