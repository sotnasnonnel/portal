# Estratégia de Carregamento Supabase sem Delay no Frontend

Guia portável da abordagem usada neste app (React + Vite + Supabase JS) para que as telas abram **instantaneamente**, sem o "flash de loading" típico em apps que consultam o banco toda vez. Pode ser aplicado em qualquer SPA (React, Vue, Svelte, etc.) que use `@supabase/supabase-js` ou um cliente HTTP equivalente.

---

## 1. O Problema

Com `supabase-js` puro, cada componente faz seu próprio `select()` no `useEffect`. Resultado:

- Navegar de uma tela para outra dispara **nova requisição** (mesmo que os dados não tenham mudado).
- Voltar a uma tela já vista mostra spinner de novo.
- Recarregar o app (F5) reinicia tudo do zero.
- Múltiplos componentes pedindo os mesmos dados disparam **N chamadas paralelas idênticas**.

A solução tem três camadas que se complementam:

1. **Cache em memória** com TTL (instantâneo dentro da sessão SPA).
2. **Cache em `sessionStorage`** (sobrevive a F5 e abertura de novas abas da mesma origem).
3. **Estratégia stale-while-revalidate** (devolve o que tem agora, renova em background).
4. **Preload em `requestIdleCallback`** (dispara consultas logo após login, antes do usuário navegar).
5. **De-duplicação de requisições in-flight** (chamadas simultâneas viram uma só).

---

## 2. Arquitetura em Camadas

```
┌───────────────────────────────────────────────┐
│  Componente React (useEffect)                 │
│  → chama service (ex.: fetchOpportunities)    │
└───────────────────┬───────────────────────────┘
                    │
┌───────────────────▼───────────────────────────┐
│  Service (src/services/*.js)                  │
│  → envolve a query com cachedQuery(key, ...)  │
└───────────────────┬───────────────────────────┘
                    │
┌───────────────────▼───────────────────────────┐
│  supabaseCache (src/lib/supabaseCache.js)     │
│  - cache em memória (Map)                     │
│  - inflight (Map de Promises ativas)          │
│  - sessionStorage (persistência por aba)      │
│  - invalidação por prefixo                    │
└───────────────────┬───────────────────────────┘
                    │ só chama o Supabase quando     
                    │ não há hit válido nem inflight 
┌───────────────────▼───────────────────────────┐
│  supabase-js (HTTP → PostgREST/Auth/Realtime) │
└───────────────────────────────────────────────┘
```

---

## 3. O Coração: `supabaseCache.js`

Arquivo único, sem dependências, ~170 linhas. Reaproveitável em qualquer projeto JS/TS.

### 3.1 Estruturas internas

```js
const cache = new Map();          // key -> { value, expiresAt, staleAt }
const inflight = new Map();       // key -> Promise em andamento
const invalidatedAt = new Map();  // prefix -> timestamp da última invalidação
const STORAGE_PREFIX = 'phd_supabase_cache_v1:';
const DEFAULT_TTL_MS = 60_000;             // 1 min "fresh"
const DEFAULT_STALE_TTL_MS = 10 * 60_000;  // mais 10 min servindo stale
```

- **`cache`**: hits instantâneos dentro da sessão.
- **`inflight`**: evita que 5 componentes pedindo a mesma chave disparem 5 requisições.
- **`invalidatedAt`**: protege contra "resposta velha sobrescrevendo cache recém-invalidado" (race condition clássica em SWR).
- **`sessionStorage`**: persiste o cache entre F5 da mesma aba. Use `localStorage` se quiser persistir entre abas/sessões — mas atenção a dados sensíveis.

### 3.2 API pública

```js
cachedQuery(key, fetcher, ttlMs = 60_000, options?: { staleTtlMs })
invalidateCache(prefixes: string | string[])
clearSupabaseCache()
```

### 3.3 Fluxo de leitura (algoritmo SWR)

```js
export async function cachedQuery(key, fetcher, ttlMs, options = {}) {
  const staleTtlMs = options.staleTtlMs ?? DEFAULT_STALE_TTL_MS;
  const now = Date.now();
  const hit = cache.get(key);

  // 1) Hit fresco: devolve cópia, ZERO espera, ZERO rede
  if (hit && hit.expiresAt > now) return clone(hit.value);

  // 2) Hit stale (passou TTL, mas ainda dentro do staleTtlMs):
  //    devolve o stale AGORA e dispara refresh em background
  if (hit && hit.staleAt > now) {
    refreshInBackground(key, fetcher, ttlMs, staleTtlMs);
    return clone(hit.value);
  }

  // 3) Já existe requisição em voo: aguarda a mesma Promise
  if (inflight.has(key)) return clone(await inflight.get(key));

  // 4) Hit em sessionStorage (sobreviveu a um F5):
  //    devolve imediatamente; refresh em background se vencido
  const stored = readStored(key);
  if (stored) {
    cache.set(key, stored);
    if (stored.expiresAt <= now) {
      refreshInBackground(key, fetcher, ttlMs, staleTtlMs);
    }
    return clone(stored.value);
  }

  // 5) Cold miss: única chamada real ao Supabase
  return clone(await startRequest(key, fetcher, ttlMs, staleTtlMs));
}
```

### 3.4 De-duplicação e proteção de race

`startRequest` registra a Promise em `inflight` **antes** de chamar o fetcher; quaisquer chamadas concorrentes pegam essa mesma Promise. Ao resolver, só persiste no cache se:

- a resposta não contém erro (`shouldCache`), **e**
- nenhuma `invalidateCache` foi chamada para um prefixo que cubra essa chave depois que a requisição começou (`wasInvalidatedAfter`).

Isso evita que uma resposta lenta sobrescreva um cache que o usuário acabou de invalidar (ex.: depois de um `update`).

### 3.5 Invalidação por prefixo

```js
invalidateCache(['demands:']);          // apaga tudo que começa com "demands:"
invalidateCache(['opportunities:', 'forecast:']); // múltiplos prefixos
```

Por isso a **convenção de naming das chaves é crítica**: use `recurso:operacao:filtro1:filtro2`. Exemplos reais do projeto:

```js
`demands:list:${year}:${status || 'all'}`
`demands:detail:${id}`
`operation:won-opportunities:2026:v2`
`operation:won-proposals:${oppIds.sort().join(',')}`  // sort para chave estável
```

---

## 4. Uso nos Services

Padrão: cada função "fetch" envolve a query do Supabase com `cachedQuery`; cada função que muta dados chama `invalidateCache` com o prefixo certo.

```js
// src/services/demands.js
import { supabase } from '../lib/supabase.js';
import { cachedQuery, invalidateCache } from '../lib/supabaseCache.js';

export async function fetchDemands(year, status) {
  const key = `demands:list:${year}:${status || 'all'}`;
  const { data, error } = await cachedQuery(key, () =>
    supabase.from('demands').select('*').eq('year', year)
      .eq(status ? 'status' : 'year', status ?? year) // exemplo
  );
  return { data, error };
}

export async function createDemand(payload) {
  const { data, error } = await supabase.from('demands').insert(payload).select().single();
  if (!error) invalidateCache(['demands:']); // limpa list E detail
  return { data, error };
}
```

**Observação importante:** o `fetcher` que você passa para `cachedQuery` é uma *thunk* — `() => supabase.from(...).select(...)`. Ele só executa quando há cold miss / refresh stale. Não inverta a ordem: passar `supabase.from(...).select(...)` direto dispararia a query toda chamada.

---

## 5. Selecionar Apenas as Colunas Necessárias

Cache acelera repetição; **`select('*')` continua sendo caro na primeira carga**. Padrão do projeto:

```js
// src/services/opportunities.js
const OPPORTUNITY_SELECT = `
  id, code, account_id, contact_id, product_id, seller_id,
  project_name, stage, source, estimated_value, contract_months,
  ...
  accounts!account_id(id, name, city, state),
  products!product_id(id, name, code, code_prefix),
  contacts!contact_id(id, name, full_name)
`;
```

Regras:

- Liste explicitamente as colunas que o frontend consome (vide a função de map para o shape do UI).
- Use **joins embutidos do PostgREST** (`accounts!account_id(...)`) para trazer relacionamentos numa única ida ao servidor — elimina N+1.
- Evite trazer BLOBs, JSONs grandes e textos longos não usados.

---

## 6. Preload Inteligente em `requestIdleCallback`

Logo após o login, dispara em segundo plano todas as consultas que o usuário **provavelmente** abrirá. Quando ele clicar, o cache já está quente.

```js
// src/services/dataPreload.js
let hasStarted = false;

function runWhenIdle(callback) {
  if (typeof window === 'undefined') return;
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 1500 });
    return;
  }
  window.setTimeout(callback, 300); // fallback Safari
}

async function settle(tasks) {
  await Promise.allSettled(tasks.map((t) => t()));
}

export function preloadSupabaseData() {
  if (hasStarted || !isSupabaseConfigured) return;
  hasStarted = true;

  runWhenIdle(async () => {
    const year = new Date().getFullYear();

    // Lote 1: dados primários
    await settle([fetchOpportunities, fetchDemands, fetchProposals, preloadActions]);

    // Lote 2: dimensões e metas (já com cache do lote 1 disponível se precisar)
    await settle([
      fetchActiveAccounts,
      fetchOpportunityFormOptions,
      () => fetchSalesTargets(year),
      () => fetchForecast(year),
    ]);

    // Lote 3: dados derivados pesados
    await settle([
      () => fetchRevenueProjection(year),
      preloadWonPortfolio,
    ]);
  });
}
```

E o gatilho no layout principal, **só após autenticar**:

```jsx
// src/components/layout/AppLayout.jsx
useEffect(() => {
  if (profile && !mustChangePassword) preloadSupabaseData();
}, [mustChangePassword, profile]);
```

Notas:

- `Promise.allSettled` é proposital: se uma consulta falhar, as outras continuam.
- Lotes sequenciais (`await settle(...)` por lote) evitam abrir 15 conexões simultâneas — escolha o tamanho de lote com base na latência do seu Supabase.
- `hasStarted` impede duplicidade em re-renders.

---

## 7. Optimistic Updates nos Contexts

Cache resolve leitura. Para **escrita parecer instantânea**, aplique o patch no estado local antes da resposta do Supabase, com rollback se der erro:

```jsx
// src/context/OpportunitiesContext.jsx
const updateExistingOpportunity = async (id, patch) => {
  let original = null;
  setOpportunities(prev => {
    original = prev.find(o => o.id === id) || null;
    return prev.map(o => o.id === id ? { ...o, ...patch } : o);
  });

  const { data, error } = await updateOpportunity(id, patch);
  if (error) {
    if (original) setOpportunities(prev => prev.map(o => o.id === id ? original : o));
    return { data: null, error };
  }
  if (data) setOpportunities(prev => prev.map(o => o.id === id ? data : o));
  return { data, error: null };
};
```

Combinado com a invalidação dentro do service (`invalidateCache(['opportunities:'])`), a próxima leitura sincroniza com o servidor.

---

## 8. Proteção Contra "Última Resposta Vence"

Quando um usuário troca de filtro rápido, requisições antigas podem chegar depois das novas e sobrescrever a UI. Solução nos contexts: um contador de requisição.

```jsx
const requestIdRef = useRef(0);

const load = useCallback(async () => {
  const currentId = ++requestIdRef.current;
  const { data } = await fetchOpportunities();
  if (currentId !== requestIdRef.current) return; // resposta obsoleta, ignora
  setOpportunities(data ?? []);
}, []);
```

---

## 9. Checklist Para Replicar em Outro Software

Ordem sugerida:

1. **Copie `supabaseCache.js`** (ou porte o arquivo para TS). Sem dependências externas.
2. **Crie convenção de chaves**: `recurso:operacao:filtros...`. Documente os prefixos.
3. **Refatore cada service**: envolva `select`/`rpc` com `cachedQuery`; chame `invalidateCache([prefix])` após `insert/update/delete`.
4. **Reduza payload**: troque `select('*')` por listas explícitas; use joins embutidos do PostgREST.
5. **Crie `dataPreload.js`** com `requestIdleCallback` + `Promise.allSettled`, em lotes.
6. **Dispare o preload no layout autenticado** (`useEffect` que depende de `profile`).
7. **Adote optimistic updates** nos contexts/stores que mudam dados.
8. **Adicione `requestIdRef`** em qualquer loader que possa ser reexecutado por mudança de filtro.
9. **Limpe o cache no logout**: `clearSupabaseCache()` no `signOut`.
10. **Ajuste TTLs por recurso**: dados muito mutáveis → TTL menor; tabelas dimensão (produtos, segmentos) → TTL e staleTtl grandes.

---

## 10. Quando NÃO Cachear

- Tabelas de **auditoria** ou **logs** (sempre quero o mais recente).
- Consultas com **dados pessoais sensíveis** que não devem ficar em `sessionStorage`.
- Resultados que dependem de **`auth.uid()` no RLS** — se o usuário mudar, a chave precisa incluir o `userId` para não vazar dados entre sessões.
- Operações de **escrita** (óbvio, mas vale registrar).

Para esses casos, chame o Supabase direto, sem `cachedQuery`.

---

## 11. Sintonia Fina de TTLs

Valores usados no projeto como referência:

| Tipo de dado                        | `ttlMs`  | `staleTtlMs` |
| ----------------------------------- | -------- | ------------ |
| Listas operacionais (oportunidades, demandas) | 30–60s   | 10 min       |
| Metas de vendas (mudam pouco)       | 60s      | 30 min       |
| Catálogos (produtos, segmentos)     | 5 min    | 1 hora       |
| RPC pesada (`get_all_opportunity_tasks`) | 30s      | 10 min       |

Regra prática: `ttlMs` é "quanto o usuário tolera ver desatualizado sem perceber"; `staleTtlMs` é "quanto tempo eu prefiro mostrar dado velho a mostrar spinner".

---

## 12. Métricas Para Validar o Ganho

Antes/depois, meça no DevTools:

- **Network**: número de requisições ao Supabase ao trocar de aba/voltar.
- **Time to Interactive** do componente: deve cair para ~0 ms em hits.
- **Largest Contentful Paint** das telas pós-login.

Em hit fresco a função retorna **síncrona em prática** (Promise já resolvida com `clone(value)`), o que é indistinguível de `useState` local.

---

## 13. Resumo em Uma Frase

> Cada leitura passa por `cachedQuery(chave, fetcher)`; cada escrita chama `invalidateCache(prefixo)`; depois do login, `preloadSupabaseData()` enche o cache em `requestIdleCallback` — assim toda navegação posterior sai do cache em memória ou do `sessionStorage`, sem spinner.

---

## Apêndice: Arquivos de Referência no Projeto

- `src/lib/supabase.js` — instanciação do client.
- `src/lib/supabaseCache.js` — implementação completa do cache.
- `src/services/dataPreload.js` — orquestração do preload em idle.
- `src/services/opportunities.js`, `src/services/demands.js` — exemplos de service consumindo `cachedQuery` e `invalidateCache`.
- `src/components/layout/AppLayout.jsx` — gatilho do preload pós-autenticação.
- `src/context/OpportunitiesContext.jsx` — exemplo de optimistic update + `requestIdRef`.
