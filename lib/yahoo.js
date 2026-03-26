// Yahoo Finance client — ISIN-first, with in-process cache
// Mirrors the Python script: yf.Ticker(isin).history(...)

const CACHE = new Map(); // key → { data, expiresAt }
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — survives warm serverless invocations

function cacheGet(key) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { CACHE.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) {
  CACHE.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Fetch chart data for a symbol (ticker or ISIN)
async function yahooChart(symbol, range = '5y', interval = '1d') {
  const cacheKey = `chart:${symbol}:${range}:${interval}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Try v8 first, fall back to v8/finance/chart on query2
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
  ];

  let lastErr;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok || data?.chart?.error) {
        const msg = data?.chart?.error?.description || data?.chart?.error?.code || `Yahoo HTTP ${response.status}`;
        lastErr = new Error(msg);
        continue;
      }
      const result = data.chart.result?.[0];
      if (!result) { lastErr = new Error('No Yahoo chart result'); continue; }

      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      const points = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = Number(closes[i]);
        if (!Number.isFinite(close) || close <= 0) continue;
        points.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), close });
      }

      const out = {
        symbol,
        price: Number(result.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? null),
        currency: result.meta?.currency || null,
        longName: result.meta?.longName || result.meta?.shortName || null,
        points
      };
      if (points.length > 0) cacheSet(cacheKey, out);
      return out;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Yahoo chart failed for ${symbol}`);
}

// Search Yahoo Finance for a query string (ISIN, name, ticker)
async function yahooSearch(query) {
  const cacheKey = `search:${query}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Yahoo search HTTP ${response.status}`);
  const results = data.quotes || [];
  cacheSet(cacheKey, results);
  return results;
}

// Main ISIN resolution function — mirrors descargar_precios.py logic:
// 1. Try ISIN directly (works for many UCITS ETFs/ETCs)
// 2. Try known yahooSymbol from providers config
// 3. Search by ISIN and try best hit
async function yahooByIsin(isin, fallbackSymbol = null, range = '5y') {
  // 1. ISIN direct
  try {
    const result = await yahooChart(isin, range);
    if (result.points.length > 10) return { ...result, resolvedAs: 'isin_direct' };
  } catch (_) { /* try next */ }

  // 2. Known fallback symbol
  if (fallbackSymbol) {
    try {
      const result = await yahooChart(fallbackSymbol, range);
      if (result.points.length > 10) return { ...result, resolvedAs: 'yahoo_symbol' };
    } catch (_) { /* try next */ }
  }

  // 3. Search ISIN and try best matching symbol — prefer European exchanges over USD ones
  try {
    const hits = await yahooSearch(isin);
    const eligible = hits.filter(h =>
      h.quoteType === 'ETF' || h.quoteType === 'ETC' ||
      h.quoteType === 'MUTUALFUND' || h.quoteType === 'EQUITY'
    );
    // Euro/European exchange suffixes — strongly prefer these to avoid USD cross-listings
    const EURO_SUFFIXES = ['.AS', '.DE', '.PA', '.MI', '.MC', '.BR', '.ST', '.HE', '.OL', '.CO', '.VI', '.LS', '.WA', '.AT', '.F', '.SG', '.BE', '.MU', '.DU', '.HA', '.TH'];
    const euroHit = eligible.find(h => EURO_SUFFIXES.some(s => (h.symbol || '').toUpperCase().endsWith(s)));
    const best = euroHit || eligible[0] || hits[0];
    if (best?.symbol) {
      try {
        const result = await yahooChart(best.symbol, range);
        if (result.points.length > 10) return { ...result, resolvedAs: 'search', foundSymbol: best.symbol };
      } catch (_) { /* exhausted */ }
    }
  } catch (_) { /* search failed */ }

  return null;
}

module.exports = { yahooChart, yahooSearch, yahooByIsin };
