export const config = { runtime: 'edge' };

// POST /api/email/send — send transactional email via Resend
// Body: { to, subject, html, from? }
// Auth: REQUIRES a valid Supabase session (Bearer access token, verified
//       against Supabase Auth). Prevents the endpoint being used as an
//       anonymous open relay for spam/phishing.

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT = 200;
const MAX_HTML    = 100 * 1024; // 100 KB
const MAX_RECIPIENTS = 10;
const ALLOWED_FROM = /@finasset\.app>?\s*$/i; // only allow sending from our verified domain

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Real auth: verify the Supabase access token, don't just check the prefix ──
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Auth not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const verify = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!verify.ok) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Auth verification failed' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  const { to, subject, html, from = 'Finasset <noreply@finasset.app>' } = body || {};

  // ── Input validation ─────────────────────────────────────────────────────
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: 'Missing to/subject/html' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
    return new Response(JSON.stringify({ error: `Recipients must be 1–${MAX_RECIPIENTS}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (!recipients.every(r => typeof r === 'string' && EMAIL_RE.test(r))) {
    return new Response(JSON.stringify({ error: 'Invalid recipient address' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (typeof subject !== 'string' || subject.length > MAX_SUBJECT) {
    return new Response(JSON.stringify({ error: 'Subject too long' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (typeof html !== 'string' || html.length > MAX_HTML) {
    return new Response(JSON.stringify({ error: 'HTML body too large' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  // Prevent sender spoofing: only allow our own verified domain as the From.
  if (typeof from !== 'string' || !ALLOWED_FROM.test(from)) {
    return new Response(JSON.stringify({ error: 'Invalid from address' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || `Resend ${r.status}`);
    return new Response(JSON.stringify({ id: d.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
