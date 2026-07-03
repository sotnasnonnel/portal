# Formulário de Contratação (Formalização de Admissão) — Design

**Data:** 2026-06-11
**App:** App Dp (Gestão de Pessoas) — React + Vite + Supabase (projeto bogsuuhrgvopzgcceoqz)

## Objetivo

A requisição "Formulário de Contratação" passa a abrir um formulário de Formalização de
Admissão com 25 campos. Ao enviar, cria uma requisição que **passa pelo fluxo de aprovação
geral do gestor** (igual Alteração/Desligamento) e grava as 25 respostas numa **tabela
dedicada**.

## Decisões (confirmadas com o usuário)

- **Persistência:** tabela nova dedicada (`formularios_contratacao`).
- **Aprovação:** passa pelo fluxo (envelope em `solicitacoes_rh` + etapas pela cadeia geral).
- **Condicionais:** sim (mostrar/ocultar conforme respostas).

## Arquitetura: envelope + detalhe

- **Envelope:** uma linha em `solicitacoes_rh` com `tipo='formulario_contratacao'`,
  `gestor_id` = quem abriu, `colaborador_id = NULL` (o admitido ainda não é colaborador),
  `justificativa` = resumo legível (`Formalização de admissão: {nome} — {cargo}`),
  `status='pendente'`. Gera etapas via `montarEtapasDeConfig` a partir da cadeia geral
  (`buscarFluxoGeral`). Isso o faz aparecer em "Aprovar / Acompanhar" e seguir o fluxo.
- **Detalhe:** uma linha em `formularios_contratacao` ligada por `solicitacao_id` (FK →
  `solicitacoes_rh.id`), com as 25 respostas.

## Migrations (banco compartilhado bogsuuhrgvopzgcceoqz)

1. **Liberar o tipo** no CHECK de `solicitacoes_rh.tipo`:
   passar a aceitar `'desligamento'`, `'aumento_salario'`, `'formulario_contratacao'`.
2. **Tornar `colaborador_id` nullable:** `ALTER TABLE solicitacoes_rh ALTER COLUMN colaborador_id DROP NOT NULL`.
3. **Criar `formularios_contratacao`** (RLS desativado, para casar com o padrão atual de
   `solicitacoes_rh`; segurança a endereçar depois junto com as outras tabelas).

Colunas de `formularios_contratacao`:

| Coluna | Tipo | Origem (questão) |
|---|---|---|
| id | uuid PK default gen_random_uuid() | — |
| solicitacao_id | uuid FK → solicitacoes_rh(id) | — |
| data_preenchimento | date | Q1 |
| nome_profissional | text | Q2 |
| telefone | text | Q3 |
| email | text | Q4 |
| cidade_estado | text | Q5 |
| gerente_area | text | Q6 |
| gestor_responsavel | text | Q7 |
| codigo_proposta_projeto | text | Q8 |
| codigo_vaga | text | Q9 |
| cargo_nivel | text | Q10 |
| remuneracao | text | Q11 |
| ajuda_custo | boolean | Q12 (Sim/Não) |
| condicao_ajuda_custo | text | Q13 |
| motivo_ajuda_custo | text | Q14 |
| valor_ajuda_custo | numeric | Q15 |
| formato_contratacao | text | Q16 |
| destinacao_profissional | text | Q17 |
| passagem_deslocamento | boolean | Q18 (Sim/Não) |
| rota_viagem | text | Q19 |
| tipo_vaga | text | Q20 (Nova/Substituição) |
| nome_substituido | text | Q21 |
| softwares_extras | jsonb (array) | Q22 |
| epis | jsonb (array) | Q23 |
| beneficios | jsonb (array) | Q24 |
| data_disponibilidade | date | Q25 |
| created_at | timestamptz default now() | — |

## Opções dos campos (config do formulário)

- **Q13 Condição da Ajuda de Custo:** Temporária (Oferecida pelo Cliente); Temporária
  (Oferecida pela PHD); Permanente (Oferecida pela PHD); Não haverá ajuda de custo.
- **Q14 Motivo da Ajuda de Custo:** Alimentação; Alojamento; Complemento de Salário |
  Retirada; Não haverá ajuda de custo.
- **Q16 Formato de Contratação:** PHD Assessoria (Sócio Cotista); PHD Engenharia (CLT);
  PJ (Pessoa Jurídica); PHD Assessoria (CLT). *(O item "Opção 5" do texto original é
  placeholder de formulário e foi omitido.)*
- **Q17 Destinação:** Obra; Sede.
- **Q20 Tipo de vaga:** Nova; Substituição.
- **Q22 Softwares Extras:** MS Project; Primavera P6; Acrobat Reader; Navisworks; DWG True
  View; Power BI; Pacote Office; 2° tela; Outra.
- **Q23 EPIs:** Camisa com faixa refletiva; Camisa polo; Agasalho; Jaleco; Botina com
  metatarso; Botina sem metatarso; Capacete; Protetor Auricular; Protetor Solar; Outra.
- **Q24 Benefícios:** Vale Alimentação (VA); Vale Transporte (VT); Alojamento; Passagem para
  mobilização; Passagem para desmobilização; Passagem para viagens periódicas; Passagem para
  folga de campo; Hospedagem em hotel; Outra.

"Outra" entra como opção selecionável comum (sem campo de texto livre adicional, por ora).

## Condicionais (mostrar/ocultar)

- **Q12 `ajuda_custo === false`** → oculta Q13, Q14, Q15.
- **Q18 `passagem_deslocamento === false`** → oculta Q19.
- **Q20 `tipo_vaga === 'Substituição'`** → mostra Q21 (caso contrário, oculto).

Campos ocultos não são validados nem enviados (vão como `null`/`[]`).

## Obrigatoriedade

Todos os campos de texto/data/escolha única **visíveis** são obrigatórios. Multi-seleções
(Q22–24) são opcionais. Regras dependentes:
- Q15 `valor_ajuda_custo` obrigatório só quando `ajuda_custo === true`.
- Q19 `rota_viagem` obrigatório só quando `passagem_deslocamento === true`.
- Q21 `nome_substituido` obrigatório só quando `tipo_vaga === 'Substituição'`.

## Componentes

- **`src/config/formularioContratacao.js`** — schema do formulário: lista ordenada de campos
  `{ id, label, tipo: 'date'|'text'|'number'|'bool'|'radio'|'checkbox', opcoes?, obrigatorio,
  condicao?(form) }`. Fonte única que dirige render + validação + payload.
- **`src/pages/Gestor/requisicoes/FormContratacao.jsx`** — renderiza o schema, controla estado,
  aplica condicionais, valida e envia. Usa `useRequisicaoForm` (equipe não é necessária aqui,
  mas o hook fornece `fluxoOk`, `user`, `submitting`, e o envio com fluxo).
- **`useRequisicaoForm`** — novo método `criarFormularioContratacao(respostas)` que:
  1. cria o envelope via a lógica atômica existente (solicitacao + etapas pela cadeia geral);
  2. insere a linha em `formularios_contratacao` com `solicitacao_id`;
  3. se (2) falhar, apaga o envelope (e etapas em cascata) para não deixar órfão;
  4. dispara `solicitacoes_rh_atualizadas` e retorna o id.
  Reaproveita `buscarFluxoGeral` + `montarEtapasDeConfig`. `fluxoOk` continua bloqueando o
  envio quando o gestor não tem cadeia geral.
- **`NovaRequisicao.jsx`** — mapear slug `formulario-contratacao` → `FormContratacao`.
- **`requisicoes.js`** — `formulario-contratacao` vira `status: 'pronto'`,
  `tipoDb: 'formulario_contratacao'`.
- **`aprovacao.js`** — `TIPO_LABEL.formulario_contratacao = 'Formulário de Contratação'`.
- **`AcompanharRequisicoes.jsx`** — para `tipo === 'formulario_contratacao'`: exibe o resumo
  (justificativa) e um botão **"Ver respostas"** que carrega a linha de
  `formularios_contratacao` (por `solicitacao_id`) e mostra as 25 respostas num modal;
  aprovar/reprovar inalterados.

## Fluxo de dados

1. Gestor abre o card → `FormContratacao` (checa `fluxoOk` da cadeia geral).
2. Preenche, condicionais escondem campos irrelevantes, validação no submit.
3. `criarFormularioContratacao(respostas)` → envelope + etapas + detalhe (atômico).
4. Aparece em "Aprovar/Acompanhar"; aprovadores veem o resumo e podem abrir "Ver respostas".

## Tratamento de erros

- `fluxoOk === false` (sem cadeia geral) → form bloqueia o envio com aviso (igual aos outros).
- Falha ao inserir o detalhe → desfaz o envelope; mostra erro genérico.
- `SEM_FLUXO` → mensagem orientando configurar no DP.
- Campos ocultos por condicional não são validados nem enviados.

## Verificação

Sem framework de testes (ESLint + Vite). `npm run lint` + `npm run build` + checagem visual
no `npm run dev`:
- Migrations aplicadas (tabela existe; tipo aceito; colaborador_id nullable).
- Card "Formulário de Contratação" abre o form; condicionais funcionam.
- Enviar grava envelope + detalhe e aparece em Aprovar/Acompanhar; "Ver respostas" mostra os dados.

## Fora de escopo

- Endurecer RLS (tratar junto com as demais tabelas, depois).
- Campo de texto livre para opções "Outra".
- Edição/exclusão de formulários já enviados.
- Conversão do profissional admitido em `colaborador` (etapa de execução do Admin, futura).
