const cache = new Map();
const inflight = new Map();
const invalidatedAt = new Map();
const STORAGE_PREFIX = "reem_supabase_cache_v1:";
const DEFAULT_TTL_MS = 60_000;
const DEFAULT_STALE_TTL_MS = 10 * 60_000;

function clone(value) {
  if (value === null || value === undefined) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function readStored(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(key, entry) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota — ignora */
  }
}

function shouldCache(value) {
  if (!value) return false;
  if (typeof value === "object" && "error" in value && value.error) return false;
  return true;
}

function wasInvalidatedAfter(key, startedAt) {
  for (const [prefix, ts] of invalidatedAt) {
    if (key.startsWith(prefix) && ts > startedAt) return true;
  }
  return false;
}

function refreshInBackground(key, fetcher, ttlMs, staleTtlMs) {
  if (inflight.has(key)) return;
  startRequest(key, fetcher, ttlMs, staleTtlMs).catch(() => {});
}

async function startRequest(key, fetcher, ttlMs, staleTtlMs) {
  const startedAt = Date.now();
  const promise = Promise.resolve().then(() => fetcher());
  inflight.set(key, promise);
  try {
    const value = await promise;
    if (shouldCache(value) && !wasInvalidatedAfter(key, startedAt)) {
      const entry = {
        value,
        expiresAt: Date.now() + ttlMs,
        staleAt: Date.now() + ttlMs + staleTtlMs,
      };
      cache.set(key, entry);
      writeStored(key, entry);
    }
    return value;
  } finally {
    inflight.delete(key);
  }
}

export async function cachedQuery(key, fetcher, ttlMs = DEFAULT_TTL_MS, options = {}) {
  const staleTtlMs = options.staleTtlMs ?? DEFAULT_STALE_TTL_MS;
  const now = Date.now();
  const hit = cache.get(key);

  if (hit && hit.expiresAt > now) return clone(hit.value);

  if (hit && hit.staleAt > now) {
    refreshInBackground(key, fetcher, ttlMs, staleTtlMs);
    return clone(hit.value);
  }

  if (inflight.has(key)) return clone(await inflight.get(key));

  const stored = readStored(key);
  if (stored) {
    cache.set(key, stored);
    if (stored.expiresAt <= now) {
      refreshInBackground(key, fetcher, ttlMs, staleTtlMs);
    }
    return clone(stored.value);
  }

  return clone(await startRequest(key, fetcher, ttlMs, staleTtlMs));
}

export function invalidateCache(prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  const now = Date.now();
  for (const prefix of list) {
    invalidatedAt.set(prefix, now);
    for (const key of [...cache.keys()]) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
    if (typeof window !== "undefined") {
      try {
        for (const k of Object.keys(window.sessionStorage)) {
          if (k.startsWith(STORAGE_PREFIX + prefix)) window.sessionStorage.removeItem(k);
        }
      } catch {
        /* ignora */
      }
    }
  }
}

export function clearSupabaseCache() {
  cache.clear();
  inflight.clear();
  invalidatedAt.clear();
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(window.sessionStorage)) {
      if (k.startsWith(STORAGE_PREFIX)) window.sessionStorage.removeItem(k);
    }
  } catch {
    /* ignora */
  }
}
