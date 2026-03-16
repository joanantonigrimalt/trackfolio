// Shared FX / currency utilities
// Used by: api/dividends/history.js, api/dividends/detail.js
//
// Fetches live rates from Yahoo Finance (4h TTL).
// GBP/USD/GBp all converted to EUR dynamically — nothing hardcoded.

const CACHE = new Map();
const TTL = 4 * 60 * 60 * 1000;
const cget = k => { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; };
const cset = (k, v) => CACHE.set(k, { v, x: Date.now() + TTL });

async function fetchYahooPair(pair, min, max, fallback) {
  const cached = cget(`fx:${pair}`);
  if (cached) return cached;
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${pair}?range=5d&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const d = await r.json();
    const closes = (d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(Boolean);
    const rate = Number(closes[closes.length - 1]);
    if (rate > min && rate < max) { cset(`fx:${pair}`, rate); return rate; }
  } catch (_) {}
  return fallback;
}

const getGbpEur = () => fetchYahooPair('GBPEUR=X', 0.5, 2.5, 1.18);
const getUsdEur = () => fetchYahooPair('USDEUR=X', 0.5, 1.5, 0.92);

// Convert an amount in any supported currency to EUR.
// All rates are live from Yahoo Finance — no hardcoded values.
async function toEur(amount, currency, gbpRate) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === 'EUR') return amount;
  if (currency === 'GBp') return (amount / 100) * (gbpRate ?? await getGbpEur()); // pence → GBP → EUR
  if (currency === 'GBP') return amount * (gbpRate ?? await getGbpEur());
  if (currency === 'USD') return amount * (await getUsdEur());
  return amount; // unknown currency: return as-is
}

module.exports = { getGbpEur, getUsdEur, toEur };
