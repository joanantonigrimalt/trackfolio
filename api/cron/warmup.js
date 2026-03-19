// Daily warmup cron — called by Vercel Cron at 07:00 UTC
// 1. Resolves all portfolio ISINs → pre-populates L1 cache + persists to Supabase
// 2. Prefetches dividend history for all user ISINs from Supabase (nightly warm-up)
// Protected by CRON_SECRET env var (set in Vercel dashboard)
//
// Schedule: every day at 07:00 UTC (configured in vercel.json)

const portfolioSeed = require('../../portfolio-seed.json');
const { resolveAssetData } = require('../../lib/providers');
const { fetchDividendHistory } = require('../../lib/dividends');
const { isSupabaseEnabled } = require('../../lib/cache');

// Fetch all unique ISINs across all user portfolios in Supabase
async function getAllPortfolioIsins() {
  if (!isSupabaseEnabled()) return portfolioSeed.positions.map(p => p.isin);
  try {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/user_positions?select=isin`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!r.ok) return portfolioSeed.positions.map(p => p.isin);
    const rows = await r.json();
    const fromDb = [...new Set(rows.map(r => r.isin).filter(Boolean))];
    // Merge with seed ISINs as fallback
    const seedIsins = portfolioSeed.positions.map(p => p.isin);
    return [...new Set([...fromDb, ...seedIsins])];
  } catch (e) {
    console.error('[cron/warmup] Failed to fetch ISINs from Supabase:', e.message);
    return portfolioSeed.positions.map(p => p.isin);
  }
}

module.exports = async (req, res) => {
  // Verify cron secret (Vercel sets Authorization header automatically for crons)
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'CRON_SECRET not configured' }));
  }
  if ((req.headers['authorization'] || '') !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  const started = Date.now();
  const isins = await getAllPortfolioIsins();

  // ── Phase 1: price history warmup ──────────────────────────────────────────
  const priceResults = [];
  for (const isin of isins) {
    try {
      const r = await resolveAssetData(isin, { skipCache: true });
      priceResults.push({
        isin,
        status: r.data?.coverage?.status || 'MISSING',
        pts: Array.isArray(r.data?.history) ? r.data.history.length : 0,
        provider: r.data?.provider || null,
      });
    } catch (_) {
      priceResults.push({ isin, status: 'ERROR' });
    }
  }

  // ── Phase 2: dividend history prefetch (batches of 5) ─────────────────────
  let divOk = 0, divErrors = 0;
  for (let i = 0; i < isins.length; i += 5) {
    const batch = isins.slice(i, i + 5);
    await Promise.all(
      batch.map(async isin => {
        try { await fetchDividendHistory(isin, { force: false }); divOk++; }
        catch (e) { console.error(`[cron/warmup] div error ${isin}:`, e.message); divErrors++; }
      })
    );
  }

  const elapsed = Date.now() - started;
  const priceOk = priceResults.filter(r => r.status === 'OK').length;
  const priceMissing = priceResults.filter(r => r.status === 'MISSING' || r.status === 'ERROR').length;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ts: new Date().toISOString(),
    elapsed_ms: elapsed,
    price: { total: isins.length, ok: priceOk, missing: priceMissing },
    dividends: { ok: divOk, errors: divErrors },
    results: priceResults,
  }, null, 2));
};
