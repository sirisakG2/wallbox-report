// Per-isolate cache keyed by the data version in the `meta` table. Every write bumps the version
// (BUMP_SQL), so reads reuse computed results until something changes — one row read instead of
// thousands on every page view (D1 bills row reads; the free plan allows 5 million a day).
const store = new Map();
export const BUMP_SQL = "UPDATE meta SET value = value + 1 WHERE key = 'version'";

export async function dataVersion(db) {
  try {
    const r = await db.prepare("SELECT value FROM meta WHERE key = 'version'").first();
    return r ? r.value : null;
  } catch { return null; } // table missing → no caching
}

export async function cached(db, key, fn) {
  const v = await dataVersion(db);
  const hit = store.get(key);
  if (v !== null && hit && hit.v === v) return hit.value;
  const value = await fn();
  if (v !== null) {
    store.set(key, { v, value });
    if (store.size > 40) store.delete(store.keys().next().value);
  }
  return value;
}

export const bump = (db) => db.prepare(BUMP_SQL);
