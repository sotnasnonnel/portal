# Função e Cargo na requisição de Alteração — Design

**Data:** 2026-06-12
**Requisição afetada:** "Alteração de Retirada de dividendo, cargo e função" (slug `alteracao`, tipo `aumento_salario`)

## Objetivo

O formulário hoje só permite propor um novo valor de retirada (R$). Passar a permitir
também propor **nova função** (selecionada de uma lista oficial vinda da planilha
FUNÇÃO.xlsx, com opção "Outro" que cadastra função nova) e **novo cargo** (texto livre).

## Decisões

- **Campos opcionais:** valor, função e cargo são individualmente opcionais; pelo menos
  um dos três precisa ser preenchido. Justificativa continua obrigatória.
- **"Outro" entra na lista oficial:** a função digitada é inserida na tabela `funcoes`
  e aparece no dropdown para as próximas requisições (origem `requisicao`).
- **Aprovação continua informativa:** nada é aplicado automaticamente no cadastro do
  colaborador; o DP aplica manualmente, como hoje.
- **Tipo no banco permanece `aumento_salario`** para não quebrar registros existentes.

## Banco (Supabase compartilhado `bogsuuhrgvopzgcceoqz`, tabelas sem prefixo)

### Nova tabela `funcoes`

| coluna | tipo | observação |
| --- | --- | --- |
| id | uuid pk | `gen_random_uuid()` |
| codigo | int, nulo | código da planilha; nulo p/ funções criadas via "Outro" |
| nome | text not null | único (case-insensitive, índice em `upper(nome)`) |
| origem | text not null | `'planilha'` ou `'requisicao'` |
| created_at | timestamptz | default `now()` |

Seed: 132 funções únicas da FUNÇÃO.xlsx (a planilha tem 135 linhas; 3 nomes duplicados —
ANALISTA DE DEPARTAMENTO PESSOAL I, CONSULTOR LEAN SENIOR, GERENTE DE PLANEJAMENTO —
mantém-se a primeira ocorrência de cada). Nomes com trim.

### `solicitacoes_rh`

Adicionar colunas `funcao_proposta text` e `cargo_proposto text` (nulas).

## Formulário (`src/pages/Gestor/requisicoes/FormAlteracao.jsx`)

- "Novo valor (R$)" passa a ser opcional.
- "Nova função": select carregado de `funcoes` em ordem alfabética + opção "Outro…" no
  fim que exibe um input de texto. No envio com "Outro": verifica duplicata
  case-insensitive em `funcoes`; se não existir, insere com origem `requisicao`;
  grava o nome em `funcao_proposta`.
- "Novo cargo": input texto livre opcional, gravado em `cargo_proposto`.
- Validação: justificativa obrigatória + pelo menos um entre valor/função/cargo.
- Card de contexto do colaborador mostra valor atual **e função atual**.

## Exibição do andamento

`AcompanharRequisicoes.jsx` e `AdminSolicitacoes.jsx` incluem `funcao_proposta` e
`cargo_proposto` no select e exibem apenas o que foi preenchido:
`Valor: atual → novo`, `Função: atual → nova`, `Cargo: → novo`.

## Fora de escopo

- Tela de administração da lista de funções.
- Aplicação automática da mudança no cadastro ao aprovar.
