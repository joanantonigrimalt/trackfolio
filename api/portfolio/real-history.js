// Returns real historical price series for ALL portfolio assets
// Uses Yahoo (ISIN-direct) as primary source, falls back to EODHD/TwelveData
const portfolioProviders = require('../../portfolio-providers.json');
const { resolveAssetData } = require('../../lib/providers');

module.exports = async (req, res) => {
  try {
    const skipCache = req.query.refresh === '1';
    const results = [];

    for (const asset of portfolioProviders.assets) {
      try {
        const resolved = await resolveAssetData(asset.isin, { skipCache });
        const points = Array.isArray(resolved.data?.history) ? resolved.data.history : [];
        const status = resolved.data?.coverage?.status || 'MISSING';
        results.push({
          isin: asset.isin,
          name: asset.name,
          provider: resolved.data?.provider || null,
          symbol: resolved.data?.symbol || null,
          resolvedAs: resolved.data?.resolvedAs || null,
          status,
          points,
          error: resolved.error || null
        });
      } catch (err) {
        results.push({
          isin: asset.isin, name: asset.name, provider: null, symbol: null,
          resolvedAs: null, status: 'MISSING', points: [], error: err.message
        });
      }
    }

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
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message }));
  }
};
