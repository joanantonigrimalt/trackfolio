export const config = { runtime: 'edge' };

// POST /api/admin/stats
// Secured: only joantonigrimalt@gmail.com can call this.
// Verifies the caller's Supabase JWT, checks email, then uses service-role
// key to pull all users + positions data.

const ADMIN_EMAIL = 'joantonigrimalt@gmail.com';

export default async (req) => {
  // CORS
  const origin = req.headers.get('origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || 'https://www.finasset.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const sbUrl  = (process.env.SUPABASE_URL || '').trim();
  const svcKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();

  if (!sbUrl || !svcKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), { status: 503, headers: corsHeaders });
  }

  // Verify caller JWT
  const auth = req.headers.get('authorization') || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  // Get user from token
  const userRes = await fetch(`${sbUrl}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${tok}` },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
  }
  const caller = await userRes.json();
  if (caller.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }

  // Fetch all users (admin API, paginated)
  const usersRes = await fetch(`${sbUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` },
  });
  const usersData = usersRes.ok ? await usersRes.json() : { users: [] };
  const users = Array.isArray(usersData.users) ? usersData.users : [];

  // Fetch all user_positions rows (to check portfolio activity)
  const posRes = await fetch(`${sbUrl}/rest/v1/user_positions?select=user_id,updated_at`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, Accept: 'application/json' },
  });
  const positions = posRes.ok ? await posRes.json() : [];
  const posMap = {};
  (Array.isArray(positions) ? positions : []).forEach(p => { posMap[p.user_id] = p.updated_at; });

  // Build user stats
  const now = Date.now();
  const DAY  = 86400000;
  const enriched = users.map(u => {
    const meta  = u.user_metadata || {};
    const plan  = meta.plan || 'free';
    const creds = meta.credits || {};
    const lastSeen = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
    const createdAt = u.created_at ? new Date(u.created_at).getTime() : 0;
    return {
      id: u.id,
      email: u.email || '—',
      name: meta.full_name || meta.name || '—',
      provider: u.app_metadata?.provider || 'email',
      plan,
      credits_used: creds.used || 0,
      credits_limit: creds.limit ?? (plan === 'pro' ? -1 : plan === 'starter' ? 50 : 10),
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      confirmed: !!u.email_confirmed_at,
      active_today: lastSeen > now - DAY,
      active_7d: lastSeen > now - 7 * DAY,
      active_30d: lastSeen > now - 30 * DAY,
      has_portfolio: !!posMap[u.id],
      portfolio_updated: posMap[u.id] || null,
      days_since_register: Math.floor((now - createdAt) / DAY),
    };
  });

  // Aggregate stats
  const total = enriched.length;
  const confirmed = enriched.filter(u => u.confirmed).length;
  const active7d  = enriched.filter(u => u.active_7d).length;
  const active30d = enriched.filter(u => u.active_30d).length;
  const withPortfolio = enriched.filter(u => u.has_portfolio).length;
  const byPlan = { free: 0, starter: 0, pro: 0 };
  enriched.forEach(u => { byPlan[u.plan] = (byPlan[u.plan] || 0) + 1; });
  const byProvider = {};
  enriched.forEach(u => { byProvider[u.provider] = (byProvider[u.provider] || 0) + 1; });

  // New registrations per day (last 30 days)
  const regByDay = {};
  enriched.forEach(u => {
    if (!u.created_at) return;
    const day = u.created_at.slice(0, 10);
    regByDay[day] = (regByDay[day] || 0) + 1;
  });

  return new Response(
    JSON.stringify({
      stats: { total, confirmed, active7d, active30d, withPortfolio, byPlan, byProvider, regByDay },
      users: enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      supabaseUrl: sbUrl,
      anonKeyPresent: !!anonKey,
      svcKeyPresent: !!svcKey,
      anthropicKeyPresent: !!(process.env.ANTHROPIC_API_KEY),
      eodhdKeyPresent: !!(process.env.EODHD_API_KEY),
      twelvedataKeyPresent: !!(process.env.TWELVEDATA_API_KEY),
      fmpKeyPresent: !!(process.env.FMP_API_KEY),
    }),
    { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
  );
};
