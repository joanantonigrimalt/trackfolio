export const config = { runtime: 'edge' };

// Also handles /api/auth/lookup-username (rewritten by vercel.json)
// When ?u=<username> is present, resolves username → email via Supabase admin API.

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

export default async (req) => {
  if (!edgeRateLimit(req)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  // Handle username → email lookup when ?u=<username> is present
  const url = new URL(req.url);
  const username = url.searchParams.get('u');
  if (username) {
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sbUrl  = process.env.SUPABASE_URL;
    if (!svcKey || !sbUrl) {
      return new Response(JSON.stringify({ error: 'Username lookup not configured' }), { status: 503 });
    }
    try {
      const r = await fetch(`${sbUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` },
      });
      if (!r.ok) return new Response(JSON.stringify({ error: 'Upstream error' }), { status: 502 });
      const data = await r.json();
      const users = Array.isArray(data.users) ? data.users : [];
      const match = users.find(u =>
        (u.user_metadata?.full_name || '').toLowerCase() === username.trim().toLowerCase()
      );
      if (!match) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      return new Response(JSON.stringify({ email: match.email }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
    }
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
