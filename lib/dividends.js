// Dividend history scraper: Digrin → Yahoo (fallback) → StockAnalysis
// L1: in-memory 24h cache  |  L2: Supabase dividend_payments table (7-day staleness)
//
// Source strategy per ETF (2025-03):
//   Digrin migrated away from Next.js (__NEXT_DATA__ gone). HTML table parser fixed
//   to handle new "(-6.03%)" change badges. Yahoo is fallback when Digrin returns < 3 payments.
//
// Public API:
//   fetchDividendHistory(isin, { force }) → { isin, ticker, source, currency, fetchedAt, isDelisted, payments, yearly }
//   payments: [{ exDate, amount, currency, year }]
//   yearly:   [{ year, totalPerShare, payments: [...] }]

const providers = require('../portfolio-providers.json');

// ── Static ISIN → scraper ticker map ─────────────────────────────────────────
// yahoo: Yahoo Finance symbol (chart events=div endpoint — free, no key needed)
// digrin: Digrin stock detail slug
// sa: StockAnalysis exchange + ticker (final fallback)
const TICKER_MAP = {
  'DE000A0F5UH1': { digrin: 'ISPA.DE', yahoo: 'ISPA.DE', sa: { exchange: 'xetra', ticker: 'ISPA' } },
  'IE00BZ4BMM98': { digrin: 'EUHD.PA', yahoo: 'EHDV.DE', sa: { exchange: 'epa',   ticker: 'EUHD' } }, // EHDV.DE = German listing, better Yahoo coverage
  'IE00B9CQXS71': { digrin: 'ZPRG.DE', yahoo: 'ZPRG.DE', sa: { exchange: 'xetra', ticker: 'ZPRG' } },
  'NL0011683594': { digrin: 'TDIV.AS', yahoo: 'TDIV.AS', sa: { exchange: 'ams',   ticker: 'TDIV' } },
  'IE000QAZP7L2': { digrin: 'EIMI.L',  yahoo: 'EIMI.L',  sa: { exchange: 'lon',   ticker: 'EIMI' } },
};

// ── Resolve ticker info for any ISIN ─────────────────────────────────────────
// Priority: explicit TICKER_MAP → yahooSymbol from portfolio-providers.json
// Funds (type==='fund') are excluded — they don't pay dividends via exchanges
function getTickerInfo(isin) {
  if (TICKER_MAP[isin]) return TICKER_MAP[isin];
  const asset = providers.assets.find(a => a.isin === isin);
  // Only attempt scraping for ETFs and ETCs, never for mutual funds
  if (!asset || asset.type === 'fund') return null;
  if (asset?.yahooSymbol) {
    return { digrin: asset.yahooSymbol, sa: inferSaFromTicker(asset.yahooSymbol) };
  }
  return null;
}

function inferSaFromTicker(ticker) {
  if (!ticker) return null;
  const parts = ticker.split('.');
  const suffix = parts.pop()?.toUpperCase();
  const base = parts.join('.');
  const exchangeMap = { DE: 'xetra', PA: 'epa', AS: 'ams', L: 'lon', MI: 'mil' };
  const exchange = exchangeMap[suffix];
  return exchange ? { exchange, ticker: base } : null;
}

// ── L1 in-memory cache (24h TTL) ─────────────────────────────────────────────
const L1 = new Map();
const L1_TTL = 24 * 60 * 60 * 1000;
const l1get = k => { const e = L1.get(k); if (!e || Date.now() > e.x) { L1.delete(k); return null; } return e.v; };
const l1set = (k, v) => L1.set(k, { v, x: Date.now() + L1_TTL });

// ── HTML parsing helpers ──────────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const s = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d.toISOString().slice(0, 10);
  return null;
}

function parseTableRows(html) {
  const rows = [];
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '');

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trM;
  while ((trM = trRe.exec(clean)) !== null) {
    const cells = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdM;
    while ((tdM = tdRe.exec(trM[1])) !== null) {
      const text = tdM[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
      cells.push(text);
    }
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

// FIX #5: tighter range (0.001–20). No UCITS ETF pays > €20/share per quarter.
// FIX #13: Digrin now includes change-badge spans like "(-6.03%)" inside the amount <td>.
//   Old code skipped ANY cell containing '%'. New code strips badge annotations first,
//   then only skips cells that are purely a percentage (e.g. "5.23%").
function parseDividendRows(rows, currency = 'EUR') {
  const payments = [];
  for (const cells of rows) {
    const date = parseDate(cells[0]);
    if (!date) continue;

    for (let i = 1; i < Math.min(cells.length, 5); i++) {
      const cell = cells[i];
      if (!cell) continue;
      // Strip change-badge annotations like "(-6.03%)" or "(+2.1%)" before parsing
      const stripped = cell.replace(/\([\s]*[+-]?[\d.]+[\s]*%[\s]*\)/g, '').trim();
      // Skip cells that are purely a percentage value (e.g. yield % columns)
      if (/^[+-]?[\d.]+\s*%$/.test(stripped)) continue;
      if (parseDate(stripped)) continue;
      const n = parseFloat(stripped.replace(/[€$£,\s]/g, '').replace(/[^0-9.-]/g, ''));
      if (!Number.isFinite(n) || n < 0.001 || n > 20) continue;
      payments.push({ exDate: date, amount: n, currency, year: parseInt(date.slice(0, 4), 10) });
      break;
    }
  }
  return payments.sort((a, b) => a.exDate.localeCompare(b.exDate));
}

// ── Digrin scraper ────────────────────────────────────────────────────────────
async function fetchFromDigrin(ticker) {
  const url = `https://www.digrin.com/stocks/detail/${encodeURIComponent(ticker)}/`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Digrin HTTP ${r.status} for ${ticker}`);
  const html = await r.text();

  const payments = tryParseNextData(html, 'EUR') || parseDividendRows(parseTableRows(html), 'EUR');
  if (!payments.length) throw new Error(`Digrin: no dividend rows found for ${ticker}`);
  return payments;
}

// Try __NEXT_DATA__ JSON first (more reliable than HTML table parsing)
function tryParseNextData(html, currency) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    const arr = findDividendArray(data, 0);
    if (!arr || !arr.length) return null;
    return normalizeDividendObjects(arr, currency);
  } catch { return null; }
}

// FIX #1: Recursively find dividend array in Next.js data with safety checks:
//   - Max array length 100 (price history has hundreds of points)
//   - Amounts must look like dividends (< 20), not NAV prices (> 5)
function findDividendArray(obj, depth) {
  if (depth > 12 || obj === null || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    // FIX #1a: price/NAV history arrays have hundreds of entries
    if (obj.length > 100) return null;
    if (obj.length >= 2 && typeof obj[0] === 'object' && obj[0] !== null) {
      const keys = Object.keys(obj[0]).map(k => k.toLowerCase());
      const hasDate = keys.some(k => k.includes('date') || k.includes('ex_') || k.includes('exdate'));
      const hasAmt = keys.some(k => k.includes('amount') || k.includes('value') || k.includes('dividend') || k.includes('div'));
      if (hasDate && hasAmt) {
        // FIX #1b: validate the amounts look like dividends, not NAV prices
        const amtKey = Object.keys(obj[0]).find(k => /amount|value|dividend|div/i.test(k));
        if (amtKey) {
          const sampleAmounts = obj.slice(0, 5).map(x => parseFloat(x[amtKey])).filter(Number.isFinite);
          // If any sample > 20, this is price history, not dividends
          if (sampleAmounts.length > 0 && sampleAmounts.some(a => a > 20)) return null;
        }
        return obj;
      }
    }
    return null;
  }
  // Prioritise keys that sound like dividends
  for (const key of Object.keys(obj)) {
    if (/dividend|div|payment|payout/i.test(key)) {
      const res = findDividendArray(obj[key], depth + 1);
      if (res) return res;
    }
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') {
      const res = findDividendArray(val, depth + 1);
      if (res) return res;
    }
  }
  return null;
}

function normalizeDividendObjects(arr, currency) {
  const payments = [];
  for (const item of arr) {
    const keys = Object.keys(item);
    const dateKey = keys.find(k => /date|ex_date|exdate/i.test(k));
    const date = dateKey ? parseDate(String(item[dateKey])) : null;
    if (!date) continue;
    const amtKey = keys.find(k => /amount|value|dividend|div/i.test(k) && k !== dateKey);
    const amount = amtKey ? parseFloat(String(item[amtKey])) : NaN;
    // FIX #5: apply same range check as parseDividendRows
    if (!Number.isFinite(amount) || amount < 0.001 || amount > 20) continue;
    payments.push({ exDate: date, amount, currency, year: parseInt(date.slice(0, 4), 10) });
  }
  return payments.sort((a, b) => a.exDate.localeCompare(b.exDate));
}

// ── Yahoo Finance dividend events (free, no key, 3y range) ───────────────────
async function fetchFromYahoo(symbol) {
  const currency = symbol.endsWith('.L') ? 'GBp' : 'EUR';
  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3y&interval=1mo&events=div`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;
      const rawCurrency = result.meta?.currency || currency;
      const raw = result.events?.dividends || {};
      const payments = Object.values(raw)
        .map(d => {
          const exDate = new Date(d.date * 1000).toISOString().slice(0, 10);
          const amount = Number(d.amount);
          if (!exDate || !Number.isFinite(amount) || amount < 0.001 || amount > 20) return null;
          return { exDate, amount, currency: rawCurrency, year: parseInt(exDate.slice(0, 4), 10) };
        })
        .filter(Boolean)
        .sort((a, b) => a.exDate.localeCompare(b.exDate));
      if (payments.length >= 3) return payments;
    } catch (_) {}
  }
  throw new Error(`Yahoo: no dividend data for ${symbol}`);
}

// ── StockAnalysis fallback ────────────────────────────────────────────────────
async function fetchFromStockAnalysis(exchange, ticker) {
  const url = `https://stockanalysis.com/quote/${exchange}/${ticker}/dividend/`;
  const currency = exchange === 'lon' ? 'GBp' : 'EUR';
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`StockAnalysis HTTP ${r.status} for ${exchange}:${ticker}`);
  const html = await r.text();
  const payments = parseDividendRows(parseTableRows(html), currency);
  if (!payments.length) throw new Error(`StockAnalysis: no dividend rows found for ${ticker}`);
  return payments;
}

// ── Supabase persistence ──────────────────────────────────────────────────────
function sbEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}
function sbUrl(path) {
  return `${process.env.SUPABASE_URL}/rest/v1${path}`;
}
function sbHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function dbGetDividends(isin) {
  if (!sbEnabled()) return null;
  try {
    const res = await fetch(
      sbUrl(`/dividend_payments?isin=eq.${encodeURIComponent(isin)}&select=ex_date,amount,currency&order=ex_date.asc&limit=500`),
      { headers: sbHeaders() }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map(r => ({
      exDate: r.ex_date,
      amount: Number(r.amount),
      currency: r.currency || 'EUR',
      year: parseInt(r.ex_date.slice(0, 4), 10),
    }));
  } catch { return null; }
}

// FIX #6: Returns { stale, lastUpdated } instead of just boolean
async function dbGetStaleness(isin) {
  if (!sbEnabled()) return { stale: true, lastUpdated: null };
  try {
    const res = await fetch(
      sbUrl(`/dividend_payments?isin=eq.${encodeURIComponent(isin)}&select=updated_at&order=updated_at.desc&limit=1`),
      { headers: sbHeaders() }
    );
    if (!res.ok) return { stale: true, lastUpdated: null };
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return { stale: true, lastUpdated: null };
    const lastUpdated = rows[0].updated_at;
    const ageDays = (Date.now() - new Date(lastUpdated).getTime()) / 86400000;
    return { stale: ageDays > 7, lastUpdated };
  } catch { return { stale: true, lastUpdated: null }; }
}

// FIX #4: await the save so Vercel doesn't kill the lambda before it completes
async function dbSaveDividends(isin, payments, source) {
  if (!sbEnabled() || !payments.length) return false;
  try {
    const now = new Date().toISOString();
    const rows = payments.map(p => ({
      isin,
      ex_date: p.exDate,
      amount: p.amount,
      currency: p.currency || 'EUR',
      source,
      updated_at: now,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const res = await fetch(sbUrl('/dividend_payments?on_conflict=isin,ex_date'), {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.error('[dividends] dbSave error:', await res.text().catch(() => res.status));
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('[dividends] dbSave exception:', e.message);
    return false;
  }
}

// ── Build yearly summary ──────────────────────────────────────────────────────
function buildYearly(payments) {
  const map = {};
  for (const p of payments) {
    if (!map[p.year]) map[p.year] = { year: p.year, totalPerShare: 0, payments: [] };
    map[p.year].totalPerShare = Math.round((map[p.year].totalPerShare + p.amount) * 10000) / 10000;
    map[p.year].payments.push({ exDate: p.exDate, amount: p.amount });
  }
  return Object.values(map).sort((a, b) => a.year - b.year);
}

// FIX #12: A fund is considered delisted if it has data but no payments in 18 months
function detectDelisted(payments) {
  if (!payments.length) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 18);
  const cut = cutoff.toISOString().slice(0, 10);
  return payments.filter(p => p.exDate >= cut).length === 0;
}

// ── Main public function ──────────────────────────────────────────────────────
// FIX #9: accepts { force } to bypass all caches and re-scrape
async function fetchDividendHistory(isin, { force = false } = {}) {
  if (!force) {
    const cached = l1get(isin);
    if (cached) return cached;
  } else {
    L1.delete(isin);
  }

  const tickerInfo = getTickerInfo(isin);
  if (!tickerInfo) {
    return { isin, ticker: null, source: 'no_mapping', currency: 'EUR', fetchedAt: new Date().toISOString(), isDelisted: false, payments: [], yearly: [] };
  }

  // L2: Supabase (skip if force=true)
  if (!force) {
    const { stale, lastUpdated } = await dbGetStaleness(isin);
    if (!stale) {
      const dbPayments = await dbGetDividends(isin);
      if (dbPayments && dbPayments.length > 0) {
        const result = {
          isin,
          ticker: tickerInfo.digrin,
          source: 'supabase',
          currency: dbPayments[0]?.currency || 'EUR',
          fetchedAt: lastUpdated || new Date().toISOString(),
          isDelisted: detectDelisted(dbPayments),
          payments: dbPayments,
          yearly: buildYearly(dbPayments),
        };
        l1set(isin, result);
        return result;
      }
    }
  }

  // Source chain: Digrin → Yahoo (when Digrin < 3 payments) → StockAnalysis
  let payments = [];
  let source = 'no_data';

  // 1. Digrin (primary — HTML table parser with % badge fix)
  try {
    payments = await fetchFromDigrin(tickerInfo.digrin);
    source = 'digrin';
  } catch (e) {
    console.warn(`[dividends] Digrin failed (${tickerInfo.digrin}): ${e.message}`);
  }

  // 2. Yahoo Finance — used when Digrin returns degraded data (< 8 payments).
  //    Quarterly ETFs should have ≥12 payments over 3y. < 8 means Digrin coverage is poor.
  //    Yahoo has clean 3y history for all 4 dividend ETFs.
  if (payments.length < 8 && tickerInfo.yahoo) {
    try {
      const yp = await fetchFromYahoo(tickerInfo.yahoo);
      if (yp.length > payments.length) {
        payments = yp;
        source = 'yahoo';
        console.log(`[dividends] Yahoo upgraded ${isin}: ${yp.length} payments (Digrin had ${payments.length === yp.length ? 0 : payments.length})`);
      }
    } catch (e) {
      console.warn(`[dividends] Yahoo failed (${tickerInfo.yahoo}): ${e.message}`);
    }
  }

  // 3. StockAnalysis — final fallback
  if (!payments.length && tickerInfo.sa) {
    try {
      payments = await fetchFromStockAnalysis(tickerInfo.sa.exchange, tickerInfo.sa.ticker);
      source = 'stockanalysis';
    } catch (e) {
      console.warn(`[dividends] StockAnalysis failed (${tickerInfo.sa?.ticker}): ${e.message}`);
    }
  }

  // FIX #7: structured log on every scrape attempt
  console.log(`[dividends] ${isin} → ${payments.length} payments via ${source} (ticker: ${tickerInfo.digrin})`);

  const now = new Date().toISOString();
  const result = {
    isin,
    ticker: tickerInfo.digrin,
    source,
    currency: payments[0]?.currency || 'EUR',
    fetchedAt: now,
    isDelisted: detectDelisted(payments),
    payments,
    yearly: buildYearly(payments),
  };

  // FIX #4: await so Vercel completes the write before closing the lambda
  if (payments.length) await dbSaveDividends(isin, payments, source).catch(() => {});

  l1set(isin, result);
  return result;
}

module.exports = { fetchDividendHistory, TICKER_MAP, getTickerInfo };
