// GET /api/myinvestor/returns?isins=ISIN1,ISIN2,...
// Fetches 1Y / 3Y / 5Y returns from justETF (ETFs) or Yahoo Finance (funds).
// Called by desktop.html after each page render to lazy-load rentabilidades.

function dateBack(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

// ── justETF: 1Y batched via cards endpoint ────────────────────────────────
async function fetch1Y(isins) {
  const results = {};
  const batches = [];
  for (let i = 0; i < isins.length; i += 50) batches.push(isins.slice(i, i + 50));

  await Promise.all(batches.map(async (batch) => {
    try {
      const params = batch.map(i => `isin=${encodeURIComponent(i)}`).join('&');
      const r = await fetch(
        `https://www.justetf.com/api/etfs/cards?locale=en&currency=EUR&${params}`,
        { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Finasset/1.0)' } }
      );
      const j = await r.json();
      for (const etf of (j.etfs || [])) {
        results[etf.isin] = etf.returns?.raw ?? null;
      }
    } catch (e) {
      console.warn('[returns] 1Y batch error:', e.message);
    }
  }));
  return results;
}

// ── justETF: multi-year performance-chart per ISIN ────────────────────────
async function fetchPerf(isin, dateFrom, today) {
  try {
    const url = `https://www.justetf.com/api/etfs/${isin}/performance-chart?locale=en&currency=EUR&valuesType=RELATIVE_CHANGE&reduceData=true&includeDividends=true&dateFrom=${dateFrom}&dateTo=${today}`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Finasset/1.0)' },
    });
    const j = await r.json();
    return j.performance?.raw ?? null;
  } catch (e) {
    return null;
  }
}

// ── Yahoo Finance: ISIN → ticker symbol ──────────────────────────────────
async function yfSearch(isin) {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${isin}&lang=en-US&region=US&quotesCount=5&newsCount=0&listsCount=0&enableFuzzyQuery=false&enableNavLinks=false`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), headers: YF_HEADERS });
    const j = await r.json();
    const quotes = j?.quotes || [];
    // Prefer MUTUALFUND or EQUITY type; filter out options/futures
    const best = quotes.find(q => q.quoteType === 'MUTUALFUND' || q.quoteType === 'ETF' || q.quoteType === 'EQUITY');
    return best?.symbol || null;
  } catch (e) {
    return null;
  }
}

// ── Yahoo Finance: 5Y monthly chart → derive 1Y/3Y/5Y ────────────────────
async function fetchYahoo(isin) {
  try {
    const symbol = await yfSearch(isin);
    if (!symbol) return { rent1a: null, rent3a: null, rent5a: null };

    const now = Math.floor(Date.now() / 1000);
    const fiveYrsAgo = now - Math.ceil((5 * 365.25 + 10)) * 86400;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${fiveYrsAgo}&period2=${now}&interval=1mo&includeAdjustedClose=true`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: YF_HEADERS });
    const j = await r.json();

    const result = j?.chart?.result?.[0];
    const timestamps = result?.timestamp;
    const closes = result?.indicators?.adjclose?.[0]?.adjclose
      || result?.indicators?.quote?.[0]?.close;

    if (!timestamps || !closes || timestamps.length < 2) return { rent1a: null, rent3a: null, rent5a: null };

    // Build valid pairs (filter nulls)
    const pairs = timestamps
      .map((ts, i) => ({ ts: ts * 1000, val: closes[i] }))
      .filter(p => p.val != null && !isNaN(p.val));

    if (pairs.length < 2) return { rent1a: null, rent3a: null, rent5a: null };

    const latestVal = pairs[pairs.length - 1].val;
    const latestTime = pairs[pairs.length - 1].ts;

    const calcReturn = (yearsBack) => {
      const targetTime = latestTime - yearsBack * 365.25 * 86400 * 1000;
      // Find closest pair to target time (must not be the latest itself)
      let closest = null;
      let minDiff = Infinity;
      for (const p of pairs.slice(0, -1)) {
        const diff = Math.abs(p.ts - targetTime);
        if (diff < minDiff) { minDiff = diff; closest = p; }
      }
      if (!closest || closest.val === 0) return null;
      // Only return if data is reasonably close to the target date (within 2 months)
      if (minDiff > 70 * 86400 * 1000) return null;
      return Math.round(((latestVal / closest.val) - 1) * 10000) / 100;
    };

    return {
      rent1a: calcReturn(1),
      rent3a: calcReturn(3),
      rent5a: calcReturn(5),
    };
  } catch (e) {
    console.warn('[returns] Yahoo error for', isin, e.message);
    return { rent1a: null, rent3a: null, rent5a: null };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const raw = (req.query.isins || req.query.isin || '').toString();
  const isins = raw
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => /^[A-Z]{2}[A-Z0-9]{10}$/.test(s))
    .slice(0, 100);

  if (isins.length === 0) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'isins param required (comma-separated ISINs, max 100)' }));
  }

  const today = new Date().toISOString().slice(0, 10);
  const d3 = dateBack(3);
  const d5 = dateBack(5);

  // Step 1: justETF — 1Y batched + 3Y/5Y concurrent
  const [returns1y, multiYear] = await Promise.all([
    fetch1Y(isins),
    (async () => {
      const r3 = {}, r5 = {};
      const CONCURRENCY = 20;
      for (let i = 0; i < isins.length; i += CONCURRENCY) {
        const batch = isins.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (isin) => {
          const [v3, v5] = await Promise.all([
            fetchPerf(isin, d3, today),
            fetchPerf(isin, d5, today),
          ]);
          return { isin, v3, v5 };
        }));
        for (const { isin, v3, v5 } of results) {
          r3[isin] = v3;
          r5[isin] = v5;
        }
      }
      return { r3, r5 };
    })(),
  ]);

  // Step 2: find ISINs with no justETF data → try Yahoo Finance
  const noData = isins.filter(isin =>
    (returns1y[isin] == null) &&
    (multiYear.r3[isin] == null) &&
    (multiYear.r5[isin] == null)
  );

  const yfResults = {};
  if (noData.length > 0) {
    const CONCURRENCY = 10;
    for (let i = 0; i < noData.length; i += CONCURRENCY) {
      const batch = noData.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async (isin) => {
        const yf = await fetchYahoo(isin);
        return { isin, ...yf };
      }));
      for (const { isin, rent1a, rent3a, rent5a } of results) {
        yfResults[isin] = { rent1a, rent3a, rent5a };
      }
    }
  }

  // Step 3: merge results (Yahoo Finance takes priority for funds)
  const output = {};
  for (const isin of isins) {
    if (yfResults[isin] && (yfResults[isin].rent1a != null || yfResults[isin].rent3a != null)) {
      output[isin] = yfResults[isin];
    } else {
      output[isin] = {
        rent1a: returns1y[isin] ?? null,
        rent3a: multiYear.r3[isin] ?? null,
        rent5a: multiYear.r5[isin] ?? null,
      };
    }
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.statusCode = 200;
  return res.end(JSON.stringify({ returns: output, count: isins.length, updated: today }));
};
