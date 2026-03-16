// GET /api/portfolio/intraday?symbols=ISPA.DE,TDIV.AS,...
//
// Returns 1D intraday data (5-min bars, ~15min delayed) from Yahoo Finance for
// each requested symbol. The frontend combines them with per-asset quantities.
//
// Response: { updatedAt, symbols: { [sym]: { points:[{ts,time,close}], currency } | null } }

const CACHE = new Map();
const TTL   = 5 * 60 * 1000; // 5-min intraday cache
const cget  = k => { const e = CACHE.get(k); if (!e || Date.now() > e.x) { CACHE.delete(k); return null; } return e.v; };
const cset  = (k, v) => CACHE.set(k, { v, x: Date.now() + TTL });

async function fetchIntraday(symbol) {
  const ck = `intra:${symbol}`;
  const cached = cget(ck);
  if (cached) return cached;

  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      if (!r.ok) continue;
      const d   = await r.json();
      const res = d?.chart?.result?.[0];
      if (!res) continue;

      const ts      = res.timestamp || [];
      const closes  = res.indicators?.quote?.[0]?.close || [];
      const currency = res.meta?.currency || 'EUR';

      const points = [];
      for (let i = 0; i < ts.length; i++) {
        const c = Number(closes[i]);
        if (!Number.isFinite(c) || c <= 0) continue;
        const dt   = new Date(ts[i] * 1000);
        const time = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
        points.push({ ts: ts[i] * 1000, time, close: c });
      }

      if (points.length > 3) {
        const out = { points, currency };
        cset(ck, out);
        return out;
      }
    } catch (_) {}
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const raw = String(req.query?.symbols || '').trim();
  if (!raw) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'symbols param required' }));
  }

  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean);
  const out = {};
  await Promise.all(symbols.map(async sym => {
    out[sym] = await fetchIntraday(sym);
  }));

  res.statusCode = 200;
  res.end(JSON.stringify({ updatedAt: new Date().toISOString(), symbols: out }, null, 2));
};
