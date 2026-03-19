// GET /api/insiders?symbol=AAPL  → transactions for a specific ticker
// GET /api/insiders               → discovery: combined recent data from Supabase cache
//
// Provider chain: L1 (memory) → L2 (Supabase) → Finnhub (fast) → SEC EDGAR (free fallback)
// Discovery auto-seeds AAPL+MSFT+JPM on first call if Supabase is empty and Finnhub is configured.

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
      let all = await dbGetAllInsiders();

      // If Supabase empty and Finnhub configured: seed inline (fast, ~600ms for 3 stocks)
      if (!all && process.env.FINNHUB_API_KEY) {
        for (const sym of DISCOVERY_SEED) {
          await fetchInsidersForSymbol(sym).catch(() => {});
        }
        all = await dbGetAllInsiders();
      }

      res.setHeader('X-Cache', all ? 'L2-HIT' : 'MISS');
      res.statusCode = 200;
      return res.end(JSON.stringify(all || []));
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
