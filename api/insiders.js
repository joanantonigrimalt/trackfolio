// GET /api/insiders?symbol=AAPL
//
// Server-side proxy for FMP insider-trading endpoint.
// - Keeps FMP_API_KEY off the client (was previously hardcoded in index.html)
// - Adds 6-hour in-memory cache per symbol
// - Returns same shape as FMP /stable/insider-trading/search
//
// X-Cache: HIT | MISS for observability

const { setupApi } = require('../lib/security');
const { getCache, setCache } = require('../lib/cache');

const TTL_INSIDERS = 6 * 60 * 60; // 6 hours

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 20 })) return;

  const symbol = String(req.query?.symbol || '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 20);
  const page   = Math.max(0, parseInt(req.query?.page || '0', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query?.limit || '100', 10)));

  const cacheKey = `insiders:${symbol || 'all'}:p${page}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.statusCode = 200;
    return res.end(JSON.stringify(cached));
  }

  res.setHeader('X-Cache', 'MISS');

  const key = process.env.FMP_API_KEY;
  if (!key) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'FMP API key not configured', data: [] }));
  }

  try {
    const sym  = symbol ? `&symbol=${encodeURIComponent(symbol)}` : '';
    const url  = `https://financialmodelingprep.com/stable/insider-trading/search?page=${page}&limit=${limit}${sym}&apikey=${key}`;
    const r    = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`FMP HTTP ${r.status}`);
    const data = await r.json();

    setCache(cacheKey, data, TTL_INSIDERS);
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (e) {
    console.error('[insiders] fetch error:', e.message);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e.message, data: [] }));
  }
};
