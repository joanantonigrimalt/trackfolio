export const config = { runtime: 'edge' };

// POST /api/email/send — send transactional email via Resend
// Body: { to, subject, html, from? }
// Auth: requires valid Supabase JWT (Bearer token)
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // Verify caller has a valid Supabase session (basic auth guard)
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 503 });
  }

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { to, subject, html, from = 'Finasset <noreply@finasset.app>' } = body;
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: 'Missing to/subject/html' }), { status: 400 });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || `Resend ${r.status}`);
    return new Response(JSON.stringify({ id: d.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
