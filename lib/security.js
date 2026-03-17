// Shared security middleware for all API endpoints
// Provides: CORS, rate limiting, input validation, request size limits

// ── CORS ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://finasset.app',
  'https://www.finasset.app',
  'https://trackfolio.vercel.app',
]);

// Allow any *.vercel.app preview URL in dev
const VERCEL_PREVIEW_RE = /^https:\/\/trackfolio-[a-z0-9]+-grigoms-projects\.vercel\.app$/;

function getAllowedOrigin(req) {
  const origin = req.headers?.origin || '';
  if (!origin) return null; // same-origin requests have no Origin header
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (VERCEL_PREVIEW_RE.test(origin)) return origin;
  // Allow localhost in development
  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    return origin;
  }
  return null;
}

function setCorsHeaders(req, res) {
  const allowedOrigin = getAllowedOrigin(req);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ── Rate limiting (in-memory, per IP) ────────────────────────────────────
// Limits: 60 req/min per IP for search/query, 20 req/min for heavy endpoints
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}

// Clean up every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpired, 5 * 60 * 1000);
}

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(req, res, maxRequests = 60) {
  const ip = getClientIp(req);
  const key = `${ip}:${req.url?.split('?')[0] || '/'}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, entry);
  }
  entry.count++;

  // Cap store size to prevent unbounded memory growth
  if (rateLimitStore.size > 10000) cleanupExpired();

  res.setHeader('X-RateLimit-Limit', String(maxRequests));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count >= maxRequests) {
    res.statusCode = 429;
    res.setHeader('Retry-After', '60');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
    return false;
  }
  return true;
}

// ── Input validation ─────────────────────────────────────────────────────
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/;
const SYMBOL_RE = /^[A-Z0-9.\-^=]{1,20}$/i;
const QUERY_MAX_LEN = 100;

function validateIsin(isin) {
  return typeof isin === 'string' && ISIN_RE.test(isin.trim().toUpperCase());
}

function validateSymbol(symbol) {
  return typeof symbol === 'string' && SYMBOL_RE.test(symbol.trim());
}

function sanitizeQuery(q) {
  if (typeof q !== 'string') return '';
  return q.trim().slice(0, QUERY_MAX_LEN).replace(/[<>"'`;\\]/g, '');
}

function validateIsins(raw) {
  if (!raw) return { isins: [], error: null };
  const isins = String(raw).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (isins.length === 0) return { isins: [], error: 'No ISINs provided' };
  if (isins.length > 50) return { isins: [], error: 'Maximum 50 ISINs per request' };
  const invalid = isins.filter(i => !validateIsin(i));
  if (invalid.length > 0) return { isins: [], error: `Invalid ISIN format: ${invalid.slice(0, 3).join(', ')}` };
  return { isins, error: null };
}

// ── Request size limit ────────────────────────────────────────────────────
const MAX_BODY_BYTES = 32 * 1024; // 32 KB

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ── Options preflight handler ────────────────────────────────────────────
function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

// ── Safe error response (never expose internal details in production) ─────
function sendError(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
}

// ── Common API setup (call at start of every handler) ───────────────────
// Returns false if the request was terminated (OPTIONS / rate-limited)
function setupApi(req, res, options = {}) {
  const { maxRequests = 60 } = options;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  setCorsHeaders(req, res);

  if (handleOptions(req, res)) return false;
  if (!checkRateLimit(req, res, maxRequests)) return false;

  return true;
}

module.exports = {
  setupApi,
  setCorsHeaders,
  checkRateLimit,
  handleOptions,
  validateIsin,
  validateIsins,
  validateSymbol,
  sanitizeQuery,
  readBody,
  sendError,
  getClientIp,
};
