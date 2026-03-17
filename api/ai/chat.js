export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to Vercel environment variables.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 });
  }

  // Validate and sanitize each message — prevent prompt injection via user-supplied system roles
  const ALLOWED_ROLES = new Set(['user', 'assistant']);
  const MAX_CONTENT_LEN = 4000;
  const MAX_MESSAGES = 20;

  const sanitized = messages
    .slice(-MAX_MESSAGES)
    .filter(m => m && typeof m === 'object' && ALLOWED_ROLES.has(m.role) && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_LEN) }));

  if (sanitized.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid messages' }), { status: 400 });
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: sanitized,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || 'OpenAI error' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
