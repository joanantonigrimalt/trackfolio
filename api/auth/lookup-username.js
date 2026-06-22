// Resolves a username to an email address for login
// Queries Supabase auth.users via service role key
// Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars
const { setupApi, sendError } = require('../../lib/security');

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 20 })) return;

  const username = (req.query.u || '').trim().slice(0, 64);
  if (!username) return sendError(res, 400, 'Missing username');

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sbUrl  = process.env.SUPABASE_URL;
  if (!svcKey || !sbUrl) return sendError(res, 503, 'Username lookup not configured');

  try {
    // Query auth.users for a user whose full_name metadata matches
    const r = await fetch(
      `${sbUrl}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` } }
    );
    if (!r.ok) return sendError(res, 502, 'Upstream error');
    const data = await r.json();
    const users = Array.isArray(data.users) ? data.users : [];
    const match = users.find(u =>
      (u.user_metadata?.full_name || '').toLowerCase() === username.toLowerCase()
    );
    if (!match) return sendError(res, 404, 'Not found');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ email: match.email }));
  } catch {
    sendError(res, 500, 'Internal error');
  }
};
