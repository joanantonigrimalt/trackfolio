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

// Divide una línea CSV respetando campos entre comillas.
function splitCsvLine(line) {
  const row = [];
  let cur = '', inQ = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '"') { inQ = !inQ; continue; }
    if (!inQ && c === ',') { row.push(cur); cur = ''; continue; }
    cur += c;
  }
  row.push(cur);
  return row;
}

// Normaliza un nombre de cabecera: minúsculas, sin acentos, espacios colapsados.
function normHeader(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseCSV(text) {
  // Cabecera esperada (orden REAL puede variar → resolvemos por NOMBRE, no por índice):
  //   ID,Nombre,ISIN,Ticker,Divisa,Pais,Mercado Cod,Mercado,Precio,Fecha Precio,
  //   1 mes %,3 meses %,6 meses %,YTD %,1 anio %,3 anios %,5 anios %,Tipo,TER anual,Distribucion,...
  const lines = text.split('\n');
  const products = [];
  const seen = new Set();
  if (!lines.length) return products;

  // Mapa nombre-normalizado → índice a partir de la fila de cabecera.
  const headerCells = splitCsvLine(lines[0].trim()).map(normHeader);
  const colMap = {};
  headerCells.forEach((h, idx) => { if (h && !(h in colMap)) colMap[h] = idx; });

  // Resuelve el índice de una columna por candidatos de nombre; si no aparece, usa el índice de reserva.
  const idxOf = (candidates, fallbackIdx) => {
    for (const c of candidates) { const k = normHeader(c); if (k in colMap) return colMap[k]; }
    return fallbackIdx;
  };
  const cols = {
    nombre:       idxOf(['nombre', 'name'], 1),
    isin:         idxOf(['isin'], 2),
    divisa:       idxOf(['divisa', 'moneda', 'currency'], 4),
    mercado:      idxOf(['mercado'], 7),   // 'mercado cod' NO coincide con 'mercado' exacto
    rent1a:       idxOf(['1 anio %', '1 ano %', '1 year %', '1a %'], 14),
    rent3a:       idxOf(['3 anios %', '3 anos %', '3 years %', '3a %'], 15),
    rent5a:       idxOf(['5 anios %', '5 anos %', '5 years %', '5a %'], 16),
    tipo:         idxOf(['tipo', 'type'], 17),
    ter:          idxOf(['ter anual', 'ter'], 18),
    distribucion: idxOf(['distribucion', 'distribution', 'reparto'], 19),
  };
  const at = (row, i) => (i >= 0 && i < row.length ? row[i] : '');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = splitCsvLine(line);
    if (row.length < 2) continue; // validación real: ISIN/Nombre resueltos por cabecera (abajo)

    const isin = (at(row, cols.isin) || '').trim();
    const nombre = (at(row, cols.nombre) || '').trim();
    if (!isin || isin.length < 10 || !nombre) continue;
    if (seen.has(isin)) continue;
    seen.add(isin);

    products.push({
      isin,
      nombre,
      tipo: (at(row, cols.tipo) || 'ETF').trim(),
      divisa: (at(row, cols.divisa) || 'EUR').trim(),
      ter: parseTer(at(row, cols.ter)),
      distribucion: (at(row, cols.distribucion) || '').trim(),
      rent1a: parsePct(at(row, cols.rent1a)),
      rent3a: parsePct(at(row, cols.rent3a)),
      rent5a: parsePct(at(row, cols.rent5a)),
      mercado: (at(row, cols.mercado) || '').trim(),
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

// Helpers puros expuestos SOLO para tests unitarios (no afectan al handler).
module.exports._test = { parseCSV, parsePct, parseTer, normHeader, splitCsvLine };
