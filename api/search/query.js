// GET /api/search/query?q=apple
// Universal asset search via Yahoo Finance (free, no key required)
// Returns: stocks, ETFs, funds, crypto, ETCs, indices

const CACHE = new Map();
const TTL = 5 * 60 * 1000; // 5 min
const cget = k => { const e=CACHE.get(k); if(!e||Date.now()>e.x){CACHE.delete(k);return null;} return e.v; };
const cset = (k,v) => CACHE.set(k,{v,x:Date.now()+TTL});

const TYPE_MAP = {
  EQUITY:       'stock',
  ETF:          'etf',
  MUTUALFUND:   'fund',
  CRYPTOCURRENCY:'crypto',
  INDEX:        'index',
  FUTURE:       'future',
  CURRENCY:     'fx',
};

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const q = String(req.query?.q || '').trim();
  if (!q || q.length < 2) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'query_too_short' }));
  }

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = cget(cacheKey);
  if (cached) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ results: cached }));
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&enableFuzzyQuery=true&enableCb=false`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'application/json' }
    });
    if (!r.ok) throw new Error(`Yahoo search HTTP ${r.status}`);
    const data = await r.json();

    const results = (data.quotes || [])
      .filter(q => q.symbol && q.quoteType && q.quoteType !== 'OPTION')
      .slice(0, 12)
      .map(q => ({
        symbol:    q.symbol,
        isin:      q.isin   || null,
        name:      q.longname  || q.shortname || q.symbol,
        shortName: q.shortname || q.longname  || q.symbol,
        type:      TYPE_MAP[q.quoteType] || q.quoteType?.toLowerCase() || 'unknown',
        typeLabel: q.typeDisp || q.quoteType || '',
        exchange:  q.exchDisp || q.exchange || '',
        currency:  q.currency || null,
      }));

    cset(cacheKey, results);
    res.statusCode = 200;
    res.end(JSON.stringify({ results }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
};
