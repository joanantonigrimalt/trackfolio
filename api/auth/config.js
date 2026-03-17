export const config = { runtime: 'edge' };

// Simple in-edge rate limiter (per IP, 30 req/min)
const _rlStore = new Map();
function edgeRateLimit(req, max = 30) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  let e = _rlStore.get(ip);
  if (!e || now > e.r) { e = { c: 0, r: now + 60000 }; _rlStore.set(ip, e); }
  e.c++;
  if (_rlStore.size > 5000) _rlStore.clear(); // prevent unbounded growth
  return e.c <= max;
}

export default (req) => {
  if (!edgeRateLimit(req)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }
  return new Response(
    JSON.stringify({
      supabaseUrl: (process.env.SUPABASE_URL || '').trim(),
      supabaseAnonKey: (process.env.SUPABASE_ANON_KEY || '').trim(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        // Reduced from 3600 → 300s; anon key is public but no need to cache aggressively
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
};
