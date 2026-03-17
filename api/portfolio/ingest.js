// Batch ISIN ingestion endpoint
// Mirrors descargar_precios.py: loop over ISINs → fetch history → normalize → return summary
//
// GET  /api/portfolio/ingest?isin=IE00BYX5NK04,IE00B4ND3602
// POST /api/portfolio/ingest   body: { "isins": ["IE00BYX5NK04", ...] }
// Add ?refresh=1 to bypass cache

const { setupApi, validateIsins, readBody, sendError } = require('../../lib/security');
const { resolveAssetData } = require('../../lib/providers');
const { dbSaveHistory, isSupabaseEnabled } = require('../../lib/cache');
const portfolioProviders = require('../../portfolio-providers.json');

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 10 })) return;

  try {
    let isins = [];

    if (req.method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch (_) {
        return sendError(res, 413, 'Request body too large');
      }
      try {
        const parsed = JSON.parse(body || '{}');
        const raw = Array.isArray(parsed.isins) ? parsed.isins.join(',') : '';
        const { isins: validated, error } = validateIsins(raw);
        if (error) return sendError(res, 400, error);
        isins = validated;
      } catch (_) {
        return sendError(res, 400, 'Invalid JSON body');
      }
    } else if (req.query.isin) {
      const { isins: validated, error } = validateIsins(String(req.query.isin));
      if (error) return sendError(res, 400, error);
      isins = validated;
    } else {
      // Default: ingest all portfolio ISINs
      isins = portfolioProviders.assets.map(a => a.isin);
    }

    const skipCache = req.query.refresh === '1';
    const uniqueIsins = [...new Set(isins.filter(Boolean))];

    if (uniqueIsins.length === 0) return sendError(res, 400, 'No ISINs to ingest');

    const results = [];
    for (const isin of uniqueIsins) {
      const resolved = await resolveAssetData(isin, { skipCache });
      const history = Array.isArray(resolved.data?.history) ? resolved.data.history : [];
      const status = resolved.data?.coverage?.status || 'MISSING';

      let savedToDb = false;
      if (history.length > 10 && isSupabaseEnabled()) {
        const provider = resolved.data?.provider || 'unknown';
        savedToDb = await dbSaveHistory(isin, history, provider);
      }

      results.push({
        isin,
        name: resolved.position?.shortName || resolved.position?.name || resolved.mapping?.name || isin,
        status,
        provider: resolved.data?.provider || null,
        symbol: resolved.data?.symbol || null,
        resolvedAs: resolved.data?.resolvedAs || null,
        points: history.length,
        firstDate: history.length > 0 ? history[0].date : null,
        lastDate: history.length > 0 ? history[history.length - 1].date : null,
        lastClose: resolved.data?.quote?.close ?? resolved.data?.quote?.price ?? null,
        currency: resolved.data?.quote?.currency || null,
        savedToDb,
        error: resolved.error || null
      });
    }

    const summary = {
      total: results.length,
      ok:      results.filter(r => r.status === 'OK').length,
      partial: results.filter(r => r.status === 'PARTIAL').length,
      missing: results.filter(r => r.status === 'MISSING').length
    };

    res.statusCode = 200;
    res.end(JSON.stringify({ summary, results }, null, 2));
  } catch (error) {
    sendError(res, 500, 'Internal server error');
  }
};
