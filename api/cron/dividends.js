// Nightly dividend prefetch cron — /api/cron/dividends
// Called by Vercel Cron at 00:30 UTC every day.
// Protected by CRON_SECRET (same mechanism as /api/cron/warmup).
//
// What it does:
//   1. Fetches all unique ISINs from Supabase user_positions
//   2. Calls fetchDividendHistory() in batches of 5 (same concurrency as detail.js)
//   3. Results are persisted by fetchDividendHistory's own Supabase cache layer
//   4. Subsequent calls to /api/dividends/detail hit warm caches → fast responses

const { isSupabaseEnabled } = require('../../lib/cache');
const { fetchDividendHistory } = require('../../lib/dividends');

async function getPortfolioIsins() {
  if (!isSupabaseEnabled()) return [];
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
    if (!r.ok) return [];
    const rows = await r.json();
    return [...new Set(rows.map(r => r.isin).filter(Boolean))];
  } catch (e) {
    console.error('[cron/dividends] Failed to fetch ISINs from Supabase:', e.message);
    return [];
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Auth — Vercel injects Authorization: Bearer <CRON_SECRET> automatically
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'CRON_SECRET not configured' }));
  }
  if ((req.headers['authorization'] || '') !== `Bearer ${secret}`) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  const started = Date.now();
  const isins = await getPortfolioIsins();

  if (!isins.length) {
    return res.end(JSON.stringify({ ok: true, message: 'No ISINs found in user_positions', processed: 0 }));
  }

  console.log(`[cron/dividends] Prefetching dividends for ${isins.length} ISINs`);

  let ok = 0, errors = 0;

  // Batches of 5 — same concurrency throttle as detail.js
  for (let i = 0; i < isins.length; i += 5) {
    const batch = isins.slice(i, i + 5);
    await Promise.all(
      batch.map(async isin => {
        try {
          await fetchDividendHistory(isin, { force: false });
          ok++;
        } catch (e) {
          console.error(`[cron/dividends] Error for ${isin}:`, e.message);
          errors++;
        }
      })
    );
  }

  const elapsed = Date.now() - started;
  console.log(`[cron/dividends] Done. ok=${ok} errors=${errors} elapsed=${elapsed}ms`);

  res.statusCode = 200;
  res.end(JSON.stringify({
    ok: true,
    ts: new Date().toISOString(),
    elapsed_ms: elapsed,
    processed: isins.length,
    success: ok,
    errors,
  }, null, 2));
};
