// GET /api/dividends/history?isins=DE000A0F5UH1,IE00BZ4BMM98,...
//
// Source priority:  EODHD (keyed, reliable EU/LSE ETFs)
//                → Yahoo Finance chart events (free)
//                → TwelveData (keyed, fallback)
//                → Digrin/StockAnalysis scraper (final fallback)
//
// Pay months + amounts derived 100% from actual historical payment dates.
// GBp (pence) → GBP → EUR via live GBPEUR=X from Yahoo.

const portfolioSeed = require('../../portfolio-seed.json');
const { fetchDividendHistory } = require('../../lib/dividends');
const { getGbpEur, toEur } = require('../../lib/fx');

// ── ETF symbol map (only distributing assets) ─────────────────────────────
const DIV_ASSETS = {
  'DE000A0F5UH1': { eodhd: 'ISPA.DE',  yahoo: 'ISPA.DE',  td: null    },  // was EXW1.DE (wrong 3-month offset)
  'IE00BZ4BMM98': { eodhd: 'EHDV.DE',  yahoo: 'EHDV.DE',  td: null    },  // was EUHD.L (GBp, shifted dates)
  'IE00B9CQXS71': { eodhd: 'ZPRG.DE',  yahoo: 'ZPRG.DE',  td: null    },  // was GBDV.L (GBp duplicates)
  'NL0011683594': { eodhd: 'TDIV.AS',  yahoo: 'TDIV.AS',  td: 'TDIV'  },
  'IE000QAZP7L2': { eodhd: 'EIMI.L',   yahoo: 'EIMI.L',   td: null    },
};

// ── Cache ─────────────────────────────────────────────────────────────────
const CACHE = new Map();
const TTL = 4 * 60 * 60 * 1000;
const cget = k => { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; };
const cset = (k, v) => CACHE.set(k, { v, x: Date.now() + TTL });

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
          date:        String(row.date        || '').slice(0, 10),  // ex-dividend date
          paymentDate: String(row.paymentDate || '').slice(0, 10) || null,
          amount:      Number(row.value ?? row.unadjustedValue ?? 0),
          currency:    String(row.currency || 'EUR'),
          period:      String(row.period   || ''),
        }))
        .filter(d => d.date && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
      cset(k, divs);
      return divs;
    } catch (_) {}
  }
  return [];  // do NOT cache empty — allow retry next request
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
        .map(d => ({
          date: new Date(d.date * 1000).toISOString().slice(0, 10),
          paymentDate: null,
          amount: Number(d.amount),
          currency,
        }))
        .filter(d => d.date && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (divs.length) { cset(k, divs); return divs; }
    } catch (_) {}
  }
  return [];  // do NOT cache empty
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
          date:        String(row.ex_date || row.date || '').slice(0, 10),
          paymentDate: String(row.payment_date || '').slice(0, 10) || null,
          amount:      Number(row.amount ?? 0),
          currency:    String(row.currency || 'EUR'),
        }))
        .filter(d => d.date && d.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (divs.length) { cset(k, divs); return divs; }
    } catch (_) {}
  }
  return [];  // do NOT cache empty
}

// ── Fetch with fallback chain ─────────────────────────────────────────────
async function fetchDivs(isin) {
  const s = DIV_ASSETS[isin];
  if (s) {
    if (s.eodhd) { const d = await eodhdDiv(s.eodhd); if (d.length) return d; }
    if (s.yahoo)  { const d = await yahooDiv(s.yahoo);  if (d.length) return d; }
    if (s.td)     { const d = await tdDiv(s.td);         if (d.length) return d; }
  } else {
    // Custom/unknown asset — try Yahoo directly with the symbol/ISIN
    const d = await yahooDiv(isin);
    if (d.length) return d;
  }
  // Final fallback: Digrin / StockAnalysis scraper
  try {
    const hist = await fetchDividendHistory(isin);
    if (hist.payments?.length) {
      return hist.payments.map(p => ({
        date: p.exDate,
        paymentDate: null,
        amount: p.amount,
        currency: p.currency || 'EUR',
      }));
    }
  } catch (_) {}
  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────

// Sum last-12-month dividends in EUR per share (for annual yield calculation)
async function annualEurPerShare(divs, gbpRate) {
  if (!divs.length) return 0;
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cut = cutoff.toISOString().slice(0, 10);
  const last12 = divs.filter(d => d.date >= cut);
  // Use last 12 months if available; otherwise last 6 payments — no extrapolation multiplier
  const src = last12.length >= 2 ? last12 : divs.slice(-6);
  if (!src.length) return 0;
  let total = 0;
  for (const d of src) total += await toEur(d.amount, d.currency, gbpRate);
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

// Build 12-entry schedule of EUR/share amounts per calendar month (index 0=Jan..11=Dec).
// For each month, uses the most recent historical payment in that month (last 2 years).
// This gives real per-month amounts instead of a uniform average.
async function buildPaySchedule(divs, gbpRate) {
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 2);
  const cut = cutoff.toISOString().slice(0, 10);
  const recent = divs.filter(d => d.date >= cut);
  const byMonth = Array.from({ length: 12 }, () => []);
  for (const d of recent) {
    const m = new Date(d.date + 'T12:00:00Z').getMonth();
    const eur = await toEur(d.amount, d.currency, gbpRate);
    byMonth[m].push({ eur, date: d.date });
  }
  // Use the most recent payment for each month
  return byMonth.map(arr => {
    if (!arr.length) return 0;
    arr.sort((a, b) => b.date.localeCompare(a.date));
    return arr[0].eur;
  });
}

// Estimate upcoming ex-date and payment date for the next payMonth.
// Based on the typical day-of-month from historical data in that month.
function estimateNextDates(divs, nextMonth, nextYear) {
  if (nextMonth == null) return { exDate: null, payDate: null };

  // Find all historical payments in nextMonth
  const inMonth = divs.filter(d => new Date(d.date + 'T12:00:00Z').getMonth() === nextMonth);
  if (!inMonth.length) return { exDate: null, payDate: null };

  // Typical day-of-month for ex-date
  const exDays = inMonth.map(d => new Date(d.date + 'T12:00:00Z').getDate());
  const avgExDay = Math.round(exDays.reduce((s, v) => s + v, 0) / exDays.length);

  // Typical gap between ex-date and payment-date (days)
  const gaps = inMonth
    .filter(d => d.paymentDate)
    .map(d => {
      const ex = new Date(d.date + 'T12:00:00Z');
      const pay = new Date(d.paymentDate + 'T12:00:00Z');
      return Math.round((pay - ex) / 86400000);
    })
    .filter(g => g > 0 && g < 60);
  const avgGap = gaps.length ? Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length) : 7;

  const exDate = new Date(Date.UTC(nextYear, nextMonth, Math.min(avgExDay, 28)));
  const payDate = new Date(exDate.getTime() + avgGap * 86400000);

  return {
    exDate:  exDate.toISOString().slice(0, 10),
    payDate: payDate.toISOString().slice(0, 10),
  };
}

// Recent dividend events for display (last 8, with EUR total amount per payment)
async function recentForDisplay(divs, gbpRate) {
  const recent = divs.slice(-8);
  const out = [];
  for (const d of recent) {
    out.push({ ...d, amountEur: await toEur(d.amount, d.currency, gbpRate) });
  }
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

    try {
      const divs = await fetchDivs(isin);
      const aps  = await annualEurPerShare(divs, gbpRate);
      const pm   = derivePayMonths(divs);
      const ps   = await buildPaySchedule(divs, gbpRate);
      const recent = await recentForDisplay(divs, gbpRate);

      const cp  = seed?.currentPrice ?? 0;
      const qty = seed?.quantity ?? 0;
      const bp  = seed?.buyPrice ?? cp;

      const today = new Date();
      const cm = today.getMonth();
      const nextM = pm.find(m => m > cm) ?? pm[0];
      const nextYear = today.getFullYear() + (nextM != null && nextM <= cm ? 1 : 0);
      const { exDate: nextExDate, payDate: nextPayDate } = estimateNextDates(divs, nextM, nextYear);

      results.push({
        isin,
        symbol:         syms?.eodhd || syms?.yahoo || isin,
        source:         divs.length ? 'live' : 'no_data',
        gbpEurRate:     gbpRate,
        annualPerShare: aps,
        annualIncome:   aps * qty,
        yieldPct:       aps > 0 && cp > 0 ? aps / cp : 0,
        yieldOnCostPct: aps > 0 && bp > 0 ? aps / bp : 0,
        payMonths:      pm,
        paySchedule:    ps,        // 12-entry array: EUR/share for each calendar month
        nextExDate,                // estimated next ex-dividend date (YYYY-MM-DD)
        nextPayDate,               // estimated next payment date (YYYY-MM-DD)
        payCount:       divs.length,
        recentDividends: recent,
      });
    } catch (err) {
      results.push({
        isin, symbol: DIV_ASSETS[isin]?.eodhd,
        annualPerShare: 0, annualIncome: 0, yieldPct: 0, yieldOnCostPct: 0,
        payMonths: [], paySchedule: Array(12).fill(0),
        nextExDate: null, nextPayDate: null,
        recentDividends: [], error: err.message,
      });
    }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ gbpEurRate: gbpRate, results }, null, 2));
};
