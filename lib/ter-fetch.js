// GET /api/ter/fetch?isin=IE00B4L5Y983,IE00BKM4GZ66,...
// Returns TER (Total Expense Ratio) for each ISIN.
// Source chain: extraETF → JustETF → Morningstar
// Response: { results: { "ISIN": 0.12, ... } }

const { setupApi, validateIsins } = require('./security');

const CACHE = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
function cGet(k) { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; }
function cSet(k, v) { CACHE.set(k, { v, x: Date.now() + CACHE_TTL }); }

const FETCH_HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

// ── Source 1: extraETF ────────────────────────────────────────────────────────
async function terFromExtraETF(isin) {
  const url = `https://extraetf.com/api-v2/detail/?isin=${encodeURIComponent(isin)}&lang=es`;
  const r = await fetch(url, {
    headers: { ...FETCH_HDR, 'Referer': `https://extraetf.com/es/etf-profile/${isin}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const etf = (data.results || [data])[0];
  if (!etf) return null;
  const ter = etf.ter ?? etf.ongoing_charges ?? null;
  if (ter != null && Number.isFinite(Number(ter)) && Number(ter) > 0) return Number(ter);
  return null;
}

// ── Source 2: JustETF ─────────────────────────────────────────────────────────
async function terFromJustETF(isin) {
  const url = `https://www.justetf.com/api/etfs?isin=${encodeURIComponent(isin)}&locale=en&currency=EUR`;
  const r = await fetch(url, {
    headers: { ...FETCH_HDR, 'Referer': `https://www.justetf.com/en/etf-profile.html?isin=${isin}` },
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const etf = (data.results || [])[0] || data;
  if (!etf) return null;
  // JustETF returns TER as percentage value (e.g. 0.12 for 0.12%)
  const ter = etf.ter ?? etf.totalExpenseRatio ?? etf.ter_pa ?? null;
  if (ter != null) {
    const n = Number(ter?.raw ?? ter);
    if (Number.isFinite(n) && n > 0 && n < 10) return n;
  }
  return null;
}

// ── Source 3: Morningstar screener ────────────────────────────────────────────
const MSTAR_TOKEN = '9vehuxllxs';
const MSTAR_HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.morningstar.es/',
};

async function terFromMorningstar(isin) {
  const dp = encodeURIComponent('SecId,OngoingCharge');
  const urls = [
    `https://tools.morningstar.es/api/rest.svc/${MSTAR_TOKEN}/security/screener?page=1&pageSize=3&sortOrder=LegalName+asc&outputType=json&version=1&languageId=es-ES&currencyId=EUR&securityDataPoints=${dp}&term=${encodeURIComponent(isin)}`,
    `https://tools.morningstar.es/api/rest.svc/${MSTAR_TOKEN}/security/screener?page=1&pageSize=3&sortOrder=LegalName+asc&outputType=json&version=1&languageId=es-ES&currencyId=EUR&universeIds=FOESP%24%24ALL%7CFOIRL%24%24ALL%7CFOLUX%24%24ALL%7CFODED%24%24ALL&securityDataPoints=${dp}&term=${encodeURIComponent(isin)}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: MSTAR_HDR, signal: AbortSignal.timeout(7000) });
      if (!r.ok) continue;
      const data = await r.json();
      const rows = data?.rows ?? data?.data ?? [];
      if (!Array.isArray(rows) || !rows.length) continue;
      const oc = rows[0]?.OngoingCharge;
      const n = parseFloat(oc);
      if (Number.isFinite(n) && n > 0) return n;
    } catch (_) {}
  }
  return null;
}

// ── Fetch TER for one ISIN with caching ───────────────────────────────────────
async function getTER(isin) {
  const cached = cGet(isin);
  if (cached !== null) return cached; // includes 0 values

  // Try sources in order
  let ter = await terFromExtraETF(isin).catch(() => null);
  if (ter == null) ter = await terFromJustETF(isin).catch(() => null);
  if (ter == null) ter = await terFromMorningstar(isin).catch(() => null);

  // Cache even null results to avoid repeated misses (shorter TTL for nulls)
  if (ter != null) {
    cSet(isin, ter);
  } else {
    CACHE.set(isin, { v: null, x: Date.now() + 24 * 60 * 60 * 1000 }); // 1 day for nulls
  }
  return ter;
}

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 20 })) return;

  const rawIsins = String(req.query?.isin || req.query?.isins || '');
  if (!rawIsins) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'isin param required' }));
  }

  const { isins, error } = validateIsins(rawIsins);
  if (error) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error }));
  }

  // Fetch all in parallel (max 10 at a time to avoid hammering sources)
  const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  const results = {};

  for (const batch of chunk(isins, 5)) {
    const batch_results = await Promise.all(batch.map(async isin => ({ isin, ter: await getTER(isin) })));
    batch_results.forEach(({ isin, ter }) => { results[isin] = ter; });
  }

  res.statusCode = 200;
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(JSON.stringify({ results }));
};
