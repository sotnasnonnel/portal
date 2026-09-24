# Requisição de Nova Vaga — Design

**Data:** 2026-06-12
**Requisição:** "Nova Vaga" (slug `nova-vaga`, hoje `em_breve`)

## Objetivo

Formulário de Nova Vaga (aumento de quadro) no padrão das demais requisições, em
4 seções, com selects dependentes (Empresa → Filial), departamento com "Outro",
função da lista oficial e anexo via Storage.

## Seções e campos

### Dados básicos
- Justificativa (textarea, obrigatória) — "justificativa do aumento de quadro"
- Previsão (date, obrigatória)
- Quantidade de vagas (inteiro ≥ 1, obrigatória)

### Local de destino
- Empresa (select, obrigatória): PHD ENGENHARIA | PHD ASSESSORIA
- Filial (select dependente, obrigatória): Engenharia → "PHD PLANEJAMENTO,
  CONSULTORIA E GESTAO DE OBRAS"; Assessoria → "PHD ASSESSORIA EM GESTAO LTDA".
  Trocar a empresa limpa a filial.
- Departamento (select, obrigatório): Administrativo, Comercial, Dados,
  Departamento Pessoal, Financeiro, Gente e Cultura / RH, Marketing, PMO,
  Planejamento, BIM, Lean, Qualidade, Medição, Topografia, Operações + "Outro"
  (texto livre, gravado só na vaga — não há lista oficial de setores).

### Dados da vaga
- Função (select da lista oficial `funcoes` + "Outro" que cadastra com
  `origem='requisicao'`, obrigatória)
- Salário proposto (R$) (number, obrigatório)

### Anexo
- 1 arquivo opcional, **só PDF/PNG/JPG/JPEG**, até 10 MB, com aviso de legibilidade.

### Informações adicionais (todos obrigatórios, exceto Desconsiderar Perfis)
Unidade de Negócios, Unidade, Nome do Cliente, Codigo do Cliente (text);
Valor do profissional orçado no contrato Comercial, Valor/margem salarial para a
proposta ao Candidato (number); Tipo Transporte (text); Modalidade de Contratação
(select: PHD Assessoria (Sócio Cotista), PHD Engenharia (CLT), PJ (Pessoa Jurídica),
PHD Assessoria (CLT)); Horário de Trabalho (text); Se o profissional estará 100% no
custo do projeto (Sim/Não); Tipo de Moradia, Tipo Alimentação, Folga de Campo,
Formação, Tempo de Experiência, Cidade de Atuação (text); Estado de Atuação (UF);
Requisitos Desejados, Atividades do Cargo, Requisitos Obrigatórios (textarea);
Desconsiderar Perfis (textarea, opcional).

## Banco (Supabase compartilhado `bogsuuhrgvopzgcceoqz`)

- **Tabela `vagas`**: `id uuid pk`, `solicitacao_id uuid unique` FK →
  `solicitacoes_rh(id) on delete cascade`, colunas acima (valores `numeric`,
  `quantidade_vagas int`, `previsao date`, `custo_projeto_100 boolean`, resto `text`),
  `anexo_path`/`anexo_nome`, `created_at`. RLS no padrão do app.
- **Bucket `vaga-anexos`**: público, 10 MB, MIME `application/pdf`, `image/png`,
  `image/jpeg`; policies insert/select/delete p/ anon.

## Código

- `src/config/novaVaga.js`: `EMPRESAS`, `FILIAIS` (mapa empresa → filiais),
  `DEPARTAMENTOS`, `CAMPOS_NOVA_VAGA` com `secao` para agrupamento e tipos
  `textarea | date | number (inteiro) | select | departamento | funcao | uf | bool |
  text`; helpers `estadoInicialNovaVaga / validarNovaVaga / montarPayloadNovaVaga`.
- `FormNovaVaga.jsx`: renderer agrupado por seção; Empresa → Filial dependente;
  Departamento/Função com "Outro"; anexo com limpeza compensatória; envelope tipo
  `nova_vaga` via `criarComDetalhe`, resumo `Nova Vaga: <função> (<qtd>x) — <depto>`.
- `requisicoes.js`: slug `nova-vaga` → `pronto`, `tipoDb: 'nova_vaga'`.
  `aprovacao.js`: `TIPO_LABEL.nova_vaga`. `NovaRequisicao.jsx`: registrar form.
- `AcompanharRequisicoes.jsx`: entrada `nova_vaga` no `DETALHE` (bucket `vaga-anexos`).

## Fora de escopo

Lista oficial de setores no banco; "Ver respostas" no Admin; aplicação automática
ao aprovar.
