// Returns real historical price series for ALL portfolio assets
// Uses Yahoo (ISIN-direct) as primary source, falls back to EODHD/TwelveData
const { setupApi, sendError } = require('../../lib/security');
const portfolioProviders = require('../../portfolio-providers.json');
const { resolveAssetData } = require('../../lib/providers');

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 10 })) return;
  try {
    const skipCache = req.query.refresh === '1';

    const results = await Promise.all(portfolioProviders.assets.map(async asset => {
      try {
        const resolved = await resolveAssetData(asset.isin, { skipCache });
        const points = Array.isArray(resolved.data?.history) ? resolved.data.history : [];
        const status = resolved.data?.coverage?.status || 'MISSING';
        return {
          isin: asset.isin,
          name: asset.name,
          provider: resolved.data?.provider || null,
          symbol: resolved.data?.symbol || null,
          resolvedAs: resolved.data?.resolvedAs || null,
          status,
          points,
          error: resolved.error || null
        };
      } catch {
        return {
          isin: asset.isin, name: asset.name, provider: null, symbol: null,
          resolvedAs: null, status: 'MISSING', points: [], error: 'fetch_failed'
        };
      }
    }));

    const summary = {
      total: results.length,
      ok:      results.filter(r => r.status === 'OK').length,
      partial: results.filter(r => r.status === 'PARTIAL').length,
      missing: results.filter(r => r.status === 'MISSING').length
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ summary, results }, null, 2));
  } catch (error) {
    sendError(res, 500, 'Internal server error');
  }
};
