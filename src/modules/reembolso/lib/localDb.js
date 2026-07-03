const STORAGE_KEY = "reem_local_db_v1";

const SCHEMA = {
  reem_reimbursements: [],
  reem_items: [],
};

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readAll() {
  if (typeof window === "undefined") return structuredClone(SCHEMA);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(SCHEMA);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(SCHEMA), ...parsed };
  } catch (err) {
    console.warn("[localDb] read error:", err);
    return structuredClone(SCHEMA);
  }
}

function writeAll(db) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn("[localDb] write error:", err);
  }
}

function table(db, name) {
  if (!db[name]) db[name] = [];
  return db[name];
}

function nowIso() {
  return new Date().toISOString();
}

export const localDb = {
  uuid,

  list(name, { where, orderBy } = {}) {
    const db = readAll();
    let rows = [...table(db, name)];
    if (where) {
      rows = rows.filter((row) =>
        Object.entries(where).every(([k, v]) => row[k] === v)
      );
    }
    if (orderBy) {
      const { column, ascending = true } = orderBy;
      rows.sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return ascending ? (av < bv ? -1 : 1) : (av < bv ? 1 : -1);
      });
    }
    return { data: rows, error: null };
  },

  get(name, id) {
    const db = readAll();
    const row = table(db, name).find((r) => r.id === id) ?? null;
    if (!row) return { data: null, error: { message: "not_found" } };
    return { data: row, error: null };
  },

  insert(name, payload) {
    const db = readAll();
    const arr = table(db, name);
    const record = {
      id: payload.id ?? uuid(),
      created_at: nowIso(),
      updated_at: nowIso(),
      ...payload,
    };
    arr.push(record);
    writeAll(db);
    return { data: record, error: null };
  },

  insertMany(name, payloads) {
    const db = readAll();
    const arr = table(db, name);
    const created = payloads.map((payload) => ({
      id: payload.id ?? uuid(),
      created_at: nowIso(),
      updated_at: nowIso(),
      ...payload,
    }));
    arr.push(...created);
    writeAll(db);
    return { data: created, error: null };
  },

  update(name, id, patch) {
    const db = readAll();
    const arr = table(db, name);
    const idx = arr.findIndex((r) => r.id === id);
    if (idx < 0) return { data: null, error: { message: "not_found" } };
    arr[idx] = { ...arr[idx], ...patch, updated_at: nowIso() };
    writeAll(db);
    return { data: arr[idx], error: null };
  },

  remove(name, id) {
    const db = readAll();
    const arr = table(db, name);
    const next = arr.filter((r) => r.id !== id);
    db[name] = next;
    writeAll(db);
    return { data: null, error: null };
  },

  removeWhere(name, where) {
    const db = readAll();
    const arr = table(db, name);
    db[name] = arr.filter(
      (row) => !Object.entries(where).every(([k, v]) => row[k] === v)
    );
    writeAll(db);
    return { data: null, error: null };
  },

  export() {
    return readAll();
  },

  reset() {
    writeAll(structuredClone(SCHEMA));
  },
};
