# RH/DP: visibilidade total + notificações de requisições

Data: 2026-06-23
Módulo: DP (Gestão de Pessoas) — Portal PHD
Banco compartilhado: `bogsuuhrgvopzgcceoqz`

## Contexto

Maicon Henrique Vieira Morais (`6c13b1c3-7560-4f49-9afe-d99456731a61`, perfil `usuario`) e
Ana Claudia Rodrigues da Costa (`3300e828-5098-4bd2-b704-32fc089d8525`, perfil `null`) são
do RH/DP. Eles precisam:

1. Visualizar **todas** as requisições abertas por qualquer pessoa.
2. Acompanhar o **fluxo completo** de cada uma.
3. Serem **notificados quando uma requisição é concluída**, com o número na sidebar.

Como o módulo DP foi restrito a `gestor`/`admin`, hoje esses dois usuários **não acessam** o
DP. Além disso, durante o levantamento confirmou-se:

- **Notificação "sua vez de aprovar/executar"**: existe como badge na sidebar (`Layout.fetchSolicitacaoCount`
  → `solicitacaoCount` no item "Aprovar / Acompanhar"). Conta requisições onde
  `acaoDisponivel(user.id, etapas) ≠ null`. Funciona para gestores. **Bug p/ admin:** a etapa de
  execução é fixada em `APROVADORES.admin` (`c2318237`); o `AdminSolicitacoes` executa com esse id
  fixo, mas o badge usa `user.id`, então admins com id ≠ `c2318237` não veem o badge de "executar".
- **Notificação "concluída"**: **não existe** para ninguém hoje.
- Conclusão: `AdminSolicitacoes.executar()` seta `solicitacoes_rh_etapas.status='executada'` e
  `solicitacoes_rh.status='concluida'`, `concluida_em=now()`, `updated_at=now()`.

## Objetivo

1. Dar ao RH (`rh_dp`) visibilidade total **somente-leitura** das requisições + fluxo.
2. Notificação **in-app** (sem e-mail) na sidebar do DP, como **um único número** por usuário,
   somando: "aguardando sua ação" + "concluídas desde a última visita".
3. Corrigir a detecção de "sua vez de executar" para admins.

---

## Parte A — RH/DP: flag, acesso e visibilidade

### Banco (migration)

- `colaboradores`: adicionar
  - `rh_dp boolean not null default false`
  - `solic_visto_em timestamptz` (marca da última visita às requisições; usado pela notificação de
    concluídas — vale para gestor/admin/RH).
- Marcar `rh_dp=true` para os ids de Maicon e Ana.
- Helper `app_private.is_rh_dp()` (SQL, STABLE, SECURITY DEFINER, `search_path=''`): retorna true se
  o colaborador logado (por `auth_id`) tem `rh_dp=true`. Sem recursão de RLS.
- **RLS (somente leitura — adicionar `or app_private.is_rh_dp()` ao USING dos SELECT):**
  - `solicitacoes_rh` (`solic_rh_select`)
  - `solicitacoes_rh_etapas` (`etapas_select`)
  - tabelas de detalhe: `ajudas_custo`, `mapeamentos`, `vagas`, `formularios_contratacao`
    (policy de select de cada uma).
  - RH **não** recebe INSERT/UPDATE/DELETE — segue só leitura.
- RPC `public.solic_marcar_visto()` (SECURITY DEFINER): `update colaboradores set solic_visto_em=now()
  where auth_id = auth.uid()`. Grant a `authenticated`. Zera a parte "concluídas" do badge.

### Front — acesso e perfil efetivo

- `AuthContext.resolveColaborador`/user: expor `user.rhDp = colab.rh_dp` e
  `user.solicVistoEm = colab.solic_visto_em`.
- **Perfil efetivo** para roteamento/sidebar do DP: usuários com `rh_dp=true` que **não** são
  `gestor`/`admin` recebem `perfil` efetivo `'rh'` no objeto `user` do AuthContext (o perfil real no
  banco permanece). Gestor/admin que também sejam `rh_dp` mantêm seu perfil.
- `modules.dp`: liberar acesso quando `perfil ∈ {gestor, admin, rh}`. (RH passa a ver o card "Gestão
  de Pessoas" na Home e acessar o DP.)
- `DP_HOME` (Home.jsx): adicionar `rh: '/gestor/solicitacoes/acompanhar'`.

### Front — sidebar e tela do RH

- `Sidebar.jsx` (`menuConfig`): adicionar entrada `rh`:
  ```
  rh: [
    { label: 'Requisições', icon: ClipboardCheck, path: '/gestor/solicitacoes/acompanhar', solicitacaoBadge: true },
  ]
  ```
- Rota `/gestor/solicitacoes/acompanhar`: hoje `allowedRoles={['gestor']}`. Passar a aceitar
  `['gestor','rh']` (perfil efetivo). Admin continua usando `AdminSolicitacoes`.
- `AcompanharRequisicoes`:
  - Buscar **todas** as requisições quando `user.rhDp` (ou admin) — em vez de filtrar só as que
    participa. Mantém a resolução de nomes via `nomes_colaboradores`.
  - **Somente leitura para RH:** quando `user.rhDp` e não é gestor/admin, **não** renderizar os
    botões Aprovar/Reprovar (mostra só o `FluxoTimeline` + "Ver respostas"). `acaoDisponivel` nunca
    retorna ação para RH (ele não está nas etapas), então na prática já não aparece — mas o design
    deixa explícito que RH é read-only.
  - Ao montar a tela, chamar `supabase.rpc('solic_marcar_visto')` e disparar
    `solicitacoes_rh_atualizadas` para o badge recalcular.

---

## Parte B — Notificações (badge único na sidebar)

O badge do item de requisições (`solicitacaoBadge`) passa a ser a **soma** de duas parcelas,
calculadas em `Layout.fetchSolicitacaoCount`:

1. **Aguardando sua ação** (já existe, com correção do admin):
   - Gestor: requisições onde `acaoDisponivel(user.id, etapas) === 'aprovacao'`.
   - Admin: requisições onde `acaoDisponivel(APROVADORES.admin, etapas) !== null` (usa o id fixo do
     executor, cobrindo "executar" para qualquer admin). Se o admin também for aprovador nominal,
     somam-se as dele por `user.id` sem duplicar.
   - RH: 0 (não age).
2. **Concluídas desde a última visita** (`status='concluida'` e `concluida_em > user.solicVistoEm`):
   - Gestor: filtradas por `gestor_id = user.id` (as que ele abriu).
   - Admin e RH: todas.
   - Se `solic_visto_em` for `null`, considerar todas as concluídas como novas (primeira visita).

`solicitacaoCount = parcela1 + parcela2`. O badge continua aparecendo no item de requisições da
sidebar (DP). Ao abrir a tela de Requisições/Acompanhar, `solic_marcar_visto()` zera a parcela 2.

### Fonte dos dados no `Layout`

`fetchSolicitacaoCount` já carrega `solicitacoes_rh` com `etapas`. Passar a também selecionar
`status, concluida_em, gestor_id`. A RLS entrega o conjunto visível a cada perfil (gestor: próprias +
que aprova; admin/RH: todas). O cálculo das duas parcelas é client-side sobre esse conjunto.

Habilitar o fetch para o perfil efetivo `rh` também (hoje retorna cedo se não for admin/gestor).

---

## Parte C — Correção do badge de execução do admin

Em `Layout.fetchSolicitacaoCount`, para `user.perfil === 'admin'`, detectar "sua vez" usando
`APROVADORES.admin` na checagem de execução (além de `user.id` para eventuais aprovações nominais),
para que **todos** os admins vejam o badge quando há requisição aguardando execução. Importar
`APROVADORES` de `config/aprovacao`.

---

## Critérios de aceitação

**RH:**
- Maicon e Ana acessam o DP (card na Home + sidebar com "Requisições").
- Veem **todas** as requisições de qualquer pessoa, com o fluxo completo, **sem** botões de aprovar/
  reprovar.
- Não conseguem inserir/alterar/aprovar nada (RLS + UI).

**Notificações:**
- Gestor vê no badge: requisições aguardando a aprovação dele + as **dele** concluídas desde a última
  visita.
- Admin vê: requisições aguardando execução (qualquer admin) + todas as concluídas novas.
- RH vê: todas as concluídas novas.
- Abrir a tela de Requisições zera a parcela "concluídas" (marca visto) — o badge cai.
- Admin com id ≠ `c2318237` passa a ver o badge quando há requisição aguardando execução.

## Fora de escopo

- Notificação por e-mail.
- Notificações em tempo real (push/realtime) — o badge atualiza no carregamento e no evento
  `solicitacoes_rh_atualizadas`, como hoje.
- Área pessoal de ausências para usuários RH-only (perfil efetivo `rh` foca em requisições).
- Notificações para o perfil `usuario` comum.
