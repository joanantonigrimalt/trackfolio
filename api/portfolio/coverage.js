const { setupApi, validateIsins, sendError } = require('../../lib/security');
const { resolveAssetData, resolveFromCache } = require('../../lib/providers');

// Wrap a promise with a per-asset timeout returning a MISSING result instead of throwing
function withTimeout(isin, promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve({
      isin, data: { coverage: { status: 'MISSING' }, provider: 'timeout', history: [] }, error: 'timeout',
    }), ms)),
  ]);
}

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 20 })) return;
  try {
    let isins = [];
    if (req.query.isin) {
      const { isins: validated, error } = validateIsins(String(req.query.isin));
      if (error) return sendError(res, 400, error);
      isins = validated;
    }
    const skipCache = req.query.refresh === '1';
    const uniqueIsins = [...new Set(isins)];

    // Phase 1: check L1 + Supabase cache (instant — no external API calls)
    const cacheResults = await Promise.all(uniqueIsins.map(isin => resolveFromCache(isin)));

    // Phase 2: for ISINs not in any cache, try live fetch with a tight per-asset timeout
    // Budget: Vercel Hobby = 10s limit; allow ~7s for live fetches (Phase 1 takes <1s)
    const PER_ASSET_TIMEOUT = 6500;
    const results = await Promise.all(
      uniqueIsins.map((isin, i) => {
        const cached = cacheResults[i];
        if (!skipCache && cached && cached.data?.coverage?.status !== 'MISSING') return cached; // already have data
        if (skipCache || !cached) {
          return withTimeout(isin, resolveAssetData(isin, { skipCache }), PER_ASSET_TIMEOUT);
        }
        return cached || { isin, data: { coverage: { status: 'MISSING' }, history: [] }, error: null };
      })
    );

    // Summary with OK / PARTIAL / MISSING counts
    const summary = {
      total: results.length,
      ok:      results.filter(r => r.data?.coverage?.status === 'OK').length,
      partial: results.filter(r => r.data?.coverage?.status === 'PARTIAL').length,
      missing: results.filter(r => !r.data || r.data?.coverage?.status === 'MISSING').length
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ summary, results }, null, 2));
  } catch (error) {
    sendError(res, 500, 'Internal server error');
  }
};
