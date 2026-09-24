# Cadastro por seleção + Fluxos de aprovação por tipo

Data: 2026-06-23
Módulo: DP (Gestão de Pessoas) — Portal PHD
Banco compartilhado: `bogsuuhrgvopzgcceoqz`

## Contexto

O acesso ao Portal é por conta Microsoft, e os colaboradores já entram como
registro mestre (planilha colab.xlsx / sincronização). Duas partes do DP ainda
assumem o modelo antigo:

1. **Cadastro** (`AdminCadastro`) cria um colaborador novo do zero, digitando
   nome + e-mail + dados de RH. Isso conflita com a fonte mestre (nome/e-mail
   vêm da Microsoft/planilha, não devem ser digitados à mão).
2. **Fluxos de aprovação** (`AdminFluxos`) usam um único fluxo geral por gestor
   (slot `tipo='aumento_salario', iniciativa=''` em `solicitacoes_rh_fluxos`),
   reaproveitado para todas as requisições. Não há fluxo por tipo.

Este spec cobre as duas mudanças.

---

## Parte 1 — Cadastro vira "selecionar colaborador + editar RH"

### Comportamento

`AdminCadastro` deixa de inserir colaborador novo. Passa a:

1. **Selecionar colaborador**: dropdown (ou busca) com colaboradores **ativos**,
   ordenados por nome, excluindo `perfil='admin'` (mesmo critério da Listagem).
2. Ao escolher, carrega os dados e exibe **Nome e E-mail como somente-leitura**
   (texto, não input), com hint "vem da conta Microsoft da PHD".
3. Permite editar **apenas** estes 8 campos:
   - Perfil (`usuario` | `gestor`)
   - Formato (CLT | PJ | Sócio Cotista | Diretoria)
   - Data de Nascimento
   - Função
   - Superior
   - Data de Admissão
   - Salário
   - Último Aumento
4. **Salvar = UPDATE** em `colaboradores` (não INSERT), por `id`.
5. Validações mantidas: superior obrigatório para `usuario`, opcional para
   `gestor` (zera superior ao virar gestor). Os campos hoje marcados como
   obrigatórios continuam obrigatórios.
6. Remove o caminho de "criar do zero" (inputs de nome/e-mail) e o INSERT.
   O botão "Limpar" passa a "Trocar colaborador" (reseta a seleção).

### Página

Título/subtítulo passam a refletir edição, ex.: **"Editar dados do colaborador"**
/ "Selecione um colaborador para completar ou atualizar os dados de RH".

### Consistência na Listagem

No modal de edição de `AdminListagem`, **Nome e E-mail viram somente-leitura**
(fonte = Microsoft/planilha). O `payload` do UPDATE para de enviar `nome`/`email`.
O restante do modal (perfil, formato, função, superior, datas, salário) continua
igual.

### Fora de escopo

- Sincronização da planilha mestre (já existe, não muda aqui).
- Filtro "dados incompletos" — a lista mostra todos os ativos; pode ser
  adicionado depois.

---

## Parte 2 — Um fluxo de aprovação por tipo de requisição

### Modelo de dados

Reaproveita `solicitacoes_rh_fluxos`:
`(id, solicitante_id, tipo, iniciativa default '', aprovadores jsonb default '[]', updated_at, created_at)`,
constraint única `(solicitante_id, tipo, iniciativa)`.

- Chave de cada fluxo: `(solicitante_id, tipo, iniciativa='')`.
- A dimensão `iniciativa` é abandonada na prática (sempre `''`).
- A linha existente `aumento_salario/''` passa a ser o fluxo do tipo
  **Alteração de Cargo** (`aumento_salario`).

Os 6 tipos configuráveis:
`aumento_salario`, `desligamento`, `formulario_contratacao`, `ajuda_custo`,
`nova_vaga`, `mapeamento`.

### Seed (migration de dados)

Para cada um dos gestores que **já têm** o fluxo geral (`aumento_salario/''`,
hoje 21 linhas), criar os fluxos dos **outros 5 tipos** copiando a mesma cadeia
`aprovadores`; e o de **`mapeamento` = `["554ec9c1-c4fb-4b5a-b4a6-040c835acca5"]`**
(Lucas Ferraz), preservando o comportamento atual do Mapeamento.

Resultado: todos os 6 fluxos nascem **preenchidos como funciona hoje** e
**independentes** (editar um não afeta os outros). Idempotente: usar
`ON CONFLICT (solicitante_id, tipo, iniciativa) DO NOTHING` para não sobrescrever
nada já configurado.

### Código

`src/config/aprovacao.js`:
- Constante `TIPOS_FLUXO` com os 6 tipos (ordem de exibição).
- `buscarFluxoPorTipo(supabase, solicitanteId, tipo)`:
  1. Busca `(solicitante_id, tipo, '')`.
  2. Rede de segurança (gestor novo ainda não seedado): se faltar, cai no slot
     geral `aumento_salario/''`.
  3. `mapeamento` sem linha → default `APROVADOR_MAPEAMENTO` (Lucas Ferraz).
  - Retorna `{ fluxo, erro }` como `buscarFluxoGeral` (distinguir erro de rede de
    "não configurado").
- `buscarFluxoGeral` é mantida como fallback interno (ou reescrita em termos de
  `buscarFluxoPorTipo`), para não quebrar chamadas existentes.

`src/pages/Gestor/requisicoes/useRequisicaoForm.js`:
- `resolverCadeia(tipo)` passa a receber o `tipo` e usa `buscarFluxoPorTipo`.
  A resolução de nomes continua via RPC `nomes_colaboradores` (já implementada).
- `criarComDetalhe` / `criarComFluxo` passam seu `tipo` para `resolverCadeia`.
- O precheck `fluxoOk` passa a considerar o tipo da requisição (ou mantém o geral
  como "tem algum fluxo"; decidir no plano — não bloquear criação por engano).

`src/pages/Gestor/requisicoes/FormMapeamento.jsx`:
- Deixa de fixar a cadeia `[Lucas Ferraz]` no código; passa a usar
  `resolverCadeia('mapeamento')` (que tem Lucas como default). Mantém o mesmo
  resultado, mas agora configurável.

### UI — `AdminFluxos`

- Mantém o seletor de gestor e o `fluxo-canvas` atuais.
- Acrescenta, abaixo do seletor de gestor, uma **faixa de chips por tipo**
  (rótulos de `TIPO_LABEL`), cada um com indicador ✅ (configurado) / ⚠️ (sem
  linha própria — usando fallback).
- Selecionar um chip carrega a cadeia daquele `(gestor, tipo)` no canvas
  (pré-preenchida via fallback quando não houver linha).
- "Salvar fluxo" grava a linha **daquele tipo** (upsert em
  `solicitante_id,tipo,iniciativa`), não mais o slot geral fixo.
- Subtítulo da página ajustado para refletir "por tipo de requisição".

### RLS

`solicitacoes_rh_fluxos` já permite leitura por `solicitante_id` (criação de
requisição lê hoje) e escrita pelo admin (AdminFluxos salva hoje). Inserir mais
linhas do mesmo tipo não muda a política. Sem mudança de RLS prevista; validar
após o seed que o admin continua salvando e o gestor continua lendo o próprio
fluxo.

### Fora de escopo

- Reintroduzir a dimensão `iniciativa` (empresa/empregado) por tipo — abandonada.
- Fluxos diferentes por iniciativa dentro de um mesmo tipo.

---

## Critérios de aceitação

**Cadastro:**
- Não é mais possível digitar nome/e-mail; só selecionar um colaborador existente.
- Editar os 8 campos e salvar atualiza o colaborador (UPDATE), refletindo na
  Listagem.
- Nome/e-mail são somente-leitura tanto no Cadastro quanto no modal da Listagem.

**Fluxos:**
- Cada gestor tem 6 fluxos independentes, todos pré-preenchidos com a cadeia
  atual (Mapeamento = Lucas Ferraz).
- Editar e salvar o fluxo de um tipo não altera os demais.
- Criar uma requisição de qualquer tipo usa o fluxo daquele tipo; nomes dos
  aprovadores resolvem via RPC (sem o erro "Aprovador sem nome resolvido").
- Mapeamento, sem edição, continua indo para Lucas Ferraz.
