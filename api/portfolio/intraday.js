// GET /api/portfolio/intraday?symbols=ISPA.DE,TDIV.AS,...
//
// Returns 1D intraday data (5-min bars, ~15min delayed) from Yahoo Finance for
// each requested symbol. The frontend combines them with per-asset quantities.
//
// Response: { updatedAt, symbols: { [sym]: { points:[{ts,time,close}], currency, timezone } | { error, reason } } }

const { setupApi, validateSymbol, sendError } = require('../../lib/security');

const CACHE = new Map();
const TTL        = 5  * 60 * 1000;  // 5-min cache when market open
const TTL_CLOSED = 60 * 60 * 1000;  // 60-min stale cache when market closed
const cget  = k => { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; };
const cset  = (k, v, ttl = TTL) => CACHE.set(k, { v, x: Date.now() + ttl });

// ── Market-hours check ────────────────────────────────────────────────────────
// Returns true if the primary session is currently open for the given timezone.
// Skips Yahoo Finance calls entirely when market is closed — saves API quota.
function isMarketOpen(timezone) {
  const now = new Date();
  // Check weekday in exchange-local time
  const dayName = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: timezone });
  if (dayName === 'Sun' || dayName === 'Sat') return false;

  // HH:MM in exchange-local time → minutes since midnight
  const [hStr, mStr] = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: timezone,
  }).split(':');
  const hm = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);

  // [open, close) in minutes since midnight (local exchange time)
  const sessions = {
    'America/New_York':  [570, 960],   // 09:30–16:00 ET
    'America/Toronto':   [570, 960],
    'Europe/London':     [540, 1050],  // 09:00–17:30
    'Europe/Berlin':     [540, 1050],
    'Europe/Paris':      [540, 1050],
    'Europe/Amsterdam':  [540, 1050],
    'Europe/Rome':       [540, 1050],
    'Europe/Madrid':     [540, 1050],
    'Asia/Hong_Kong':    [540, 960],   // 09:00–16:00
    'Asia/Tokyo':        [540, 900],   // 09:00–15:00
    'Asia/Shanghai':     [570, 900],   // 09:30–15:00
  };
  const [open, close] = sessions[timezone] ?? [540, 1020];
  return hm >= open && hm < close;
}

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
  const timezone = getTimezone(symbol);

  // If market is closed, return stale cache (avoids unnecessary Yahoo calls)
  const marketOpen = isMarketOpen(timezone);
  const cached = cget(ck);
  if (cached) {
    // Always use cached when market is closed — no point refreshing
    if (!marketOpen) return { ...cached, marketClosed: true };
    return cached;
  }
  if (!marketOpen) {
    // Market closed and no cache — fetch once to populate stale cache (extended TTL)
    // Fall through to fetch but use TTL_CLOSED below
  }

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
        cset(ck, out, marketOpen ? TTL : TTL_CLOSED);
        return { ...out, marketClosed: !marketOpen };
      }

      // Market closed or pre-market — fewer than 3 points, not an error
      if (points.length > 0) {
        const out = { points, currency, timezone, marketState };
        cset(ck, out, TTL_CLOSED);
        return { ...out, marketClosed: !marketOpen };
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
  let anyHit = false;
  await Promise.all(symbols.map(async sym => {
    // Track whether the result came from cache (cget inside fetchIntraday logs it)
    const before = CACHE.has(`intra:${sym}`);
    out[sym] = await fetchIntraday(sym);
    if (before) anyHit = true;
  }));

  res.setHeader('X-Cache', anyHit ? 'HIT' : 'MISS');
  res.statusCode = 200;
  res.end(JSON.stringify({ updatedAt: new Date().toISOString(), symbols: out }, null, 2));
};
