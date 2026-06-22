const { setupApi, sendError } = require('../../lib/security');

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 30 })) return;

  const auth = req.headers['authorization'] || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tok) return sendError(res, 401, 'Unauthorized');

  const sbUrl  = process.env.SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !svcKey) return sendError(res, 503, 'Not configured');

  try {
    const r = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: { apikey: svcKey, Authorization: `Bearer ${tok}` }
    });
    if (!r.ok) return sendError(res, 401, 'Invalid token');
    const user = await r.json();

    const meta = user.user_metadata || {};
    const plan = meta.plan || 'free';
    const credits = meta.credits || { used: 0, limit: plan === 'pro' ? -1 : plan === 'starter' ? 50 : 10, remaining: 0, month: '' };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ plan, credits }));
  } catch {
    sendError(res, 500, 'Internal error');
  }
};
