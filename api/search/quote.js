// GET /api/search/quote?symbol=AAPL
// Current price + 5y history for any Yahoo symbol
// Used when adding a new asset to get its live price and chart data

const CACHE = new Map();
const TTL = 30 * 60 * 1000; // 30 min
const cget = k => { const e=CACHE.get(k); if(!e||Date.now()>e.x){CACHE.delete(k);return null;} return e.v; };
const cset = (k,v) => CACHE.set(k,{v,x:Date.now()+TTL});

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const symbol = String(req.query?.symbol || '').trim();
  if (!symbol) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'symbol_required' }));
  }

  const k = `quote:${symbol}`;
  const cached = cget(k);
  if (cached) {
    res.statusCode = 200;
    return res.end(JSON.stringify(cached));
  }

  try {
    for (const host of ['query1', 'query2']) {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'application/json' }
      });
      if (!r.ok) continue;
      const data = await r.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const meta = result.meta || {};
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];

      const history = [];
      for (let i = 0; i < timestamps.length; i++) {
        const c = Number(closes[i]);
        if (Number.isFinite(c) && c > 0) {
          history.push({ date: new Date(timestamps[i]*1000).toISOString().slice(0,10), close: c });
        }
      }

      const currentPrice = Number(meta.regularMarketPrice ?? closes[closes.length-1] ?? 0);
      const currency = meta.currency || 'USD';
      const name = meta.longName || meta.shortName || symbol;

      const out = { symbol, name, currentPrice, currency, history };
      if (history.length > 10) cset(k, out);

      res.statusCode = 200;
      return res.end(JSON.stringify(out));
    }
    throw new Error('No data from Yahoo');
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
};
