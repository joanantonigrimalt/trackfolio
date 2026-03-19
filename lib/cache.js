// Persistent cache for historical price data
// L1: in-memory Map (warm requests, 30 min TTL)
// L2: Supabase REST API (persistent, survives cold starts)
//
// Supabase is disabled gracefully when SUPABASE_URL is empty.
// To enable: set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local / Vercel env vars.
// Run supabase-schema.sql once to create the required tables.

const MAX_STALE_DAYS = 1; // re-fetch if last data point is older than this

function isSupabaseEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

function sbUrl(path) {
  return `${process.env.SUPABASE_URL}/rest/v1${path}`;
}

function sbHeaders(extra = {}) {
  return {
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

// Read all cached price history for an ISIN from Supabase
async function dbGetHistory(isin) {
  if (!isSupabaseEnabled()) return null;
  try {
    const res = await fetch(
      sbUrl(`/price_history?isin=eq.${encodeURIComponent(isin)}&select=date,close&order=date.asc&limit=5000`),
      { headers: sbHeaders() }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map(r => ({ date: r.date, close: Number(r.close) }));
  } catch (e) {
    console.error('[cache] dbGetHistory exception:', e.message);
    return null;
  }
}

// Check if the cached data is fresh enough (last data point ≤ MAX_STALE_DAYS old)
async function dbIsStale(isin) {
  if (!isSupabaseEnabled()) return true; // no DB → always stale
  try {
    const res = await fetch(
      sbUrl(`/price_history?isin=eq.${encodeURIComponent(isin)}&select=date&order=date.desc&limit=1`),
      { headers: sbHeaders() }
    );
    if (!res.ok) return true;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return true;
    const lastDate = new Date(rows[0].date);
    const ageDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > MAX_STALE_DAYS;
  } catch (e) {
    console.error('[cache] dbIsStale exception:', e.message);
    return true;
  }
}

// Upsert price history for an ISIN into Supabase (batches of 500)
async function dbSaveHistory(isin, points, provider = 'unknown') {
  if (!isSupabaseEnabled()) return false;
  if (!Array.isArray(points) || points.length === 0) return false;
  try {
    // Deduplicate by date — keep last occurrence (most recent fetch wins)
    const seen = new Map();
    for (const p of points) seen.set(p.date, p);
    const rows = [...seen.values()].map(p => ({ isin, date: p.date, close: p.close, provider }));
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const res = await fetch(sbUrl('/price_history?on_conflict=isin,date'), {
        method: 'POST',
        headers: sbHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(chunk)
      });
      if (!res.ok) {
        const err = await res.text().catch(() => res.status);
        console.error('[cache] dbSaveHistory error:', err);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('[cache] dbSaveHistory exception:', e.message);
    return false;
  }
}

// Save asset metadata (name, type, provider) to Supabase
async function dbSaveMetadata(isin, name, type, recommendedProvider) {
  if (!isSupabaseEnabled()) return false;
  try {
    const res = await fetch(sbUrl('/assets_metadata'), {
      method: 'POST',
      headers: sbHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ isin, name, tipo: type || 'unknown', recommended_provider: recommendedProvider || null })
    });
    return res.ok;
  } catch (e) {
    console.error('[cache] dbSaveMetadata exception:', e.message);
    return false;
  }
}

// ── Insider cache (Supabase L2) ───────────────────────────────────────────────
const INSIDER_TTL_HOURS = 6;

async function dbGetInsiders(symbol) {
  if (!isSupabaseEnabled()) return null;
  try {
    const res = await fetch(
      sbUrl(`/insider_cache?symbol=eq.${encodeURIComponent(symbol)}&select=data,fetched_at&limit=1`),
      { headers: sbHeaders(), signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const { data, fetched_at } = rows[0];
    const ageHours = (Date.now() - new Date(fetched_at).getTime()) / 3_600_000;
    if (ageHours > INSIDER_TTL_HOURS) return null; // stale
    return Array.isArray(data) ? data : null;
  } catch (e) {
    console.error('[cache] dbGetInsiders exception:', e.message);
    return null;
  }
}

// Returns combined recent insider transactions from all cached symbols (discovery view)
async function dbGetAllInsiders() {
  if (!isSupabaseEnabled()) return null;
  try {
    const res = await fetch(
      sbUrl(`/insider_cache?select=data,fetched_at&order=fetched_at.desc&limit=60`),
      { headers: sbHeaders(), signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const all = [];
    for (const row of rows) {
      const ageHours = (Date.now() - new Date(row.fetched_at).getTime()) / 3_600_000;
      if (ageHours > INSIDER_TTL_HOURS) continue;
      if (Array.isArray(row.data)) all.push(...row.data);
    }
    return all.length > 0
      ? all.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)).slice(0, 300)
      : null;
  } catch (e) {
    console.error('[cache] dbGetAllInsiders exception:', e.message);
    return null;
  }
}

async function dbSaveInsiders(symbol, data) {
  if (!isSupabaseEnabled()) return false;
  try {
    const res = await fetch(sbUrl('/insider_cache?on_conflict=symbol'), {
      method: 'POST',
      headers: sbHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ symbol, data, fetched_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch (e) {
    console.error('[cache] dbSaveInsiders exception:', e.message);
    return false;
  }
}

// ── Generic in-memory KV cache with TTL ──────────────────────────────────────
// Used by API routes that need short-lived caching without Supabase overhead.
// Survives within a single serverless instance lifetime (warm requests only).
// For cold-start resilience on heavy endpoints (seed, insiders) use Supabase L2.

const _kvStore = new Map();

/** Returns cached value or null (+ logs HIT/MISS) */
function getCache(key) {
  const e = _kvStore.get(key);
  if (!e) { console.log('[cache MISS]', key); return null; }
  if (Date.now() > e.x) { _kvStore.delete(key); console.log('[cache MISS]', key); return null; }
  console.log('[cache HIT]', key);
  return e.v;
}

/** Stores value with TTL (default 15 min) */
function setCache(key, value, ttlSeconds = 900) {
  _kvStore.set(key, { v: value, x: Date.now() + ttlSeconds * 1000 });
}

/** Removes a single key (or clears all if key omitted) */
function invalidateCache(key) {
  if (key) _kvStore.delete(key);
  else _kvStore.clear();
}

module.exports = {
  dbGetHistory, dbSaveHistory, dbIsStale, dbSaveMetadata, isSupabaseEnabled,
  dbGetInsiders, dbSaveInsiders, dbGetAllInsiders,
  getCache, setCache, invalidateCache,
};
