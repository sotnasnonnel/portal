# Filtro por tipo no Acompanhar Requisições (Gestor) — Design

**Data:** 2026-07-01
**Status:** Aprovado

## Objetivo

A tela do gestor "Aprovar / Acompanhar" (`AcompanharRequisicoes.jsx`) lista todas as
requisições que o gestor criou ou aprova, sem nenhum filtro. Adicionar um filtro por **tipo**
de requisição (Ajuda de Custo, Nova Vaga, Alteração de Cargo, etc.), com chips, igual à
visualização do Admin (`AdminSolicitacoes.jsx`).

## Escopo

- **Um arquivo:** `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx` (a view do gestor
  comum). A visão RH/DP (`RequisicoesRh.jsx`, renderizada quando `user.rhDp`) fica inalterada.
- Reusa `TIPO_LABEL` e `TIPO_LABEL_CURTO` de `src/config/aprovacao.js` e a classe CSS
  `filter-chip` (já usada no Admin), sem CSS novo.

## Comportamento

- Linha de chips no cabeçalho do card "Requisições que você participa", espelhando o Admin
  (`AdminSolicitacoes.jsx:332-340`): ícone `Filter` (lucide-react) + chip `Todos os tipos` +
  um chip por tipo, rótulo `TIPO_LABEL_CURTO[t]`, `title={TIPO_LABEL[t]}`.
- Estado `filtroTipo` (default `'todos'`).
- `filtradas = filtroTipo === 'todos' ? participa : participa.filter((s) => s.tipo === filtroTipo)`.
- A lista renderiza `filtradas` em vez de `participa`.
- "Expandir/Recolher todas" (`todasExpandidas`, `alternarTodas`) passam a operar sobre `filtradas`.
- Mostra **todos os 6 tipos** sempre (como o Admin), independente de haver requisição do tipo.
- Os chips só aparecem quando há requisições (`participa.length > 0`).

### Estados vazios

- `participa.length === 0`: "Nenhuma requisição para acompanhar." (texto atual, mantém).
- `participa.length > 0 && filtradas.length === 0`: "Nenhuma requisição desse tipo."

## Fora de escopo (YAGNI)

- Filtro na visão RH/DP (`RequisicoesRh.jsx`).
- Filtro por status nesta tela.
- Contadores por chip.
- Agrupamento visual em seções por tipo (a decisão é filtrar por chips, como o Admin).

## Verificação

`npm run lint` + `npm run build`; smoke manual: abrir Gestor → Aprovar/Acompanhar, clicar nos
chips e confirmar que a lista filtra por tipo, que "Todos os tipos" volta a mostrar tudo, e que
"Expandir todas" respeita o filtro ativo.
