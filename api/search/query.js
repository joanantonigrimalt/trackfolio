// GET /api/search/query?q=<query>
// Multi-source asset search: Yahoo + EODHD + TwelveData + known providers
// Features: scoring, dedup by ISIN/symbol, encoding fix, clean type labels

const { setupApi, sanitizeQuery, validateSymbol, sendError } = require('../../lib/security');
const { search: eodhdSearch } = require('../../lib/eodhd');
const { searchSymbol: twelveSearch } = require('../../lib/twelvedata');

// ── Known assets from portfolio-providers.json ─────────────────────────────
let KNOWN_ASSETS = [];
try {
  KNOWN_ASSETS = require('../../portfolio-providers.json').assets || [];
} catch (_) {}

// ── Cache ──────────────────────────────────────────────────────────────────
const CACHE = new Map();
const TTL = 5 * 60 * 1000;
const cget = k => { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; };
const cset = (k, v) => CACHE.set(k, { v, x: Date.now() + TTL });

// ── Type maps ──────────────────────────────────────────────────────────────
const YAHOO_TYPE = {
  EQUITY: 'stock', ETF: 'etf', MUTUALFUND: 'fund',
  CRYPTOCURRENCY: 'crypto', INDEX: 'index', FUTURE: 'future',
  CURRENCY: 'fx', ETC: 'etc',
};

const TYPE_LABEL = {
  stock: 'Acción', etf: 'ETF', fund: 'Fondo',
  crypto: 'Cripto', index: 'Índice', future: 'Futuro',
  fx: 'Divisa', etc: 'ETC', unknown: 'Activo',
};

const EODHD_TYPE = {
  'common stock': 'stock', 'preferred stock': 'stock',
  'etf': 'etf', 'fund': 'fund', 'etc': 'etc',
  'index': 'index', 'currency': 'fx',
};

const TWELVE_TYPE = {
  'common stock': 'stock', 'etf': 'etf',
  'mutual fund': 'fund', 'index': 'index', 'cryptocurrency': 'crypto',
};

// ── Encoding fix ───────────────────────────────────────────────────────────
// Handles Latin-1 chars mangled as UTF-8 (common in Yahoo/EODHD name fields)
// Pairs: [garbled_utf8_as_latin1, correct_char]
// Generated from UTF-8 bytes misread as Windows-1252/Latin-1
const ENCODING_FIXES = [
  // Lowercase accented vowels + ñ (most common in Spanish asset names)
  ['\u00C3\u00B3', '\u00F3'],  // ó
  ['\u00C3\u00A1', '\u00E1'],  // á
  ['\u00C3\u00A9', '\u00E9'],  // é
  ['\u00C3\u00AD', '\u00ED'],  // í
  ['\u00C3\u00BA', '\u00FA'],  // ú
  ['\u00C3\u00B1', '\u00F1'],  // ñ
  ['\u00C3\u00A0', '\u00E0'],  // à
  ['\u00C3\u00BC', '\u00FC'],  // ü
  // Uppercase accented
  ['\u00C3\u2019', '\u00D1'],  // Ñ (0x91 as cp1252 = U+2019)
  ['\u00C3\u0081', '\u00C1'],  // Á
  ['\u00C3\u2030', '\u00C9'],  // É (0x89 as cp1252 = U+2030, rare)
  ['\u00C3\u0093', '\u00D3'],  // Ó
  ['\u00C3\u009A', '\u00DA'],  // Ú
  // Curly quotes and dashes (common in fund names)
  ['\u00E2\u0080\u0099', "'"],  // â€™ → '
  ['\u00E2\u0080\u009C', '"'],  // â€œ → "
  ['\u00E2\u0080\u009D', '"'],  // â€  → "
  ['\u00E2\u0080\u0093', '\u2013'],  // â€" → –
  ['\u00E2\u0080\u0094', '\u2014'],  // â€" → —
  ['\u00C2\u00BB', '\u00BB'],  // Â» → »
  ['\u00C2\u00AB', '\u00AB'],  // Â« → «
];

function fixText(str) {
  if (!str || typeof str !== 'string') return str || '';
  let s = str;
  for (const [bad, good] of ENCODING_FIXES) s = s.split(bad).join(good);
  return s.trim();
}

// ── Query analysis ─────────────────────────────────────────────────────────
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/i;
// Ticker: up to 6 chars optionally followed by .XX exchange suffix
const TICKER_RE = /^[A-Z0-9]{1,6}(\.[A-Z]{1,3})?$/i;

function analyzeQuery(q) {
  // Strip exchange suffix (e.g. IE00BDVPNG13.SG → IE00BDVPNG13) before ISIN test
  const baseQ = q.trim().replace(/\.[A-Z]{1,3}$/i, '');
  if (ISIN_RE.test(baseQ)) return 'isin';
  if (TICKER_RE.test(q.trim()) && q.length <= 10) return 'ticker';
  return 'name';
}

// ── Geographic bonuses ─────────────────────────────────────────────────────
const SPANISH_SYM = ['.MC', '.BCN', '.MAD'];
const SPANISH_EXC = ['BME', 'MCE', 'XMAD', 'MAD', 'BCN', 'MCI'];
const EURO_SYM    = ['.AS', '.DE', '.L', '.PA', '.MI', '.BR', '.ST', '.HE', '.OL', '.CO', '.VI', '.LS', '.WA', '.PR', '.BU', '.AT'];
const EURO_EXC    = ['XETR', 'LSE', 'AMS', 'EPA', 'MIL', 'BRU', 'STO', 'HEL', 'OSL', 'CPH', 'VIE', 'LIS', 'WSE', 'ATH', 'EURONEXT', 'XLON', 'XAMS', 'XPAR', 'XMIL'];

function geoScore(symbol, exchange) {
  const s = (symbol || '').toUpperCase();
  const e = (exchange || '').toUpperCase();
  if (SPANISH_SYM.some(x => s.endsWith(x)) || SPANISH_EXC.some(x => e.includes(x))) return 40;
  if (EURO_SYM.some(x => s.endsWith(x)) || EURO_EXC.some(x => e.includes(x))) return 15;
  return 0;
}

// ── Scoring ────────────────────────────────────────────────────────────────
function score(item, qLower, qType) {
  const name = fixText(item.name || '').toLowerCase();
  const sym  = (item.symbol || '').toLowerCase();
  const isin = (item.isin   || '').toLowerCase();
  let s = 0;

  // Known asset (from portfolio-providers.json)
  if (item._known) s += 500;

  // ISIN exact
  if (qType === 'isin' && isin === qLower) s += 1000;

  // Ticker exact / base match
  if (qType === 'ticker') {
    if (sym === qLower) s += 200;
    else if (sym.split('.')[0] === qLower.split('.')[0]) s += 130;
  }

  // Name matching
  if (name === qLower)               s += 150;
  else if (name.startsWith(qLower))  s += 100;
  else if (name.includes(qLower))    s += 60;
  else {
    // All words present
    const words = qLower.split(/\s+/).filter(w => w.length > 1);
    if (words.length > 0 && words.every(w => name.includes(w))) s += 35;
  }

  // Has ISIN
  if (item.isin) s += 20;

  // Geo bonus (most relevant for name searches)
  s += geoScore(item.symbol, item.exchange);

  // Type: prefer real assets
  const t = item.type || '';
  if (['stock', 'etf', 'fund', 'etc'].includes(t)) s += 10;
  if (['future', 'fx'].includes(t)) s -= 25;
  if (t === 'crypto' && !/btc|eth|crypto|coin|token/i.test(qLower)) s -= 15;

  // Source priority
  const srcBonus = { known_asset: 30, yahoo: 10, eodhd: 8, twelvedata: 6 };
  s += srcBonus[item._src] || 0;

  return s;
}

// ── Normalise result to common shape ───────────────────────────────────────
function norm(raw, src) {
  const type = raw.type || 'unknown';
  return {
    symbol:    raw.symbol    || '',
    isin:      raw.isin      || null,
    name:      fixText(raw.name || raw.symbol || ''),
    type,
    typeLabel: TYPE_LABEL[type] || TYPE_LABEL.unknown,
    exchange:  fixText(raw.exchange || ''),
    currency:  raw.currency  || null,
    _src:      src,
    _known:    raw._known    || false,
    _score:    0,
  };
}

// ── Source: known assets ───────────────────────────────────────────────────
function fromKnown(qLower, qType) {
  return KNOWN_ASSETS
    .filter(a => {
      if (qType === 'isin') return (a.isin || '').toLowerCase() === qLower;
      const name = (a.name || '').toLowerCase();
      const sym  = (a.yahooSymbol || a.providerSymbol || '').toLowerCase();
      return name.includes(qLower) ||
             sym.split('.')[0] === qLower.split('.')[0];
    })
    .map(a => norm({
      symbol:   a.yahooSymbol || a.providerSymbol || a.isin,
      isin:     a.isin,
      name:     a.name,
      type:     a.type,
      exchange: '',
      currency: null,
      _known:   true,
    }, 'known_asset'));
}

// ── Source: Yahoo Finance ──────────────────────────────────────────────────
async function fromYahoo(q) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&enableFuzzyQuery=true&enableCb=false`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const data = await r.json();
  return (data.quotes || [])
    .filter(q => q.symbol && q.quoteType && !['OPTION', 'FUTURE'].includes(q.quoteType))
    .map(q => norm({
      symbol:   q.symbol,
      isin:     q.isin || null,
      name:     q.longname || q.shortname || q.symbol,
      type:     YAHOO_TYPE[q.quoteType] || q.quoteType?.toLowerCase() || 'unknown',
      exchange: q.exchDisp || q.exchange || '',
      currency: q.currency || null,
    }, 'yahoo'));
}

// ── Source: EODHD (good for European/Spanish equities) ────────────────────
async function fromEodhd(q) {
  const { data } = await eodhdSearch(q, 10);
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    const rawType = (item.Type || '').toLowerCase();
    const type = EODHD_TYPE[rawType]
      || (rawType.includes('stock') ? 'stock' : rawType.includes('etf') ? 'etf' : 'unknown');
    // EODHD symbol format: CODE.EXCHANGE (e.g. MAP.MC, EXW1.DE)
    const symbol = item.Code && item.Exchange
      ? `${item.Code}.${item.Exchange}`
      : (item.Code || '');
    return norm({
      symbol,
      isin:     item.ISIN     || null,
      name:     item.Name     || symbol,
      type,
      exchange: item.Exchange || item.Country || '',
      currency: item.Currency || null,
    }, 'eodhd');
  });
}

// ── Source: TwelveData ────────────────────────────────────────────────────
async function fromTwelve(q) {
  const res = await twelveSearch(q);
  const list = res?.data?.data || [];
  return list.map(item => {
    const rawType = (item.instrument_type || '').toLowerCase();
    const type = TWELVE_TYPE[rawType]
      || (rawType.includes('stock') ? 'stock' : 'unknown');
    return norm({
      symbol:   item.symbol,
      isin:     null,   // TwelveData /symbol_search doesn't return ISINs
      name:     item.instrument_name || item.symbol,
      type,
      exchange: item.exchange || item.mic_code || '',
      currency: item.currency || null,
    }, 'twelvedata');
  });
}

// ── Deduplication ──────────────────────────────────────────────────────────
// Primary key: ISIN. Secondary key: base ticker (strip .EXCHANGE suffix).
// Results must be pre-sorted highest score first — we always keep the first seen.
function dedup(sorted) {
  const byIsin = new Map(); // isin.upper → index in out
  const bySym  = new Map(); // baseSymbol.upper → index in out
  const out    = [];

  for (const item of sorted) {
    const isin = (item.isin || '').toUpperCase();
    const base = (item.symbol || '').split('.')[0].toUpperCase();

    // Check ISIN collision
    if (isin && byIsin.has(isin)) {
      const idx = byIsin.get(isin);
      // Inherit any extra data the later result might have (lower score, skip body)
      if (!out[idx].currency && item.currency) out[idx].currency = item.currency;
      if (!out[idx].exchange && item.exchange) out[idx].exchange = item.exchange;
      continue;
    }

    // Check base-symbol collision
    if (base && bySym.has(base)) {
      const idx = bySym.get(base);
      // Inherit ISIN if the earlier entry lacked it
      if (!out[idx].isin && isin) {
        out[idx].isin = item.isin;
        byIsin.set(isin, idx);
      }
      if (!out[idx].currency && item.currency) out[idx].currency = item.currency;
      continue;
    }

    const idx = out.length;
    out.push(item);
    if (isin) byIsin.set(isin, idx);
    if (base) bySym.set(base, idx);
  }

  return out;
}

// ── Main handler ───────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 60 })) return;

  // ── ?symbol=XX — chart data mode (unchanged behaviour) ──────────────────
  const symbol = String(req.query?.symbol || '').trim();
  if (symbol) {
    if (!validateSymbol(symbol)) return sendError(res, 400, 'Invalid symbol format');
    const ck = `quote:${symbol}`;
    const cached = cget(ck);
    if (cached) { res.statusCode = 200; return res.end(JSON.stringify(cached)); }
    try {
      for (const host of ['query1', 'query2']) {
        const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`;
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'application/json' }
        });
        if (!r.ok) continue;
        const d = await r.json();
        const result = d?.chart?.result?.[0];
        if (!result) continue;
        const meta = result.meta || {};
        const ts   = result.timestamp || [];
        const cls  = result.indicators?.quote?.[0]?.close || [];
        const history = [];
        for (let i = 0; i < ts.length; i++) {
          const c = Number(cls[i]);
          if (Number.isFinite(c) && c > 0)
            history.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c });
        }
        const out = {
          symbol,
          name:         fixText(meta.longName || meta.shortName || symbol),
          currentPrice: Number(meta.regularMarketPrice ?? cls[cls.length - 1] ?? 0),
          currency:     meta.currency || 'USD',
          history,
        };
        if (history.length > 10) cset(ck, out);
        res.statusCode = 200;
        return res.end(JSON.stringify(out));
      }
      throw new Error('No data from Yahoo');
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // ── ?q=XX — search mode ────────────────────────────────────────────────
  const q = sanitizeQuery(String(req.query?.q || ''));
  if (!q || q.length < 2) {
    return sendError(res, 400, 'query_too_short');
  }

  const ck = `search3:${q.toLowerCase()}`;
  const cached = cget(ck);
  if (cached) { res.statusCode = 200; return res.end(JSON.stringify({ results: cached })); }

  const qType  = analyzeQuery(q);
  // For ISIN queries, strip exchange suffix so scoring and known-asset lookup match correctly
  const qLower = qType === 'isin' ? q.toLowerCase().replace(/\.[a-z]{1,3}$/, '') : q.toLowerCase();

  // ── 1. Gather results from all sources in parallel ───────────────────────
  const known = fromKnown(qLower, qType);

  const [yahooRes, eodhdRes, twelveRes] = await Promise.allSettled([
    fromYahoo(q),
    fromEodhd(q),
    fromTwelve(q),
  ]);

  const all = [
    ...known,
    ...(yahooRes.status  === 'fulfilled' ? yahooRes.value  : []),
    ...(eodhdRes.status  === 'fulfilled' ? eodhdRes.value  : []),
    ...(twelveRes.status === 'fulfilled' ? twelveRes.value : []),
  ];

  // ── 2. Score every candidate ─────────────────────────────────────────────
  for (const item of all) item._score = score(item, qLower, qType);

  // ── 3. Sort highest-score first (so dedup keeps best) ───────────────────
  all.sort((a, b) => b._score - a._score);

  // ── 4. Deduplicate by ISIN then by base ticker ───────────────────────────
  const deduped = dedup(all);

  // ── 5. Final sort, strip internals, cap at 12 ───────────────────────────
  const results = deduped
    .sort((a, b) => b._score - a._score)
    .slice(0, 12)
    .map(({ _src, _known, _score, ...item }) => item);

  cset(ck, results);
  res.statusCode = 200;
  res.end(JSON.stringify({ results }));
};
