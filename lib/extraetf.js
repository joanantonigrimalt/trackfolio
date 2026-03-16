// extraETF data layer — validation + ETF profile enrichment
// Uses extraETF's internal API endpoint (api-v2/detail) discovered from their JS bundle.
//
// Public API:
//   fetchExtraETFAnnual(isin)  → { isin, annual: { 2024: 1.46, ... }, currency, source }
//   fetchETFProfile(isin)      → { isin, overview: {...}, holdings: [...], source, fetchedAt }
//   validateAnnual(d, e)       → { consistent, diffPct, status }

// ── L1 in-memory cache (24h) ──────────────────────────────────────────────────
const L1 = new Map();
const L1_TTL = 24 * 60 * 60 * 1000;
const l1get = k => { const e = L1.get(k); if (!e || Date.now() > e.x) { L1.delete(k); return null; } return e.v; };
const l1set = (k, v) => L1.set(k, { v, x: Date.now() + L1_TTL });

// ── Supabase helpers ──────────────────────────────────────────────────────────
const STALE_DAYS = 7;

function sbEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}
function sbUrl(path) {
  return `${process.env.SUPABASE_URL}/rest/v1${path}`;
}
function sbHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function dbGetProfile(isin) {
  if (!sbEnabled()) return null;
  try {
    const res = await fetch(
      sbUrl(`/etf_profiles?isin=eq.${encodeURIComponent(isin)}&select=overview,holdings,updated_at&limit=1`),
      { headers: sbHeaders(), signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const row = rows[0];
    const ageDays = (Date.now() - new Date(row.updated_at).getTime()) / 86400000;
    if (ageDays > STALE_DAYS) return null; // stale — re-fetch
    return { overview: row.overview, holdings: row.holdings, updatedAt: row.updated_at };
  } catch { return null; }
}

async function dbSaveProfile(isin, overview, holdings) {
  if (!sbEnabled()) return;
  try {
    const now = new Date().toISOString();
    await fetch(sbUrl('/etf_profiles?on_conflict=isin'), {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{ isin, overview, holdings, source: 'extraetf', updated_at: now }]),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* non-critical */ }
}

// ── Raw API fetch ─────────────────────────────────────────────────────────────
async function fetchRawDetail(isin) {
  const url = `https://extraetf.com/api-v2/detail/?isin=${encodeURIComponent(isin)}&lang=es`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': `https://extraetf.com/es/etf-profile/${isin}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`extraETF HTTP ${r.status} for ${isin}`);
  const data = await r.json();
  const etf = (data.results || [data])[0];
  if (!etf) throw new Error(`extraETF: empty result for ${isin}`);
  return etf;
}

// ── Normalize overview fields ─────────────────────────────────────────────────
function normalizeOverview(etf) {
  const aum = etf.fondsvolumen
    ? (etf.fondsvolumen / 1e6).toFixed(0) + ' M EUR'   // bytes → millions
    : etf.assets_under_management
      ? etf.assets_under_management.toFixed(0) + ' M EUR'
      : null;

  const replication = [
    etf.replication_methodology_first_level,
    etf.replication_methodology_second_level,
  ].filter(Boolean).join(' — ') || null;

  return {
    name:             etf.fondname || null,
    isin:             etf.isin || null,
    ter:              etf.ter ?? etf.ongoing_charges ?? null,
    ter_date:         etf.ongoing_charges_date || null,
    fund_size:        aum,
    fund_size_raw:    etf.fondsvolumen || null,
    fund_size_date:   etf.fondsvolumen_date || null,
    launch_date:      etf.launch_date || null,
    distribution:     etf.distribution_policy || null,
    is_distributing:  etf.is_distributing ?? null,
    currency:         etf.fund_currency_id || etf.currency || null,
    domicile:         etf.fund_domicile || null,
    domicile_code:    etf.fund_domicile_code || null,
    replication,
    index_name:       etf.underlying_index_name || null,
    provider_name:    etf.provider_name || null,
    num_holdings:     etf.number_of_holding || null,
    dividend_yield:   etf.portfolio_dividendyield || null,
    is_hedged:        etf.is_hedged ?? false,
    hedged_currency:  etf.is_hedged_currency || null,
  };
}

// ── Normalize top holdings (portfolio_breakdown.items) ────────────────────────
function normalizeHoldings(etf) {
  const items = etf.portfolio_breakdown?.items || [];
  return items.slice(0, 10).map(item => ({
    name:    item.name || item.name_short || null,
    isin:    item.isin || null,
    weight:  item.weight != null ? Math.round(item.weight * 100) / 100 : null,
    country: item.country_name || item.country || null,
    sector:  item.stock_global_sector || null,
    type:    item.type || null,
  }));
}

// ── Public: fetchExtraETFAnnual (dividend validation) ─────────────────────────
async function fetchExtraETFAnnual(isin) {
  const cached = l1get('annual:' + isin);
  if (cached) return cached;

  try {
    const etf = await fetchRawDetail(isin);
    const raw = etf.sum_distribution || {};
    const annual = {};
    for (const [yr, val] of Object.entries(raw)) {
      const n = parseFloat(val);
      if (Number.isFinite(n) && n > 0) annual[yr] = Math.round(n * 10000) / 10000;
    }
    const result = { isin, annual, currency: etf.currency || 'EUR', source: 'extraetf', fetchedAt: new Date().toISOString() };
    l1set('annual:' + isin, result);
    return result;
  } catch (e) {
    console.warn(`[extraetf] annual fetch failed for ${isin}: ${e.message}`);
    return { isin, annual: {}, currency: 'EUR', source: 'extraetf_unavailable', fetchedAt: new Date().toISOString() };
  }
}

// ── Public: fetchETFProfile (overview + holdings) ─────────────────────────────
// L1 memory → L2 Supabase → live extraETF API
async function fetchETFProfile(isin) {
  // L1
  const l1 = l1get('profile:' + isin);
  if (l1) return l1;

  // L2: Supabase
  const db = await dbGetProfile(isin);
  if (db) {
    const result = { isin, overview: db.overview, holdings: db.holdings, source: 'supabase', fetchedAt: db.updatedAt };
    l1set('profile:' + isin, result);
    return result;
  }

  // Live fetch
  try {
    const etf = await fetchRawDetail(isin);
    const overview  = normalizeOverview(etf);
    const holdings  = normalizeHoldings(etf);
    const fetchedAt = new Date().toISOString();

    // Persist async (non-blocking)
    dbSaveProfile(isin, overview, holdings).catch(() => {});

    const result = { isin, overview, holdings, source: 'extraetf', fetchedAt };
    l1set('profile:' + isin, result);
    return result;
  } catch (e) {
    console.warn(`[extraetf] profile fetch failed for ${isin}: ${e.message}`);
    return { isin, overview: null, holdings: [], source: 'extraetf_unavailable', fetchedAt: new Date().toISOString(), error: e.message };
  }
}

// ── Public: validateAnnual ────────────────────────────────────────────────────
// Thresholds: <10% → validated | 10–20% → partially_validated | >20% → inconsistent
function validateAnnual(digrinTotal, extraetfTotal) {
  if (!extraetfTotal || extraetfTotal <= 0 || !digrinTotal || digrinTotal <= 0) {
    return { consistent: null, diffPct: null, status: 'unvalidated' };
  }
  const diffPct = Math.abs(digrinTotal - extraetfTotal) / extraetfTotal * 100;
  const diffPctRounded = Math.round(diffPct * 10) / 10;
  if (diffPct < 10) return { consistent: true,  diffPct: diffPctRounded, status: 'validated' };
  if (diffPct < 20) return { consistent: null,  diffPct: diffPctRounded, status: 'partially_validated' };
  return             { consistent: false, diffPct: diffPctRounded, status: 'inconsistent' };
}

module.exports = { fetchExtraETFAnnual, fetchETFProfile, validateAnnual };
