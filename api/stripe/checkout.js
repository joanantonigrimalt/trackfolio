export const config = { runtime: 'edge' };

// POST /api/stripe/checkout
// Body: { token: <supabase_jwt> }
// Returns: { url: <stripe_checkout_url> }
//
// Env vars required:
//   STRIPE_SECRET_KEY  — sk_live_... or sk_test_...
//   STRIPE_PRICE_ID    — price_... (9.99€/month recurring)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const CORS_ORIGIN = 'https://www.finasset.app';

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': origin || CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });

  const sbUrl  = (process.env.SUPABASE_URL || '').trim();
  const svcKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const stripeKey  = (process.env.STRIPE_SECRET_KEY || '').trim();
  const stripePriceId = (process.env.STRIPE_PRICE_ID || '').trim();

  if (!stripeKey) return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 503, headers: cors });
  if (!stripePriceId) return new Response(JSON.stringify({ error: 'STRIPE_PRICE_ID not set' }), { status: 503, headers: cors });

  // Verify caller JWT
  const auth = req.headers.get('authorization') || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tok) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

  const userRes = await fetch(`${sbUrl}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${tok}` },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: cors });
  const user = await userRes.json();

  // Check if already pro
  const plan = user.user_metadata?.plan;
  if (plan === 'pro') {
    return new Response(JSON.stringify({ error: 'already_pro', message: 'Ya tienes el plan Pro activo.' }), { status: 400, headers: cors });
  }

  // Create Stripe Checkout Session
  const params = new URLSearchParams({
    'mode': 'subscription',
    'line_items[0][price]': stripePriceId,
    'line_items[0][quantity]': '1',
    'customer_email': user.email || '',
    'client_reference_id': user.id,
    'success_url': `${CORS_ORIGIN}/desktop?upgraded=1`,
    'cancel_url': `${CORS_ORIGIN}/desktop`,
    'locale': 'es',
    'allow_promotion_codes': 'true',
    'subscription_data[metadata][user_id]': user.id,
    'subscription_data[metadata][email]': user.email || '',
  });

  const sessRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!sessRes.ok) {
    const err = await sessRes.json().catch(() => ({}));
    console.error('[stripe/checkout] error:', err);
    return new Response(JSON.stringify({ error: 'stripe_error', detail: err?.error?.message || 'Unknown error' }), { status: 502, headers: cors });
  }

  const session = await sessRes.json();
  return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), { status: 200, headers: cors });
};
