# Requisições DP — Design

**Data:** 2026-06-11
**App:** App Dp (Gestão de Pessoas) — React + Vite + Supabase

## Objetivo

Transformar a área hoje chamada "Solicitações DP" em **"Requisições DP"**, substituindo a
UI de abas por um **hub em grade de cards** (estilo `imagedp.png`). Cada card abre uma
requisição específica. Hoje duas estão prontas (Desligamento e Alteração); as outras quatro
serão construídas incrementalmente, abrindo por enquanto uma tela "Em construção".

Sem mudanças de banco. Sem mudanças na lógica de aprovação, `FluxoTimeline` ou na
configuração de fluxos do admin.

## Decisões (confirmadas com o usuário)

- **6 cards, todos clicáveis.** Os não construídos abrem placeholder "Em construção".
- **Label do card de alteração:** "Alteração de Retirada de dividendo, cargo e função"
  (apenas display; a chave/valor de banco continua `aumento_salario`).
- **Navegação por rotas separadas** (uma rota por requisição).
- **Refatorar** o arquivo de 573 linhas em unidades isoladas (aprovado).

## Renomeações (somente display)

| Onde | De | Para |
|---|---|---|
| Sidebar admin (link) | Solicitações DP | Requisições DP |
| Sidebar gestor (grupo) | Solicitações DP | Requisições DP |
| Sidebar gestor (filho) | Nova solicitação | Nova requisição |
| Título da página (gestor) | Solicitações DP | Requisições DP |
| Título da página (admin) | Solicitações DP | Requisições DP |
| `TIPO_LABEL.aumento_salario` | Alteração de Retirada de dividendos / prestação de serviço | Alteração de Retirada de dividendo, cargo e função |

A chave do tipo no banco permanece `aumento_salario`. Nenhuma migração.

## Registro de requisições (fonte única)

Novo `src/config/requisicoes.js` exportando um array, cada item:
`{ slug, label, icon, status: 'pronto' | 'em_breve', tipoDb? }`.

| slug | label | icon (lucide) | status | tipoDb |
|---|---|---|---|---|
| `requisicao-geral` | Requisição geral | FileText | em_breve | — |
| `desligamento` | Desligamento | UserMinus | pronto | desligamento |
| `substituicao` | Substituição | UserRoundCog | em_breve | — |
| `alteracao` | Alteração de Retirada de dividendo, cargo e função | PencilLine | pronto | aumento_salario |
| `aumento-quadro` | Aumento de quadro | ListPlus | em_breve | — |
| `transferencia` | Transferência | ArrowRightLeft | em_breve | — |

Adicionar uma nova requisição = adicionar item ao array + criar o componente de formulário
e mapeá-lo no container.

## Layout — hub em grade

`RequisicoesHub.jsx` em `/gestor/solicitacoes/nova`:
- Header "Requisições disponíveis".
- Grade responsiva (CSS, sem Tailwind — projeto usa Vanilla CSS) com os 6 cards.
- Cada card: ícone no topo + label. Card clicável navega para `/gestor/solicitacoes/nova/:slug`.
- Cards `em_breve` continuam clicáveis (abrem placeholder); opcionalmente um selo "Em breve".

## Rotas

```
/gestor/solicitacoes               -> redirect /gestor/solicitacoes/nova
/gestor/solicitacoes/nova          -> RequisicoesHub (grade de cards)
/gestor/solicitacoes/nova/:tipo    -> NovaRequisicao (container do formulário)
/gestor/solicitacoes/acompanhar    -> AcompanharRequisicoes (lista/aprovação)
```

Substitui a rota catch-all atual `/gestor/solicitacoes/:modo` por rotas explícitas.

## Componentes (refatoração isolada de `GestorSolicitacoes.jsx`)

- **`RequisicoesHub.jsx`** — grade de cards a partir do registro.
- **`NovaRequisicao.jsx`** — container da rota `:tipo`. Resolve o slug no registro; se
  `status === 'pronto'` renderiza o form correspondente, senão renderiza o placeholder.
  Mostra "← Voltar" para o hub.
- **`requisicoes/FormDesligamento.jsx`** — form de desligamento (extraído).
- **`requisicoes/FormAlteracao.jsx`** — form de alteração (extraído; ex-`aumento_salario`).
- **`requisicoes/EmConstrucao.jsx`** — placeholder com label da requisição + ← Voltar.
- **`AcompanharRequisicoes.jsx`** — lista de acompanhamento/aprovação (extraída; comportamento inalterado).
- **`useRequisicaoForm.js`** (hook) — lógica compartilhada de criação: fetch da equipe,
  pré-checagem `fluxoOk`, e `criarComFluxo(tipo, iniciativa, dados)`. Cada form consome o hook.

`GestorSolicitacoes.jsx` deixa de existir como arquivo monolítico (ou vira um shell fino),
com responsabilidades distribuídas nas unidades acima.

## Fluxo de dados (inalterado)

`useRequisicaoForm.criarComFluxo` mantém a lógica atual: busca o fluxo configurado pelo
admin (`buscarFluxo`), resolve nomes dos aprovadores, insere em `solicitacoes_rh`, monta e
insere `solicitacoes_rh_etapas`, com delete compensatório se as etapas falharem. Dispara
`window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'))` no sucesso.

## Tratamento de erros (inalterado)

- `SEM_FLUXO` → alerta orientando configurar fluxo no DP.
- Form bloqueado quando `fluxoOk[caso] === false` com aviso inline.
- Placeholder "Em construção" para slugs `em_breve`; rota com slug inválido → volta ao hub.

## Fora de escopo

- Construção dos formulários das 4 requisições novas (próximas iterações).
- Qualquer migração ou alteração de schema do Supabase.
- Mudanças na lógica de aprovação/etapas e no admin de fluxos.
