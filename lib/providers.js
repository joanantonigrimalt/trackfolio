// Provider orchestrator
// Resolution order per asset type:
//   ETF/ETC  → Yahoo (ISIN direct / yahooSymbol) → EODHD → TwelveData
//   Fund     → fundNav (Morningstar / Leeway) → Yahoo search → fund-source
//
// Cache layers:
//   L1: in-process Map (30 min, warm requests)
//   L2: Supabase price_history table (persistent, optional — set SUPABASE_URL)

const portfolioProviders = require('../portfolio-providers.json');
const portfolioSeed = require('../portfolio-seed.json');
const { fmpFetch } = require('./fmp');
const { getQuote: getEodQuote, getHistory } = require('./eodhd');
const { getQuote: getTdQuote, getTimeSeries } = require('./twelvedata');
const { yahooByIsin } = require('./yahoo');
const { getNavHistory, getNavQuote } = require('./fundNav');
const { dbGetHistory, dbSaveHistory, dbIsStale } = require('./cache');

// ── L1 in-process cache ────────────────────────────────────────────────────────
const RESOLVE_CACHE = new Map();
const RESOLVE_CACHE_TTL = 30 * 60 * 1000;

function l1Get(isin) { const e = RESOLVE_CACHE.get(isin); if (!e) return null; if (Date.now() > e.exp) { RESOLVE_CACHE.delete(isin); return null; } return e.data; }
function l1Set(isin, data) { RESOLVE_CACHE.set(isin, { data, exp: Date.now() + RESOLVE_CACHE_TTL }); }

// ── Lookups ────────────────────────────────────────────────────────────────────
function getAssetByIsin(isin) { return portfolioProviders.assets.find(a => a.isin === isin) || null; }
function getSeedPosition(isin) { return portfolioSeed.positions.find(p => p.isin === isin) || null; }
function isFund(mapping) { return mapping?.type === 'fund'; }

// ── Coverage classifier ────────────────────────────────────────────────────────
function classifyCoverage(history, quote) {
  const hasQ = !!(quote && Number.isFinite(Number(quote.close ?? quote.price)));
  const pts = Array.isArray(history) ? history.filter(p => Number.isFinite(p.close) && p.close > 0).length : 0;
  if (pts >= 60 && hasQ) return 'OK';
  if (pts >= 60 || pts > 0 || hasQ) return 'PARTIAL';
  return 'MISSING';
}

// ── History helpers ────────────────────────────────────────────────────────────
// Try to load history from Supabase first, fall back to fetching from provider
// If fresh data is fetched, persist it to Supabase.
async function withDbCache(isin, provider, fetchFn) {
  const stale = await dbIsStale(isin);
  if (!stale) {
    const cached = await dbGetHistory(isin);
    if (cached && cached.length > 30) return { points: cached, fromDb: true };
  }
  const result = await fetchFn();
  if (result && result.length > 10) {
    // Fire-and-forget persist (don't block the response)
    dbSaveHistory(isin, result, provider).catch(() => {});
  }
  return { points: result || [], fromDb: false };
}

// ── Yahoo (primary for ETFs/ETCs) ──────────────────────────────────────────────
async function fetchFromYahoo(isin, mapping) {
  try {
    const fallback = mapping?.yahooSymbol || null;
    const result = await yahooByIsin(isin, fallback);
    if (!result) throw new Error('Yahoo returned no data');
    const history = result.points;
    const quote = Number.isFinite(result.price) && result.price > 0
      ? { close: result.price, price: result.price, currency: result.currency }
      : null;
    const status = classifyCoverage(history, quote);
    // Persist to Supabase if OK/PARTIAL
    if (history.length > 10) dbSaveHistory(isin, history, `yahoo:${result.resolvedAs}`).catch(() => {});
    return {
      provider: 'yahoo', symbol: result.symbol, resolvedAs: result.resolvedAs,
      quote, history,
      coverage: { quote: !!quote, history: history.length >= 60, status, note: `Yahoo (${result.resolvedAs}): ${history.length} pts` }
    };
  } catch (err) {
    return {
      provider: 'yahoo', symbol: null, resolvedAs: null, quote: null, history: [],
      coverage: { quote: false, history: false, status: 'MISSING', note: `Yahoo: ${err.message}` }
    };
  }
}

// ── fundNav (primary for funds: Morningstar → Leeway) ─────────────────────────
// Always calls Morningstar live (has own 30-min in-memory cache in fundNav.js).
// Bypasses Supabase so stale Yahoo data saved there doesn't pollute fund prices.
async function fetchFromFundNav(isin) {
  try {
    const result = await getNavHistory(isin);
    const points = result?.points || [];
    if (!points.length) throw new Error('No NAV data from Morningstar/Leeway');
    const quote = { close: points[points.length - 1].close, price: points[points.length - 1].close };
    const status = classifyCoverage(points, quote);
    // Persist to Supabase in background for history use
    if (points.length > 10) dbSaveHistory(isin, points, 'fundnav').catch(() => {});
    return {
      provider: 'fundnav', symbol: isin, resolvedAs: result.source || 'morningstar_or_leeway',
      quote, history: points,
      coverage: { quote: true, history: points.length >= 60, status, note: `fundNav(${result.source}): ${points.length} pts` }
    };
  } catch (err) {
    return {
      provider: 'fundnav', symbol: isin, resolvedAs: null, quote: null, history: [],
      coverage: { quote: false, history: false, status: 'MISSING', note: `fundNav: ${err.message}` }
    };
  }
}

// ── EODHD ──────────────────────────────────────────────────────────────────────
async function fetchFromEodhd(isin, mapping) {
  try {
    const { points } = await withDbCache(isin, 'eodhd', async () => {
      const raw = await getHistory(mapping.providerSymbol, '2021-03-15');
      if (!Array.isArray(raw.data)) throw new Error('EODHD bad response');
      return raw.data.map(r => ({ date: r.date, close: Number(r.close) })).filter(r => r.date && r.close > 0);
    });
    const quoteRes = await getEodQuote(mapping.providerSymbol).catch(() => null);
    const quote = quoteRes?.data ? { close: Number(quoteRes.data.close), price: Number(quoteRes.data.close) } : (points.length > 0 ? { close: points[points.length - 1].close, price: points[points.length - 1].close } : null);
    const status = classifyCoverage(points, quote);
    return {
      provider: 'eodhd', symbol: mapping.providerSymbol, resolvedAs: 'provider_symbol',
      quote, history: points,
      coverage: { quote: !!quote, history: points.length >= 60, status, note: `EODHD: ${points.length} pts` }
    };
  } catch (err) {
    return {
      provider: 'eodhd', symbol: mapping.providerSymbol, resolvedAs: null, quote: null, history: [],
      coverage: { quote: false, history: false, status: 'MISSING', note: `EODHD: ${err.message}` }
    };
  }
}

// ── TwelveData ─────────────────────────────────────────────────────────────────
async function fetchFromTwelveData(isin, mapping) {
  try {
    const { points } = await withDbCache(isin, 'twelvedata', async () => {
      const [qr, sr] = await Promise.all([getTdQuote(mapping.providerSymbol), getTimeSeries(mapping.providerSymbol, 500)]);
      const vals = Array.isArray(sr.data?.values) ? sr.data.values : [];
      return vals.map(r => ({ date: r.datetime, close: Number(r.close) })).filter(r => r.date && r.close > 0);
    });
    const qr = await getTdQuote(mapping.providerSymbol).catch(() => null);
    const quote = qr?.data && !qr.data.code && Number.isFinite(Number(qr.data.close))
      ? { close: Number(qr.data.close), price: Number(qr.data.close) }
      : (points.length > 0 ? { close: points[points.length - 1].close, price: points[points.length - 1].close } : null);
    const status = classifyCoverage(points, quote);
    return {
      provider: 'twelvedata', symbol: mapping.providerSymbol, resolvedAs: 'provider_symbol',
      quote, history: points,
      coverage: { quote: !!quote, history: points.length >= 60, status, note: `TwelveData: ${points.length} pts` }
    };
  } catch (err) {
    return {
      provider: 'twelvedata', symbol: mapping.providerSymbol, resolvedAs: null, quote: null, history: [],
      coverage: { quote: false, history: false, status: 'MISSING', note: `TwelveData: ${err.message}` }
    };
  }
}

// ── FMP ────────────────────────────────────────────────────────────────────────
async function fetchFromFmp(symbol) {
  try {
    const d = await fmpFetch('/stable/quote', { symbol });
    const q = Array.isArray(d) ? d[0] : d;
    return {
      provider: 'fmp', symbol, quote: q || null, history: null,
      coverage: { quote: !!q, history: false, status: classifyCoverage([], q), note: 'FMP: quote only' }
    };
  } catch (err) {
    return { provider: 'fmp', symbol, quote: null, history: null, coverage: { quote: false, history: false, status: 'MISSING', note: err.message } };
  }
}

// ── fund-source scaffold ───────────────────────────────────────────────────────
function fundSourceFallback(mapping) {
  return {
    provider: 'fund-source', symbol: null, quote: null, history: null,
    coverage: { quote: false, history: false, status: 'MISSING', note: 'NAV source not connected (Morningstar + Leeway both failed)' }
  };
}

// ── Main resolver ──────────────────────────────────────────────────────────────
// Yahoo is tried first for ALL asset types (ETFs, ETCs, AND funds via 0P*.F symbols).
// Falls back to dedicated provider (eodhd/twelvedata) only if Yahoo is not OK.
// fundNav (Morningstar/Leeway) is kept as last resort for uncovered funds.

// cacheOnly=true → check L1 + Supabase only, never call any external API
async function resolveFromCache(isin) {
  const c = l1Get(isin);
  if (c) return c;
  try {
    const stale = await dbIsStale(isin);
    if (stale) return null; // stale data → trigger live fetch
    const rows = await dbGetHistory(isin);
    if (rows && rows.length > 30) {
      const quote = { close: rows[rows.length - 1].close, price: rows[rows.length - 1].close };
      const status = classifyCoverage(rows, quote);
      const out = {
        isin,
        position: getSeedPosition(isin),
        mapping: getAssetByIsin(isin),
        data: { provider: 'supabase_cache', history: rows, quote, coverage: { status, note: `Supabase: ${rows.length} pts` } },
        error: null,
      };
      if (status !== 'MISSING') l1Set(isin, out);
      return out;
    }
  } catch (_) {}
  return null; // not in any cache
}

async function resolveAssetData(isin, { skipCache = false, cacheOnly = false } = {}) {
  // L1 check
  if (!skipCache && !cacheOnly) { const c = l1Get(isin); if (c) return c; }
  if (cacheOnly) { return await resolveFromCache(isin); }

  const mapping = getAssetByIsin(isin);
  const position = getSeedPosition(isin);

  // 1. Funds: Morningstar/Leeway first — more accurate/current NAV than Yahoo for UCITS funds
  if (isFund(mapping)) {
    const navData = await fetchFromFundNav(isin);
    if (navData.coverage.status === 'OK') {
      const out = { isin, position, mapping, data: navData, error: null };
      l1Set(isin, out);
      return out;
    }
    // Morningstar failed/partial → try Yahoo as fallback
    const yahooData = await fetchFromYahoo(isin, mapping);
    const data = yahooData.coverage.status !== 'MISSING' ? yahooData
               : navData.coverage.status !== 'MISSING'  ? navData
               : fundSourceFallback(mapping);
    const out = { isin, position, mapping, data, error: null };
    if (data.coverage.status !== 'MISSING') l1Set(isin, out);
    return out;
  }

  // 2. ETFs/stocks: Yahoo first (works via ISIN direct or yahooSymbol)
  const yahooData = await fetchFromYahoo(isin, mapping);

  if (yahooData.coverage.status === 'OK') {
    const out = { isin, position, mapping, data: yahooData, error: null };
    l1Set(isin, out);
    return out;
  }

  // 3. No mapping → return best we have
  if (!mapping) {
    if (yahooData.coverage.status !== 'MISSING') {
      const out = { isin, position, mapping: null, data: yahooData, error: null };
      l1Set(isin, out);
      return out;
    }
    return { isin, position, mapping: null, data: null, error: 'Unknown asset — no mapping and Yahoo returned no data' };
  }

  // 4. Try recommended provider (eodhd / twelvedata / fmp) — mainly for assets where Yahoo gives PARTIAL
  const rp = mapping.recommendedProvider;
  let altData = null;
  if (rp === 'eodhd')           altData = await fetchFromEodhd(isin, mapping);
  else if (rp === 'twelvedata') altData = await fetchFromTwelveData(isin, mapping);
  else if (rp === 'fmp')        altData = await fetchFromFmp(mapping.providerSymbol || isin);

  // Use altData if it improves on Yahoo
  let data = yahooData;
  if (altData && (altData.coverage.status === 'OK' ||
      (altData.coverage.status === 'PARTIAL' && data.coverage.status === 'MISSING'))) {
    data = altData;
  }

  const out = { isin, position, mapping, data, error: null };
  if (data.coverage.status !== 'MISSING') l1Set(isin, out);
  return out;
}

module.exports = { getAssetByIsin, getSeedPosition, resolveAssetData, resolveFromCache, classifyCoverage };
