// GET /api/dividends/history?isins=DE000A0F5UH1,IE00BZ4BMM98,...
//
// Strategy: Yahoo Finance (no key) → EODHD (fallback, keyed)
// Currency: Yahoo/EODHD may return GBp (pence) for LSE-listed ETFs.
//   → divide by 100 → GBP, then multiply by GBPEUR rate (fetched from Yahoo).
//
// Known distributing ETFs in this portfolio with CORRECT symbols per API:
const DIV_ASSETS = {
  'DE000A0F5UH1': { yahoo: 'EXW1.DE',  eodhd: 'EXW1.DE',  tdiv: null       }, // iShares EURO STOXX 50 — Xetra EUR
  'IE00BZ4BMM98': { yahoo: 'EUHD.L',   eodhd: 'EUHD.L',   tdiv: null       }, // Invesco EuroStoxx High Div — LSE GBp
  'IE00B9CQXS71': { yahoo: 'GBDV.L',   eodhd: 'GBDV.L',   tdiv: null       }, // SPDR Global Div Aristocrats — LSE GBp
  'NL0011683594': { yahoo: 'TDIV.AS',  eodhd: 'TDIV.AS',   tdiv: 'TDIV'    }, // VanEck TDIV — Amsterdam EUR
  'IE000QAZP7L2': { yahoo: 'EIMI.L',   eodhd: 'EIMI.L',   tdiv: null       }, // iShares EM IMI — LSE GBp
};

const portfolioSeed = require('../../portfolio-seed.json');

// ── Simple in-process cache ────────────────────────────────────────────────
const CACHE = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000;
function cget(k) { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; }
function cset(k, v) { CACHE.set(k, { v, x: Date.now() + CACHE_TTL }); }

// ── FX rate: GBPEUR (1 GBP = X EUR) ──────────────────────────────────────
async function getGbpEurRate() {
  const k = 'fx:GBPEUR';
  const cached = cget(k);
  if (cached) return cached;
  // Try Yahoo GBPEUR=X
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GBPEUR=X?range=5d&interval=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }
    );
    if (res.ok) {
      const data = await res.json();
      const closes = (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(Boolean);
      const rate = Number(closes[closes.length - 1]);
      if (rate > 0.5 && rate < 2.5) { cset(k, rate); return rate; }
    }
  } catch (_) {}
  return 1.18; // fallback: 1 GBP ≈ 1.18 EUR
}

// ── Normalise a raw amount to EUR ─────────────────────────────────────────
// currency values seen in practice: "EUR", "GBP", "GBp", "USD"
async function toEur(amount, currency) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === 'EUR') return amount;
  if (currency === 'GBp') { // pence → GBP → EUR
    const rate = await getGbpEurRate();
    return (amount / 100) * rate;
  }
  if (currency === 'GBP') {
    const rate = await getGbpEurRate();
    return amount * rate;
  }
  if (currency === 'USD') return amount * 0.93; // approximate
  return amount;
}

// ── Yahoo Finance dividend events ─────────────────────────────────────────
async function yahooDiv(symbol) {
  const k = `yahoo:div:${symbol}`;
  const cached = cget(k);
  if (cached) return cached;

  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3y&interval=1mo&events=div%2Csplit`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'application/json' }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const rawCurrency = result.meta?.currency || 'EUR';
      const rawDivs = result.events?.dividends || {};

      const dividends = Object.values(rawDivs)
        .map(d => ({ date: new Date(d.date * 1000).toISOString().slice(0, 10), amount: Number(d.amount), currency: rawCurrency }))
        .filter(d => d.date && Number.isFinite(d.amount) && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (dividends.length > 0) { cset(k, dividends); return dividends; }
    } catch (_) {}
  }
  return [];
}

// ── EODHD dividend endpoint ───────────────────────────────────────────────
const EODHD_KEYS = [
  process.env.EODHD_API_KEY_4,
  process.env.EODHD_API_KEY_3,
  process.env.EODHD_API_KEY_2,
  process.env.EODHD_API_KEY,
].filter(Boolean);

async function eodhdDiv(symbol) {
  const k = `eodhd:div:${symbol}`;
  const cached = cget(k);
  if (cached) return cached;
  if (!EODHD_KEYS.length) return [];

  for (const key of EODHD_KEYS) {
    try {
      const url = `https://eodhd.com/api/div/${encodeURIComponent(symbol)}?api_token=${key}&fmt=json&from=2022-01-01`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const dividends = rows
        .map(r => ({
          date: String(r.date).slice(0, 10),
          amount: Number(r.value ?? r.unadjustedValue ?? 0),
          currency: String(r.currency || 'EUR'),
        }))
        .filter(d => d.date && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (dividends.length > 0) { cset(k, dividends); return dividends; }
    } catch (_) {}
  }
  return [];
}

// ── Twelve Data dividend endpoint ─────────────────────────────────────────
const TD_KEYS = [
  process.env.TWELVEDATA_API_KEY_4,
  process.env.TWELVEDATA_API_KEY_3,
  process.env.TWELVEDATA_API_KEY_2,
  process.env.TWELVEDATA_API_KEY,
].filter(Boolean);

async function twelveDiv(symbol) {
  const k = `td:div:${symbol}`;
  const cached = cget(k);
  if (cached) return cached;
  if (!TD_KEYS.length) return [];

  for (const key of TD_KEYS) {
    try {
      const url = `https://api.twelvedata.com/dividends?symbol=${encodeURIComponent(symbol)}&range=3y&apikey=${key}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const rows = data?.dividends || [];
      if (!rows.length) continue;

      const dividends = rows
        .map(r => ({
          date: String(r.ex_date || r.date || '').slice(0, 10),
          amount: Number(r.amount ?? r.value ?? 0),
          currency: String(r.currency || 'EUR'),
        }))
        .filter(d => d.date && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (dividends.length > 0) { cset(k, dividends); return dividends; }
    } catch (_) {}
  }
  return [];
}

// ── Fetch dividends with fallback chain ───────────────────────────────────
async function fetchDividends(isin) {
  const syms = DIV_ASSETS[isin];
  if (!syms) return [];

  // 1. Yahoo (free, no key)
  if (syms.yahoo) {
    const divs = await yahooDiv(syms.yahoo);
    if (divs.length > 0) return divs;
  }

  // 2. EODHD
  if (syms.eodhd) {
    const divs = await eodhdDiv(syms.eodhd);
    if (divs.length > 0) return divs;
  }

  // 3. TwelveData
  if (syms.tdiv) {
    const divs = await twelveDiv(syms.tdiv);
    if (divs.length > 0) return divs;
  }

  return [];
}

// ── Aggregate helpers ─────────────────────────────────────────────────────
async function annualEur(dividends) {
  if (!dividends.length) return 0;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cut = cutoff.toISOString().slice(0, 10);
  const last12 = dividends.filter(d => d.date >= cut);
  // If fewer than 2 payments in last 12m, extrapolate from last 2 years
  const src = last12.length >= 2 ? last12 : dividends.slice(-8);
  if (!src.length) return 0;
  let total = 0;
  for (const d of src) total += await toEur(d.amount, d.currency);
  // If we extrapolated from partial year, annualise
  if (src !== last12 && src.length > 0) {
    const oldest = new Date(src[0].date + 'T00:00:00Z');
    const newest = new Date(src[src.length - 1].date + 'T00:00:00Z');
    const spanDays = Math.max(1, (newest - oldest) / 86400000);
    const annFactor = 365 / spanDays;
    return total * Math.min(annFactor, 4); // cap at 4× to avoid crazy extrapolation
  }
  return total;
}

function payMonths(dividends) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const cut = cutoff.toISOString().slice(0, 10);
  const recent = dividends.filter(d => d.date >= cut);
  const set = new Set(recent.map(d => new Date(d.date + 'T12:00:00Z').getMonth()));
  return [...set].sort((a, b) => a - b);
}

// ── Handler ───────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rawIsins = String(req.query?.isins || '');
  const isins = rawIsins
    ? rawIsins.split(',').map(s => s.trim()).filter(Boolean)
    : portfolioSeed.positions.map(p => p.isin);

  const gbpEur = await getGbpEurRate(); // pre-fetch once

  const results = [];
  for (const isin of isins) {
    const seed = portfolioSeed.positions.find(p => p.isin === isin);
    const syms = DIV_ASSETS[isin];

    if (!syms) {
      // Not a known distributing asset — skip with zero
      results.push({ isin, symbol: null, annualPerShare: 0, annualIncome: 0, yieldPct: 0, yieldOnCostPct: 0, payMonths: [] });
      continue;
    }

    try {
      const divs = await fetchDividends(isin);
      const aps = await annualEur(divs);
      const pm = payMonths(divs);

      const qty = seed?.quantity ?? 0;
      const cp = seed?.currentPrice ?? 0;
      const bp = seed?.buyPrice ?? cp;

      const recent8 = divs.slice(-8);
      const recent8eur = [];
      for (const d of recent8) {
        recent8eur.push({ ...d, amountEur: await toEur(d.amount, d.currency) });
      }

      results.push({
        isin,
        symbol: syms.yahoo || syms.eodhd,
        gbpEurRate: gbpEur,
        annualPerShare: aps,
        annualIncome: aps * qty,
        yieldPct: aps > 0 && cp > 0 ? aps / cp : 0,
        yieldOnCostPct: aps > 0 && bp > 0 ? aps / bp : 0,
        payMonths: pm,
        recentDividends: recent8eur,
      });
    } catch (err) {
      results.push({ isin, symbol: syms?.yahoo, annualPerShare: 0, annualIncome: 0, yieldPct: 0, yieldOnCostPct: 0, payMonths: [], error: err.message });
    }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ gbpEurRate: gbpEur, results }, null, 2));
};
