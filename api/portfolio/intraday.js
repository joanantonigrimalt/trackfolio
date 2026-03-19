// GET /api/portfolio/intraday?symbols=ISPA.DE,TDIV.AS,...
//
// Returns 1D intraday data (5-min bars, ~15min delayed) from Yahoo Finance for
// each requested symbol. The frontend combines them with per-asset quantities.
//
// Response: { updatedAt, symbols: { [sym]: { points:[{ts,time,close}], currency, timezone } | { error, reason } } }

const { setupApi, validateSymbol, sendError } = require('../../lib/security');

const CACHE = new Map();
const TTL   = 5 * 60 * 1000; // 5-min intraday cache
const cget  = k => { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; };
const cset  = (k, v) => CACHE.set(k, { v, x: Date.now() + TTL });

// Detect exchange timezone from symbol suffix for correct time display
function getTimezone(symbol) {
  const s = (symbol || '').toUpperCase();
  if (s.endsWith('.L') || s.endsWith('.IL'))   return 'Europe/London';
  if (s.endsWith('.DE') || s.endsWith('.F'))   return 'Europe/Berlin';
  if (s.endsWith('.PA'))                       return 'Europe/Paris';
  if (s.endsWith('.AS'))                       return 'Europe/Amsterdam';
  if (s.endsWith('.MI'))                       return 'Europe/Rome';
  if (s.endsWith('.MC') || s.endsWith('.MAD')) return 'Europe/Madrid';
  if (s.endsWith('.TO'))                       return 'America/Toronto';
  if (s.endsWith('.HK'))                       return 'Asia/Hong_Kong';
  if (s.endsWith('.T'))                        return 'Asia/Tokyo';
  if (s.endsWith('.SS') || s.endsWith('.SZ'))  return 'Asia/Shanghai';
  // Default: US Eastern (NYSE/NASDAQ)
  return 'America/New_York';
}

async function fetchIntraday(symbol) {
  const ck = `intra:${symbol}`;
  const cached = cget(ck);
  if (cached) return cached;

  const timezone = getTimezone(symbol);

  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      if (!r.ok) {
        if (r.status === 404) return { error: true, reason: 'symbol_not_found', points: [], currency: null };
        continue;
      }
      const d   = await r.json();
      const res = d?.chart?.result?.[0];
      if (!res) {
        const errCode = d?.chart?.error?.code;
        if (errCode === 'Not Found') return { error: true, reason: 'symbol_not_found', points: [], currency: null };
        continue;
      }

      const ts       = res.timestamp || [];
      const closes   = res.indicators?.quote?.[0]?.close || [];
      const volumes  = res.indicators?.quote?.[0]?.volume || [];
      const highs    = res.indicators?.quote?.[0]?.high || [];
      const lows     = res.indicators?.quote?.[0]?.low || [];
      const currency = res.meta?.currency || 'EUR';
      const marketState = res.meta?.marketState || 'UNKNOWN'; // REGULAR, PRE, POST, CLOSED

      const points = [];
      for (let i = 0; i < ts.length; i++) {
        const c = Number(closes[i]);
        if (!Number.isFinite(c) || c <= 0) continue;
        const dt   = new Date(ts[i] * 1000);
        const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
        points.push({
          ts: ts[i] * 1000,
          time,
          close: c,
          high:   Number.isFinite(Number(highs[i]))  ? Number(highs[i])   : c,
          low:    Number.isFinite(Number(lows[i]))   ? Number(lows[i])    : c,
          volume: Number.isFinite(Number(volumes[i]))? Number(volumes[i]) : 0,
        });
      }

      if (points.length > 3) {
        const out = { points, currency, timezone, marketState };
        cset(ck, out);
        return out;
      }

      // Market closed or pre-market — fewer than 3 points, not an error
      if (points.length > 0) {
        const out = { points, currency, timezone, marketState };
        cset(ck, out);
        return out;
      }

      return { error: true, reason: 'no_trading_data', points: [], currency, timezone, marketState };
    } catch (e) {
      if (host === 'query2') return { error: true, reason: 'fetch_failed', points: [], currency: null };
    }
  }
  return { error: true, reason: 'fetch_failed', points: [], currency: null };
}

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 30 })) return;

  const raw = String(req.query?.symbols || '').trim();
  if (!raw) return sendError(res, 400, 'symbols param required');

  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
  const invalid = symbols.filter(s => !validateSymbol(s));
  if (invalid.length > 0) return sendError(res, 400, `Invalid symbol format: ${invalid[0]}`);

  const out = {};
  await Promise.all(symbols.map(async sym => {
    out[sym] = await fetchIntraday(sym);
  }));

  res.statusCode = 200;
  res.end(JSON.stringify({ updatedAt: new Date().toISOString(), symbols: out }, null, 2));
};
