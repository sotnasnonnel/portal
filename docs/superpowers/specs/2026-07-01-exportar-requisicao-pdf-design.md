# Exportar requisição em PDF — Design

**Data:** 2026-07-01
**Status:** Aprovado
**Git:** este projeto NÃO usa git — este spec fica só como arquivo; nada será commitado.

## Objetivo

Permitir baixar uma requisição individual em PDF, para registro na pasta (arquivo físico/digital).
Botão "Baixar PDF" em 4 lugares; um serviço único gera o documento.

## Conteúdo do PDF (confirmado)

- **Cabeçalho:** logo PHD (`src/assets/logo-phd.png`) + título "Requisição — {TIPO_LABEL}"; grade
  com Colaborador, Solicitante, Data (`created_at`), Status.
- **Campos** da requisição (todos os tipos).
- **Anexo:** se houver e for imagem, embute em página nova; se for PDF/Word, escreve
  "Anexo: {nome}" (jsPDF não mescla PDFs).
- **NÃO inclui** a cadeia de aprovação.

## Arquitetura

### 1. Serviço — `src/services/requisicaoPdf.js`

Carregado por **import dinâmico** no clique (mantém jsPDF fora do bundle principal), usando
`jspdf` + `jspdf-autotable` (já instalados), no padrão do `src/modules/reembolso/services/reembolsoPdf.js`
(`new jsPDF({ unit: 'pt', format: 'a4' })`, margem 40, título em texto na cor azul PHD, `autoTable`,
`doc.save(nome)`).

Assinatura:

```js
export async function gerarRequisicaoPdf(sol, { nomeColaborador, nomeSolicitante }) { ... }
```

- `sol`: linha de `solicitacoes_rh` já carregada pela tela (tem `id, tipo, status, created_at,
  salario_proposto, funcao_proposta, cargo_proposto, justificativa`, e o embed `colaborador { nome, funcao, salario }`).
- `nomeColaborador` / `nomeSolicitante`: nomes já resolvidos pela tela chamadora (a RLS de
  colaboradores esconde nomes; cada tela já resolve via `nomes[...]`/embed).

Passos internos:

1. **Cabeçalho:** carrega e desenha a logo (`import logoPhd from '../assets/logo-phd.png'` → carrega
   num `Image` → `doc.addImage`); título "Requisição — {TIPO_LABEL[sol.tipo]}"; grade Colaborador /
   Solicitante / Data (`formatarData(created_at)`) / Status (via `STATUS_LABEL`, ver abaixo); linha separadora.
2. **Campos** (linhas `label: valor` via `autoTable` ou a grade `field()` do padrão reembolso):
   - **Tipos por config** (`ajuda_custo`, `nova_vaga`, `mapeamento`, `formulario_contratacao`):
     `const r = await buscarRespostas(sol)` (de `ModalRespostas.jsx`); linhas =
     `r.campos.map((c) => [c.label, fmtResposta(c, r.dados[c.id])])`. Anexo = `r.anexoUrl` + `r.dados.anexo_nome`.
   - **Tipos diretos** (`aumento_salario`, `desligamento`): sem `DETALHE`. Monta as linhas da própria `sol`:
     - `aumento_salario`: "Valor atual" `formatarMoeda(sol.colaborador?.salario)`, "Valor proposto"
       `formatarMoeda(sol.salario_proposto)`, "Função proposta" `sol.funcao_proposta`, "Cargo proposto"
       `sol.cargo_proposto`, "Justificativa" `sol.justificativa` — inclui só os preenchidos.
     - `desligamento`: `parseDesligamento(sol.justificativa)` → "Data sugerida" `data`, "Justificativa" `texto`.
     - Estes dois não têm anexo.
3. **Anexo** (só tipos por config): se `anexoUrl` existir → `fetch` → `blob`; se `blob.type` começa com
   `image/`, carrega num `Image` e `doc.addPage()` + `doc.addImage` escalado à página, com legenda
   "Anexo: {anexo_nome}"; senão, escreve a linha "Anexo: {anexo_nome}" no corpo.
4. `doc.save(nomeArquivo(sol, nomeColaborador))`.

Helpers no próprio serviço:
- `STATUS_LABEL = { pendente: 'Em andamento', concluida: 'Concluída', reprovada: 'Reprovada' }` (fallback: o próprio status).
- `nomeArquivo(sol, nomeColaborador)` → `Requisicao_{TipoCurto}_{Colaborador}_{AAAA-MM-DD}.pdf`, com
  tokens sanitizados (sem espaços/acentos/`/`). TipoCurto = `TIPO_LABEL_CURTO[sol.tipo]`.

### 2. Botão reutilizável — `src/components/BotaoPdfRequisicao.jsx`

```jsx
<BotaoPdfRequisicao sol={s} nomeColaborador="..." nomeSolicitante="..." className? label? />
```

- Botão "Baixar PDF" (ícone `FileDown`/`Download` do lucide) com estado de carregando (spinner).
- No clique: `const { gerarRequisicaoPdf } = await import('../services/requisicaoPdf'); await gerarRequisicaoPdf(sol, { nomeColaborador, nomeSolicitante });` com try/catch → `alert` em erro.
- Default export.

### 3. Integração (4 pontos)

- **Acompanhar** (`src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`): no bloco `sol-card-actions`,
  ao lado de "Ver respostas", `<BotaoPdfRequisicao sol={s} nomeColaborador={nomeColab} nomeSolicitante={nomeSolic} />`.
  Como o botão aparece para todo card, garantir que `sol-card-actions` seja renderizado mesmo sem "Ver respostas"/aprovar.
- **RH/DP** (`src/pages/Gestor/requisicoes/RequisicoesRh.jsx`): no modal de detalhes da linha (ou na linha da tabela),
  passando o nome do colaborador/solicitante que a tela já tem (`nomes`/embed).
- **Admin** (`src/pages/Admin/AdminSolicitacoes.jsx`): no card/detalhe da solicitação, com os nomes que a tela já exibe.
- **Modal "Ver respostas"** (`src/pages/Gestor/requisicoes/ModalRespostas.jsx`): aceitar props opcionais
  `sol`, `nomeColaborador`, `nomeSolicitante`; quando presentes, renderiza o `BotaoPdfRequisicao` no rodapé.
  As telas que abrem o modal passam esses dados.

### 4. Refactor pequeno (incluído)

Exportar `fmtResposta` de `ModalRespostas.jsx` (hoje é `const` interno) para o serviço reusar a mesma
formatação (bool→Sim/Não, checkbox→lista, null→"—"), sem duplicar.

## Fora de escopo (YAGNI)

- Cadeia de aprovação no PDF (não marcado).
- Exportar vários de uma vez / ZIP.
- Mesclar anexos que já são PDF.
- Alterar o `reembolsoPdf.js` (é do módulo Reembolso, separado).

## Verificação

`npm run lint` + `npm run build`. Smoke manual: em cada um dos 4 pontos, baixar o PDF de uma
requisição de cada tipo e conferir cabeçalho (logo + dados), campos corretos, e o anexo
(imagem embutida / nome referenciado). **Sem commit** — mudanças ficam no working tree.
