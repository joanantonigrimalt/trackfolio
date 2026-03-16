// GET /api/dividends/history?isins=DE000A0F5UH1,IE00BZ4BMM98,...
//
// Source priority:  EODHD (keyed, reliable EU/LSE ETFs)
//                → Yahoo Finance chart events (free)
//                → TwelveData (keyed, fallback)
//
// Pay months derived 100% from actual historical payment dates — no hardcoding.
// GBp (pence) → GBP → EUR via live GBPEUR=X from Yahoo.

const portfolioSeed = require('../../portfolio-seed.json');

// ── ETF symbol map (only distributing assets) ─────────────────────────────
// Lists the correct symbol per API. No payMonths here — derived from data.
const DIV_ASSETS = {
  'DE000A0F5UH1': { eodhd: 'EXW1.DE',  yahoo: 'EXW1.DE',  td: null        },
  'IE00BZ4BMM98': { eodhd: 'EUHD.L',   yahoo: 'EUHD.L',   td: null        },
  'IE00B9CQXS71': { eodhd: 'GBDV.L',   yahoo: 'GBDV.L',   td: null        },
  'NL0011683594': { eodhd: 'TDIV.AS',  yahoo: 'TDIV.AS',  td: 'TDIV'     },
  'IE000QAZP7L2': { eodhd: 'EIMI.L',   yahoo: 'EIMI.L',   td: null        },
};

// ── Cache ─────────────────────────────────────────────────────────────────
const CACHE = new Map();
const TTL = 4 * 60 * 60 * 1000;
const cget = k => { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; };
const cset = (k, v) => CACHE.set(k, { v, x: Date.now() + TTL });

// ── GBPEUR exchange rate ───────────────────────────────────────────────────
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
  if (currency === 'GBp') return (amount / 100) * gbpRate;   // pence → GBP → EUR
  if (currency === 'GBP') return amount * gbpRate;
  if (currency === 'USD') return amount * 0.93;
  return amount;
}

// ── EODHD /api/div/ ────────────────────────────────────────────────────────
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
      const url = `https://eodhd.com/api/div/${encodeURIComponent(symbol)}?api_token=${key}&fmt=json&from=2021-01-01`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) continue;
      const rows = await r.json();
      if (!Array.isArray(rows) || !rows.length) continue;
      const divs = rows
        .map(row => ({
          date: String(row.date || '').slice(0, 10),
          amount: Number(row.value ?? row.unadjustedValue ?? 0),
          currency: String(row.currency || 'EUR'),
          period: String(row.period || ''),
        }))
        .filter(d => d.date && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
      cset(k, divs);
      return divs;
    } catch (_) {}
  }
  cset(k, []);
  return [];
}

// ── Yahoo chart events=div ─────────────────────────────────────────────────
async function yahooDiv(symbol) {
  const k = `yahoo:div:${symbol}`;
  const cached = cget(k);
  if (cached !== null) return cached;
  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3y&interval=1mo&events=div`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      if (!r.ok) continue;
      const data = await r.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;
      const currency = result.meta?.currency || 'EUR';
      const raw = result.events?.dividends || {};
      const divs = Object.values(raw)
        .map(d => ({ date: new Date(d.date * 1000).toISOString().slice(0, 10), amount: Number(d.amount), currency }))
        .filter(d => d.date && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
      cset(k, divs);
      return divs;
    } catch (_) {}
  }
  cset(k, []);
  return [];
}

// ── TwelveData /dividends ──────────────────────────────────────────────────
const TD_KEYS = [
  process.env.TWELVEDATA_API_KEY_4, process.env.TWELVEDATA_API_KEY_3,
  process.env.TWELVEDATA_API_KEY_2, process.env.TWELVEDATA_API_KEY,
].filter(Boolean);

async function tdDiv(symbol) {
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
        .map(row => ({
          date: String(row.ex_date || row.date || '').slice(0, 10),
          amount: Number(row.amount ?? 0),
          currency: String(row.currency || 'EUR'),
        }))
        .filter(d => d.date && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
      cset(k, divs);
      return divs;
    } catch (_) {}
  }
  cset(k, []);
  return [];
}

// ── Fetch with fallback chain ─────────────────────────────────────────────
async function fetchDivs(isin) {
  const s = DIV_ASSETS[isin];
  if (!s) return [];
  if (s.eodhd) { const d = await eodhdDiv(s.eodhd); if (d.length) return d; }
  if (s.yahoo)  { const d = await yahooDiv(s.yahoo);  if (d.length) return d; }
  if (s.td)     { const d = await tdDiv(s.td);         if (d.length) return d; }
  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────
// Sum last-12-month dividends in EUR
async function annualEurPerShare(divs, gbpRate) {
  if (!divs.length) return 0;
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cut = cutoff.toISOString().slice(0, 10);
  const last12 = divs.filter(d => d.date >= cut);
  const src = last12.length >= 2 ? last12 : divs.slice(-6);
  if (!src.length) return 0;
  let total = 0;
  for (const d of src) total += await toEur(d.amount, d.currency, gbpRate);
  if (src !== last12 && src.length >= 1) {
    const span = Math.max(30,
      (new Date(src[src.length - 1].date + 'T12:00:00Z') - new Date(src[0].date + 'T12:00:00Z')) / 86400000
    );
    total = total * Math.min(365 / span, 4);
  }
  return total;
}

// Derive pay months (0-11) from historical payment dates (last 2 years)
function derivePayMonths(divs) {
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 2);
  const cut = cutoff.toISOString().slice(0, 10);
  const recent = divs.filter(d => d.date >= cut);
  const set = new Set(recent.map(d => new Date(d.date + 'T12:00:00Z').getMonth()));
  return [...set].sort((a, b) => a - b);
}

// Recent dividend events for display (last 8, with EUR amount)
async function recentForDisplay(divs, gbpRate) {
  const recent = divs.slice(-8);
  const out = [];
  for (const d of recent) out.push({ ...d, amountEur: await toEur(d.amount, d.currency, gbpRate) });
  return out;
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
      const aps = await annualEurPerShare(divs, gbpRate);
      const pm = derivePayMonths(divs);
      const recent = await recentForDisplay(divs, gbpRate);

      const cp = seed.currentPrice ?? 0;
      const qty = seed.quantity ?? 0;
      const bp = seed.buyPrice ?? cp;

      results.push({
        isin,
        symbol: syms.eodhd || syms.yahoo,
        source: divs.length ? 'live' : 'no_data',
        gbpEurRate: gbpRate,
        annualPerShare: aps,
        annualIncome: aps * qty,
        yieldPct: aps > 0 && cp > 0 ? aps / cp : 0,
        yieldOnCostPct: aps > 0 && bp > 0 ? aps / bp : 0,
        payMonths: pm,
        payCount: divs.length,
        recentDividends: recent,
      });
    } catch (err) {
      results.push({
        isin, symbol: DIV_ASSETS[isin]?.eodhd,
        annualPerShare: 0, annualIncome: 0, yieldPct: 0, yieldOnCostPct: 0,
        payMonths: [], recentDividends: [], error: err.message,
      });
    }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ gbpEurRate: gbpRate, results }, null, 2));
};
