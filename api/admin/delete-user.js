export const config = { runtime: 'edge' };

// POST /api/admin/delete-user
// Body: { user_id: "uuid" }
// Secured: only joantonigrimalt@gmail.com can call this.
// Deletes user from Supabase Auth + all their data tables.

const ADMIN_EMAIL = 'joantonigrimalt@gmail.com';

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || 'https://www.finasset.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

  const sbUrl  = (process.env.SUPABASE_URL || '').trim();
  const svcKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!sbUrl || !svcKey) {
    return new Response(JSON.stringify({ error: 'Not configured — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel env vars' }), { status: 503, headers: corsHeaders });
  }

  // Verify caller JWT
  const auth = req.headers.get('authorization') || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tok) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

  // Verify caller is admin
  const userRes = await fetch(`${sbUrl}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${tok}` },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
  const caller = await userRes.json();
  if (caller.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }

  // Parse body
  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders }); }
  const { user_id } = body;
  if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: corsHeaders });

  // Prevent self-deletion
  if (user_id === caller.id) {
    return new Response(JSON.stringify({ error: 'No puedes eliminar tu propia cuenta desde el admin' }), { status: 400, headers: corsHeaders });
  }

  // Delete user data from tables (best effort — don't fail if table missing)
  const tables = ['user_positions', 'user_loans', 'portfolio_snapshots', 'user_plan'];
  await Promise.allSettled(tables.map(table =>
    fetch(`${sbUrl}/rest/v1/${table}?user_id=eq.${user_id}`, {
      method: 'DELETE',
      headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json' },
    })
  ));

  // Delete from Supabase Auth (requires service role key)
  const delRes = await fetch(`${sbUrl}/auth/v1/admin/users/${user_id}`, {
    method: 'DELETE',
    headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` },
  });

  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    return new Response(JSON.stringify({ error: err.message || 'Error eliminando usuario de Auth: ' + delRes.status }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, deleted: user_id }), { status: 200, headers: corsHeaders });
};
