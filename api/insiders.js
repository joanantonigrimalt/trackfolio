// GET /api/insiders?symbol=AAPL
//
// Fetches insider trading data from SEC EDGAR (Form 4 filings).
// Free — no API key needed. Data is the primary source (SEC requires Form 4 within 2 days of trade).
// Caches 6 hours per symbol.

const { setupApi } = require('../lib/security');
const { getCache, setCache } = require('../lib/cache');

const TTL = 6 * 60 * 60; // 6 hours
const SEC_HDRS = {
  'User-Agent': 'Finasset/1.0 app@finasset.app',
  'Accept': 'application/json, text/html, application/xml',
};

async function secFetch(url, timeoutMs = 6000) {
  const r = await fetch(url, { headers: SEC_HDRS, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`SEC HTTP ${r.status} ${url}`);
  return r;
}

// In-process ticker→CIK map (populated once per function warm instance)
let _cikMap = null;
async function getCikMap() {
  if (_cikMap) return _cikMap;
  const hit = getCache('sec:cik_map');
  if (hit) { _cikMap = hit; return _cikMap; }
  const r = await secFetch('https://www.sec.gov/files/company_tickers.json', 8000);
  const raw = await r.json();
  const map = {};
  for (const v of Object.values(raw)) {
    map[v.ticker.toUpperCase()] = String(v.cik_str).padStart(10, '0');
  }
  _cikMap = map;
  setCache('sec:cik_map', map, 12 * 60 * 60); // 12h
  return map;
}

// Parse Form 4 XML → array of transaction objects compatible with the existing renderer
function parseForm4(xml, filingDate, accession, cikNum) {
  const get = tag => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>\\s*(?:<value>)?([^<]+?)(?:</value>)?\\s*</${tag}>`, 'i'));
    return m ? m[1].trim() : '';
  };

  const issuerSymbol  = get('issuerTradingSymbol');
  const reporterName  = get('rptOwnerName');
  const officerTitle  = get('officerTitle');
  const isDirector    = get('isDirector') === '1';
  const isOfficer     = get('isOfficer') === '1';
  const role          = officerTitle || (isDirector ? 'Director' : isOfficer ? 'Officer' : 'Insider');

  // Link to SEC filing index page
  const accClean = accession.replace(/-/g, '');
  const link = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${accession}-index.htm`;

  const txns = [];
  const blockRe = /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi;
  let m;
  while ((m = blockRe.exec(xml)) !== null) {
    const blk = m[1];
    const getB = tag => {
      const bm = blk.match(new RegExp(`<${tag}[^>]*>\\s*(?:<value>)?([^<]+?)(?:</value>)?\\s*</${tag}>`, 'i'));
      return bm ? bm[1].trim() : '';
    };
    const date   = getB('transactionDate') || filingDate;
    const shares = parseFloat(getB('transactionShares'));
    const price  = parseFloat(getB('transactionPricePerShare')) || 0;
    const code   = getB('transactionAcquiredDisposedCode'); // A = acquired, D = disposed
    const secTy  = getB('securityTitle');
    if (!shares || isNaN(shares) || !date) continue;
    txns.push({
      symbol:               issuerSymbol,
      reportingName:        reporterName,
      typeOfOwner:          role,
      transactionDate:      date,
      transactionType:      code === 'A' ? 'P-Purchase' : 'S-Sale',
      securitiesTransacted: Math.abs(shares),
      price,
      securityName:         secTy || 'Common Stock',
      link,
    });
  }
  return txns;
}

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 30 })) return;

  const symbol = String(req.query?.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

  // No symbol → return empty (frontend shows placeholder)
  if (!symbol) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify([]));
  }

  const cacheKey = `insiders:sec:${symbol}`;
  const hit = getCache(cacheKey);
  if (hit) {
    res.setHeader('X-Cache', 'HIT');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(hit));
  }
  res.setHeader('X-Cache', 'MISS');

  try {
    // 1. Resolve ticker → CIK
    const cikMap = await getCikMap();
    const cik10  = cikMap[symbol];
    if (!cik10) {
      setCache(cacheKey, [], TTL);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify([]));
    }
    const cikNum = parseInt(cik10, 10);

    // 2. Fetch recent filings for this company
    const subR   = await secFetch(`https://data.sec.gov/submissions/CIK${cik10}.json`);
    const sub    = await subR.json();
    const recent = sub.filings?.recent || {};
    const forms  = recent.form           || [];
    const dates  = recent.filingDate     || [];
    const accs   = recent.accessionNumber || [];
    const docs   = recent.primaryDocument || [];

    // Collect last 10 Form 4 filings
    const form4s = [];
    for (let i = 0; i < forms.length && form4s.length < 10; i++) {
      if (forms[i] === '4') form4s.push({ date: dates[i], acc: accs[i], doc: docs[i] });
    }

    // 3. Fetch & parse XMLs — batches of 5 to respect SEC rate limits
    const all = [];
    for (let i = 0; i < form4s.length; i += 5) {
      const batch = form4s.slice(i, i + 5);
      const parsed = await Promise.all(batch.map(async ({ date, acc, doc }) => {
        try {
          const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc.replace(/-/g, '')}/${doc}`;
          const r   = await secFetch(url);
          const xml = await r.text();
          return parseForm4(xml, date, acc, cikNum);
        } catch (_) { return []; }
      }));
      all.push(...parsed.flat());
    }

    const data = all.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    setCache(cacheKey, data, TTL);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  } catch (e) {
    console.error('[insiders/sec] error:', e.message);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: e.message, data: [] }));
  }
};
