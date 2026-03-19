// lib/fundProfile.js — Fund profile from Morningstar (overview + top holdings)
// Overview:  Morningstar screener API (proven reliable)
// Holdings:  portfolio_holding with both secId variants → lt.morningstar.com →
//            HTML snapshot scraping → ExtraETF fallback

const { getCache, setCache } = require('./cache');
const MSTAR_TOKEN    = '9vehuxllxs';  // tools.morningstar.es public token
const MSTAR_TOKEN_LT = 'klr5zysl8t'; // lt.morningstar.com public token
const TTL = 24 * 60 * 60; // 24h

const HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':     'application/json, text/plain, */*',
  'Referer':    'https://www.morningstar.es/',
};

async function mstarGet(url) {
  const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error(`Morningstar HTTP ${r.status}`);
  const text = await r.text();
  try { return JSON.parse(text); } catch { throw new Error('Morningstar non-JSON'); }
}

// ISIN → { i: fundClassId, pi: shareClassId }
// Response format: "Name|{"i":"F000010KY6","pi":"0P0001DFE8",...}|..."
async function getMstarIds(isin) {
  const cacheKey = `mstar:ids:${isin}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `https://www.morningstar.es/es/util/SecuritySearch.ashx?q=${encodeURIComponent(isin)}&SecurityType=FO,SIV,SH`;
  const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Morningstar search HTTP ${r.status}`);
  const text = await r.text();

  const jsonMatch = text.match(/\|(\{[^|]+\})\|/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[1]);
      if (obj.i || obj.pi) {
        const ids = { i: obj.i || null, pi: obj.pi || null };
        setCache(cacheKey, ids, TTL);
        return ids;
      }
    } catch (_) {}
  }
  // Legacy XML fallback — single ID
  const xmlMatch = text.match(/\bid="([A-Z0-9]{6,})"/) || text.match(/id=([A-Z0-9]{6,})\b/);
  if (xmlMatch) {
    const ids = { i: xmlMatch[1], pi: null };
    setCache(cacheKey, ids, TTL);
    return ids;
  }
  throw new Error(`Morningstar: no secId for ${isin}`);
}

// ── Fund overview via Morningstar screener ────────────────────────────────────
async function getOverviewFromScreener(isin) {
  const dataPoints = [
    'SecId', 'LegalName', 'OngoingCharge', 'FundTNAV', 'InceptionDate',
    'Currency', 'CategoryName', 'Yield_M12', 'InstitutionName',
    'DomicileCountryId', 'DistributionType',
  ].join(',');

  const base   = `https://tools.morningstar.es/api/rest.svc/${MSTAR_TOKEN}/security/screener`;
  const common = `page=1&pageSize=3&sortOrder=LegalName+asc&outputType=json&version=1&languageId=es-ES&currencyId=EUR`;
  const dp     = `securityDataPoints=${encodeURIComponent(dataPoints)}`;
  const term   = `term=${encodeURIComponent(isin)}`;

  const urls = [
    `${base}?${common}&${dp}&${term}`,
    `${base}?${common}&universeIds=FOESP%24%24ALL%7CFOIRL%24%24ALL%7CFOLUX%24%24ALL%7CFODED%24%24ALL%7CFOFRA%24%24ALL&${dp}&${term}`,
  ];

  for (const url of urls) {
    try {
      const data = await mstarGet(url);
      const rows = data?.rows ?? data?.data ?? [];
      if (!Array.isArray(rows) || !rows.length) continue;
      const row = rows[0];
      if (!row) continue;
      return {
        ter:            parseFloat(row.OngoingCharge) || null,
        fund_size:      formatAUM(row.FundTNAV),
        launch_date:    row.InceptionDate ?? null,
        distribution:   row.DistributionType ?? null,
        currency:       row.Currency ?? null,
        domicile:       row.DomicileCountryId ?? null,
        replication:    null,
        index_name:     null,
        num_holdings:   null,
        dividend_yield: parseFloat(row.Yield_M12) || null,
        provider_name:  row.InstitutionName ?? null,
        category:       row.CategoryName ?? null,
        is_hedged:      false,
      };
    } catch (_) {}
  }
  return {};
}

// ── Normalize a raw Morningstar holdings array ────────────────────────────────
function normHoldings(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const mapped = raw.slice(0, 15).map(h => ({
    name:    h.HoldingName ?? h.holdingName ?? h.Name ?? h.name ?? '—',
    weight:  parseFloat(h.Weight ?? h.weight ?? h.Weighting ?? h.Percentage ?? 0) || 0,
    country: h.CountryName ?? h.countryName ?? h.Country ?? null,
    isin:    h.ISIN ?? h.isin ?? null,
  })).filter(h => h.weight > 0);
  return mapped.length ? mapped.sort((a, b) => b.weight - a.weight) : null;
}

// ── Try one portfolio_holding endpoint variant ────────────────────────────────
async function tryPortfolioHolding(secId, domain, token) {
  const url = `https://${domain}/api/rest.svc/${token}/portfolio_holding/${secId}?currencyId=EUR&idtype=Morningstar&responseViewFormat=json`;
  const data = await mstarGet(url);
  const raw  = data?.PortfolioHolding ?? data?.portfolioHolding ?? data?.holdings ?? null;
  return normHoldings(raw);
}

// ── Try embedded JSON in Morningstar snapshot HTML ────────────────────────────
async function getHoldingsFromMstarHtml(secId) {
  const url = `https://www.morningstar.es/es/funds/snapshot/snapshot.aspx?id=${secId}&tab=3`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': 'https://www.morningstar.es/',
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) return null;
  const html = await r.text();

  // Look for holdings array embedded in page JS (several possible formats)
  const patterns = [
    /"PortfolioHolding"\s*:\s*(\[[\s\S]{5,6000}?\])/,
    /"portfolioHolding"\s*:\s*(\[[\s\S]{5,6000}?\])/,
    /"TopHoldings?"\s*:\s*(\[[\s\S]{5,6000}?\])/,
    /"holdings"\s*:\s*(\[[\s\S]{5,6000}?\])/,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (!m) continue;
    try {
      const result = normHoldings(JSON.parse(m[1]));
      if (result) return result;
    } catch (_) {}
  }
  return null;
}

// ── Fund holdings: try all sources in order ──────────────────────────────────
async function getFundHoldings(ids, isin) {
  // Candidate secIds to try (i = fund class, pi = share class)
  const candidates = [ids.i, ids.pi].filter(Boolean);

  // 1. Morningstar tools.morningstar.es — both IDs
  for (const secId of candidates) {
    try {
      const h = await tryPortfolioHolding(secId, 'tools.morningstar.es', MSTAR_TOKEN);
      if (h) return h;
    } catch (_) {}
  }

  // 2. lt.morningstar.com — both IDs (different global domain)
  for (const secId of candidates) {
    try {
      const h = await tryPortfolioHolding(secId, 'lt.morningstar.com', MSTAR_TOKEN_LT);
      if (h) return h;
    } catch (_) {}
  }

  // 3. HTML snapshot scraping — both IDs
  for (const secId of candidates) {
    try {
      const h = await getHoldingsFromMstarHtml(secId);
      if (h) return h;
    } catch (_) {}
  }

  // 4. ExtraETF (covers ETFs and some European mutual funds)
  try {
    const { fetchETFProfile } = require('./extraetf');
    const etfData = await fetchETFProfile(isin);
    if (etfData.holdings && etfData.holdings.length > 0) {
      return etfData.holdings.slice(0, 15).map(h => ({
        name:    h.name,
        weight:  h.weight,
        country: h.country ?? null,
        isin:    h.isin ?? null,
      })).filter(h => h.weight > 0);
    }
  } catch (_) {}

  return [];
}

function formatAUM(raw) {
  if (raw == null) return null;
  const n = parseFloat(raw);
  if (!isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' B EUR';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' M EUR';
  return n.toFixed(0) + ' EUR';
}

// ── Main entry ─────────────────────────────────────────────────────────────────
async function fetchFundProfile(isin) {
  const cacheKey = `fund:profile:${isin}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const ids = await getMstarIds(isin);
    const primaryId = ids.i || ids.pi;

    const [overview, holdings] = await Promise.all([
      getOverviewFromScreener(isin),
      getFundHoldings(ids, isin),
    ]);

    const result = {
      isin,
      overview,
      holdings,
      source:    'morningstar',
      secId:     primaryId,
      fetchedAt: new Date().toISOString(),
    };
    setCache(cacheKey, result, TTL);
    return result;
  } catch (e) {
    console.warn(`[fundProfile] failed for ${isin}: ${e.message}`);
    return { isin, overview: null, holdings: [], source: 'morningstar_unavailable', fetchedAt: new Date().toISOString(), error: e.message };
  }
}

module.exports = { fetchFundProfile };
