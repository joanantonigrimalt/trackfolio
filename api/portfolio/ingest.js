// Batch ISIN ingestion endpoint
// Mirrors descargar_precios.py: loop over ISINs → fetch history → normalize → return summary
//
// GET  /api/portfolio/ingest?isin=IE00BYX5NK04,IE00B4ND3602
// POST /api/portfolio/ingest   body: { "isins": ["IE00BYX5NK04", ...] }
// Add ?refresh=1 to bypass cache

const { resolveAssetData } = require('../../lib/providers');
const { dbSaveHistory, isSupabaseEnabled } = require('../../lib/cache');
const portfolioProviders = require('../../portfolio-providers.json');

module.exports = async (req, res) => {
  try {
    let isins = [];

    if (req.method === 'POST') {
      let body = '';
      await new Promise((resolve) => { req.on('data', c => (body += c)); req.on('end', resolve); });
      try {
        const parsed = JSON.parse(body || '{}');
        isins = Array.isArray(parsed.isins) ? parsed.isins : [];
      } catch (_) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    } else if (req.query.isin) {
      isins = String(req.query.isin).split(',').map(v => v.trim()).filter(Boolean);
    } else {
      // Default: ingest all portfolio ISINs
      isins = portfolioProviders.assets.map(a => a.isin);
    }

    const skipCache = req.query.refresh === '1';
    const uniqueIsins = [...new Set(isins.filter(Boolean))];

    if (uniqueIsins.length === 0) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'No ISINs to ingest' }));
    }

    const results = [];
    for (const isin of uniqueIsins) {
      const resolved = await resolveAssetData(isin, { skipCache });
      const history = Array.isArray(resolved.data?.history) ? resolved.data.history : [];
      const status = resolved.data?.coverage?.status || 'MISSING';

      // Explicitly await Supabase write (fire-and-forget in providers.js is unreliable
      // in serverless — this endpoint guarantees the data is persisted before responding)
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
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ summary, results }, null, 2));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message }));
  }
};
