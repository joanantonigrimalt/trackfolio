// GET /api/myinvestor/catalog
// Dynamic catalog: fetches all ETFs/Funds from Google Sheet (public) and caches 7 days via CDN.
// Google Sheet: https://docs.google.com/spreadsheets/d/1Qj4avyVAIwhaqqXI4UBL0WB_0oo1taPUu4ZwUstUeC0/
// ~4574 products, no filter, deduped by ISIN.

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Qj4avyVAIwhaqqXI4UBL0WB_0oo1taPUu4ZwUstUeC0/export?format=csv&gid=0';

// In-memory cache per serverless instance (avoids re-fetching on warm invocations)
let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 24 * 60 * 60 * 1000; // 1 day — refresca rentabilidades semanales sin lag (el Sheet se regenera semanalmente)

function parsePct(s) {
  if (!s) return null;
  s = s.trim().replace('%', '').replace(/,/g, '.');
  if (s === '-' || s === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function parseTer(s) {
  if (!s) return null;
  s = s.trim().replace('%', '').replace('p.a.', '').replace(/,/g, '.').trim();
  if (s === '-' || s === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n * 10000) / 10000;
}

function parseCSV(text) {
  // Header: ID,Nombre,ISIN,Ticker,Divisa,Pais,Mercado Cod,Mercado,Precio,Fecha Precio,
  //         1 mes %,3 meses %,6 meses %,YTD %,1 anio %,3 anios %,5 anios %,
  //         Tipo,TER anual,Distribucion,...,TV Semanal,TV Mensual,...
  const lines = text.split('\n');
  const products = [];
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSV parse: handle quoted fields
    const row = [];
    let cur = '', inQ = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') { inQ = !inQ; continue; }
      if (!inQ && c === ',') { row.push(cur); cur = ''; continue; }
      cur += c;
    }
    row.push(cur);

    if (row.length < 18) continue;
    const isin = (row[2] || '').trim();
    const nombre = (row[1] || '').trim();
    if (!isin || isin.length < 10 || !nombre) continue;
    if (seen.has(isin)) continue;
    seen.add(isin);

    products.push({
      isin,
      nombre,
      tipo: (row[17] || 'ETF').trim(),
      divisa: (row[4] || 'EUR').trim(),
      ter: parseTer(row[18]),
      distribucion: (row[19] || '').trim(),
      rent1a: parsePct(row[14]),
      rent3a: parsePct(row[15]),
      rent5a: parsePct(row[16]),
      mercado: (row[7] || '').trim(),
    });
  }
  return products;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public,max-age=86400,stale-while-revalidate=604800');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Serve from in-memory cache if fresh
  if (_cache && (Date.now() - _cacheAt) < CACHE_MS) {
    return res.end(JSON.stringify({
      products: _cache,
      count: _cache.length,
      updated: new Date(_cacheAt).toISOString().slice(0, 10),
    }));
  }

  try {
    const r = await fetch(SHEET_URL, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!r.ok) throw new Error('Sheet fetch failed: ' + r.status);
    const text = await r.text();
    const products = parseCSV(text);
    if (products.length < 100) throw new Error('Too few products: ' + products.length);

    _cache = products;
    _cacheAt = Date.now();

    return res.end(JSON.stringify({
      products: _cache,
      count: _cache.length,
      updated: new Date(_cacheAt).toISOString().slice(0, 10),
    }));
  } catch (err) {
    // If fetch fails, return cached data (even if stale) or empty
    if (_cache) {
      return res.end(JSON.stringify({
        products: _cache,
        count: _cache.length,
        updated: new Date(_cacheAt).toISOString().slice(0, 10),
        stale: true,
      }));
    }
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: err.message, products: [], count: 0 }));
  }
};
