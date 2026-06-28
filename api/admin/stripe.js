export const config = { runtime: 'edge' };

const ADMIN_EMAIL = 'joantonigrimalt@gmail.com';

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || 'https://www.finasset.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const sbUrl  = (process.env.SUPABASE_URL || '').trim();
  const svcKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();

  // Verify admin JWT
  const auth = req.headers.get('authorization') || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tok) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

  const userRes = await fetch(`${sbUrl}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${tok}` },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
  const caller = await userRes.json();
  if (caller.email !== ADMIN_EMAIL) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });

  if (!stripeKey) {
    return new Response(JSON.stringify({ configured: false, mrr: 0, arr: 0, totalActiveSubs: 0, monthlyCount: 0, annualCount: 0, recentCharges: [] }), { status: 200, headers: corsHeaders });
  }

  const stripeHeaders = {
    Authorization: `Bearer ${stripeKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // Fetch active subscriptions
  const [subsRes, chargesRes] = await Promise.all([
    fetch('https://api.stripe.com/v1/subscriptions?status=active&limit=100&expand[]=data.customer', { headers: stripeHeaders }),
    fetch('https://api.stripe.com/v1/charges?limit=50&expand[]=data.customer', { headers: stripeHeaders }),
  ]);

  const subsData = subsRes.ok ? await subsRes.json() : { data: [] };
  const chargesData = chargesRes.ok ? await chargesRes.json() : { data: [] };

  const subs = subsData.data || [];
  const charges = chargesData.data || [];

  // Calculate MRR: sum monthly equivalent of each active subscription
  let mrr = 0, monthlyCount = 0, annualCount = 0;
  subs.forEach(sub => {
    const item = sub.items?.data?.[0];
    if (!item) return;
    const amt = (item.price?.unit_amount || 0) / 100; // cents → euros
    const interval = item.price?.recurring?.interval;
    if (interval === 'month') { mrr += amt; monthlyCount++; }
    else if (interval === 'year') { mrr += amt / 12; annualCount++; }
  });

  // Map recent charges
  const recentCharges = charges.map(c => ({
    id: c.id,
    amount: ((c.amount || 0) / 100).toFixed(2),
    currency: c.currency,
    paid: c.paid,
    refunded: c.refunded,
    created: new Date(c.created * 1000).toISOString(),
    customer_email: typeof c.customer === 'object' ? c.customer?.email : null,
    customer_name: typeof c.customer === 'object' ? (c.customer?.name || c.billing_details?.name || null) : null,
  }));

  return new Response(JSON.stringify({
    configured: true,
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    totalActiveSubs: subs.length,
    monthlyCount,
    annualCount,
    recentCharges,
  }), { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
};
