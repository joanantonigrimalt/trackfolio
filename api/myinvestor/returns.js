// GET /api/myinvestor/returns?isins=ISIN1,ISIN2,...
// Fetches 1Y / 3Y / 5Y returns from justETF for up to 100 ISINs.
// Called by desktop.html after each page render to lazy-load rentabilidades.

function dateBack(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

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

  // Fetch 1Y (batched cards) and 3Y+5Y (concurrent per ISIN) simultaneously
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

  const output = {};
  for (const isin of isins) {
    output[isin] = {
      rent1a: returns1y[isin] ?? null,
      rent3a: multiYear.r3[isin] ?? null,
      rent5a: multiYear.r5[isin] ?? null,
    };
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.statusCode = 200;
  return res.end(JSON.stringify({ returns: output, count: isins.length, updated: today }));
};
