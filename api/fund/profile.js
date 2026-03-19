// GET /api/fund/profile?isin=ES0146309002[,ES0112611001,...]
// Returns fund profile (overview + holdings) from Morningstar

const { setupApi, validateIsins } = require('../../lib/security');
const { fetchFundProfile } = require('../../lib/fundProfile');

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 30 })) return;

  const rawIsins = String(req.query?.isin || req.query?.isins || '');
  if (!rawIsins) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'isin required' })); }

  const { isins, error } = validateIsins(rawIsins);
  if (error) { res.statusCode = 400; return res.end(JSON.stringify({ error })); }

  const results = await Promise.all(isins.map(isin => fetchFundProfile(isin).catch(e => ({
    isin, overview: null, holdings: [], source: 'error', error: e.message, fetchedAt: new Date().toISOString()
  }))));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ results }, null, 2));
};
