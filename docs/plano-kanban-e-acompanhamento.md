# Plano — Kanban e acompanhamento do chamado (módulo Administrativo)

> Módulo **Administrativo** (React + Vite + Supabase, projeto `bogsuuhrgvopzgcceoqz`).
> Objetivo: (1) um **Kanban** para o time do Adm enxergar prazo e responsável de relance;
> (2) uma dinâmica de **acompanhamento assíncrono** que faça o solicitante entender que
> o pedido andou — sem tempo real, sem WebSocket.

---

## 1. Como funciona HOJE (baseline)

- **Fila** (`/administrativo/fila`) é uma **tabela**: ID, assunto, status, solicitante, técnico,
  criação e vencimento. Destaca "sem responsável" e pinta o SLA vencido de vermelho.
- **Detalhe** (`/administrativo/chamado/:id`) já tem **conversa**: `chamados_adm_interacoes`
  com mensagem, anexos, nota interna e as colunas `lida_solicitante_em` / `lida_atendente_em`.
  → **As colunas de leitura existem no banco e NÃO são usadas na interface.**
- **Status** hoje são 5: `aguardando_aprovacao`, `aberto`, `fechado`, `reprovado`, `cancelado`.
  Tudo que está sendo trabalhado vive em `aberto` — não há como distinguir "ninguém pegou",
  "estou tocando" e "esperando o solicitante responder".
- **Não existe histórico de eventos.** Aprovação, atribuição e fechamento acontecem, mas
  não deixam registro legível: quem olha o chamado não vê "foi aprovado por X e passou para Y".
- **Nenhum e-mail é enviado** em nenhum momento.
- Já existe Kanban no portal (`src/modules/solic/app/components/AdminKanbanBoard.tsx`), mas
  ele é de arrastar — aqui o quadro é só de leitura, então serve de referência de layout,
  não de mecânica.

**Diagnóstico:** o "chat" já existe; o que falta é o chamado **contar sua própria história**.
E o Kanban precisa de colunas que hoje o modelo de status não oferece.

---

## 2. Fase 1 — Fundação: status e eventos

Sem isto as duas funcionalidades nascem tortas.

### 2.1 Novos status

| Status | Quando | Coluna do Kanban |
|---|---|---|
| `aguardando_aprovacao` | serviço com alçada/fluxo, esperando decisão | Aguardando aprovação |
| `aberto` | liberado, **ninguém assumiu** | A fazer |
| `em_atendimento` | **novo** — alguém assumiu e está tocando | Em atendimento |
| `aguardando_solicitante` | **novo** — o Adm perguntou e espera resposta | Aguardando solicitante |
| `fechado` / `reprovado` / `cancelado` | encerrados | Concluído (agrupados) |

Migração: ampliar o `CHECK` de `chamados_adm.status`. É aditivo — nenhum chamado existente muda.

**Decidido: o prazo NÃO pausa.** Mesmo em `aguardando_solicitante` o relógio continua
correndo — o SLA mede o tempo total até a solicitação ser resolvida, não o tempo de trabalho
do Adm. Vantagem: o vencimento continua sendo uma conta simples (`analise_em + horas`),
fácil de auditar. Efeito colateral aceito: chamado parado esperando o solicitante pode vencer
sem culpa do atendente — a linha do tempo mostra de quem era a bola em cada momento.

### 2.2 Tabela de eventos

```sql
chamados_adm_eventos(
  id, chamado_id, tipo, autor_id, de text, para text, dados jsonb, created_at
)
```
`tipo`: `criado` · `aprovado` · `reprovado` · `atribuido` · `status` · `fechado` · `reaberto` · `avaliado`.

**Gravados por TRIGGER, não pelo front.** Se dependesse do código da tela, qualquer caminho
alternativo (um update pelo painel do Supabase, uma correção manual) deixaria buraco no
histórico — e um histórico com buraco não serve como histórico.

RLS: leitura para quem já enxerga o chamado; escrita só pelo trigger (nenhuma policy de INSERT).

---

## 3. Fase 2 — Acompanhamento (o "chat" que mostra que andou)

### 3.1 Linha do tempo unificada

No detalhe, mesclar **mensagens + eventos** numa lista única ordenada por data:

```
[evento]    Chamado aberto por Jarbas · 10/08 09:12
[evento]    Aprovado por Marcus · 10/08 11:40 · prazo até 12/08 11:40
[evento]    Atribuído a Paulo Ricardo · 10/08 11:41
[mensagem]  Paulo: "Já pedi orçamento ao fornecedor" · 10/08 14:02
[evento]    Aguardando solicitante · 10/08 14:02
```

É isto que responde "minha solicitação andou?" sem ninguém precisar escrever mensagem.
Evento tem ícone e cor próprios; mensagem mantém o balão atual.

### 3.2 Ações que geram texto automaticamente

Aprovar, atribuir, mudar status e fechar passam a registrar o evento correspondente —
o solicitante vê o movimento mesmo quando ninguém digitou nada.

### 3.3 Não lidas (as colunas ociosas viram função)

- Badge com contagem em **Meus chamados** e na **fila**.
- Ponto no card do Kanban.
- `marcarLidas` já existe e é chamado ao abrir o detalhe.

### 3.4 Responder muda o estado

- Adm responde → `aguardando_solicitante`.
- Solicitante responde → volta para `em_atendimento`.

Isso é o que faz a caixa de mensagem virar fluxo de trabalho em vez de mural.

### 3.5 E-mail é o que torna o assíncrono viável

Sem notificação, "não é tempo real" vira "ninguém fica sabendo". Edge Function no padrão
das que já existem, disparada em: aprovação pendente, aprovado/reprovado, nova mensagem
(para o outro lado), e fechamento (com o convite para avaliar).

---

## 4. Fase 3 — Kanban

Tela `/administrativo/kanban`, restrita ao time do Adm.

### 4.1 Colunas e cartão

Colunas conforme a tabela da fase 1. O cartão mostra:

- `#número` + assunto
- Solicitante e **responsável** (iniciais em avatar; "sem responsável" em destaque)
- **Prazo com semáforo**: verde (> 24h), âmbar (< 24h), vermelho (vencido), cinza (sem prazo)
- Ponto de mensagem não lida

### 4.2 Sem arrastar: o quadro é de leitura

**Decidido: não há drag-and-drop.** O cartão é um atalho — clicar abre o detalhe do chamado,
e é lá que as ações acontecem (assumir, responder, fechar).

Isso não é uma limitação, é o desenho certo: o chamado muda de coluna como **consequência**
de uma ação real. Assumir joga para "Em atendimento"; responder ao solicitante joga para
"Aguardando solicitante"; fechar com resolução joga para "Concluído". Arrastar permitiria
mover o cartão sem fazer a coisa — inclusive tirar um chamado de "Aguardando aprovação"
sem ninguém ter aprovado.

Consequência prática: `@hello-pangea/dnd` **não é necessário** aqui, e a tela fica bem mais
simples — uma consulta agrupada por status e cartões que são links.

### 4.3 Filtros e mobile

Filtros: meus/todos, classe, e "só atrasados".
No celular, Kanban de 5 colunas não funciona: abaixo de 900px vira **scroll horizontal com
snap por coluna**, mantendo a fila em tabela como visão alternativa.

---

## 5. Ordem de execução

| # | Entrega | Depende de | Tamanho |
|---|---|---|---|
| 1 | Migração: status novos + eventos + trigger | — | P |
| 2 | Linha do tempo no detalhe (eventos + mensagens) | 1 | M |
| 3 | Responder muda o estado do chamado | 1 | P |
| 4 | Badges de não lidas | — | P |
| 5 | Kanban (leitura, cartões que abrem o chamado) | 1 | M |
| 6 | E-mails (Edge Function) | 1 | M |

Sugestão: **1 → 2 → 3** entrega o acompanhamento completo e já muda a percepção do
solicitante. O Kanban (5) é independente depois da fase 1 e pode ir em paralelo. O e-mail (6)
é o que faz o assíncrono funcionar de verdade — não deixar por último por muito tempo.

---

## 6. Decisões

**Fechadas:**
- Kanban **sem arrastar**, só leitura + atalho para o detalhe.
- E-mail **só para os envolvidos** (solicitante, técnico do chamado, aprovador da vez) —
  nunca para o time inteiro.
- "Concluído" agrupa fechado, reprovado e cancelado.
- O quadro abre com **todos** os chamados, com filtro "meus" — igual à fila hoje.

- As **5 colunas** de §2.1 correspondem às etapas reais do Adm.
- O **prazo não pausa**: o SLA mede o tempo total até resolver.

Nada em aberto — o plano está pronto para execução.

---

## 7. Riscos

- **Trigger de evento em UPDATE amplo.** Se o front atualizar várias colunas de uma vez, o
  trigger precisa distinguir o que mudou para não gerar evento vazio.
- **Chamado pode vencer esperando o solicitante.** Como o prazo não pausa, um pedido parado
  aguardando resposta de quem abriu conta como atraso do Adm. A linha do tempo mostra de
  quem era a bola, mas o indicador sozinho não distingue.
- **Histórico é imutável por desenho.** Depois de aplicado, corrigir um evento errado exige
  migração — o que é a intenção, mas convém saber.
