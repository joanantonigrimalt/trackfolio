// Returns real historical price series for ALL portfolio assets
// Uses Yahoo (ISIN-direct) as primary source, falls back to EODHD/TwelveData
const { setupApi, sendError } = require('../../lib/security');
const portfolioProviders = require('../../portfolio-providers.json');
const { resolveAssetData } = require('../../lib/providers');

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 10 })) return;
  const requestedAt = new Date().toISOString();
  try {
    const skipCache = req.query.refresh === '1';

    const results = await Promise.all(portfolioProviders.assets.map(async asset => {
      const assetStart = Date.now();
      try {
        const resolved = await resolveAssetData(asset.isin, { skipCache });
        const points = Array.isArray(resolved.data?.history) ? resolved.data.history : [];
        const status = resolved.data?.coverage?.status || 'MISSING';
        // Data age: compare last point date to today
        const lastPoint = points.length > 0 ? points[points.length - 1]?.date : null;
        const firstPoint = points.length > 0 ? points[0]?.date : null;
        const dataAgeHours = lastPoint
          ? Math.round((Date.now() - new Date(lastPoint).getTime()) / 3600000)
          : null;
        const spanDays = (lastPoint && firstPoint)
          ? Math.round((new Date(lastPoint).getTime() - new Date(firstPoint).getTime()) / 86400000)
          : 0;
        return {
          isin: asset.isin,
          name: asset.name,
          provider: resolved.data?.provider || null,
          symbol: resolved.data?.symbol || null,
          resolvedAs: resolved.data?.resolvedAs || null,
          status,
          fromCache: resolved.data?.resolvedAs === 'db_cache',
          pointCount: points.length,
          spanDays,
          lastPointDate: lastPoint,
          dataAgeHours,
          fetchedAt: new Date().toISOString(),
          fetchMs: Date.now() - assetStart,
          points,
          error: resolved.error || null
        };
      } catch (e) {
        return {
          isin: asset.isin, name: asset.name, provider: null, symbol: null,
          resolvedAs: null, status: 'MISSING', fromCache: false,
          pointCount: 0, spanDays: 0, lastPointDate: null, dataAgeHours: null,
          fetchedAt: new Date().toISOString(), fetchMs: Date.now() - assetStart,
          points: [], error: e.message || 'fetch_failed'
        };
      }
    }));

    const summary = {
      total:   results.length,
      ok:      results.filter(r => r.status === 'OK').length,
      partial: results.filter(r => r.status === 'PARTIAL').length,
      missing: results.filter(r => r.status === 'MISSING').length,
      fromCache: results.filter(r => r.fromCache).length,
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ requestedAt, summary, results }, null, 2));
  } catch (error) {
    sendError(res, 500, 'Internal server error');
  }
};
