// JustETF price and NAV data by ISIN
// Public API endpoint discovered from JustETF's web app.
// Covers 3000+ European ETFs and ETCs with daily NAV in EUR.
//
// Public: fetchJustETFQuote(isin, currency?) → { price, currency, date, name } or null

const CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function cacheGet(k) { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; }
function cacheSet(k, v) { CACHE.set(k, { v, x: Date.now() + CACHE_TTL }); }

async function fetchJustETFQuote(isin, currency = 'EUR') {
  const key = `justetf:${isin}:${currency}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const url = `https://www.justetf.com/api/etfs?isin=${encodeURIComponent(isin)}&locale=en&currency=${currency}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': `https://www.justetf.com/en/etf-profile.html?isin=${isin}`,
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`JustETF HTTP ${res.status}`);
    const data = await res.json();
    const etf = (data.results || [])[0] || data;
    if (!etf) throw new Error('JustETF: empty result');

    // Price: prefer intraday, fall back to NAV
    const price =
      etf.lastQuote?.raw ??
      etf.nav?.raw ??
      etf.price?.raw ??
      etf.close?.raw ??
      null;

    const priceCurrency =
      etf.lastQuote?.currency ??
      etf.nav?.currency ??
      etf.currency ??
      currency;

    const date =
      etf.lastQuote?.date ??
      etf.nav?.date ??
      etf.referenceDate ??
      null;

    if (!Number.isFinite(price) || price <= 0) throw new Error('JustETF: no valid price');

    const result = { isin, name: etf.name || etf.ticker || isin, price, currency: priceCurrency, date, source: 'justetf' };
    cacheSet(key, result);
    return result;
  } catch (e) {
    console.warn(`[justetf] ${isin}: ${e.message}`);
    return null;
  }
}

module.exports = { fetchJustETFQuote };
