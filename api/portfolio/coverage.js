const { setupApi, validateIsins, sendError } = require('../../lib/security');
const { resolveAssetData } = require('../../lib/providers');

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

    // Run in parallel — sequential was causing Vercel timeout with large portfolios
    const results = await Promise.all(
      uniqueIsins.map(isin => resolveAssetData(isin, { skipCache }))
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
