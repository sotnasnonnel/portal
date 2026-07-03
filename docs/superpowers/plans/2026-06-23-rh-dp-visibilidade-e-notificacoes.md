# RH/DP visibilidade + notificações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar aos usuários RH/DP (Maicon, Ana) visibilidade somente-leitura de todas as requisições + fluxo, e um badge único de notificações na sidebar (sua vez + concluídas novas) para gestor/admin/RH, corrigindo a detecção de execução do admin.

**Architecture:** Migration no Supabase (flag `rh_dp`, marca `solic_visto_em`, helper `is_rh_dp()`, 3 policies de SELECT, RPC `solic_marcar_visto`). No front (módulo DP): AuthContext expõe `rhDp`/`solicVistoEm`/perfil efetivo `rh` e `markSolicVisto`; Sidebar/Home/rotas habilitam o RH; `AcompanharRequisicoes` mostra tudo read-only e marca visto; `Layout` soma as duas parcelas do badge.

**Tech Stack:** React 19 + Vite, @supabase/supabase-js, Postgres/Supabase (`bogsuuhrgvopzgcceoqz`).

## Global Constraints

- **Sem framework de teste.** Verificação por tarefa = `npm run lint` (sem erro novo; o erro pré-existente `react-refresh/only-export-components` em `AuthContext.jsx` e o `Icon`/no-unused-vars do reembolso Sidebar NÃO contam) + `npm run build` (`✓ built`) + SQL/manual quando indicado.
- **Sem commits.** O repositório git tem raiz na home do usuário; NÃO rodar `git add`/`git commit`/branch. Só editar arquivos e aplicar migrations via MCP.
- **Banco compartilhado** `bogsuuhrgvopzgcceoqz`. Migrations via `apply_migration` (MCP) + arquivo `supabase_migration_*.sql` na raiz.
- **IDs:** Maicon `6c13b1c3-7560-4f49-9afe-d99456731a61`; Ana `3300e828-5098-4bd2-b704-32fc089d8525`; admin executor `APROVADORES.admin = c2318237-b3f7-49ec-bb48-9d2a0c0c555d`.
- **RH é somente-leitura** (RLS só de SELECT; UI sem botões de ação).
- **Badge = um número** = (aguardando ação) + (concluídas com `concluida_em > solic_visto_em`). Escopo concluídas: gestor → `gestor_id=me`; admin/RH → todas.

---

### Task 1: Migration — flag RH, helper, RLS, RPC

**Files:**
- Create: `supabase_migration_rh_dp_notif.sql`
- Apply: via MCP `apply_migration` no projeto `bogsuuhrgvopzgcceoqz`.

**Interfaces:**
- Produces (banco): coluna `colaboradores.rh_dp boolean`, `colaboradores.solic_visto_em timestamptz`; função `app_private.is_rh_dp() → boolean`; função `public.solic_marcar_visto() → void`. Policies `solic_rh_select`, `etapas_select`, `form_select` passam a incluir `or app_private.is_rh_dp()`.

- [ ] **Step 1: Escrever `supabase_migration_rh_dp_notif.sql`**

```sql
-- ============================================================================
-- RH/DP: flag de visibilidade total + marca de "visto" p/ notificações
-- (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ============================================================================

alter table public.colaboradores
  add column if not exists rh_dp boolean not null default false,
  add column if not exists solic_visto_em timestamptz;

-- Maicon e Ana são do RH/DP.
update public.colaboradores set rh_dp = true
where id in ('6c13b1c3-7560-4f49-9afe-d99456731a61', '3300e828-5098-4bd2-b704-32fc089d8525');

-- helper: o usuário logado é RH/DP?
create or replace function app_private.is_rh_dp()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.colaboradores
    where auth_id = (select auth.uid()) and rh_dp = true
  )
$$;
revoke all on function app_private.is_rh_dp() from public;
grant execute on function app_private.is_rh_dp() to authenticated;

-- RLS: leitura total para RH (só SELECT). ajudas_custo/mapeamentos/vagas já são USING(true).
drop policy if exists solic_rh_select on public.solicitacoes_rh;
create policy solic_rh_select on public.solicitacoes_rh
for select to authenticated
using (
  gestor_id = app_private.my_colaborador_id()
  or app_private.is_admin()
  or app_private.is_aprovador_da_solic(id)
  or app_private.is_rh_dp()
);

drop policy if exists etapas_select on public.solicitacoes_rh_etapas;
create policy etapas_select on public.solicitacoes_rh_etapas
for select to authenticated
using (
  app_private.is_admin()
  or app_private.is_aprovador_da_solic(solicitacao_id)
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
  or app_private.is_rh_dp()
);

drop policy if exists form_select on public.formularios_contratacao;
create policy form_select on public.formularios_contratacao
for select to authenticated
using (
  app_private.is_admin()
  or exists (select 1 from public.solicitacoes_rh s
             where s.id = solicitacao_id and s.gestor_id = app_private.my_colaborador_id())
  or app_private.is_rh_dp()
);

-- RPC: marca "visto" das requisições do usuário logado (zera a parcela de concluídas).
create or replace function public.solic_marcar_visto()
returns void language sql security definer set search_path = '' as $$
  update public.colaboradores set solic_visto_em = now() where auth_id = (select auth.uid());
$$;
revoke all on function public.solic_marcar_visto() from public;
grant execute on function public.solic_marcar_visto() to authenticated;
```

- [ ] **Step 2: Aplicar via MCP**

`apply_migration` (project `bogsuuhrgvopzgcceoqz`, name `rh_dp_notif`) com o SQL acima.

- [ ] **Step 3: Verificar via MCP `execute_sql`**

```sql
select id, nome, rh_dp from colaboradores
where id in ('6c13b1c3-7560-4f49-9afe-d99456731a61','3300e828-5098-4bd2-b704-32fc089d8525');
select polname, pg_get_expr(polqual, polrelid) like '%is_rh_dp%' as tem_rh
from pg_policy where polrelid in ('public.solicitacoes_rh'::regclass,'public.solicitacoes_rh_etapas'::regclass,'public.formularios_contratacao'::regclass)
  and polcmd='r';
```
Expected: ambos com `rh_dp = true`; as 3 policies de select com `tem_rh = true`.

---

### Task 2: AuthContext — rhDp, solicVistoEm, perfil efetivo, markSolicVisto

**Files:**
- Modify: `src/contexts/AuthContext.jsx`

**Interfaces:**
- Consumes: `colab.rh_dp`, `colab.solic_visto_em` (já vêm do `select('*')` em `resolveColaborador`).
- Produces: `user.rhDp: boolean`, `user.solicVistoEm: string|null`, `user.perfil` efetivo (`'rh'` para RH-only); `modules.dp` aceita `'rh'`; método `markSolicVisto()` no contexto.

- [ ] **Step 1: Setar user com rhDp/solicVistoEm e perfil efetivo**

Substituir o bloco `setUser({...})` (~linhas 109-117) por:

```jsx
      const rhDp = colab.rh_dp === true;
      // Perfil efetivo no DP: RH que não é gestor/admin navega como 'rh' (perfil real fica no banco).
      const perfilEfetivo = (rhDp && colab.perfil !== 'gestor' && colab.perfil !== 'admin') ? 'rh' : colab.perfil;
      setUser({
        id: colab.id,
        nome: colab.nome,
        email: colab.email,
        perfil: perfilEfetivo,
        rhDp,
        solicVistoEm: colab.solic_visto_em || null,
        funcao: colab.funcao || null,
        dataAdmissao: colab.data_admissao || null,
        authId: authUser.id,
      });
```

- [ ] **Step 2: Adicionar `markSolicVisto` (após `refreshReembolsoProfile`, ~linha 155)**

```jsx
  const markSolicVisto = useCallback(async () => {
    const agora = new Date().toISOString();
    await supabase.rpc('solic_marcar_visto');
    setUser((u) => (u ? { ...u, solicVistoEm: agora } : u));
    window.dispatchEvent(new Event('solicitacoes_rh_atualizadas'));
  }, []);
```

- [ ] **Step 3: `modules.dp` aceitar 'rh'**

```jsx
    dp: (user?.perfil === 'gestor' || user?.perfil === 'admin' || user?.perfil === 'rh') ? user.perfil : null,
```

- [ ] **Step 4: Expor `markSolicVisto` no value**

No `useMemo` do `value` (~linha 163-168), adicionar `markSolicVisto` à lista de propriedades e ao array de deps:

```jsx
  const value = useMemo(() => ({
    user, session, modules, reembolsoProfile, solicProfile,
    blocked, loading, error,
    signInWithMicrosoft, logout, refreshReembolsoProfile, markSolicVisto,
  }), [user, session, modules, reembolsoProfile, solicProfile, blocked, loading, error,
       signInWithMicrosoft, logout, refreshReembolsoProfile, markSolicVisto]);
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erro novo (o erro pré-existente do `AuthContext` `react-refresh` continua); `✓ built`.

---

### Task 3: Navegação do RH — Home, Sidebar, rota

**Files:**
- Modify: `src/pages/Home/Home.jsx`
- Modify: `src/components/Layout/Sidebar.jsx`
- Modify: `src/routes/AppRoutes.jsx`

**Interfaces:**
- Consumes: `modules.dp === 'rh'` (Task 2); rota `/gestor/solicitacoes/acompanhar`.

- [ ] **Step 1: `Home.jsx` — DP_HOME para 'rh'**

Linha 7 (`const DP_HOME = { admin: '/admin/listagem', gestor: '/gestor', usuario: '/usuario' };`) passa a:

```jsx
const DP_HOME = { admin: '/admin/listagem', gestor: '/gestor', usuario: '/usuario', rh: '/gestor/solicitacoes/acompanhar' };
```

- [ ] **Step 2: `Sidebar.jsx` — menu do 'rh'**

No objeto `menuConfig` (~linha 23-59), adicionar a chave `rh` (usa ícones já importados `ClipboardCheck`):

```jsx
  rh: [
    { label: 'Requisições', icon: ClipboardCheck, path: '/gestor/solicitacoes/acompanhar', solicitacaoBadge: true },
  ],
```

- [ ] **Step 3: `AppRoutes.jsx` — liberar a rota de acompanhar para 'rh'**

Na rota `/gestor/solicitacoes/acompanhar` (~linha 277-288), trocar `allowedRoles={['gestor']}` por `allowedRoles={['gestor', 'rh']}`:

```jsx
          <Route
            path="/gestor/solicitacoes/acompanhar"
            element={
              <ModuleRoute module="dp">
                <ProtectedRoute allowedRoles={['gestor', 'rh']}>
                  <LazyPage>
                    <AcompanharRequisicoes />
                  </LazyPage>
                </ProtectedRoute>
              </ModuleRoute>
            }
          />
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erro novo; `✓ built`.

---

### Task 4: AcompanharRequisicoes (todas + read-only RH + marcar visto) e AdminSolicitacoes (marcar visto)

**Files:**
- Modify: `src/pages/Gestor/requisicoes/AcompanharRequisicoes.jsx`
- Modify: `src/pages/Admin/AdminSolicitacoes.jsx`

**Interfaces:**
- Consumes: `useAuth().markSolicVisto`, `user.rhDp`, `user.perfil`.

- [ ] **Step 1: `AcompanharRequisicoes` — pegar `markSolicVisto` e mostrar todas p/ RH/admin**

No destructuring do `useAuth()` (~linha 29), incluir `markSolicVisto`:

```jsx
  const { user, markSolicVisto } = useAuth();
```

No `fetchParticipa` (~linhas 39-51), trocar o filtro por: RH e admin veem todas; demais só as que participam:

```jsx
  const fetchParticipa = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('solicitacoes_rh')
      .select(SELECT_SOL)
      .order('created_at', { ascending: false });
    const veTudo = user.rhDp || user.perfil === 'admin';
    const minhas = veTudo
      ? (data || [])
      : (data || []).filter((s) => s.gestor_id === user.id || (s.etapas || []).some((e) => e.aprovador_id === user.id));
    const ids = [...new Set(minhas.flatMap((s) => [s.gestor_id, s.colaborador_id]).filter(Boolean))];
    let nomesMap = {};
    if (ids.length) {
      const { data: cols } = await supabase.rpc('nomes_colaboradores', { p_ids: ids });
      nomesMap = Object.fromEntries((cols || []).map((c) => [c.id, c.nome]));
    }
    setNomes(nomesMap);
    setParticipa(minhas);
    setLoading(false);
  }, [user]);
```

- [ ] **Step 2: `AcompanharRequisicoes` — marcar visto ao abrir**

Logo após o `useEffect(() => { fetchParticipa(); }, [fetchParticipa]);` existente (~linha 53), adicionar:

```jsx
  useEffect(() => {
    markSolicVisto?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 3: `AcompanharRequisicoes` — read-only para RH (esconder Aprovar/Reprovar)**

Na renderização das ações (~linha 173, bloco `{(podeAprovar || DETALHE[s.tipo]) && (...)}`), garantir que RH nunca veja botões de ação. `podeAprovar` já é falso para RH (não está nas etapas), mas tornar explícito: trocar a definição de `podeAprovar` (~linha 138) por:

```jsx
              const podeAprovar = !user?.rhDp && acaoDisponivel(user?.id, s.etapas) === 'aprovacao';
```

(O botão "Ver respostas" continua disponível para RH.)

- [ ] **Step 4: `AdminSolicitacoes` — marcar visto ao abrir**

Em `src/pages/Admin/AdminSolicitacoes.jsx`, no destructuring do `useAuth()`, incluir `markSolicVisto`, e adicionar um `useEffect(() => { markSolicVisto?.(); }, [])` (com o mesmo disable do exhaustive-deps) junto aos outros effects de montagem. Se a página não usa `useAuth` hoje, importar `useAuth` de `../../contexts/AuthContext` e chamar `const { markSolicVisto } = useAuth();`.

- [ ] **Step 5: Lint + build + verificação manual**

Run: `npm run lint && npm run build`
Expected: sem erro novo; `✓ built`.
Manual: como gestor, abrir Acompanhar vê só as próprias/participa; (com um RH real) vê todas sem botões de aprovar.

---

### Task 5: Layout — badge único (sua vez + concluídas) e correção do admin

**Files:**
- Modify: `src/components/Layout/Layout.jsx`

**Interfaces:**
- Consumes: `acaoDisponivel`, `APROVADORES` de `config/aprovacao`; `user.perfil`, `user.id`, `user.solicVistoEm`.

- [ ] **Step 1: Importar `APROVADORES`**

Linha 9 (`import { acaoDisponivel } from '../../config/aprovacao';`) passa a:

```jsx
import { acaoDisponivel, APROVADORES } from '../../config/aprovacao';
```

- [ ] **Step 2: Reescrever `fetchSolicitacaoCount` (soma das duas parcelas + admin fix + 'rh')**

Substituir a função `fetchSolicitacaoCount` (~linhas 47-56) por:

```jsx
  const fetchSolicitacaoCount = async () => {
    if (!['admin', 'gestor', 'rh'].includes(user?.perfil)) return;
    const { data, error } = await supabase
      .from('solicitacoes_rh')
      .select('id, gestor_id, status, concluida_em, etapas:solicitacoes_rh_etapas(id, ordem, aprovador_id, tipo_etapa, status)');
    if (error) return;
    const lista = data || [];

    // parcela 1: aguardando sua ação
    let aguardando = 0;
    if (user.perfil === 'gestor') {
      aguardando = lista.filter((s) => acaoDisponivel(user.id, s.etapas) !== null).length;
    } else if (user.perfil === 'admin') {
      // execução é fixada no admin executor; qualquer admin deve ver o badge de executar.
      aguardando = lista.filter(
        (s) => acaoDisponivel(APROVADORES.admin, s.etapas) !== null || acaoDisponivel(user.id, s.etapas) !== null
      ).length;
    }

    // parcela 2: concluídas desde a última visita
    const visto = user.solicVistoEm ? new Date(user.solicVistoEm).getTime() : 0;
    const novasConcluidas = lista.filter((s) => {
      if (s.status !== 'concluida' || !s.concluida_em) return false;
      if (new Date(s.concluida_em).getTime() <= visto) return false;
      return user.perfil === 'gestor' ? s.gestor_id === user.id : true; // admin/rh: todas
    }).length;

    setSolicitacaoCount(aguardando + novasConcluidas);
  };
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erro novo; `✓ built`.

- [ ] **Step 4: Verificação manual**

`npm run dev`. Como gestor com uma requisição concluída recente: o badge no item "Aprovar / Acompanhar" mostra (aguardando + concluídas novas); abrir a tela zera a parte de concluídas. Como admin (id ≠ executor) com requisição aguardando execução: badge aparece.

---

## Verificação final (end-to-end)

- [ ] RH (Maicon/Ana) — Home mostra "Gestão de Pessoas"; sidebar tem "Requisições"; a tela lista **todas** as requisições com fluxo completo, **sem** botões de aprovar/reprovar.
- [ ] RH não consegue alterar nada (RLS só leitura).
- [ ] Gestor: badge = aguardando aprovação dele + as **dele** concluídas novas; abrir Acompanhar zera concluídas.
- [ ] Admin: badge inclui execução pendente (qualquer admin) + todas concluídas novas; abrir Requisições DP zera concluídas.
- [ ] `npm run build` final ✓.

## Notas de self-review

- **Cobertura do spec:** Parte A (RH flag/acesso/leitura) → Task 1 (DB) + Task 2 (perfil/rhDp) + Task 3 (nav) + Task 4 (tela read-only/todas). Parte B (badge único) → Task 2 (solicVistoEm/markSolicVisto) + Task 4 (marcar visto) + Task 5 (soma). Parte C (admin fix) → Task 5. Sem lacunas.
- **Sem placeholders:** todo passo de código mostra o código real.
- **Consistência de nomes:** `markSolicVisto` (AuthContext value) consumido em Task 4; `user.rhDp`/`user.solicVistoEm`/perfil `'rh'` definidos em Task 2 e usados em Tasks 3/4/5; `solic_marcar_visto`/`is_rh_dp` (Task 1) usados por `markSolicVisto`/RLS.
- **Atenção (executor):** `colaboradores` é lido com `select('*')` em `resolveColaborador`, então `rh_dp`/`solic_visto_em` chegam sem alterar o select. A RLS `colaboradores_select` já permite ler a própria linha (RH lê o próprio `rh_dp`).
