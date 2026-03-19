// lib/insiders.js — Insider trading data
// Provider chain: L1 (in-memory) → L2 (Supabase) → Finnhub → SEC EDGAR
//
// Finnhub: fast (~200ms), JSON, 60 req/min free. Requires FINNHUB_API_KEY.
// SEC EDGAR: free, no key needed, but slow (~5s cold: 1MB CIK map + Form 4 XML parsing).

const { getCache, setCache, dbGetInsiders, dbSaveInsiders } = require('./cache');

const TTL = 6 * 60 * 60; // 6 hours

// ── Finnhub provider ──────────────────────────────────────────────────────────
// GET /stock/insider-transactions?symbol=AAPL&token=KEY
// transactionCode: P=Purchase S=Sale F=TaxWithhold(sell) X=Exercise(sell)
async function fetchFromFinnhub(symbol) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY not set');
  const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&token=${key}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Finnhub HTTP ${r.status}`);
  const json = await r.json();
  const rows = Array.isArray(json.data) ? json.data : [];
  const data = rows
    .filter(t => ['P', 'S', 'F', 'X'].includes(t.transactionCode))
    .map(t => ({
      symbol:               (t.symbol || symbol).toUpperCase(),
      companyName:          '',
      reportingName:        t.name || '—',
      typeOfOwner:          '',
      transactionDate:      t.transactionDate || t.filingDate || '',
      transactionType:      t.transactionCode === 'P' ? 'P-Purchase' : 'S-Sale',
      securitiesTransacted: Math.abs(t.change || 0),
      price:                t.transactionPrice || 0,
      securityName:         'Common Stock',
      link:                 '',
      isDerivative:         false,
    }))
    .filter(t => t.transactionDate && t.securitiesTransacted > 0)
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
    .slice(0, 50);
  return data;
}

// ── SEC EDGAR provider ────────────────────────────────────────────────────────
const SEC_HDRS = {
  'User-Agent': 'Finasset/1.0 app@finasset.app',
  'Accept':     'application/json, text/html, application/xml',
};

async function secFetch(url, ms = 6000) {
  const r = await fetch(url, { headers: SEC_HDRS, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`SEC HTTP ${r.status}`);
  return r;
}

let _cikMap   = null;
let _titleMap = null;

async function getCikMap() {
  if (_cikMap) return _cikMap;
  const hit = getCache('sec:cik_map');
  if (hit) { _cikMap = hit; _titleMap = getCache('sec:title_map') || {}; return _cikMap; }
  const r   = await secFetch('https://www.sec.gov/files/company_tickers.json', 8000);
  const raw = await r.json();
  const cik = {}, title = {};
  for (const v of Object.values(raw)) {
    const t = v.ticker.toUpperCase();
    cik[t]   = String(v.cik_str).padStart(10, '0');
    title[t] = v.title;
  }
  _cikMap   = cik;
  _titleMap = title;
  setCache('sec:cik_map',   cik,   12 * 60 * 60);
  setCache('sec:title_map', title, 12 * 60 * 60);
  return _cikMap;
}

function getCompanyTitle(symbol) {
  return (_titleMap || {})[symbol.toUpperCase()] || '';
}

function parseForm4(xml, filingDate, accession, cikNum, knownSymbol) {
  const get = tag => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>\\s*(?:<value>)?([^<]+?)(?:</value>)?\\s*</${tag}>`, 'i'));
    return m ? m[1].trim() : '';
  };

  const rawSymbol    = get('issuerTradingSymbol') || knownSymbol || '';
  const companyName  = get('issuerName') || getCompanyTitle(rawSymbol);
  const reporterName = get('rptOwnerName');
  const officerTitle = get('officerTitle');
  const isDirector   = get('isDirector') === '1';
  const isOfficer    = get('isOfficer') === '1';
  const role         = officerTitle || (isDirector ? 'Director' : isOfficer ? 'Officer' : 'Insider');
  const accClean     = accession.replace(/-/g, '');
  const link         = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${accession}-index.htm`;

  const txns = [];

  const ndRe = /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi;
  let m;
  while ((m = ndRe.exec(xml)) !== null) {
    const blk  = m[1];
    const getB = tag => {
      const bm = blk.match(new RegExp(`<${tag}[^>]*>\\s*(?:<value>)?([^<]+?)(?:</value>)?\\s*</${tag}>`, 'i'));
      return bm ? bm[1].trim() : '';
    };
    const date   = getB('transactionDate') || filingDate;
    const shares = parseFloat(getB('transactionShares'));
    const price  = parseFloat(getB('transactionPricePerShare')) || 0;
    const code   = getB('transactionAcquiredDisposedCode');
    const secTy  = getB('securityTitle');
    if (!shares || isNaN(shares) || !date) continue;
    txns.push({
      symbol:               rawSymbol,
      companyName,
      reportingName:        reporterName,
      typeOfOwner:          role,
      transactionDate:      date,
      transactionType:      code === 'A' ? 'P-Purchase' : 'S-Sale',
      securitiesTransacted: Math.abs(shares),
      price,
      securityName:         secTy || 'Common Stock',
      link,
      isDerivative:         false,
    });
  }

  const dRe = /<derivativeTransaction>([\s\S]*?)<\/derivativeTransaction>/gi;
  while ((m = dRe.exec(xml)) !== null) {
    const blk  = m[1];
    const getB = tag => {
      const bm = blk.match(new RegExp(`<${tag}[^>]*>\\s*(?:<value>)?([^<]+?)(?:</value>)?\\s*</${tag}>`, 'i'));
      return bm ? bm[1].trim() : '';
    };
    const code = getB('transactionAcquiredDisposedCode');
    if (code !== 'D') continue;
    const date   = getB('transactionDate') || filingDate;
    const shares = parseFloat(getB('underlyingSecurityShares')) || parseFloat(getB('transactionShares'));
    const price  = parseFloat(getB('transactionPricePerShare')) || parseFloat(getB('exercisePrice')) || 0;
    const secTy  = getB('securityTitle');
    if (!shares || isNaN(shares) || !date) continue;
    txns.push({
      symbol:               rawSymbol,
      companyName,
      reportingName:        reporterName,
      typeOfOwner:          role,
      transactionDate:      date,
      transactionType:      'S-Sale',
      securitiesTransacted: Math.abs(shares),
      price,
      securityName:         secTy || 'Common Stock',
      link,
      isDerivative:         true,
    });
  }

  return txns;
}

async function fetchFromSec(symbol) {
  const cikMap = await getCikMap();
  const cik10  = cikMap[symbol];
  if (!cik10) return [];
  const cikNum = parseInt(cik10, 10);

  const subR   = await secFetch(`https://data.sec.gov/submissions/CIK${cik10}.json`);
  const sub    = await subR.json();
  const recent = sub.filings?.recent || {};
  const forms  = recent.form            || [];
  const dates  = recent.filingDate      || [];
  const accs   = recent.accessionNumber || [];
  const docs   = recent.primaryDocument || [];

  const form4s = [];
  for (let i = 0; i < forms.length && form4s.length < 5; i++) {
    if (forms[i] === '4') form4s.push({ date: dates[i], acc: accs[i], doc: docs[i] });
  }

  const parsed = await Promise.all(form4s.map(async ({ date, acc, doc }) => {
    try {
      const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc.replace(/-/g, '')}/${doc}`;
      const r   = await secFetch(url);
      const xml = await r.text();
      return parseForm4(xml, date, acc, cikNum, symbol);
    } catch (_) { return []; }
  }));

  return parsed.flat().sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

// ── Main fetch function ───────────────────────────────────────────────────────
async function fetchInsidersForSymbol(symbol) {
  const cacheKey = `insiders:${symbol}`;

  // L1 in-memory (warm instance)
  const l1 = getCache(cacheKey);
  if (l1) return { data: l1, source: 'l1' };

  // L2 Supabase (shared across cold starts)
  const l2 = await dbGetInsiders(symbol);
  if (l2) { setCache(cacheKey, l2, TTL); return { data: l2, source: 'l2' }; }

  // Try Finnhub first (fast, ~200ms)
  if (process.env.FINNHUB_API_KEY) {
    try {
      const data = await fetchFromFinnhub(symbol);
      setCache(cacheKey, data, TTL);
      await dbSaveInsiders(symbol, data).catch(() => {});
      return { data, source: 'finnhub' };
    } catch (e) {
      console.warn(`[insiders] Finnhub failed for ${symbol}:`, e.message);
    }
  }

  // Fall back to SEC EDGAR (slow, no key needed)
  try {
    const data = await fetchFromSec(symbol);
    setCache(cacheKey, data, TTL);
    await dbSaveInsiders(symbol, data).catch(() => {});
    return { data, source: 'sec' };
  } catch (e) {
    console.error(`[insiders] SEC EDGAR failed for ${symbol}:`, e.message);
    return { data: [], source: 'sec', error: e.message };
  }
}

module.exports = { fetchInsidersForSymbol, getCikMap, getCompanyTitle };
