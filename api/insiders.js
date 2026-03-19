// GET /api/insiders?symbol=AAPL  → transactions for a specific ticker
// GET /api/insiders               → discovery: combined recent data from Supabase cache
//
// Data source: SEC EDGAR Form 4 filings (free, official, no API key needed).
// Cache: L1 in-memory (6h) → L2 Supabase insider_cache → SEC EDGAR live fetch.

const { setupApi } = require('../lib/security');
const { dbGetAllInsiders } = require('../lib/cache');
const { fetchInsidersForSymbol } = require('../lib/insiders');

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 30 })) return;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const symbol = String(req.query?.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

  // ── Discovery mode (no symbol): return combined data from all cached symbols ─
  if (!symbol) {
    try {
      const all = await dbGetAllInsiders();
      res.setHeader('X-Cache', all ? 'L2-HIT' : 'MISS');
      res.statusCode = 200;
      return res.end(JSON.stringify(all || []));
    } catch (e) {
      console.error('[insiders] discovery error:', e.message);
      res.statusCode = 200;
      return res.end(JSON.stringify([]));
    }
  }

  // ── Symbol mode: L1 → L2 → SEC EDGAR ─────────────────────────────────────
  try {
    const { data, source } = await fetchInsidersForSymbol(symbol);
    res.setHeader('X-Cache', source === 'l1' ? 'L1-HIT' : source === 'l2' ? 'L2-HIT' : 'MISS');
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (e) {
    console.error('[insiders] fetch error:', e.message);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e.message, data: [] }));
  }
};
