const { resolveAssetData } = require('../../lib/providers');

module.exports = async (req, res) => {
  try {
    const isins = req.query.isin
      ? String(req.query.isin).split(',').map((v) => v.trim()).filter(Boolean)
      : [];
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
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message }));
  }
};
