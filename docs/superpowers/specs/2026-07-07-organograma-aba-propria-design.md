# Organograma como aba própria (fora de Requisições)

**Data:** 2026-07-07
**Status:** Aprovado

## Objetivo

Tirar a Consulta Organograma de dentro do hub de Requisições DP e transformá-la em uma
página própria, com item de menu ("aba") na Sidebar, visível para os perfis **gestor**,
**admin** e **rh**.

## Contexto atual

- O organograma é registrado como um pseudo-tipo de requisição em
  `src/config/requisicoes.js` (slug `consulta-organograma`, sem `tipoDb`).
- O usuário chega nele via hub de Requisições → `/gestor/solicitacoes/nova/consulta-organograma`,
  onde `NovaRequisicao.jsx` tem um desvio especial que renderiza `ConsultaOrganograma`
  (read-only, com botão "Voltar" para o hub) em vez das abas de requisição.
- Gate atual: rota `/gestor/solicitacoes/nova/:tipo` com `allowedRoles={['gestor','rh']}`.
  Admin não tem acesso hoje.
- Código em `src/pages/Gestor/requisicoes/`: `ConsultaOrganograma.jsx` + pasta
  `organograma/` (`useOrganograma.js`, `organogramaData.js`, `organogramaData.test.js`,
  `ConsultaOrganograma.css`).

## Decisões

1. **Acesso:** `['gestor', 'admin', 'rh']` — mantém RH (acesso atual) e adiciona admin.
2. **Rota:** `/organograma`, dentro do `<Layout />` em `AppRoutes.jsx`, envolvida por
   `ModuleRoute module="dp"` + `ProtectedRoute allowedRoles={['gestor','admin','rh']}`,
   com lazy import (padrão das rotas vizinhas). O módulo `dp` já é liberado para os três
   perfis em `AuthContext.jsx`.
3. **Menu:** item de nível superior `{ label: 'Organograma', icon: Network, path: '/organograma' }`
   nos arrays `admin`, `gestor` e `rh` do `menuConfig` em `Sidebar.jsx`.
4. **Arquivos movem junto:** `ConsultaOrganograma.jsx` e a pasta `organograma/` saem de
   `src/pages/Gestor/requisicoes/` para `src/pages/Gestor/organograma/`, refletindo que
   não é mais uma requisição.
5. **Botão "Voltar" sai:** ele voltava ao hub de Requisições; como página própria não faz
   sentido. A prop/handler associado é removido.
6. **Limpeza em Requisições:** remover o item `consulta-organograma` de
   `src/config/requisicoes.js` (o card some do hub) e o desvio especial + import em
   `NovaRequisicao.jsx`.

## Fora de escopo

- Nenhuma mudança de backend: as queries ao Supabase backoffice (`supabaseBackoffice.js`,
  `organograma_meses`, `organograma_alocacao`) continuam idênticas.
- Não trata a dívida conhecida de RLS na tabela `organograma_alocacao` do projeto
  backoffice (policy antiga permissiva) — permanece sinalizada para revisão à parte.
- Nenhuma mudança visual na consulta em si (filtros, tabela, CSS inalterados, exceto a
  remoção do botão "Voltar").

## Testes / verificação

- `organogramaData.test.js` segue passando após o move (só muda o caminho do arquivo).
- Verificação manual: logar como gestor/admin/rh → aba "Organograma" visível e funcional;
  hub de Requisições sem o card; rota antiga do organograma não renderiza mais a consulta;
  perfil `usuario` não vê a aba e é bloqueado na rota.
