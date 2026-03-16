// GET /api/dividends/history?isins=DE000A0F5UH1,IE00BZ4BMM98,...
// Returns real dividend events using EODHD /api/div/ (already connected).
// Handles GBp → GBP → EUR conversion for LSE-listed ETFs.

const portfolioProviders = require('../../portfolio-providers.json');
const portfolioSeed = require('../../portfolio-seed.json');

const API_KEYS = [
  process.env.EODHD_API_KEY_4,
  process.env.EODHD_API_KEY_3,
  process.env.EODHD_API_KEY_2,
  process.env.EODHD_API_KEY,
].filter(Boolean);

const CACHE = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function cacheGet(k) { const e = CACHE.get(k); if (!e) return null; if (Date.now() > e.exp) { CACHE.delete(k); return null; } return e.data; }
function cacheSet(k, data) { CACHE.set(k, { data, exp: Date.now() + CACHE_TTL }); }

function getMapping(isin) {
  return portfolioProviders.assets.find(a => a.isin === isin) || null;
}

// Fetch EUR/GBP rate from Yahoo (cached 4h) — needed for LSE ETFs priced in GBp
async function getEurGbpRate() {
  const k = 'fx:EURGBP';
  const cached = cacheGet(k);
  if (cached) return cached;
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/EURGBP=X?range=5d&interval=1d', {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const data = await res.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    const rate = Number(closes.filter(Boolean).pop());
    if (rate > 0) { cacheSet(k, rate); return rate; }
  } catch (_) {}
  return 0.845; // fallback
}

// Normalise dividend amount to EUR
// currency from EODHD: "EUR", "GBP", "GBp" (pence), "USD", etc.
async function toEur(amount, currency) {
  if (currency === 'EUR') return amount;
  // GBp = pence — divide by 100 first to get GBP
  const gbpAmount = currency === 'GBp' ? amount / 100 : amount;
  if (currency === 'GBP' || currency === 'GBp') {
    const rate = await getEurGbpRate(); // EUR per 1 GBP
    // rate is EUR/GBP: 1 GBP = (1/rate) EUR  — but EURGBP=X means 1 EUR = rate GBP
    return gbpAmount / rate;
  }
  // USD and others: approximate (good enough for dividend display)
  if (currency === 'USD') return amount * 0.92;
  return amount;
}

// Fetch dividends from EODHD for a given symbol
async function fetchEodhdDividends(symbol, fromYear = 2022) {
  const k = `eodhd:div:${symbol}`;
  const cached = cacheGet(k);
  if (cached) return cached;

  if (!API_KEYS.length) throw new Error('No EODHD_API_KEY configured');

  for (const key of API_KEYS) {
    const url = `https://eodhd.com/api/div/${encodeURIComponent(symbol)}?api_token=${key}&fmt=json&from=${fromYear}-01-01`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const rows = await res.json();
      if (!Array.isArray(rows)) continue;

      const dividends = rows
        .map(r => ({
          date: String(r.date).slice(0, 10),
          paymentDate: String(r.paymentDate || r.date).slice(0, 10),
          amount: Number(r.value ?? r.unadjustedValue),
          currency: String(r.currency || 'EUR'),
          period: String(r.period || ''),
        }))
        .filter(d => Number.isFinite(d.amount) && d.amount > 0 && d.date)
        .sort((a, b) => a.date.localeCompare(b.date));

      const out = { symbol, dividends };
      cacheSet(k, out);
      return out;
    } catch (_) {
      // try next key
    }
  }
  return { symbol, dividends: [] };
}

// Sum dividends from last 12 months, normalised to EUR
async function annualPerShareEur(dividends) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cut = cutoff.toISOString().slice(0, 10);
  const last12 = dividends.filter(d => d.date >= cut);
  if (!last12.length) return 0;
  let total = 0;
  for (const d of last12) {
    total += await toEur(d.amount, d.currency);
  }
  return total;
}

// Unique months (0-11) that had payments in the last 2 years
function payMonthsFromHistory(dividends) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const cut = cutoff.toISOString().slice(0, 10);
  const recent = dividends.filter(d => d.date >= cut);
  const set = new Set(recent.map(d => new Date(d.date + 'T12:00:00Z').getMonth()));
  return [...set].sort((a, b) => a - b);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rawIsins = String(req.query?.isins || '');
  const isins = rawIsins
    ? rawIsins.split(',').map(s => s.trim()).filter(Boolean)
    : portfolioSeed.positions.map(p => p.isin);

  const results = [];

  for (const isin of isins) {
    const mapping = getMapping(isin);
    const seed = portfolioSeed.positions.find(p => p.isin === isin);

    // Prefer EODHD providerSymbol; fall back to yahooSymbol (EODHD often accepts these too)
    const eodhdSymbol = mapping?.providerSymbol || mapping?.yahooSymbol || null;

    if (!eodhdSymbol || !API_KEYS.length) {
      results.push({ isin, symbol: eodhdSymbol, dividends: [], annualPerShare: 0, payMonths: [], error: 'no_symbol_or_key' });
      continue;
    }

    try {
      const { dividends } = await fetchEodhdDividends(eodhdSymbol);
      const aps = await annualPerShareEur(dividends);
      const payMonths = payMonthsFromHistory(dividends);

      const currentPrice = seed?.currentPrice ?? 0;
      const quantity = seed?.quantity ?? 0;
      const buyPrice = seed?.buyPrice ?? currentPrice;

      const annualIncome = aps * quantity;
      const yieldPct = aps > 0 && currentPrice > 0 ? aps / currentPrice : 0;
      const yieldOnCostPct = aps > 0 && buyPrice > 0 ? aps / buyPrice : 0;

      // Return a few recent dividends for transparency (last 8, EUR-normalised)
      const recent = dividends.slice(-8);
      const recentEur = await Promise.all(
        recent.map(async d => ({ ...d, amountEur: await toEur(d.amount, d.currency) }))
      );

      results.push({
        isin,
        symbol: eodhdSymbol,
        annualPerShare: aps,
        annualIncome,
        yieldPct,
        yieldOnCostPct,
        payMonths,
        recentDividends: recentEur,
      });
    } catch (err) {
      results.push({ isin, symbol: eodhdSymbol, dividends: [], annualPerShare: 0, payMonths: [], error: err.message });
    }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ results }, null, 2));
};
