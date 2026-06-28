export const config = { runtime: 'edge' };

// POST /api/stripe/webhook
// Stripe webhook handler — updates user plan in Supabase
//
// Env vars required:
//   STRIPE_WEBHOOK_SECRET  — whsec_...
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Events handled:
//   checkout.session.completed      → set user plan = 'pro'
//   customer.subscription.deleted   → set user plan = 'free'
//   invoice.payment_failed          → (log only)

async function verifyStripeSignature(body, sigHeader, secret) {
  // Parse Stripe-Signature header: t=timestamp,v1=signature
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;

  // Build signed payload
  const payload = `${ts}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time compare
  if (computed.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

async function updateUserPlan(userId, plan, sbUrl, svcKey) {
  // Get current user metadata
  const getRes = await fetch(`${sbUrl}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` },
  });
  if (!getRes.ok) return;
  const user = await getRes.json();
  const meta = user.user_metadata || {};

  // Patch user metadata
  await fetch(`${sbUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_metadata: {
        ...meta,
        plan,
        plan_updated_at: new Date().toISOString(),
        ...(plan === 'pro'
          ? { credits: { limit: -1, used: meta.credits?.used || 0 } }
          : { credits: { limit: 10, used: 0 } }
        ),
      },
    }),
  });
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const sigHeader = req.headers.get('stripe-signature') || '';
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const sbUrl  = (process.env.SUPABASE_URL || '').trim();
  const svcKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!webhookSecret) return new Response('Webhook secret not configured', { status: 503 });

  const rawBody = await req.text();

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!valid) return new Response('Invalid signature', { status: 400 });

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  console.log(`[stripe/webhook] event: ${event.type}`);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.user_id;
      if (userId) {
        await updateUserPlan(userId, 'pro', sbUrl, svcKey);
        console.log(`[stripe/webhook] upgraded user ${userId} to pro`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      if (userId) {
        await updateUserPlan(userId, 'free', sbUrl, svcKey);
        console.log(`[stripe/webhook] downgraded user ${userId} to free`);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      console.warn(`[stripe/webhook] payment failed for customer ${invoice.customer}, amount: ${invoice.amount_due}`);
      // Could send email notification here
    }
  } catch (e) {
    console.error(`[stripe/webhook] handler error: ${e.message}`);
    // Return 200 so Stripe doesn't retry
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
