// GET /api/etf/profile?isin=DE000A0F5UH1[,IE00B9CQXS71,...]
//
// Returns normalized ETF profile (overview + top holdings) from extraETF.
// Cache chain: L1 memory (24h) → L2 Supabase etf_profiles (7d) → live extraETF API
//
// Response:
//   { results: [{ isin, overview, holdings, source, fetchedAt, error? }] }

const portfolioSeed = require('../../portfolio-seed.json');
const { fetchETFProfile } = require('../../lib/extraetf');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rawIsins = String(req.query?.isin || req.query?.isins || '');
  const force = req.query?.force === '1';

  const isins = rawIsins
    ? rawIsins.split(',').map(s => s.trim()).filter(Boolean)
    : portfolioSeed.positions.map(p => p.isin);

  // Run in parallel — extraETF API is fast and we have L1/L2 cache
  const results = await Promise.all(
    isins.map(async isin => {
      try {
        return await fetchETFProfile(isin, { force });
      } catch (e) {
        return { isin, overview: null, holdings: [], source: 'error', error: e.message, fetchedAt: new Date().toISOString() };
      }
    })
  );

  res.statusCode = 200;
  res.end(JSON.stringify({ results }, null, 2));
};
