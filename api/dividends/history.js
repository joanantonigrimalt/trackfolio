// GET /api/dividends/history?isins=DE000A0F5UH1,IE00BZ4BMM98,...
//
// Strategy: Yahoo Finance (no key) → EODHD (fallback) → TwelveData (fallback)
// GBp handling: dividends from LSE ETFs come in pence → ÷100 → GBP → × GBPEUR

const portfolioSeed = require('../../portfolio-seed.json');

// ── Known distributing ETFs with correct per-API symbols ─────────────────
const DIV_ASSETS = {
  'DE000A0F5UH1': { yahoo: 'EXW1.DE',  eodhd: 'EXW1.DE',  payMonths: [2,5,8,11] }, // EURO STOXX 50 Dist — Xetra EUR, Mar/Jun/Sep/Dec
  'IE00BZ4BMM98': { yahoo: 'EUHD.L',   eodhd: 'EUHD.L',   payMonths: [0,3,6,9]  }, // Invesco EuroStoxx Hi Div — LSE GBp, Jan/Apr/Jul/Oct
  'IE00B9CQXS71': { yahoo: 'GBDV.L',   eodhd: 'GBDV.L',   payMonths: [1,4,7,10] }, // SPDR Global Div Aristocrats — LSE GBp, Feb/May/Aug/Nov
  'NL0011683594': { yahoo: 'TDIV.AS',  eodhd: 'TDIV.AS',  payMonths: [1,4,7,10] }, // VanEck TDIV — Amsterdam EUR, Feb/May/Aug/Nov
  'IE000QAZP7L2': { yahoo: 'EIMI.L',   eodhd: 'EIMI.L',   payMonths: [3,9]      }, // iShares EM IMI Dist — LSE GBp, Apr/Oct semi-annual
};

// Fallback yields when no live data is available
const FALLBACK_YIELD = {
  'DE000A0F5UH1': 0.0280,
  'IE00BZ4BMM98': 0.0414,
  'IE00B9CQXS71': 0.0350,
  'NL0011683594': 0.0520,
  'IE000QAZP7L2': 0.0350,
};

// ── Cache ─────────────────────────────────────────────────────────────────
const CACHE = new Map();
const TTL = 4 * 60 * 60 * 1000;
const cget = k => { const e=CACHE.get(k); if(!e||Date.now()>e.x){CACHE.delete(k);return null;} return e.v; };
const cset = (k,v) => CACHE.set(k,{v,x:Date.now()+TTL});

// ── GBPEUR rate ───────────────────────────────────────────────────────────
async function getGbpEur() {
  const cached = cget('fx:GBPEUR');
  if (cached) return cached;
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GBPEUR=X?range=5d&interval=1d', {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
    });
    const d = await r.json();
    const closes = (d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(Boolean);
    const rate = Number(closes[closes.length - 1]);
    if (rate > 0.5 && rate < 2.5) { cset('fx:GBPEUR', rate); return rate; }
  } catch (_) {}
  return 1.18;
}

async function toEur(amount, currency, gbpRate) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === 'EUR') return amount;
  if (currency === 'GBp') return (amount / 100) * gbpRate;
  if (currency === 'GBP') return amount * gbpRate;
  if (currency === 'USD') return amount * 0.93;
  return amount;
}

// ── Yahoo dividend events via chart API ───────────────────────────────────
async function yahooDiv(symbol) {
  const k = `yahoo:div:${symbol}`;
  const cached = cget(k);
  if (cached !== null) return cached;
  for (const host of ['query1','query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3y&interval=1mo&events=div`;
      const r = await fetch(url, { headers: {'User-Agent':'Mozilla/5.0','Accept':'application/json'} });
      if (!r.ok) continue;
      const data = await r.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;
      const currency = result.meta?.currency || 'EUR';
      const raw = result.events?.dividends || {};
      const divs = Object.values(raw)
        .map(d => ({ date: new Date(d.date*1000).toISOString().slice(0,10), amount: Number(d.amount), currency }))
        .filter(d => d.date && d.amount > 0)
        .sort((a,b) => a.date.localeCompare(b.date));
      cset(k, divs);
      return divs;
    } catch (_) {}
  }
  cset(k, []); // cache empty so we don't hammer Yahoo
  return [];
}

// ── EODHD dividend endpoint ───────────────────────────────────────────────
const EODHD_KEYS = [
  process.env.EODHD_API_KEY_4, process.env.EODHD_API_KEY_3,
  process.env.EODHD_API_KEY_2, process.env.EODHD_API_KEY,
].filter(Boolean);

async function eodhdDiv(symbol) {
  const k = `eodhd:div:${symbol}`;
  const cached = cget(k);
  if (cached !== null) return cached;
  if (!EODHD_KEYS.length) return [];
  for (const key of EODHD_KEYS) {
    try {
      const url = `https://eodhd.com/api/div/${encodeURIComponent(symbol)}?api_token=${key}&fmt=json&from=2022-01-01`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const rows = await r.json();
      if (!Array.isArray(rows) || !rows.length) continue;
      const divs = rows
        .map(row => ({ date: String(row.date).slice(0,10), amount: Number(row.value??row.unadjustedValue??0), currency: String(row.currency||'EUR') }))
        .filter(d => d.date && d.amount > 0)
        .sort((a,b) => a.date.localeCompare(b.date));
      cset(k, divs);
      return divs;
    } catch (_) {}
  }
  cset(k, []);
  return [];
}

// ── TwelveData dividend endpoint ──────────────────────────────────────────
const TD_KEYS = [
  process.env.TWELVEDATA_API_KEY_4, process.env.TWELVEDATA_API_KEY_3,
  process.env.TWELVEDATA_API_KEY_2, process.env.TWELVEDATA_API_KEY,
].filter(Boolean);

async function twelveDiv(symbol) {
  const k = `td:div:${symbol}`;
  const cached = cget(k);
  if (cached !== null) return cached;
  if (!TD_KEYS.length) return [];
  for (const key of TD_KEYS) {
    try {
      const url = `https://api.twelvedata.com/dividends?symbol=${encodeURIComponent(symbol)}&range=3y&apikey=${key}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      const rows = data?.dividends || [];
      if (!rows.length) continue;
      const divs = rows
        .map(row => ({ date: String(row.ex_date||row.date||'').slice(0,10), amount: Number(row.amount??0), currency: String(row.currency||'EUR') }))
        .filter(d => d.date && d.amount > 0)
        .sort((a,b) => a.date.localeCompare(b.date));
      cset(k, divs);
      return divs;
    } catch (_) {}
  }
  cset(k, []);
  return [];
}

// ── Fetch with fallback chain ─────────────────────────────────────────────
async function fetchDivs(isin) {
  const syms = DIV_ASSETS[isin];
  if (!syms) return [];
  const y = await yahooDiv(syms.yahoo);   if (y.length  > 0) return y;
  const e = await eodhdDiv(syms.eodhd);   if (e.length  > 0) return e;
  if (syms.tdiv) {
    const t = await twelveDiv(syms.tdiv); if (t.length > 0) return t;
  }
  return [];
}

// ── Annual income per share (EUR) ─────────────────────────────────────────
async function annualEur(divs, gbpRate) {
  if (!divs.length) return 0;
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear()-1);
  const cut = cutoff.toISOString().slice(0,10);
  const last12 = divs.filter(d => d.date >= cut);
  const src = last12.length >= 2 ? last12 : divs.slice(-6);
  if (!src.length) return 0;
  let total = 0;
  for (const d of src) total += await toEur(d.amount, d.currency, gbpRate);
  if (src !== last12 && src.length >= 1) {
    const spanDays = Math.max(30,
      (new Date(src[src.length-1].date+'T12:00:00Z') - new Date(src[0].date+'T12:00:00Z')) / 86400000
    );
    total = total * Math.min(365 / spanDays, 4);
  }
  return total;
}

// ── Handler ───────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rawIsins = String(req.query?.isins || '');
  const isins = rawIsins
    ? rawIsins.split(',').map(s => s.trim()).filter(Boolean)
    : portfolioSeed.positions.map(p => p.isin);

  const gbpRate = await getGbpEur();
  const results = [];

  for (const isin of isins) {
    const syms = DIV_ASSETS[isin];
    const seed = portfolioSeed.positions.find(p => p.isin === isin);
    if (!syms || !seed) {
      results.push({ isin, annualPerShare: 0, annualIncome: 0, yieldPct: 0, yieldOnCostPct: 0, payMonths: [] });
      continue;
    }

    try {
      const divs = await fetchDivs(isin);
      let aps = await annualEur(divs, gbpRate);

      // Fallback to known yield if live data gave nothing or implausible result
      const cp = seed.currentPrice ?? 0;
      const implausible = aps <= 0 || (cp > 0 && aps / cp > 0.30); // >30% yield is wrong
      if (implausible && FALLBACK_YIELD[isin] && cp > 0) {
        aps = cp * FALLBACK_YIELD[isin];
      }

      const qty = seed.quantity ?? 0;
      const bp  = seed.buyPrice ?? cp;

      // Always use known pay months (authoritative), never estimated from history
      const pm = syms.payMonths;

      const recent8 = divs.slice(-8);
      const recentEur = [];
      for (const d of recent8) recentEur.push({ ...d, amountEur: await toEur(d.amount, d.currency, gbpRate) });

      results.push({
        isin,
        symbol: syms.yahoo,
        source: divs.length > 0 ? 'live' : 'fallback_yield',
        gbpEurRate: gbpRate,
        annualPerShare: aps,
        annualIncome: aps * qty,
        yieldPct: aps > 0 && cp > 0 ? aps / cp : 0,
        yieldOnCostPct: aps > 0 && bp > 0 ? aps / bp : 0,
        payMonths: pm,
        recentDividends: recentEur,
      });
    } catch (err) {
      // Still return fallback data so calendar works
      const cp = seed.currentPrice ?? 0;
      const aps = cp * (FALLBACK_YIELD[isin] ?? 0);
      results.push({
        isin, symbol: syms.yahoo, source: 'error_fallback',
        annualPerShare: aps, annualIncome: aps * (seed.quantity ?? 0),
        yieldPct: FALLBACK_YIELD[isin] ?? 0, yieldOnCostPct: FALLBACK_YIELD[isin] ?? 0,
        payMonths: syms.payMonths, recentDividends: [], error: err.message,
      });
    }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ gbpEurRate: gbpRate, results }, null, 2));
};
