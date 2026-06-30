// TEMP diagnostic endpoint - DELETE after testing
// GET /api/myinvestor/test-yf?isin=LU0236145453
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const isin = (req.query.isin || 'LU0236145453').toString().toUpperCase();
  const log = [];

  const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'es-ES,es;q=0.9',
  };

  // Test 1: Yahoo Finance search
  let symbol = null;
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${isin}&lang=en-US&region=US&quotesCount=5&newsCount=0&listsCount=0`;
    const r = await fetch(url, { signal: AbortSignal.timeout(7000), headers: YF_HEADERS });
    const text = await r.text();
    log.push({ test: 'yf_search', status: r.status, ok: r.ok, bodySnippet: text.substring(0, 300) });
    if (r.ok) {
      const j = JSON.parse(text);
      const quote = j?.quotes?.[0];
      symbol = quote?.symbol || null;
      log.push({ symbol, quoteType: quote?.quoteType });
    }
  } catch (e) {
    log.push({ test: 'yf_search', error: e.message });
  }

  // Test 2: Yahoo Finance chart (if symbol found)
  if (symbol) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const oneYrAgo = now - 400 * 86400;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${oneYrAgo}&period2=${now}&interval=1mo`;
      const r = await fetch(url, { signal: AbortSignal.timeout(7000), headers: YF_HEADERS });
      const text = await r.text();
      log.push({ test: 'yf_chart', status: r.status, ok: r.ok, bodySnippet: text.substring(0, 300) });
    } catch (e) {
      log.push({ test: 'yf_chart', error: e.message });
    }
  }

  // Test 3: Morningstar
  try {
    const today = new Date(); const s5 = new Date(today); s5.setFullYear(s5.getFullYear()-5);
    const url = `https://lt.morningstar.com/api/rest.svc/timeseries_price/9vehuxllxs?currencyId=EUR&idtype=Isin&frequency=monthly&startDate=${s5.toISOString().slice(0,10)}&outputType=COMPACTJSON&id=${isin}`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://tools.morningstar.es/' }
    });
    const text = await r.text();
    log.push({ test: 'morningstar', status: r.status, ok: r.ok, bodySnippet: text.substring(0, 300) });
  } catch (e) {
    log.push({ test: 'morningstar', error: e.message });
  }

  // Test 4: justETF fund search (new endpoint guess)
  try {
    const url = `https://www.justetf.com/api/funds/cards?locale=en&currency=EUR&isin=${isin}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await r.text();
    log.push({ test: 'justetf_funds', status: r.status, ok: r.ok, bodySnippet: text.substring(0, 200) });
  } catch (e) {
    log.push({ test: 'justetf_funds', error: e.message });
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  return res.end(JSON.stringify({ isin, symbol, log }, null, 2));
};
