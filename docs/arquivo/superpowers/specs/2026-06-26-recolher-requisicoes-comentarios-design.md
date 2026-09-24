# Recolher requisições + comentário opcional ao aprovar/reprovar

Data: 2026-06-26
Módulo: Portal PHD → Requisições DP (visão do Gestor)

## Problema

A visão do Gestor (`AcompanharRequisicoes.jsx`) mostra cada requisição como um
card grande e totalmente expandido (info + justificativa + resumo + timeline +
botões). Quando há muitas requisições, a lista fica longa e difícil de varrer.

Além disso, quem aprova hoje não consegue deixar nenhum comentário (aprovar é 1
clique direto), e quem reprova é **obrigado** a escrever um motivo.

## Objetivos

1. **Recolher/expandir** cada card numa linha-resumo (ex: `Desligamento ·
   Warley Alves Campos` + badge de status), expansível para ver o detalhe e o
   fluxo de aprovação.
2. **Comentário opcional** para quem aprova **e** para quem reprova, exibido na
   timeline do fluxo para todos da cadeia (incluindo RH/DP, que só lê).

## Escopo

- **Aplica só à visão do Gestor** (`AcompanharRequisicoes.jsx`). A visão RH/DP
  (`RequisicoesRh.jsx`) já é tabela compacta + modal; não muda — mas como ela
  reusa `FluxoTimeline`, o RH/DP passa a **ver** os comentários.
- **Sem migração de banco.** O comentário é gravado na coluna `justificativa`
  que já existe em `solicitacoes_rh_etapas`.

## Decisões (confirmadas com o usuário)

- Cards começam **recolhidos**, exceto a requisição que está **aguardando a ação
  do próprio usuário** (`acaoDisponivel(user.id, etapas) === 'aprovacao'`), que
  abre **expandida**.
- Botão **"Expandir todas / Recolher todas"** no topo da lista.
- **Aprovar e reprovar passam a abrir o mesmo modal de confirmação**, com campo
  de comentário **opcional nos dois** (a reprovação deixa de exigir motivo).
- Estado de expandido/recolhido é só de UI (`useState`), não persiste.

---

## Feature 1 — Recolher/expandir cards

### Comportamento

- Cada `sol-card` ganha um **cabeçalho clicável** (`<button>` para acessibilidade)
  contendo: ícone/tipo, o resumo `"{TIPO_LABEL[tipo]} · {nomeColab || 'Solicitado
  por ' + nomeSolic}"`, o `badge` de status (mantido visível recolhido) e um
  chevron que gira conforme o estado.
- **Recolhido**: mostra só o cabeçalho.
- **Expandido**: mostra o conteúdo atual (`sol-card-info`, `sol-card-just`,
  `sol-card-resumo`, `FluxoTimeline`, `sol-card-actions`).

### Estado

- `const [expandido, setExpandido] = useState(() => new Set())` — Set com os IDs
  expandidos.
- Inicialização: após `fetchParticipa`, um `useEffect` semeia o Set com os IDs
  onde `acaoDisponivel(user.id, s.etapas) === 'aprovacao'`.
- Toggle individual: clicar no cabeçalho adiciona/remove o ID do Set.
- "Expandir todas" → Set com todos os IDs; "Recolher todas" → Set vazio. Um único
  botão alterna o rótulo conforme a maioria esteja expandida ou não.

### Acessibilidade

- Cabeçalho é `<button>` com `aria-expanded` e `aria-controls` apontando para o
  corpo. O chevron tem `aria-hidden`.

### CSS (`Requisicoes.css`)

- `.sol-card-header` (linha clicável: flex, gap, cursor pointer, padding).
- `.sol-card-chevron` com transição de `transform: rotate(...)`.
- `.sol-card-body` recebe o conteúdo expandível; quando recolhido, não é
  renderizado (render condicional, não `display:none`, para não montar a timeline
  à toa).

---

## Feature 2 — Comentário opcional ao aprovar/reprovar

### UI

- Substituir o clique direto de **Aprovar** por um modal espelhado no de
  reprovação. Um único componente de modal de decisão com dois modos:
  `modo = 'aprovar' | 'reprovar'`.
- Modal contém:
  - Título e texto-guia conforme o modo.
  - `textarea` de **comentário opcional** (sem `*`, placeholder do tipo
    "Comentário (opcional)…").
  - Botão confirmar com cor conforme o modo (success/danger).
- Some a obrigatoriedade do motivo na reprovação: o botão confirmar **não**
  depende mais de `texto.trim()`.

### Persistência

- **Aprovar** (`aprovar`): `update` na etapa atual com
  `{ status: 'aprovada', decidido_em, justificativa: comentario.trim() || null }`
  (mesma cláusula de guarda atual: `.eq('aprovador_id', user.id).eq('status',
  'pendente')`).
- **Reprovar** (`confirmarReprovar`): igual ao atual, mas `justificativa` agora
  pode ser `null` (comentário vazio). Mantém o segundo `update` que marca a
  `solicitacoes_rh` como `reprovada`.

### Exibição na timeline (`FluxoTimeline.jsx`)

- Hoje o trecho de comentário só renderiza quando `status === 'reprovada'`.
- Passar a renderizar `e.justificativa` (entre aspas, estilo atual) sempre que
  **existir**, para qualquer status decidido (`aprovada`, `auto_aprovada`,
  `reprovada`). A label "Aprovou"/"Reprovou" já vem do mapa `VISUAL`.

---

## Arquivos afetados

- `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx` — estado de
  expandir/recolher, cabeçalho clicável, botão "expandir todas", modal de decisão
  unificado (aprovar+reprovar), gravação do comentário no `aprovar`.
- `src/components/Solicitacoes/FluxoTimeline.jsx` — mostrar comentário em
  qualquer etapa decidida que tenha `justificativa`.
- `src/pages/Gestor/requisicoes/Requisicoes.css` — estilos do cabeçalho, chevron
  e corpo recolhível.

## Fora de escopo (YAGNI)

- Persistir o estado de expandido entre recarregamentos.
- Recolher na visão RH/DP (já é compacta).
- Editar/excluir comentário depois de gravado.
- Comentário na etapa de execução do admin (mantém fluxo atual).

## Testes / verificação manual

- Lista com várias requisições começa recolhida; a que aguarda o usuário abre
  expandida.
- "Expandir todas"/"Recolher todas" alterna corretamente.
- Aprovar sem comentário funciona; aprovar com comentário grava e aparece na
  timeline como "Aprovou" + texto.
- Reprovar sem comentário encerra como Reprovada (sem exigir motivo); com
  comentário, mostra o texto.
- RH/DP enxerga os comentários na timeline (modal de detalhe).
