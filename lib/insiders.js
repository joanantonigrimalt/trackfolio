// lib/insiders.js — SEC EDGAR Form 4 fetch + parse
// Shared by api/insiders.js and api/cron/warmup.js
//
// Parses both nonDerivativeTransaction (direct purchases/sales) and
// derivativeTransaction sales (RSU/option disposals — real insider selling).

const { getCache, setCache, dbGetInsiders, dbSaveInsiders } = require('./cache');

const TTL = 6 * 60 * 60; // 6 hours
const SEC_HDRS = {
  'User-Agent': 'Finasset/1.0 app@finasset.app',
  'Accept': 'application/json, text/html, application/xml',
};

async function secFetch(url, ms = 6000) {
  const r = await fetch(url, { headers: SEC_HDRS, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`SEC HTTP ${r.status}`);
  return r;
}

// ── Ticker → CIK + company title map ─────────────────────────────────────────
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

// ── Form 4 XML parser ─────────────────────────────────────────────────────────
// Handles both .xml and .htm primary documents (EDGAR embeds XML in HTML too).
// Parses:
//   • nonDerivativeTransaction — direct stock buys (A) and sells (D)
//   • derivativeTransaction    — only disposals (D): RSU vesting sales, option exercises
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

  // Non-derivative: direct stock purchases & sales
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

  // Derivative: only disposals (D) — RSU sales, option exercises resulting in sells
  const dRe = /<derivativeTransaction>([\s\S]*?)<\/derivativeTransaction>/gi;
  while ((m = dRe.exec(xml)) !== null) {
    const blk  = m[1];
    const getB = tag => {
      const bm = blk.match(new RegExp(`<${tag}[^>]*>\\s*(?:<value>)?([^<]+?)(?:</value>)?\\s*</${tag}>`, 'i'));
      return bm ? bm[1].trim() : '';
    };
    const code = getB('transactionAcquiredDisposedCode');
    if (code !== 'D') continue; // ignore grants (A) — only sells
    const date   = getB('transactionDate') || filingDate;
    // underlyingSecurityShares gives the actual shares of common stock affected
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

// ── Main fetch function ───────────────────────────────────────────────────────
async function fetchInsidersForSymbol(symbol) {
  const cacheKey = `insiders:sec:${symbol}`;

  // L1 in-memory (warm instance)
  const l1 = getCache(cacheKey);
  if (l1) return { data: l1, source: 'l1' };

  // L2 Supabase (shared across cold starts)
  const l2 = await dbGetInsiders(symbol);
  if (l2) { setCache(cacheKey, l2, TTL); return { data: l2, source: 'l2' }; }

  // Fetch from SEC EDGAR
  const cikMap = await getCikMap();
  const cik10  = cikMap[symbol];
  if (!cik10) {
    const empty = [];
    setCache(cacheKey, empty, TTL);
    dbSaveInsiders(symbol, empty).catch(() => {});
    return { data: empty, source: 'sec', notFound: true };
  }
  const cikNum = parseInt(cik10, 10);

  const subR   = await secFetch(`https://data.sec.gov/submissions/CIK${cik10}.json`);
  const sub    = await subR.json();
  const recent = sub.filings?.recent || {};
  const forms  = recent.form             || [];
  const dates  = recent.filingDate       || [];
  const accs   = recent.accessionNumber  || [];
  const docs   = recent.primaryDocument  || [];

  const form4s = [];
  for (let i = 0; i < forms.length && form4s.length < 5; i++) {
    if (forms[i] === '4') form4s.push({ date: dates[i], acc: accs[i], doc: docs[i] });
  }

  const all = [];
  for (let i = 0; i < form4s.length; i += 5) {
    const batch  = form4s.slice(i, i + 5);
    const parsed = await Promise.all(batch.map(async ({ date, acc, doc }) => {
      try {
        const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc.replace(/-/g, '')}/${doc}`;
        const r   = await secFetch(url);
        const xml = await r.text();
        return parseForm4(xml, date, acc, cikNum, symbol);
      } catch (_) { return []; }
    }));
    all.push(...parsed.flat());
  }

  const data = all.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  setCache(cacheKey, data, TTL);
  await dbSaveInsiders(symbol, data).catch(() => {});
  return { data, source: 'sec' };
}

module.exports = { fetchInsidersForSymbol, getCikMap, getCompanyTitle };
