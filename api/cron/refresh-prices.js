// GET /api/cron/refresh-prices  — daily background price refresh (Vercel Cron)
//
// Warms the Supabase price cache so users see fresh EOD prices without waiting
// for a lazy live fetch. Refreshes the seed portfolio plus every ISIN already
// tracked in assets_metadata, within a time budget (Vercel function limit).
//
// Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` on scheduled runs
// when CRON_SECRET is configured. Requests without it are rejected.

const { resolveAssetData } = require('../../lib/providers');
const portfolioSeed = require('../../portfolio-seed.json');

async function fetchTrackedIsins() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const r = await fetch(`${url}/rest/v1/assets_metadata?select=isin`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows.map(x => x && x.isin).filter(Boolean) : [];
  } catch { return []; }
}

module.exports = async (req, res) => {
  // ── Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  const auth = req.headers['authorization'] || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const started = Date.now();
  const BUDGET_MS   = Number(process.env.CRON_BUDGET_MS || 50000); // leave headroom under maxDuration
  const CONCURRENCY = 4;

  const seedIsins = (portfolioSeed.positions || []).map(p => p.isin).filter(Boolean);
  const tracked   = await fetchTrackedIsins();
  const isins     = [...new Set([...seedIsins, ...tracked])];

  let idx = 0, processed = 0, refreshed = 0;
  async function worker() {
    while (idx < isins.length && (Date.now() - started) < BUDGET_MS) {
      const isin = isins[idx++];
      try {
        const r = await resolveAssetData(isin, { skipCache: true }); // fetches live + persists to Supabase
        if (r && r.data && r.data.coverage && r.data.coverage.status !== 'MISSING') refreshed++;
      } catch { /* keep going */ }
      processed++;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const remaining = isins.length - processed;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    ok: true,
    total: isins.length,
    processed,
    refreshed,
    remaining,
    elapsedMs: Date.now() - started,
    // No silent truncation: if the budget was hit, say how many were skipped.
    note: remaining > 0
      ? `Time budget reached — ${remaining} ISIN(s) not refreshed this run.`
      : 'All tracked ISINs refreshed.',
  }));
};
