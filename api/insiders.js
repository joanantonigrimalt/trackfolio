// GET /api/insiders?symbol=AAPL  → transactions for a specific ticker
// GET /api/insiders               → discovery: buys/sells for seed stocks
//
// Provider chain: L1 (memory) → L2 (Supabase) → Finnhub → SEC EDGAR
// Discovery always fetches the seed stocks specifically — ignores dbGetAllInsiders
// to avoid showing stale cached data for wrong symbols.

const { setupApi } = require('../lib/security');
const { fetchInsidersForSymbol } = require('../lib/insiders');

// Fixed seed for discovery view — well-known stocks with active insider trading
const DISCOVERY_SEED = ['AAPL', 'MSFT', 'JPM', 'NVDA', 'META'];

// Company names to enrich Finnhub data (which doesn't return companyName)
const COMPANY_NAMES = {
  AAPL: 'Apple Inc.', MSFT: 'Microsoft Corp.', JPM: 'JPMorgan Chase',
  NVDA: 'NVIDIA Corp.', META: 'Meta Platforms', TSLA: 'Tesla Inc.',
  GOOGL: 'Alphabet Inc.', AMZN: 'Amazon.com', V: 'Visa Inc.',
  WMT: 'Walmart Inc.', BAC: 'Bank of America', XOM: 'Exxon Mobil',
};

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 30 })) return;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const symbol = String(req.query?.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

  // ── Discovery mode (no symbol) ────────────────────────────────────────────
  // Always fetch seed stocks through L1→L2→Finnhub chain.
  // This avoids stale/wrong symbols that may be cached in dbGetAllInsiders.
  if (!symbol) {
    try {
      const fetched = [];
      for (const sym of DISCOVERY_SEED) {
        const { data } = await fetchInsidersForSymbol(sym).catch(() => ({ data: [] }));
        if (Array.isArray(data)) {
          // Enrich with company name if missing (Finnhub doesn't include it)
          const name = COMPANY_NAMES[sym] || sym;
          fetched.push(...data.map(t => t.companyName ? t : { ...t, companyName: name }));
        }
      }
      const result = fetched
        .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
        .slice(0, 300);
      res.setHeader('X-Cache', 'MISS');
      res.statusCode = 200;
      return res.end(JSON.stringify(result));
    } catch (e) {
      console.error('[insiders] discovery error:', e.message);
      res.statusCode = 200;
      return res.end(JSON.stringify([]));
    }
  }

  // ── Symbol mode: L1 → L2 → Finnhub → SEC EDGAR ───────────────────────────
  try {
    const { data, source } = await fetchInsidersForSymbol(symbol);
    // Enrich with company name if known
    const name = COMPANY_NAMES[symbol];
    const enriched = name
      ? data.map(t => t.companyName ? t : { ...t, companyName: name })
      : data;
    res.setHeader('X-Cache', source === 'l1' ? 'L1-HIT' : source === 'l2' ? 'L2-HIT' : 'MISS');
    res.statusCode = 200;
    res.end(JSON.stringify(enriched));
  } catch (e) {
    console.error('[insiders] fetch error:', e.message);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e.message, data: [] }));
  }
};
