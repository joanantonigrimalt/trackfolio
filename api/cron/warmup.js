// Daily warmup cron — called by Vercel Cron at 07:00 UTC
// Resolves all portfolio ISINs to pre-populate L1 cache + persist to Supabase
// Protected by CRON_SECRET env var (set in Vercel dashboard)
//
// Schedule: every day at 07:00 UTC (configured in vercel.json)

const portfolioSeed = require('../../portfolio-seed.json');
const { resolveAssetData } = require('../_lib/providers');

module.exports = async (req, res) => {
  // Verify cron secret (Vercel sets Authorization header automatically for crons)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${secret}`) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  const isins = portfolioSeed.positions.map(p => p.isin);
  const results = [];
  const started = Date.now();

  for (const isin of isins) {
    try {
      const r = await resolveAssetData(isin, { skipCache: true });
      results.push({
        isin,
        status: r.data?.coverage?.status || 'MISSING',
        pts: Array.isArray(r.data?.history) ? r.data.history.length : 0,
        provider: r.data?.provider || null
      });
    } catch (err) {
      results.push({ isin, status: 'ERROR', error: err.message });
    }
  }

  const elapsed = Date.now() - started;
  const ok = results.filter(r => r.status === 'OK').length;
  const missing = results.filter(r => r.status === 'MISSING' || r.status === 'ERROR').length;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ts: new Date().toISOString(),
    elapsed_ms: elapsed,
    summary: { total: isins.length, ok, missing },
    results
  }, null, 2));
};
