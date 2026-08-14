# Ajustes nas Requisições DP (pedido Ana Costa)

Três mudanças. **Banco e Edge Function já aplicados** (migração
`requisicoes_cancelamento` + função `notify-solic-reprovada` ACTIVE). Falta só o
**deploy do front**.

---

## 1. "Devolver para ajustes" — REMOVIDO
Botão e modo `devolver` saíram de `AcompanharRequisicoes`. O status `devolvida`
segue aceito no banco por compatibilidade, mas nada mais o gera. Serviço
`notificarSolicitanteDevolucao.js` (órfão) foi apagado; a Edge Function
`notify-solic-devolvida` fica deployada mas sem uso (pode ser removida depois).

## 2. Reprovação → e-mail ao solicitante → ele responde → volta a quem reprovou
- Ao reprovar (na tela do gestor E na do admin), o solicitante recebe e-mail
  "Sua requisição foi reprovada – Deseja responder?" com o motivo.
- No Histórico do solicitante, requisição `reprovada` mostra o motivo e o botão
  **Responder**. Ele ajusta (campos + anexos) e reenvia.
- Ao responder, a **etapa de quem reprovou** é reaberta como `pendente` (as
  anteriores continuam aprovadas, as seguintes pendentes). Quem reprovou reavalia
  — aprova ou reprova de novo. **Não recomeça a cadeia** (difere da versão
  anterior "devolver", que reconstruía do zero).
- Justificativa da reprovação é **obrigatória** (gestor e admin).

Implementação: `notificarSolicitanteReprovacao.js` + Edge Function
`notify-solic-reprovada`; `useRequisicaoForm.responderRequisicao` (reabre a etapa
reprovada — client-side, atômico o suficiente, usando a RLS que já permite ao
gestor-dono reescrever as próprias etapas); `EditarReenviarModal` agora chama
`onResponder` e recebe a etapa reprovada.

## 3. Admin "Cancelar requisição"
Na tela do Admin (`AdminSolicitacoes`), toda requisição pendente ganha
**Cancelar requisição** com justificativa **obrigatória**. Marca a etapa atual
como `cancelada` e a requisição como `cancelada` (novo status), guardando
`cancelamento_motivo/por/em`.

---

## Deploy

1. ✅ **Migração** `requisicoes_cancelamento` aplicada (status `'cancelada'` no
   CHECK + colunas de cancelamento). Validada antes em transação com rollback.
2. ✅ **Edge Function** `notify-solic-reprovada` deployada (ACTIVE, verify_jwt).
3. ⏳ **Deploy do front** (pendente).

## Verificação feita (no banco, com rollback)
- Ciclo **reprovar → responder**: a etapa de quem reprovou volta a `pendente`, as
  anteriores seguem aprovadas, requisição volta a `pendente`. RLS deixou a
  gestora-dona reabrir.
- **Cancelar** (admin): etapa + requisição `cancelada`, motivo gravado; RLS ok.
- **E-mail de reprovação**: caminho de dados conferido numa reprovação real
  (destinatário = solicitante, motivo e quem reprovou resolvidos).
- 134 testes (Node) verdes; `vite build` e ESLint limpos nos arquivos tocados.
