# Requisição de Mapeamento — Design

**Data:** 2026-06-12
**Requisição:** "Mapeamento — Avaliação de Candidatos / Projetos" (slug `mapeamento`, hoje `em_breve`)

## Objetivo

Tirar o Mapeamento do placeholder e criar o formulário completo, espelhando o padrão
do Formulário de Contratação (schema de campos em `src/config/`, envelope em
`solicitacoes_rh` + tabela de detalhe, "Ver respostas" no acompanhamento). Novidade:
anexo de arquivo via Supabase Storage.

## Campos (18 + anexo)

| # | campo | coluna | tipo UI | obrigatório |
| --- | --- | --- | --- | --- |
| 1 | Função | funcao | dropdown lista oficial `funcoes` + "Outro" | sim |
| 2 | Unidade | unidade | text | sim |
| 3 | Código da proposta/cliente | codigo_proposta_cliente | text | sim |
| 4 | Unidade de Negócios | unidade_negocios | text | sim |
| 5 | Estado | estado | select 27 UFs | sim |
| 6 | Cidade | cidade | text | sim |
| 7 | Salário Base | salario_base | number | sim |
| 8 | Ajuda de Custo - Alimentação | ajuda_custo_alimentacao | number | sim |
| 9 | Ajuda de Custo - Moradia | ajuda_custo_moradia | number | sim |
| 10 | Ajuda de Custo - Mobilidade | ajuda_custo_mobilidade | number | sim |
| 11 | Data Limite da Contratação | data_limite_contratacao | date | sim |
| 12 | Horário de Trabalho | horario_trabalho | text | sim |
| 13 | Critério de Folga | criterio_folga | text | sim |
| 14 | Formação (Escolaridade) | formacao | text | sim |
| 15 | Tempo de Experiência | tempo_experiencia | text | sim |
| 16 | Atividades do Cargo | atividades_cargo | textarea | sim |
| 17 | Conhecimentos Obrigatórios | conhecimentos_obrigatorios | textarea | sim |
| 18 | Desconsiderar perfis | desconsiderar_perfis | textarea | não |
| 19 | Anexar arquivo | anexo_path + anexo_nome | file (1 arquivo, 10 MB) | não |

## Banco (Supabase compartilhado `bogsuuhrgvopzgcceoqz`)

- **Tabela `mapeamentos`**: `id uuid pk`, `solicitacao_id uuid unique` FK →
  `solicitacoes_rh(id) on delete cascade`, colunas acima (`salario_base` e ajudas
  `numeric`, `data_limite_contratacao date`, resto `text`), `created_at`.
  RLS no padrão do app (policy liberada anon/authenticated).
- **Bucket `mapeamento-anexos`** (público — o app inteiro opera com anon key/login
  custom): limite 10 MB, MIME PDF/Word/Excel/PNG/JPG. Policy de INSERT para
  anon/authenticated restrita ao bucket. Path: `<solicitacao_id>/<nome-sanitizado>`.

## Código

- `src/config/mapeamento.js`: schema `CAMPOS_MAPEAMENTO` no formato do de contratação
  (id, n, label, tipo, obrigatorio), com tipos novos `funcao`, `uf`, `textarea`.
  Constante `UFS` (27). Helpers `estadoInicial / validar / montarPayload`.
- `src/pages/Gestor/requisicoes/FormMapeamento.jsx`: renderer dirigido pelo schema +
  dropdown de função (lista oficial + "Outro" cadastra em `funcoes`, igual à
  Alteração) + input de arquivo. Sequência de envio: valida → upload do anexo (se
  houver) → `criarComDetalhe` (envelope + etapas + detalhe, com compensação); se o
  insert falhar, remove o arquivo do bucket.
- `useRequisicaoForm.js`: generalizar `criarFormularioContratacao` em
  `criarComDetalhe({ tipo, justificativa, tabela, detalhe })`, mantendo a função
  antiga como wrapper.
- `src/config/requisicoes.js`: slug `mapeamento` → `status: 'pronto'`,
  `tipoDb: 'mapeamento'`. `src/config/aprovacao.js`: `TIPO_LABEL.mapeamento`.
- `NovaRequisicao.jsx`: registrar `FormMapeamento` no mapa `FORMS`.
- `AcompanharRequisicoes.jsx`: "Ver respostas" generalizado por tipo
  (`formulario_contratacao` → `formularios_contratacao`/CAMPOS;
  `mapeamento` → `mapeamentos`/CAMPOS_MAPEAMENTO) com link de download do anexo
  (public URL).

Resumo do envelope (`justificativa`): `Mapeamento: <função> — <cidade>/<UF>`.

**Fluxo de aprovação (atualizado em 2026-06-12):** diferente das demais requisições,
o Mapeamento NÃO segue o fluxo configurado do gestor — vai direto para aprovação de
**LUCAS FERRAZ GONCALVES** (`APROVADOR_MAPEAMENTO` em `config/aprovacao.js`), seguida
da etapa padrão de execução do Admin (DP). Por isso o formulário não exige nem exibe
a pré-checagem de "fluxo configurado".

## Fora de escopo

- "Ver respostas" no AdminSolicitacoes (hoje nem contratação tem lá).
- Aplicação automática de qualquer dado ao aprovar.
