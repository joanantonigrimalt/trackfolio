// GET /api/myinvestor/returns?isins=ISIN1,ISIN2,...
// Fetches 1Y / 3Y / 5Y returns from justETF (ETFs) or Morningstar (funds).
// Called by desktop.html after each page render to lazy-load rentabilidades.

function dateBack(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

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

// ── Morningstar: fetch 5Y monthly NAV, derive 1Y/3Y/5Y returns ───────────
// Falls back to null if the fund is not found or the API fails.
async function fetchMorningstar(isin) {
  try {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - 5);
    startDate.setDate(startDate.getDate() - 5);
    const startStr = startDate.toISOString().slice(0, 10);

    const url = `https://lt.morningstar.com/api/rest.svc/timeseries_price/9vehuxllxs?currencyId=EUR&idtype=Isin&frequency=monthly&startDate=${startStr}&outputType=COMPACTJSON&id=${isin}`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Referer': 'https://tools.morningstar.es/',
        'Origin': 'https://tools.morningstar.es',
      },
    });

    if (!r.ok) return { rent1a: null, rent3a: null, rent5a: null };
    const j = await r.json();

    // Response: [{TimeSeries:{Security:[{HistoryDetail:[{EndDate:"...",Value:"..."},...]}]}}]
    const history = j?.[0]?.TimeSeries?.Security?.[0]?.HistoryDetail;
    if (!Array.isArray(history) || history.length < 2) return { rent1a: null, rent3a: null, rent5a: null };

    const sorted = history
      .filter(h => h.EndDate && h.Value != null)
      .sort((a, b) => a.EndDate.localeCompare(b.EndDate));

    const latestVal = parseFloat(sorted[sorted.length - 1].Value);
    if (isNaN(latestVal) || latestVal === 0) return { rent1a: null, rent3a: null, rent5a: null };

    const calcReturn = (yearsBack) => {
      const target = new Date(today);
      target.setFullYear(target.getFullYear() - yearsBack);
      const targetStr = target.toISOString().slice(0, 10);
      // Find closest entry on or before target date
      let closest = null;
      for (const entry of sorted) {
        if (entry.EndDate <= targetStr) closest = entry;
        else break;
      }
      if (!closest) return null;
      const startVal = parseFloat(closest.Value);
      if (isNaN(startVal) || startVal === 0) return null;
      return Math.round(((latestVal / startVal) - 1) * 10000) / 100;
    };

    return {
      rent1a: calcReturn(1),
      rent3a: calcReturn(3),
      rent5a: calcReturn(5),
    };
  } catch (e) {
    console.warn('[returns] Morningstar error for', isin, e.message);
    return { rent1a: null, rent3a: null, rent5a: null };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const raw = (req.query.isins || req.query.isin || '').toString();
  // Validate ISIN format: 2 letters + 10 alphanumeric
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

  // Step 1: fetch justETF data for all ISINs in parallel (1Y batched + 3Y/5Y concurrent)
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

  // Step 2: find ISINs with no justETF data → try Morningstar
  const noData = isins.filter(isin =>
    returns1y[isin] == null &&
    multiYear.r3[isin] == null &&
    multiYear.r5[isin] == null
  );

  const msResults = {};
  if (noData.length > 0) {
    const CONCURRENCY = 15;
    for (let i = 0; i < noData.length; i += CONCURRENCY) {
      const batch = noData.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async (isin) => {
        const ms = await fetchMorningstar(isin);
        return { isin, ...ms };
      }));
      for (const { isin, rent1a, rent3a, rent5a } of results) {
        msResults[isin] = { rent1a, rent3a, rent5a };
      }
    }
  }

  // Step 3: merge
  const output = {};
  for (const isin of isins) {
    if (msResults[isin]) {
      output[isin] = msResults[isin];
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
