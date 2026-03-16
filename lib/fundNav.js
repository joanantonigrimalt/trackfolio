// NAV/historical data for UCITS funds not listed on exchanges
// Covers Spanish (ES*) and Luxembourg (LU*) funds that don't trade on markets
//
// Source priority:
//   1. Morningstar unofficial API (no key — uses public web token)
//   2. Leeway API (LEEWAY_API_TOKEN — European financial data)

const CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function cacheGet(key) { const e = CACHE.get(key); if (!e) return null; if (Date.now() > e.exp) { CACHE.delete(key); return null; } return e.data; }
function cacheSet(key, data) { CACHE.set(key, { data, exp: Date.now() + CACHE_TTL }); }

// ── Morningstar (primary — no API key needed) ──────────────────────────────────
// Uses Morningstar's public SecuritySearch + timeseries_price endpoints
// These are unofficial but widely used (token 9vehuxllxs is public in their web app)

const MSTAR_TOKEN = '9vehuxllxs';

async function mstarSearch(isin) {
  // SecurityType: FO=fund, SH=stock, SIV=sicav — try broad search
  const url = `https://www.morningstar.es/es/util/SecuritySearch.ashx?q=${encodeURIComponent(isin)}&SecurityType=FO,SIV,SH`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Referer': 'https://www.morningstar.es/' }
  });
  if (!res.ok) throw new Error(`Morningstar search HTTP ${res.status}`);
  const text = await res.text();
  if (!text || text.trim().length === 0) throw new Error(`Morningstar empty response for ${isin}`);

  // Response format: "Fund Name|{"i":"F000010KY6","pi":"0P0001DFE8","n":"...","t":2,...}|FUND||..."
  // Extract the first JSON blob and get the "i" (secId) field
  const jsonMatch = text.match(/\|(\{[^|]+\})\|/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[1]);
      const secId = obj.i || obj.pi;
      if (secId) return secId;
    } catch (_) { /* fall through */ }
  }

  // Fallback: try legacy XML-style  id="..."
  const xmlMatch = text.match(/\bid="([A-Z0-9]{6,})"/) || text.match(/id=([A-Z0-9]{6,})\b/);
  if (xmlMatch) return xmlMatch[1];

  throw new Error(`Morningstar no ID found for ${isin} — response: ${text.slice(0, 300)}`);
}

async function mstarHistory(secId, startDate = '2021-01-01') {
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://tools.morningstar.es/api/rest.svc/timeseries_price/${MSTAR_TOKEN}?id=${secId}&currencyId=EUR&idtype=Morningstar&frequency=daily&startDate=${startDate}&endDate=${today}&outputType=JSON`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://www.morningstar.es/' }
  });
  if (!res.ok) throw new Error(`Morningstar history HTTP ${res.status}`);
  const data = await res.json();
  // Format: { TimeSeries: { Security: [{ Id: "...", HistoryDetail: [{ EndDate: "YYYY-MM-DD", Value: "100.00" }] }] } }
  const detail = data?.TimeSeries?.Security?.[0]?.HistoryDetail || [];
  if (detail.length === 0) throw new Error(`Morningstar empty history for secId=${secId}`);
  return detail
    .map(p => ({ date: p.EndDate, close: Number(p.Value) }))
    .filter(p => p.date && Number.isFinite(p.close) && p.close > 0);
}

async function navFromMorningstar(isin) {
  const secId = await mstarSearch(isin);
  const points = await mstarHistory(secId);
  return { source: 'morningstar', secId, points };
}

// ── Leeway (secondary — European financial data provider) ──────────────────────
// API docs: https://leeway.tech — EOD historical data for European instruments

async function navFromLeeway(isin) {
  const token = process.env.LEEWAY_API_TOKEN;
  if (!token) throw new Error('LEEWAY_API_TOKEN not configured');

  const today = new Date().toISOString().slice(0, 10);
  // Try multiple possible Leeway endpoint patterns
  const endpoints = [
    `https://api.leeway.tech/api/v1/public/history/eod/${encodeURIComponent(isin)}?startDate=2021-01-01&endDate=${today}&apitoken=${token}`,
    `https://api.leeway.tech/api/v1/public/historicalquotes?isin=${encodeURIComponent(isin)}&startdate=2021-01-01&enddate=${today}&apitoken=${token}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.data || data?.history || data?.quotes || []);
      const points = arr
        .map(p => ({ date: String(p.date || p.Date || p.datetime || ''), close: Number(p.close || p.Close || p.nav || p.price || 0) }))
        .filter(p => p.date && Number.isFinite(p.close) && p.close > 0);
      if (points.length > 10) return { source: 'leeway', points };
    } catch (_) { /* try next */ }
  }
  throw new Error(`Leeway returned no data for ${isin}`);
}

// ── Main entry point ────────────────────────────────────────────────────────────
// Returns { source, secId?, points } or null

async function getNavHistory(isin) {
  const key = `nav:${isin}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  // 1. Morningstar
  try {
    const result = await navFromMorningstar(isin);
    if (result.points.length > 10) { cacheSet(key, result); return result; }
  } catch (_) { /* try next */ }

  // 2. Leeway
  try {
    const result = await navFromLeeway(isin);
    if (result.points.length > 10) { cacheSet(key, result); return result; }
  } catch (_) { /* all failed */ }

  return null;
}

// Get latest NAV/price (just last point from history or dedicated quote)
async function getNavQuote(isin) {
  const history = await getNavHistory(isin);
  if (!history || history.points.length === 0) return null;
  const last = history.points[history.points.length - 1];
  return { source: history.source, price: last.close, date: last.date };
}

module.exports = { getNavHistory, getNavQuote, navFromMorningstar, navFromLeeway };
