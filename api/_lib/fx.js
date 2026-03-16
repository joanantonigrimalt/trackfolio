// Shared FX / currency utilities
// Used by: api/dividends/history.js, api/dividends/detail.js
//
// Keeps a single in-process cache for GBPEUR rate (4h TTL)
// so multiple endpoints don't each fetch it independently.

const CACHE = new Map();
const TTL = 4 * 60 * 60 * 1000;
const cget = k => { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; };
const cset = (k, v) => CACHE.set(k, { v, x: Date.now() + TTL });

async function getGbpEur() {
  const cached = cget('fx:GBPEUR');
  if (cached) return cached;
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GBPEUR=X?range=5d&interval=1d', {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const d = await r.json();
    const closes = (d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(Boolean);
    const rate = Number(closes[closes.length - 1]);
    if (rate > 0.5 && rate < 2.5) { cset('fx:GBPEUR', rate); return rate; }
  } catch (_) {}
  return 1.18; // fallback
}

// Convert an amount in any supported currency to EUR.
// Pass gbpRate if you already have it to avoid an extra await.
async function toEur(amount, currency, gbpRate) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === 'EUR') return amount;
  const rate = gbpRate ?? (await getGbpEur());
  if (currency === 'GBp') return (amount / 100) * rate; // pence → GBP → EUR
  if (currency === 'GBP') return amount * rate;
  if (currency === 'USD') return amount * 0.93;
  return amount; // unknown currency: return as-is
}

module.exports = { getGbpEur, toEur };
