// GET /api/myinvestor/catalog
// Server-side proxy to MyInvestor public catalog API.
// Tries multiple endpoints for ETFs and Funds. Cached in-memory 6h.
// Returns: { products: [...], count: N, updated: ISO_DATE }

const MI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Referer': 'https://app.myinvestor.es/',
  'Origin': 'https://app.myinvestor.es',
};

const ENDPOINT_TEMPLATES = [
  'https://app.myinvestor.es/api/v2/savings-plans/fund-search?page={PAGE}&size=100&productType={TYPE}',
  'https://app.myinvestor.es/api/v1/savings-plans/fund-search?page={PAGE}&size=100&type={TYPE}',
  'https://app.myinvestor.es/api/v2/investment-universe?category={TYPE}&page={PAGE}&size=100',
  'https://app.myinvestor.es/api/v2/funds?productType={TYPE}&page={PAGE}&size=100',
  'https://app.myinvestor.es/api/v1/investment-products?type={TYPE}&page={PAGE}&size=100',
];

// In-memory cache (6 hours)
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000;

function extractItems(json) {
  if (Array.isArray(json)) return json;
  for (const k of ['content','data','results','items','funds','etfs','products','list']) {
    if (Array.isArray(json[k])) return json[k];
  }
  // One level deeper
  for (const v of Object.values(json)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const sub of Object.values(v)) {
        if (Array.isArray(sub) && sub.length > 0) return sub;
      }
    }
  }
  return [];
}

function hasMore(json, count) {
  if (count < 100) return false;
  if (json.last === true || json.last === 'true') return false;
  if (json.hasNext === false) return false;
  return true;
}

function get(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const v = obj[k];
      if (typeof v === 'object' && !Array.isArray(v)) return v.name || v.value || v.code || JSON.stringify(v);
      return v;
    }
  }
  return '';
}

function toNum(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.').replace('%', '').trim());
  return isNaN(n) ? null : n;
}

function parseProduct(item, type) {
  const isin   = get(item, 'isin','ISIN','isinCode','code');
  const nombre = get(item, 'name','nombre','productName','fundName','title','shortName','description');
  const cat    = get(item, 'category','categoria','assetClass','fundCategory','morningstarCategory','subcategory');
  const market = get(item, 'market','exchange','mercado','stockExchange','primaryExchange');
  const ter    = get(item, 'ter','TER','ongoingCharge','totalExpenseRatio','managementFee','annualFee','expenseRatio');
  const cur    = get(item, 'currency','divisa','currencyCode','baseCurrency','currency_code');
  const rep    = get(item, 'replicationMethod','replica','replication','methodology','indexReplication','physicalOrSynthetic');
  const dist   = get(item, 'distributionPolicy','distribucion','incomeType','dividendPolicy','accumulation','distributing');
  const rating = get(item, 'morningstarRating','rating','stars','morningstarStars','starRating');
  const r1a    = get(item, 'return1Year','performance1Y','annualized1Y','oneYearReturn','return1y','trailingReturn1Y','r1y');
  const r3a    = get(item, 'return3Year','performance3Y','annualized3Y','threeYearReturn','return3y','trailingReturn3Y','r3y');
  const r5a    = get(item, 'return5Year','performance5Y','annualized5Y','fiveYearReturn','return5y','trailingReturn5Y','r5y');
  let url      = get(item, 'url','link','productUrl','detailUrl');
  if (!url && isin) url = type === 'ETF'
    ? `https://app.myinvestor.es/etfs/${isin}`
    : `https://app.myinvestor.es/fondos/${isin}`;

  return {
    isin: String(isin), nombre: String(nombre),
    tipo: type === 'ETF' ? 'ETF' : 'Fondo',
    categoria: String(cat), mercado: String(market),
    ter: toNum(ter), divisa: String(cur),
    replica: String(rep), distribucion: String(dist),
    rent1a: toNum(r1a), rent3a: toNum(r3a), rent5a: toNum(r5a),
    rating: String(rating), url: String(url),
  };
}

async function fetchType(type) {
  for (let ei = 0; ei < ENDPOINT_TEMPLATES.length; ei++) {
    const tpl = ENDPOINT_TEMPLATES[ei].replace(/{TYPE}/g, type);
    const all = [];
    let page = 0;

    try {
      while (page < 60) {
        const url = tpl.replace('{PAGE}', page);
        const resp = await fetch(url, { headers: MI_HEADERS });
        if (resp.status === 401 || resp.status === 403) break;
        if (!resp.ok) break;

        let json;
        try { json = await resp.json(); } catch { break; }

        const items = extractItems(json);
        if (!items || items.length === 0) { if (page === 0) break; break; }

        items.forEach(item => all.push(parseProduct(item, type)));
        if (!hasMore(json, items.length)) break;
        page++;
        await new Promise(r => setTimeout(r, 200));
      }

      if (all.length > 0) return all;
    } catch { /* try next endpoint */ }
  }
  return [];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  // Serve cache if fresh
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=21600');
    res.setHeader('X-Cache', 'HIT');
    res.statusCode = 200;
    return res.end(JSON.stringify(_cache));
  }

  try {
    const [etfs, funds] = await Promise.all([fetchType('ETF'), fetchType('FUND')]);
    const products = [...etfs, ...funds];

    const body = {
      products,
      count: products.length,
      updated: new Date().toISOString(),
      etfs: etfs.length,
      funds: funds.length,
    };

    if (products.length > 0) {
      _cache = body;
      _cacheAt = Date.now();
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=21600');
    res.setHeader('X-Cache', products.length > 0 ? 'MISS' : 'EMPTY');
    res.statusCode = 200;
    return res.end(JSON.stringify(body));

  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message, products: [], count: 0 }));
  }
};
