// GET /api/dividends/history?isins=DE000A0F5UH1,IE00BZ4BMM98,...
// Returns real dividend events from Yahoo Finance for each ISIN.
// Uses the same Yahoo symbol resolution as providers.js.

const portfolioProviders = require('../../portfolio-providers.json');
const portfolioSeed = require('../../portfolio-seed.json');

const CACHE = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function cacheGet(k) {
  const e = CACHE.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) { CACHE.delete(k); return null; }
  return e.data;
}
function cacheSet(k, data) { CACHE.set(k, { data, exp: Date.now() + CACHE_TTL }); }

function getSymbol(isin) {
  const m = portfolioProviders.assets.find(a => a.isin === isin);
  return m?.yahooSymbol || null;
}

// Fetch dividend events from Yahoo Finance chart API
async function fetchYahooDividends(symbol) {
  const key = `div:${symbol}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3y&interval=1mo&events=div`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3y&interval=1mo&events=div`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const currency = result.meta?.currency || 'EUR';
      const rawDivs = result.events?.dividends || {};

      const dividends = Object.values(rawDivs)
        .map(d => ({
          date: new Date(d.date * 1000).toISOString().slice(0, 10),
          amount: Number(d.amount),
          currency,
        }))
        .filter(d => Number.isFinite(d.amount) && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

      const out = { symbol, currency, dividends };
      if (dividends.length > 0) cacheSet(key, out);
      return out;
    } catch (_) {
      // try next URL
    }
  }
  return { symbol, currency: 'EUR', dividends: [] };
}

// Compute annualized dividend per share from last 12 months of history
function annualPerShare(dividends) {
  if (!dividends.length) return 0;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cut = cutoff.toISOString().slice(0, 10);
  const last12 = dividends.filter(d => d.date >= cut);
  return last12.reduce((s, d) => s + d.amount, 0);
}

// Estimate next payment months based on historical pattern
function estimatePayMonths(dividends) {
  if (!dividends.length) return [];
  // Get months with payments from last 2 years
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const cut = cutoff.toISOString().slice(0, 10);
  const recent = dividends.filter(d => d.date >= cut);
  const monthSet = new Set(recent.map(d => new Date(d.date).getMonth()));
  return [...monthSet].sort((a, b) => a - b);
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
    const symbol = getSymbol(isin);
    const seed = portfolioSeed.positions.find(p => p.isin === isin);

    if (!symbol) {
      results.push({ isin, symbol: null, dividends: [], annualPerShare: 0, payMonths: [], error: 'no_symbol' });
      continue;
    }

    try {
      const { currency, dividends } = await fetchYahooDividends(symbol);
      const aps = annualPerShare(dividends);
      const payMonths = estimatePayMonths(dividends);
      const currentPrice = seed?.currentPrice ?? null;
      const yieldPct = (aps > 0 && currentPrice > 0) ? (aps / currentPrice) : 0;
      const quantity = seed?.quantity ?? 0;
      const buyPrice = seed?.buyPrice ?? currentPrice ?? 0;
      const yieldOnCostPct = (aps > 0 && buyPrice > 0) ? (aps / buyPrice) : 0;

      results.push({
        isin,
        symbol,
        currency,
        dividends,
        annualPerShare: aps,
        annualIncome: aps * quantity,
        yieldPct,
        yieldOnCostPct,
        payMonths,
      });
    } catch (err) {
      results.push({ isin, symbol, dividends: [], annualPerShare: 0, payMonths: [], error: err.message });
    }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ results }, null, 2));
};
