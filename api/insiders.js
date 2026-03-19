// GET /api/insiders?symbol=AAPL  → transactions for a specific ticker
// GET /api/insiders               → discovery: combined recent insider data
//
// Provider chain: L1 (memory) → L2 (Supabase) → Finnhub → SEC EDGAR
// Discovery: Supabase cache first; if empty, fetches seed stocks directly from
// Finnhub and returns the data immediately (no Supabase round-trip required).

const { setupApi } = require('../lib/security');
const { dbGetAllInsiders } = require('../lib/cache');
const { fetchInsidersForSymbol } = require('../lib/insiders');

const DISCOVERY_SEED = ['AAPL', 'MSFT', 'JPM'];

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 30 })) return;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const symbol = String(req.query?.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

  // ── Discovery mode (no symbol) ────────────────────────────────────────────
  if (!symbol) {
    try {
      // 1. Try Supabase cache (fast return if warm)
      const cached = await dbGetAllInsiders();
      if (cached) {
        res.setHeader('X-Cache', 'L2-HIT');
        res.statusCode = 200;
        return res.end(JSON.stringify(cached));
      }

      // 2. Cache miss — fetch seed stocks directly and return data immediately
      //    (Supabase saves happen inside fetchInsidersForSymbol as a side effect)
      if (process.env.FINNHUB_API_KEY) {
        const fetched = [];
        for (const sym of DISCOVERY_SEED) {
          const { data } = await fetchInsidersForSymbol(sym).catch(() => ({ data: [] }));
          if (Array.isArray(data)) fetched.push(...data);
        }
        if (fetched.length > 0) {
          const result = fetched
            .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
            .slice(0, 300);
          res.setHeader('X-Cache', 'MISS');
          res.statusCode = 200;
          return res.end(JSON.stringify(result));
        }
      }

      res.setHeader('X-Cache', 'MISS');
      res.statusCode = 200;
      return res.end(JSON.stringify([]));
    } catch (e) {
      console.error('[insiders] discovery error:', e.message);
      res.statusCode = 200;
      return res.end(JSON.stringify([]));
    }
  }

  // ── Symbol mode: L1 → L2 → Finnhub → SEC EDGAR ───────────────────────────
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
