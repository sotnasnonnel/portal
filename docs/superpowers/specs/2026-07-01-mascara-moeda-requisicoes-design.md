# Máscara de moeda nos valores das requisições — Design

**Data:** 2026-07-01
**Status:** Aprovado (aguardando revisão do spec)

## Objetivo

Os campos de valor (R$) das requisições hoje são `<input type="number">` crus. O usuário
quer que, ao digitar, o valor seja formatado automaticamente no padrão pt-BR: o ponto separa
milhar/milhão e a vírgula separa centavos. Ex.: digitar `12000` mostra `12.000`; a vírgula
só entra quando o usuário a digita (centavos), sem forçar 2 casas.

## Comportamento da máscara (confirmado)

"Agrupar milhar; vírgula = centavos" — NÃO é centavos automáticos (fill-from-right).

| Digita | Mostra |
|---|---|
| `1` | `1` |
| `1200` | `1.200` |
| `12000` | `12.000` |
| `1200000` | `1.200.000` |
| `12000,5` | `12.000,5` |
| `12000,50` | `12.000,50` |
| `12000,509` | `12.000,50` (limita a 2 casas) |

Envio ao banco: `"12.000"` → `12000`; `"12.000,50"` → `12000.50`; vazio → `null`.

## Campos afetados (todos rotulados "(R$)")

- **Ajuda de Custo** (`src/config/ajudaCusto.js`): `alimentacao_valor`, `mobilidade_valor`, `moradia_valor`.
- **Nova Vaga** (`src/config/novaVaga.js`): `valor_orcado_contrato`, `valor_margem_proposta`.
- **Alteração de Cargo / Função** (`src/pages/Gestor/requisicoes/FormAlteracao.jsx`): `salario_proposto` ("Novo valor (R$)").

## Arquitetura

### 1. Utilitário puro — `src/utils/currencyMask.js`

Sem dependências de React; testável com `node --test`.

- `maskCurrencyInput(texto: string) => string`
  - Mantém apenas dígitos e a **primeira** vírgula (descarta vírgulas extras e qualquer
    outro caractere).
  - Separa em parte inteira e parte decimal (se houver vírgula).
  - Remove zeros à esquerda da parte inteira (mas preserva um único `0`, ex.: `0,50`).
  - Agrupa a parte inteira com `.` a cada 3 dígitos (da direita p/ esquerda).
  - Limita a parte decimal a 2 dígitos.
  - Preserva a vírgula "pendente" enquanto o usuário digita (ex.: `12000,` → `12.000,`).
  - `''` → `''`.
- `parseCurrency(mascarado: string) => number | null`
  - `''`/nulo → `null`.
  - Remove os pontos de milhar, troca a vírgula por ponto, `Number()`. Ex.: `"12.000,50"` → `12000.5`; `"12.000"` → `12000`; `"0"` → `0`.

### 2. Componente compartilhado — `src/components/CurrencyInput.jsx`

- Props: `value` (string mascarada), `onChange(maskedString)`, e repasse de `id`/`className`/`placeholder`.
- Renderiza `<input type="text" inputMode="decimal">` com classe `form-input` (padrão dos forms).
- No `onChange`, aplica `maskCurrencyInput(e.target.value)` e chama `onChange` com o resultado.
- É um componente controlado puro de apresentação: não converte para número (isso é no submit).

### 3. Renderização nos formulários

- Nos configs, os 5 campos citados passam de `tipo: 'number'` para `tipo: 'moeda'`.
- `renderCampo` em `FormAjudaCusto.jsx` e `FormNovaVaga.jsx` ganha um ramo:
  `if (c.tipo === 'moeda') return <CurrencyInput value={val} onChange={(v) => set(c.id, v)} />;`
- `FormAlteracao.jsx`: substitui o `<input>` hard-coded de "Novo valor (R$)" pelo
  `CurrencyInput`, mantendo o mesmo estado `form.salario_proposto` (agora string mascarada).

### 4. Conversão no envio

O estado do form passa a guardar a **string mascarada**. A conversão para número passa a
usar `parseCurrency` em vez de `Number()`:

- `src/config/ajudaCusto.js` — na função `montarPayloadAjudaCusto` (hoje: `... : Number(v)` para `tipo:'number'`), tratar `tipo:'moeda'` com `parseCurrency`.
- `src/config/novaVaga.js` — idem na função de montar payload.
- `src/pages/Gestor/requisicoes/FormAlteracao.jsx` — no submit, `salario_proposto: temValor ? parseCurrency(form.salario_proposto) : null` (hoje `Number(...)`), e o `temValor`/validação continuam com base na string vazia.

Validação de obrigatório não muda: campo vazio continua `''`.

## Testes

`src/utils/currencyMask.test.js` (`node --test`):
- `maskCurrencyInput`: casos da tabela acima + descarte de letras, vírgulas extras, zeros à
  esquerda, vírgula pendente, string vazia.
- `parseCurrency`: `"12.000"`→`12000`, `"12.000,50"`→`12000.5`, `"0"`→`0`, `''`→`null`.

Verificação de UI: `npm run lint` + `npm run build`; smoke manual digitando nos 6 campos e
conferindo o valor gravado.

## Fora de escopo (YAGNI)

- Campos de dinheiro fora das requisições (o módulo Reembolso tem seu próprio formato).
- Preenchimento de valores pré-existentes nos inputs (os forms de nova requisição começam vazios).
- Centavos automáticos (fill-from-right).
- Mudança na exibição read-only de valores (segue usando `formatarMoeda`).
