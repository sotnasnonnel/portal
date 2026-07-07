# Perfil Coordenador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o papel `coordenador` no módulo DP: mesmos poderes do Gestor limitados à equipe dele; o Gestor acima enxerga e aprova também a equipe dos seus coordenadores.

**Architecture:** O perfil entra na coluna text `colaboradores.perfil`; a hierarquia continua em `superior_id`. Uma função recursiva no Postgres (`app_private.descendentes`) alimenta a RPC `get_minha_equipe()` e o helper de RLS `manages()` (que passa de "superior direto" a "ancestral"). No front, um service `getEquipeIds()` substitui as 6 consultas `.eq('superior_id', user.id)`, e regras de cadastro viram helpers puros testáveis em `src/config/perfis.js`.

**Tech Stack:** React 19 + Vite, react-router-dom 7, Supabase (projeto do portal `bogsuuhrgvopzgcceoqz`, migração aplicada via MCP `mcp__plugin_supabase_supabase__apply_migration`), testes `node --test` (`npm test`).

## Global Constraints

- Novo valor de perfil: string `'coordenador'` (minúsculo, como os demais).
- Hierarquia de cadastro: `gestor` → sem superior; `coordenador` → superior obrigatório, só gestores; `usuario` → superior obrigatório, gestores e coordenadores (spec, decisão 3).
- Gestor vê **e aprova** a equipe dos coordenadores abaixo dele (spec, decisões 1-2).
- Coordenador tem acesso às mesmas telas do gestor, incluindo `/organograma`.
- Nada muda em `config/aprovacao.js`, AdminFluxos, módulos reembolso/solic, organograma backoffice.
- Um commit por task.

---

### Task 1: Helpers puros de perfil (`src/config/perfis.js`) — TDD

**Files:**
- Create: `src/config/perfis.js`
- Test: `src/config/perfis.test.js`

**Interfaces:**
- Produces:
  - `PERFIL_OPCOES: Array<{value, label}>` — opções do select de perfil (usuario, coordenador, gestor).
  - `PERFIL_LABEL: object` — mapa perfil→rótulo (inclui admin).
  - `precisaSuperior(perfil: string): boolean` — false só para `'gestor'`.
  - `candidatosASuperior(perfil, colaboradores, excluirId?): Array` — lista filtrada e ordenada de possíveis superiores.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `src/config/perfis.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERFIL_OPCOES, PERFIL_LABEL, precisaSuperior, candidatosASuperior } from './perfis.js';

const pessoas = [
  { id: 'g1', nome: 'Bruno Gestor', perfil: 'gestor' },
  { id: 'g2', nome: 'Ana Gestora', perfil: 'gestor' },
  { id: 'c1', nome: 'Carla Coordenadora', perfil: 'coordenador' },
  { id: 'u1', nome: 'Duda Usuária', perfil: 'usuario' },
  { id: 'a1', nome: 'Adm', perfil: 'admin' },
];

test('PERFIL_OPCOES tem usuario, coordenador e gestor', () => {
  assert.deepEqual(PERFIL_OPCOES.map((o) => o.value), ['usuario', 'coordenador', 'gestor']);
});

test('PERFIL_LABEL cobre os quatro perfis', () => {
  assert.equal(PERFIL_LABEL.coordenador, 'Coordenador');
  assert.equal(PERFIL_LABEL.gestor, 'Gestor');
  assert.equal(PERFIL_LABEL.usuario, 'Usuário');
  assert.equal(PERFIL_LABEL.admin, 'Admin');
});

test('precisaSuperior: só gestor dispensa superior', () => {
  assert.equal(precisaSuperior('gestor'), false);
  assert.equal(precisaSuperior('coordenador'), true);
  assert.equal(precisaSuperior('usuario'), true);
});

test('candidatosASuperior de coordenador: só gestores, ordenados', () => {
  assert.deepEqual(candidatosASuperior('coordenador', pessoas).map((c) => c.id), ['g2', 'g1']);
});

test('candidatosASuperior de usuario: gestores e coordenadores', () => {
  assert.deepEqual(candidatosASuperior('usuario', pessoas).map((c) => c.id), ['g2', 'g1', 'c1']);
});

test('candidatosASuperior exclui o próprio colaborador', () => {
  assert.deepEqual(candidatosASuperior('usuario', pessoas, 'g1').map((c) => c.id), ['g2', 'c1']);
});

test('candidatosASuperior de gestor: vazio', () => {
  assert.deepEqual(candidatosASuperior('gestor', pessoas), []);
});

test('candidatosASuperior tolera lista nula', () => {
  assert.deepEqual(candidatosASuperior('usuario', null), []);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module ... perfis.js`.

- [ ] **Step 3: Implementar `src/config/perfis.js`**

```js
/**
 * Perfis do módulo DP e regras de hierarquia de cadastro.
 * - gestor: topo, sem superior.
 * - coordenador: responde a um gestor.
 * - usuario: responde a um gestor ou coordenador.
 * (admin não é atribuível pela UI de cadastro.)
 */
export const PERFIL_OPCOES = [
  { value: 'usuario', label: 'Usuário' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'gestor', label: 'Gestor' },
];

export const PERFIL_LABEL = {
  admin: 'Admin',
  gestor: 'Gestor',
  coordenador: 'Coordenador',
  usuario: 'Usuário',
};

export const precisaSuperior = (perfil) => perfil !== 'gestor';

export function candidatosASuperior(perfil, colaboradores, excluirId = null) {
  if (perfil === 'gestor') return [];
  const aceitos = perfil === 'coordenador' ? ['gestor'] : ['gestor', 'coordenador'];
  return (colaboradores || [])
    .filter((c) => aceitos.includes(c.perfil) && c.id !== excluirId)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}
```

Nota de ordenação: `localeCompare(..., 'pt-BR')` põe "Ana Gestora" antes de "Bruno Gestor" — por isso os testes esperam `['g2','g1']`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (os 8 testes novos + suíte existente).

- [ ] **Step 5: Commit**

```bash
git add src/config/perfis.js src/config/perfis.test.js
git commit -m "feat: helpers de perfil com regras de superior (coordenador)"
```

---

### Task 2: Migração SQL — equipe recursiva + RLS ancestral

**Files:**
- Create: `supabase_migration_coordenador.sql` (raiz do repo, padrão dos demais)
- Aplicar no projeto Supabase do portal (`bogsuuhrgvopzgcceoqz`) via MCP `apply_migration`.

**Interfaces:**
- Produces:
  - `app_private.descendentes(raiz uuid) returns setof uuid` — todos os descendentes (não inclui a raiz).
  - `public.get_minha_equipe() returns table (id uuid)` — descendentes do logado (RPC usada pela Task 4).
  - `app_private.manages(target uuid)` redefinida como "sou ancestral de target" — policies existentes de `ciclos_ausencia` passam a cobrir a subárvore.
  - Policy `colaboradores_select` atualizada para `app_private.manages(id)`.

- [ ] **Step 1: Criar o arquivo `supabase_migration_coordenador.sql`**

```sql
-- ============================================================================
-- Perfil Coordenador — equipe recursiva (banco compartilhado bogsuuhrgvopzgcceoqz)
-- ----------------------------------------------------------------------------
-- Gestor -> Coordenador -> usuários. O gestor herda visão/aprovação de toda a
-- subárvore. app_private.manages() passa de "superior direto" a "ancestral".
-- ============================================================================

-- Descendentes de <raiz> (não inclui a própria raiz). UNION (não ALL) protege
-- contra ciclos acidentais de superior_id.
create or replace function app_private.descendentes(raiz uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  with recursive arvore as (
    select id from public.colaboradores where superior_id = raiz
    union
    select c.id from public.colaboradores c join arvore a on c.superior_id = a.id
  )
  select id from arvore
$$;

revoke all on function app_private.descendentes(uuid) from public;
grant execute on function app_private.descendentes(uuid) to authenticated;

-- manages(): o logado é ANCESTRAL de <target>? (antes: superior direto)
create or replace function app_private.manages(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target in (
    select app_private.descendentes(app_private.my_colaborador_id())
  )
$$;

-- Equipe do logado (diretos + equipes dos coordenadores abaixo), para o front.
create or replace function public.get_minha_equipe()
returns table (id uuid) language sql stable security definer set search_path = '' as $$
  select * from app_private.descendentes(app_private.my_colaborador_id())
$$;

revoke all on function public.get_minha_equipe() from public;
grant execute on function public.get_minha_equipe() to authenticated;

-- colaboradores_select: troca "superior direto" por "ancestral" (subárvore).
drop policy if exists colaboradores_select on public.colaboradores;
create policy colaboradores_select on public.colaboradores
for select to authenticated
using (
  auth_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))   -- 1º login (auth_id nulo)
  or app_private.is_admin()
  or app_private.manages(id)
);

-- ciclos_ausencia: as policies existentes já usam manages(colaborador_id);
-- com manages() recursivo o gestor lê e aprova a equipe dos coordenadores
-- sem reescrever policy nenhuma.
```

- [ ] **Step 2: Aplicar via MCP**

Usar a ferramenta `mcp__plugin_supabase_supabase__apply_migration` com:
- `project_id`: o projeto do portal (confirmar com `list_projects` — o banco compartilhado é `bogsuuhrgvopzgcceoqz`)
- `name`: `coordenador_equipe_recursiva`
- `query`: o conteúdo do arquivo acima.

Expected: sucesso sem erro.

- [ ] **Step 3: Sanidade via `execute_sql` (read-only)**

```sql
-- 1) função existe e recursa: descendentes de um gestor qualquer
select count(*) from app_private.descendentes(
  (select id from colaboradores where perfil = 'gestor' limit 1)
);
-- Expected: número >= quantidade de subordinados diretos desse gestor.

-- 2) policy recriada
select policyname from pg_policies
where tablename = 'colaboradores' and policyname = 'colaboradores_select';
-- Expected: 1 linha.
```

- [ ] **Step 4: Rodar advisors de segurança**

Usar `mcp__plugin_supabase_supabase__get_advisors` (type `security`) e conferir que não surgiu erro novo relacionado às funções/policies criadas.

- [ ] **Step 5: Commit do arquivo**

```bash
git add supabase_migration_coordenador.sql
git commit -m "feat: migracao coordenador - equipe recursiva e RLS ancestral"
```

---

### Task 3: Acesso — AuthContext, rotas e menu

**Files:**
- Modify: `src/contexts/AuthContext.jsx:121` (perfilEfetivo) e `:181` (modules.dp)
- Modify: `src/routes/AppRoutes.jsx` (allowedRoles das rotas do gestor + organograma)
- Modify: `src/components/Layout/Sidebar.jsx` (menuConfig.coordenador + perfilLabel)

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces: `user.perfil === 'coordenador'` navegável; rotas `/gestor/*` e `/organograma` aceitam coordenador; menu do coordenador igual ao do gestor.

- [ ] **Step 1: AuthContext — perfilEfetivo e modules.dp**

Em `src/contexts/AuthContext.jsx`, trocar a linha 121:

```js
// antes
const perfilEfetivo = (rhDp && colab.perfil !== 'gestor' && colab.perfil !== 'admin') ? 'rh' : colab.perfil;
// depois
const perfilEfetivo = (rhDp && !['gestor', 'admin', 'coordenador'].includes(colab.perfil)) ? 'rh' : colab.perfil;
```

E a linha 181 (dentro de `modules`):

```js
// antes
dp: (user?.perfil === 'gestor' || user?.perfil === 'admin' || user?.perfil === 'rh') ? user.perfil : null,
// depois
dp: ['gestor', 'coordenador', 'admin', 'rh'].includes(user?.perfil) ? user.perfil : null,
```

- [ ] **Step 2: AppRoutes — allowedRoles**

Em `src/routes/AppRoutes.jsx`, atualizar (todas dentro do bloco DP):

| Rota | de | para |
|---|---|---|
| `/gestor` | `['gestor']` | `['gestor', 'coordenador']` |
| `/gestor/aprovacoes` | `['gestor']` | `['gestor', 'coordenador']` |
| `/gestor/aprovacoes/:id` | `['gestor']` | `['gestor', 'coordenador']` |
| `/gestor/equipe` | `['gestor']` | `['gestor', 'coordenador']` |
| `/gestor/ausencia` | `['gestor']` | `['gestor', 'coordenador']` |
| `/gestor/minha-ausencia` | `['gestor']` | `['gestor', 'coordenador']` |
| `/gestor/solicitacoes/nova` | `['gestor', 'rh']` | `['gestor', 'coordenador', 'rh']` |
| `/gestor/solicitacoes/nova/:tipo` | `['gestor', 'rh']` | `['gestor', 'coordenador', 'rh']` |
| `/gestor/solicitacoes/acompanhar` | `['gestor', 'rh']` | `['gestor', 'coordenador', 'rh']` |
| `/organograma` | `['gestor', 'admin', 'rh']` | `['gestor', 'coordenador', 'admin', 'rh']` |

São trocas literais no atributo `allowedRoles={[...]}` de cada `<Route>`.

- [ ] **Step 3: Sidebar — menu e rótulo**

Em `src/components/Layout/Sidebar.jsx`:

(a) Adicionar `coordenador` ao `menuConfig`, logo após o array `gestor` (mesma estrutura do gestor):

```js
  coordenador: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/gestor' },
    { label: 'Minha Equipe', icon: Users, path: '/gestor/equipe' },
    {
      group: true,
      key: 'ausencias',
      label: 'Ausências',
      icon: CalendarClock,
      locked: true,
      children: [
        { label: 'Aprovações', icon: ClipboardCheck, path: '/gestor/aprovacoes', badge: true },
        { label: 'Gestão de Ausência', icon: CalendarClock, path: '/gestor/ausencia' },
        { label: 'Minha Ausência', icon: CalendarDays, path: '/gestor/minha-ausencia' },
      ],
    },
    {
      group: true,
      key: 'solicitacoes',
      label: 'Requisições DP',
      icon: FileText,
      children: [
        { label: 'Requisição', icon: PlusCircle, path: '/gestor/solicitacoes/nova' },
        { label: 'Acompanhar', icon: ClipboardCheck, path: '/gestor/solicitacoes/acompanhar', solicitacaoBadge: true },
      ],
    },
    { label: 'Organograma', icon: Network, path: '/organograma' },
  ],
```

(Nota: o grupo Ausências está `locked: true` hoje no menu do gestor — manter idêntico para o coordenador.)

(b) `perfilLabel` (objeto em ~linha 112) ganha a entrada:

```js
  const perfilLabel = {
    admin: 'Administrador',
    gestor: 'Gestor',
    coordenador: 'Coordenador',
    usuario: 'Colaborador',
    rh: 'RH / DP',
  };
```

- [ ] **Step 4: Verificar build e lint dos arquivos tocados**

```bash
npx eslint src/contexts/AuthContext.jsx src/routes/AppRoutes.jsx src/components/Layout/Sidebar.jsx
npm run build
```
Expected: sem erros novos (AuthContext tem 1 erro pré-existente de fast-refresh na linha ~197; ignorar).

- [ ] **Step 5: Commit**

```bash
git add src/contexts/AuthContext.jsx src/routes/AppRoutes.jsx src/components/Layout/Sidebar.jsx
git commit -m "feat: perfil coordenador com acesso as telas do gestor"
```

---

### Task 4: Equipe recursiva no front — `getEquipeIds()` + 6 consultas

**Files:**
- Create: `src/services/equipe.js`
- Modify: `src/pages/Gestor/GestorEquipe.jsx:16-31`
- Modify: `src/pages/Gestor/GestorDashboard.jsx:32-39`
- Modify: `src/pages/Gestor/GestorAprovacoes.jsx:24-30`
- Modify: `src/pages/Gestor/GestorAusencia.jsx:61-67`
- Modify: `src/components/Layout/Layout.jsx:36-58,67-81`
- Modify: `src/pages/Gestor/requisicoes/useRequisicaoForm.js:24-29`

**Interfaces:**
- Consumes: RPC `get_minha_equipe()` (Task 2).
- Produces: `getEquipeIds(): Promise<string[]>` em `src/services/equipe.js` — ids de todos os descendentes do logado; lança em erro.

- [ ] **Step 1: Criar `src/services/equipe.js`**

```js
import { supabase } from './supabase';

/**
 * Ids de toda a equipe do usuário logado: subordinados diretos + as equipes
 * dos coordenadores abaixo (RPC recursiva get_minha_equipe).
 */
export async function getEquipeIds() {
  const { data, error } = await supabase.rpc('get_minha_equipe');
  if (error) throw error;
  return (data || []).map((r) => r.id);
}
```

- [ ] **Step 2: `GestorEquipe.jsx` — trocar a busca da equipe**

Import no topo (junto aos demais): `import { getEquipeIds } from '../../services/equipe';`

Trocar o início de `fetchEquipe` (linhas 17-26):

```js
    const fetchEquipe = async () => {
      setLoading(true);
      try {
        const ids = await getEquipeIds();
        const { data, error } = ids.length
          ? await supabase.from('colaboradores').select('*').in('id', ids).order('nome')
          : { data: [], error: null };

        if (!error && data) {
          setEquipe(data);
```

O restante do corpo (ciclos/saldos) permanece igual; fechar com:

```js
      } catch (err) {
        console.error('Erro ao carregar equipe:', err);
      } finally {
        setLoading(false);
      }
    };
```

(O `setLoading(false)` no fim do corpo atual sai do lugar e vira `finally`.)

- [ ] **Step 3: `GestorDashboard.jsx` — idem**

Import: `import { getEquipeIds } from '../../services/equipe';`

Trocar as linhas 32-36 (primeira query do try):

```js
        const ids = await getEquipeIds();
        const { data: cols, error: colsError } = ids.length
          ? await supabase.from('colaboradores').select('*').in('id', ids).order('nome')
          : { data: [], error: null };
```

(A variável local `ids` das linhas 42 já existe dentro do `if (cols...)` — renomear a de dentro para `idsEquipe` OU simplesmente reutilizar: trocar `const ids = cols.map((c) => c.id);` por `const idsEquipe = cols.map((c) => c.id);` e o `.in('colaborador_id', ids)` da linha 47 por `.in('colaborador_id', idsEquipe)`.)

- [ ] **Step 4: `GestorAprovacoes.jsx` — idem**

Import: `import { getEquipeIds } from '../../services/equipe';`

Trocar as linhas 24-30:

```js
      const idsEquipe = await getEquipeIds();
      const { data: cols, error: colsError } = idsEquipe.length
        ? await supabase.from('colaboradores').select('id, nome').in('id', idsEquipe)
        : { data: [], error: null };

      if (colsError) throw colsError;
      const ids = cols.map((c) => c.id);
```

- [ ] **Step 5: `GestorAusencia.jsx` — idem**

Import: `import { getEquipeIds } from '../../services/equipe';`

Trocar as linhas 61-65:

```js
        const ids = await getEquipeIds();
        const { data: cols, error: colsError } = ids.length
          ? await supabase.from('colaboradores').select('*').in('id', ids).order('nome')
          : { data: [], error: null };
```

(O `ids` interno da linha 70 — `const ids = cols.map(...)` — vira `idsEquipe` e o `.in('colaborador_id', ids)` da linha 74 vira `.in('colaborador_id', idsEquipe)` para não sombrear.)

- [ ] **Step 6: `Layout.jsx` — badges para coordenador**

Import: `import { getEquipeIds } from '../../services/equipe';`

Trocar `fetchPendingCount` (linhas 36-55):

```js
  const fetchPendingCount = async () => {
    if (user?.perfil !== 'gestor' && user?.perfil !== 'coordenador') return;
    try {
      const ids = await getEquipeIds();
      if (!ids.length) { setPendingCount(0); return; }
      const { count, error } = await supabase
        .from('ciclos_ausencia')
        .select('*', { count: 'exact', head: true })
        .in('colaborador_id', ids)
        .eq('status_atual', 'Marcação Pendente')
        .not('ausencia_agendada_inicio', 'is', null);
      if (!error) setPendingCount(count || 0);
    } catch (err) {
      console.error('Erro ao contar pendências:', err);
    }
  };
```

Em `fetchSolicitacaoCount`:
- linha 58: `if (!['admin', 'gestor', 'coordenador', 'rh'].includes(user?.perfil)) return;`
- linha 67: `if (user.perfil === 'gestor' || user.perfil === 'coordenador') {`
- linha 81: `return ['gestor', 'coordenador'].includes(user.perfil) ? s.gestor_id === user.id : true; // admin/rh: todas`

- [ ] **Step 7: `useRequisicaoForm.js` — equipe para requisições**

Import: `import { getEquipeIds } from '../../../services/equipe';`

Trocar as linhas 24-29 (dentro do efeito):

```js
      const ids = await getEquipeIds().catch(() => []);
      const { data } = ids.length
        ? await supabase
            .from('colaboradores')
            .select('id, nome, funcao, salario')
            .in('id', ids)
            .eq('ativo', true)
            .order('nome')
        : { data: [] };
```

- [ ] **Step 8: Lint + build + testes**

```bash
npx eslint src/services/equipe.js src/pages/Gestor/GestorEquipe.jsx src/pages/Gestor/GestorDashboard.jsx src/pages/Gestor/GestorAprovacoes.jsx src/pages/Gestor/GestorAusencia.jsx src/components/Layout/Layout.jsx src/pages/Gestor/requisicoes/useRequisicaoForm.js
npm test
npm run build
```
Expected: eslint sem erros NOVOS (Layout.jsx tem 2 erros pré-existentes `react-hooks/set-state-in-effect` nas linhas ~88/99 — não piorar); testes PASS; build OK.

- [ ] **Step 9: Commit**

```bash
git add src/services/equipe.js src/pages/Gestor/GestorEquipe.jsx src/pages/Gestor/GestorDashboard.jsx src/pages/Gestor/GestorAprovacoes.jsx src/pages/Gestor/GestorAusencia.jsx src/components/Layout/Layout.jsx src/pages/Gestor/requisicoes/useRequisicaoForm.js
git commit -m "feat: equipe recursiva via get_minha_equipe nas telas do gestor"
```

---

### Task 5: Cadastro — AdminCadastro e AdminListagem

**Files:**
- Modify: `src/pages/Admin/AdminCadastro.jsx`
- Modify: `src/pages/Admin/AdminListagem.jsx`

**Interfaces:**
- Consumes: `PERFIL_OPCOES`, `PERFIL_LABEL`, `precisaSuperior`, `candidatosASuperior` de `src/config/perfis.js` (Task 1).

- [ ] **Step 1: `AdminCadastro.jsx`**

(a) Import: `import { PERFIL_OPCOES, precisaSuperior, candidatosASuperior } from '../../config/perfis';`

(b) Remover o estado `gestores` (linha 17) e o `setGestores` do `carregar` (linha 32) e do `cadastrarNovo` (linhas 105-107). O bloco do `cadastrarNovo` fica:

```js
    if (created && created.perfil !== 'admin') {
      setColaboradores((prev) => [...prev, created].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')));
    }
```

(c) Trocar a linha 23:

```js
  const superiorObrigatorio = precisaSuperior(formData.perfil);
  const candidatosSuperior = candidatosASuperior(
    formData.perfil, colaboradores, aba === 'editar' ? selecionadoId : null,
  );
```

(d) `handleChange` (linha 72): trocar de superior é obrigatório sempre que o perfil muda (a lista de candidatos muda):

```js
      ...(name === 'perfil' ? { superior: '' } : {}),
```

(e) Select de Perfil (linhas 207-211):

```jsx
                  <select className="form-select" name="perfil" value={formData.perfil} onChange={handleChange} required>
                    {PERFIL_OPCOES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
```

(f) Select de Superior (linhas 234-239) passa a usar os candidatos:

```jsx
                    <select className="form-select" name="superior" value={formData.superior} onChange={handleChange} required={superiorObrigatorio}>
                      <option value="">Selecione o superior...</option>
                      {candidatosSuperior.map((g) => (
                        <option key={g.id} value={g.id}>{g.nome}</option>
                      ))}
                    </select>
```

- [ ] **Step 2: `AdminListagem.jsx`**

(a) Import: `import { PERFIL_OPCOES, PERFIL_LABEL, precisaSuperior, candidatosASuperior } from '../../config/perfis';`

(b) Trocar as linhas 64-69:

```js
  const candidatosSuperior = candidatosASuperior(editForm.perfil, colaboradoresData, editForm.id);

  // Gestor é topo de hierarquia; coordenador e usuário precisam de superior.
  const superiorObrigatorio = precisaSuperior(editForm.perfil);
```

(c) Linha 76 (perfilLabel):

```js
      perfilLabel: PERFIL_LABEL[u.perfil] || 'Usuário',
```

(d) Select de Perfil no modal (linhas 450-451):

```jsx
                      {PERFIL_OPCOES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
```

(e) Select de Superior no modal (linha 495): trocar `{gestores.map((g) => (` por `{candidatosSuperior.map((g) => (`.

(f) Ao trocar o perfil no modal, limpar o superior (a lista de candidatos muda). Em `handleEditChange` (linhas 129-135):

```js
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'perfil' ? { superior: '' } : {}),
    }));
  };
```

- [ ] **Step 3: Lint + build**

```bash
npx eslint src/pages/Admin/AdminCadastro.jsx src/pages/Admin/AdminListagem.jsx
npm run build
```
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Admin/AdminCadastro.jsx src/pages/Admin/AdminListagem.jsx
git commit -m "feat: cadastro com perfil coordenador e regras de superior"
```

---

### Task 6: Verificação

- [ ] **Step 1: Suíte completa**

```bash
npm test
npm run build
```
Expected: todos PASS, build OK.

- [ ] **Step 2: Sanidade SQL (via MCP `execute_sql`, read-only)**

Se existir (ou criando via AdminCadastro depois) um coordenador de teste sob um gestor:

```sql
-- gestor deve ver os netos:
select count(*) from app_private.descendentes('<id-do-gestor>');
-- coordenador deve ver só os diretos:
select count(*) from app_private.descendentes('<id-do-coordenador>');
```

- [ ] **Step 3: Verificação manual no navegador (requer login real)**

- Admin: em Cadastro, o select Perfil mostra Usuário/Coordenador/Gestor; escolher Coordenador exige Superior e lista só gestores; escolher Usuário lista gestores e coordenadores.
- Promover (ou criar) um colaborador a coordenador com um gestor como superior e mover um usuário para baixo do coordenador.
- Logar como coordenador: menu completo (Dashboard, Minha Equipe, Ausências, Requisições DP, Organograma); Minha Equipe mostra só a equipe direta dele.
- Logar como o gestor acima: Minha Equipe/Dashboard/Gestão de Ausência mostram a equipe direta + a equipe do coordenador; pendência de ausência criada por alguém da equipe do coordenador aparece em Aprovações do gestor E do coordenador, e ambos conseguem aprovar.
- Perfil `usuario` continua sem acesso ao módulo DP além de /usuario.
