# Edição da requisição pelo solicitante (cadeia recomeça)

Dois ajustes nas Requisições DP, pedidos em 2026-08-12: **(1)** o requisitante
pode editar a própria requisição e ela volta para a cadeia de aprovação;
**(2)** transformar Mapeamento em Nova Vaga, que existia mas ninguém alcançava
(ver a última seção).

Decisões da parte 1, confirmadas com o usuário:

- **Quando:** só enquanto a requisição está **em andamento** (`status = 'pendente'`).
  Concluída e cancelada não se mexem mais.
- **Reprovada continua como estava:** botão **Responder** reabre a etapa de quem
  reprovou, sem reiniciar a cadeia (regra combinada com a Ana Costa em ago/2026).
  Os dois caminhos são excludentes e nunca aparecem juntos no mesmo card.
- **A cadeia recomeça do zero:** as aprovações já dadas são descartadas e todos
  decidem de novo. É o ponto do pedido — quem aprovou aprovou outro conteúdo.

---

## Banco (⚠️ aplicar ANTES do deploy do front)

`supabase_migration_requisicoes_edicao_solicitante.sql`:

- Colunas em `solicitacoes_rh`: `edicao_motivo`, `edicao_por`, `edicao_em`
  (+ `reenvios`, idempotente — já existia de jul/2026).
- RPC `reenviar_requisicao_rh(p_sol uuid, p_etapas jsonb, p_motivo text)`
  SECURITY DEFINER: apaga as etapas, insere a cadeia nova, volta a requisição
  para `pendente` e grava o rastro da edição — **numa transação só**. Em duas
  chamadas do cliente, uma falha no meio deixaria a requisição **sem nenhuma
  etapa**, ou seja, sem aprovador da vez e invisível para todos.
- Guardas da RPC: sessão com colaborador vinculado; **só o dono** (`gestor_id`)
  edita; **só em `pendente`** (com `for update`, então um aprovador decidindo no
  mesmo instante é serializado); cadeia vazia aborta e desfaz o delete.
- A função já existiu com a assinatura `(uuid, jsonb)` na feature "Devolver para
  ajustes" (removida da interface em ago/2026). A migração dropa as duas
  assinaturas antes de criar — roda igual tendo ela sobrevivido ou não.
- **Não amplia a RLS**: `etapas_write` já permitia ao gestor-dono reescrever as
  próprias etapas. A RPC é SECURITY DEFINER pela atomicidade, não por privilégio.

**Ordem obrigatória: migração primeiro, deploy depois.** As telas passaram a
pedir `edicao_motivo`/`edicao_em` no SELECT; sem as colunas, a consulta volta
erro e o Histórico, o Acompanhar e o Admin ficam vazios.

## Código

- `config/reenvio.js`: `podeEditarRequisicao` / `podeResponderRequisicao` — a
  regra de quem vê cada botão, isolada e testável. Imports do módulo ganharam a
  extensão `.js` (junto com `ajudaCusto`/`novaVaga`/`mapeamento`), senão o
  módulo não carrega fora do Vite e a regra não teria como ser testada.
- `useRequisicaoForm.js`: `editarRequisicao` — pré-checa o status (falha cedo,
  antes de gravar), grava os ajustes, **reconstrói a cadeia pela mesma via da
  criação** (`resolverCadeia` + `aplicarAlcadaGC`), chama a RPC, audita a alçada
  e notifica o 1º aprovador da cadeia nova.
  Consequência importante: se a edição muda o que define a alçada (função
  proposta, cargo), os aprovadores certos entram e saem sozinhos.
- `EditarReenviarModal.jsx`: ganhou `modo` (`'responder' | 'editar'`). No modo
  editar exibe o aviso de que a cadeia reinicia e exige **motivo da edição**;
  o editor de campos e anexos é exatamente o mesmo. `onResponder` virou
  `onSalvar` (quem executa é o chamador).
- `HistoricoRequisicoes.jsx`: botão **Editar requisição** (âmbar) nas pendentes,
  ao lado do Responder das reprovadas; mostra o rastro da última edição.
- `AcompanharRequisicoes.jsx`, `AdminSolicitacoes.jsx`, `RequisicoesRh.jsx`:
  faixa âmbar "Editada pelo solicitante em dd/mm — a aprovação recomeçou:
  <motivo>". Sem isso, quem já tinha aprovado reaprovaria sem saber o que mudou.

Testes: `config/reenvio.test.js` (10). Suíte: 246 verdes; ESLint e `vite build`
limpos nos arquivos tocados.

## Decidido de propósito

- **Notificação só para o próximo aprovador** (comportamento que já existia).
  Avisar por e-mail quem já tinha aprovado exigiria uma Edge Function nova; a
  faixa âmbar no card cobre o essencial. Fica como follow-up se a Ana pedir.
- **Requisição pendente na etapa de execução do Admin ainda é editável** — ela
  não foi executada, então continua "em andamento". Se o DP achar arriscado,
  basta excluir `tipo_etapa = 'execucao'` da regra em `podeEditarRequisicao`.
- **Sem versionamento do conteúdo**: guardamos o motivo, não o "antes e depois"
  campo a campo. Um diff exigiria histórico das tabelas de detalhe.

## Mapeamento → Nova Vaga (pedido 2): ampliado

A conversão existe desde jul/2026 (commit 49cccaf) e já estava no ar, mas os
gestores continuavam pedindo a vaga ao DP — não conseguiam achar o botão. Duas
causas, ambas corrigidas:

1. **A regra de status estava errada na prática.** Exigia `status = 'concluida'`,
   que não quer dizer "aprovado" e sim "o Admin do DP executou a etapa final"
   (`AdminSolicitacoes.executar`). Entre a aprovação da cadeia e a execução do DP
   — exatamente quando o gestor quer abrir a vaga — a requisição segue `pendente`
   e o botão não existia.
   Agora: `podeGerarNovaVaga` libera para o **solicitante** em qualquer situação
   que não seja fim de linha (reprovada/cancelada). É seguro porque a Nova Vaga é
   uma requisição NOVA e passa pela própria cadeia completa (§5.1); o Mapeamento
   é insumo, não autorização. Quando a origem ainda está em aprovação, o
   formulário avisa em âmbar.
2. **Só existia num lugar** (aba Histórico de Requisições DP → Mapeamento). Agora
   o botão é o componente `BotaoGerarNovaVaga` e aparece nos três lugares onde o
   solicitante abre um Mapeamento: Histórico, **Aprovar/Acompanhar** e o rodapé
   do modal **Ver respostas**. Ele mesmo decide se aparece, então some para quem
   não é o solicitante (aprovador que abre o mesmo mapeamento não vê).

O botão lê a tabela `mapeamentos` direto em vez de `buscarRespostas()` — o modal
"Ver respostas" agora é um dos donos do botão, e importar de lá fecharia um ciclo.

Testes: `config/mapeamento.test.js` (7).
