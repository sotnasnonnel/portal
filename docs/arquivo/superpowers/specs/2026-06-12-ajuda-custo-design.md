# Requisição de Ajuda de Custo — Design

**Data:** 2026-06-12
**Requisição:** "Ajuda de Custo" (slug `ajuda-custo`, hoje `em_breve`)

## Objetivo

Formulário de Ajuda de Custo no padrão das demais requisições (schema em config,
envelope `solicitacoes_rh` + tabela de detalhe, anexo via Storage, "Ver respostas").

## Decisões

- **Colaborador da equipe obrigatório** no topo (como na Alteração) → `colaborador_id`
  no envelope.
- **Tipo de Ajuda de Custo é múltipla escolha** (checkbox): Alimentação, Mobilidade,
  Moradia, Transferência de Projeto, Retroativo — pelo menos 1.
- **Campos condicionais**: cada tipo marcado revela sua seção; campos visíveis são
  obrigatórios, ocultos vão como nulos.
- Datas obrigatórias com validação `data_final ≥ data_inicio`.
- **Anexo opcional** (1 arquivo, 10 MB, PDF/Word/Excel/imagem).
- "Retroativo - Moradia" tratado como valor (R$), igual aos demais campos de moradia.
- Envelope tipo `ajuda_custo`; fluxo geral do gestor; resumo
  `Ajuda de Custo: <tipos> — <início> a <fim>`.

## Campos por seção

| seção (tipo marcado) | campos |
| --- | --- |
| (sempre) | Data Início, Data Final, Tipo de Ajuda de Custo |
| Alimentação | Alimentação - Valor (R$), Alimentação - Justificativa |
| Mobilidade | Mobilidade - Valor (R$), Mobilidade - Justificativa |
| Moradia | Moradia - Valor (R$) |
| Transferência de Projeto | Origem, Destino, Alimentação Valor, Alimentação QTD Dias, Mobilidade Valor, Mobilidade QTD Dias, Moradia Valor |
| Retroativo | Justificativa, Alimentação Valor, Alimentação Justificativa, Mobilidade Valor, Mobilidade QTD Dias, Moradia Valor |
| (sempre) | Anexar arquivo (opcional) |

## Banco (Supabase compartilhado `bogsuuhrgvopzgcceoqz`)

- **Tabela `ajudas_custo`**: `id uuid pk`, `solicitacao_id uuid unique` FK →
  `solicitacoes_rh(id) on delete cascade`, `data_inicio date`, `data_final date`,
  `tipos text[]`, valores `numeric`, QTD dias `int`, justificativas/origem/destino
  `text`, `anexo_path`/`anexo_nome`, `created_at`. RLS no padrão do app.
- **Bucket `ajuda-custo-anexos`**: mesma config do `mapeamento-anexos` (público,
  10 MB, MIME restrito, policies insert/select/delete p/ anon).

## Código

- `src/config/ajudaCusto.js`: `TIPOS_AJUDA`, `CAMPOS_AJUDA_CUSTO` (com `mostrar`
  condicionado a `tipos`), `estadoInicialAjudaCusto / validarAjudaCusto /
  montarPayloadAjudaCusto` (padrão do formulário de contratação).
- `useRequisicaoForm.js`: `criarComDetalhe` aceita `colaborador_id` (default null).
- `FormAjudaCusto.jsx`: colaborador da equipe + renderer dirigido pelo schema
  (date/number/text/textarea/checkbox) + anexo com limpeza compensatória.
- `requisicoes.js`: slug `ajuda-custo` → `pronto`, `tipoDb: 'ajuda_custo'`.
  `aprovacao.js`: `TIPO_LABEL.ajuda_custo`. `NovaRequisicao.jsx`: registrar form.
- `AcompanharRequisicoes.jsx`: entrada `ajuda_custo` no `DETALHE`, que passa a
  indicar também o `bucket` do anexo por tipo.

## Fora de escopo

Aplicação automática ao aprovar; "Ver respostas" no Admin.
