// Cache leve para leituras do Supabase: memória + sessionStorage + SWR + dedup.
// Estratégia descrita em estrategia-carregamento-supabase-sem-delay.md.
// Sem dependências. Use cachedQuery() na leitura e invalidateCache() após escrita.

type Entry<T = unknown> = { value: T; expiresAt: number; staleAt: number };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const invalidatedAt = new Map<string, number>();

const STORAGE_PREFIX = "phd_supabase_cache_v1:";
const DEFAULT_TTL_MS = 60_000; // 1 min "fresh"
const DEFAULT_STALE_TTL_MS = 10 * 60_000; // +10 min servindo stale

function clone<T>(value: T): T {
  if (value == null) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function hasSessionStorage(): boolean {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

function readStored(key: string): Entry | null {
  if (!hasSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as Entry;
  } catch {
    return null;
  }
}

function writeStored(key: string, entry: Entry): void {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota cheia ou serialização falhou: ignora (cache em memória ainda funciona) */
  }
}

function removeStoredByPrefix(prefix: string): void {
  if (!hasSessionStorage()) return;
  try {
    const full = STORAGE_PREFIX + prefix;
    const toRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(full)) toRemove.push(k);
    }
    toRemove.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// uma resposta do supabase só deve ser cacheada quando não houve erro
function shouldCache(value: unknown): boolean {
  if (value && typeof value === "object" && "error" in value) {
    return !(value as { error: unknown }).error;
  }
  return true;
}

function wasInvalidatedAfter(key: string, startedAt: number): boolean {
  for (const [prefix, ts] of invalidatedAt) {
    if (key.startsWith(prefix) && ts >= startedAt) return true;
  }
  return false;
}

function store(key: string, value: unknown, ttlMs: number, staleTtlMs: number, startedAt: number) {
  if (!shouldCache(value)) return;
  if (wasInvalidatedAfter(key, startedAt)) return; // invalidado durante a requisição: não persiste
  const now = Date.now();
  const entry: Entry = { value, expiresAt: now + ttlMs, staleAt: now + ttlMs + staleTtlMs };
  cache.set(key, entry);
  writeStored(key, entry);
}

function startRequest<T>(key: string, fetcher: () => Promise<T>, ttlMs: number, staleTtlMs: number): Promise<T> {
  const startedAt = Date.now();
  const p = (async () => {
    try {
      const value = await fetcher();
      store(key, value, ttlMs, staleTtlMs, startedAt);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function refreshInBackground<T>(key: string, fetcher: () => Promise<T>, ttlMs: number, staleTtlMs: number) {
  if (inflight.has(key)) return;
  // dispara e ignora erros: a UI já recebeu o stale
  startRequest(key, fetcher, ttlMs, staleTtlMs).catch(() => {});
}

export interface CachedQueryOptions {
  ttlMs?: number;
  staleTtlMs?: number;
}

/**
 * Lê com cache (stale-while-revalidate + dedup). `fetcher` é uma thunk:
 *   cachedQuery('surveys:list', () => supabase.from('solic_surveys').select('*'))
 * Só executa o fetcher em cold miss ou refresh de stale.
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CachedQueryOptions = {}
): Promise<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const staleTtlMs = options.staleTtlMs ?? DEFAULT_STALE_TTL_MS;
  const now = Date.now();

  const hit = cache.get(key) as Entry<T> | undefined;

  // 1) fresco
  if (hit && hit.expiresAt > now) return clone(hit.value);

  // 2) stale dentro da janela: devolve já e renova em background
  if (hit && hit.staleAt > now) {
    refreshInBackground(key, fetcher, ttlMs, staleTtlMs);
    return clone(hit.value);
  }

  // 3) requisição em voo: aguarda a mesma promise
  if (inflight.has(key)) return clone((await inflight.get(key)) as T);

  // 4) sessionStorage (sobreviveu a F5)
  const stored = readStored(key) as Entry<T> | null;
  if (stored) {
    cache.set(key, stored);
    if (stored.expiresAt <= now) refreshInBackground(key, fetcher, ttlMs, staleTtlMs);
    return clone(stored.value);
  }

  // 5) cold miss: única chamada real
  return clone(await startRequest(key, fetcher, ttlMs, staleTtlMs));
}

/** Invalida tudo cujo key começa com um dos prefixos (ex.: 'surveys:'). */
export function invalidateCache(prefixes: string | string[]): void {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  const now = Date.now();
  for (const prefix of list) {
    invalidatedAt.set(prefix, now);
    for (const k of [...cache.keys()]) {
      if (k.startsWith(prefix)) cache.delete(k);
    }
    removeStoredByPrefix(prefix);
  }
}

/** Limpa tudo (chamar no logout). */
export function clearSupabaseCache(): void {
  cache.clear();
  inflight.clear();
  invalidatedAt.clear();
  if (hasSessionStorage()) {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
      }
      toRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}
