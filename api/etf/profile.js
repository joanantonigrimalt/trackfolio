// GET /api/etf/profile?isin=DE000A0F5UH1[,IE00B9CQXS71,...]
// Also handles /api/fund/profile (rewritten by vercel.json) — falls back to Morningstar.
//
// Returns normalized ETF or fund profile (overview + top holdings).
// Cache chain: L1 memory (24h) → L2 Supabase etf_profiles (7d) → live extraETF / Morningstar
//
// Response:
//   { results: [{ isin, overview, holdings, source, fetchedAt, error? }] }

const { setupApi, validateIsins } = require('../../lib/security');
const portfolioSeed = require('../../portfolio-seed.json');
const { fetchETFProfile } = require('../../lib/extraetf');
const { fetchFundProfile } = require('../../lib/fundProfile');

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 30 })) return;

  const rawIsins = String(req.query?.isin || req.query?.isins || '');
  const force = req.query?.force === '1';

  let isins;
  if (rawIsins) {
    const { isins: validated, error } = validateIsins(rawIsins);
    if (error) { res.statusCode = 400; return res.end(JSON.stringify({ error })); }
    isins = validated;
  } else {
    isins = portfolioSeed.positions.map(p => p.isin);
  }

  // Run in parallel — try extraETF first; fall back to Morningstar for funds
  const results = await Promise.all(
    isins.map(async isin => {
      try {
        const r = await fetchETFProfile(isin, { force });
        // If extraETF returned no meaningful data, fall back to fund profile
        if (!r || r.error || !r.overview) {
          try { return await fetchFundProfile(isin); } catch (_) {}
        }
        return r;
      } catch (_) {
        try { return await fetchFundProfile(isin); } catch (e) {
          return { isin, overview: null, holdings: [], source: 'error', error: 'fetch_failed', fetchedAt: new Date().toISOString() };
        }
      }
    })
  );

  res.statusCode = 200;
  res.end(JSON.stringify({ results }, null, 2));
};
