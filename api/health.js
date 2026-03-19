// GET /api/health
// Returns real-time status of every data provider used by Finasset.
// Safe to call from the frontend to show a "data source status" panel.

const { setupApi } = require('../lib/security');

const TIMEOUT = 6000;

async function check(name, fn) {
  const start = Date.now();
  try {
    const ok = await fn();
    return { name, status: ok ? 'ok' : 'degraded', latencyMs: Date.now() - start };
  } catch (e) {
    return { name, status: 'down', latencyMs: Date.now() - start, error: e.message?.slice(0, 120) };
  }
}

// ── Provider checks ───────────────────────────────────────────────────────────

async function checkYahoo() {
  const r = await fetch(
    'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=1d',
    { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) }
  );
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const d = await r.json();
  return !!(d?.chart?.result?.[0]?.meta?.regularMarketPrice);
}

async function checkEodhd() {
  const key = process.env.EODHD_API_KEY || process.env.EODHD_API_KEY_2
    || process.env.EODHD_API_KEY_3 || process.env.EODHD_API_KEY_4;
  if (!key) return false; // no key configured
  const r = await fetch(
    `https://eodhd.com/api/real-time/AAPL.US?api_token=${key}&fmt=json`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );
  if (!r.ok) throw new Error(`EODHD HTTP ${r.status}`);
  const d = await r.json();
  return Number.isFinite(Number(d?.close));
}

async function checkTwelveData() {
  const key = process.env.TWELVEDATA_API_KEY || process.env.TWELVEDATA_API_KEY_2
    || process.env.TWELVEDATA_API_KEY_3 || process.env.TWELVEDATA_API_KEY_4;
  if (!key) return false; // no key configured
  const r = await fetch(
    `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${key}`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );
  if (!r.ok) throw new Error(`TwelveData HTTP ${r.status}`);
  const d = await r.json();
  return !d.code && Number.isFinite(Number(d?.close));
}

async function checkFmp() {
  const key = process.env.FMP_API_KEY;
  if (!key) return false;
  const r = await fetch(
    `https://financialmodelingprep.com/stable/quote?symbol=AAPL&apikey=${key}`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );
  if (!r.ok) throw new Error(`FMP HTTP ${r.status}`);
  const d = await r.json();
  const item = Array.isArray(d) ? d[0] : d;
  return Number.isFinite(Number(item?.price));
}

async function checkExtraETF() {
  const r = await fetch(
    'https://extraetf.com/api-v2/detail/?isin=IE00BYX5NK04&lang=en',
    {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT),
    }
  );
  if (!r.ok) throw new Error(`extraETF HTTP ${r.status}`);
  const d = await r.json();
  return !!(d?.results?.[0]?.isin || d?.isin);
}

async function checkSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return false;
  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/price_history?select=isin&limit=1`,
    {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
      signal: AbortSignal.timeout(TIMEOUT),
    }
  );
  return r.ok;
}

async function checkFrankfurter() {
  const r = await fetch('https://api.frankfurter.app/latest?from=GBP&to=EUR', {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) throw new Error(`Frankfurter HTTP ${r.status}`);
  const d = await r.json();
  return Number.isFinite(Number(d?.rates?.EUR));
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 10 })) return;

  const checkedAt = new Date().toISOString();

  const results = await Promise.all([
    check('yahoo',      checkYahoo),
    check('eodhd',      checkEodhd),
    check('twelvedata', checkTwelveData),
    check('fmp',        checkFmp),
    check('extraetf',   checkExtraETF),
    check('supabase',   checkSupabase),
    check('frankfurter',checkFrankfurter),
  ]);

  const allOk = results.every(r => r.status === 'ok' || r.status === 'degraded');
  const anyDown = results.some(r => r.status === 'down');

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    checkedAt,
    overall: anyDown ? 'degraded' : 'ok',
    providers: results,
  }, null, 2));
};
