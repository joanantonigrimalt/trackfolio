export const config = { runtime: 'edge' };

// POST /api/ai/chat
// Body: { messages: [{role, content}], portfolio?|portfolioContext?: {...} }
// Streams back OpenAI chat completions via Server-Sent Events (data: {text}),
// compatible with the desktop.html / mobile.html stream readers.
//
// Auth: requires a valid Supabase JWT (Bearer). Enforces a monthly message
// quota per plan, persisted in auth user_metadata.credits (same shape read by
// /api/auth/plan). Free = 10/mo, Starter = 50/mo, Pro = unlimited.

const OPENAI_API   = 'https://api.openai.com/v1/chat/completions';
const MODEL_FREE   = 'gpt-4o-mini';   // Free / Starter
const MODEL_PRO    = 'gpt-4o';        // Pro
const MAX_TOKENS   = 1500;
const TEMPERATURE  = 0.3;

const ALLOWED_ROLES   = new Set(['user', 'assistant']);
const MAX_CONTENT_LEN = 4000;
const MAX_MESSAGES    = 20;
const PRO_HARD_CAP    = 1500;  // tope duro de coste para Pro (la UI lo muestra como "ilimitado")

// ── Lightweight in-edge rate limit (per IP) — cost-abuse backstop ─────────
const RL_MAX = 15;            // requests per IP per window
const RL_WINDOW_MS = 60_000;  // 1 minute
const _rlStore = new Map();
function aiRateLimit(req) {
  const ip = req.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  let e = _rlStore.get(ip);
  if (!e || now > e.reset) { e = { count: 0, reset: now + RL_WINDOW_MS }; _rlStore.set(ip, e); }
  e.count++;
  if (_rlStore.size > 5000) _rlStore.clear();
  return e.count <= RL_MAX;
}

function planLimit(plan) {
  return plan === 'pro' ? -1 : plan === 'starter' ? 50 : 10;
}

// Format a value that may already be a formatted string or a raw number.
function fmtVal(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.replace('%', '').trim();
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

// Build the Vera system prompt — accepts either the desktop `portfolio` shape
// (formatted strings + `assets`) or the mobile `portfolioContext` shape
// (numbers + `positions`). Reads defensively so both work.
function buildSystemPrompt(ctx) {
  let prompt = `Eres Vera, la asistente financiera personal integrada en FinAsset (finasset.app), una aplicación de seguimiento de carteras de inversión.

## Identidad y tono
- Responde SIEMPRE en español, con un tono cercano, claro y profesional.
- Eres experta en ETFs, fondos indexados, acciones, dividendos y fiscalidad española (IRPF / plus-valías).
- Cuando menciones fondos o ETFs, cita el TER (Total Expense Ratio) si lo conoces.
- Usa formato Markdown: negritas, listas y encabezados cuando ayuden a la claridad. Sé concisa.

## Capacidades principales
- Calcular rendimientos (rentabilidad total, CAGR, retorno sobre el coste).
- Analizar la diversificación geográfica, sectorial y por tipo de activo.
- Comparar carteras con benchmarks (MSCI World, S&P 500, IBEX 35).
- Explicar la fiscalidad española de inversiones: tramos de IRPF de ahorro, diferimiento fiscal en fondos, regla FIFO, compensación de pérdidas.
- Estimar ingresos por dividendos anuales y calcular la rentabilidad por dividendo (YoC, yield actual).
- Sugerir mejoras a la cartera basándose en los datos reales del usuario.

## Limitaciones honestas
- No tienes acceso a precios en tiempo real salvo los que se te proporcionen en el contexto.
- No puedes ejecutar operaciones ni dar consejos personalizados de inversión con responsabilidad legal.
- Cuando no sepas algo con certeza, dilo abiertamente.`;

  if (ctx && typeof ctx === 'object') {
    const totalValue = fmtVal(ctx.totalValue ?? ctx.total);
    const invested   = fmtVal(ctx.totalInvested ?? ctx.invested);
    const gainAmt     = fmtVal(ctx.totalGain ?? ctx.gainAmt ?? ctx.gain);
    const gainPct     = fmtPct(ctx.totalGainPct ?? ctx.gainPct);
    const liquidity   = fmtVal(ctx.liquidity);
    const divIncome   = fmtVal(ctx.annualDividendIncome ?? ctx.annualDividends);
    const positions   = Array.isArray(ctx.positions) ? ctx.positions
                       : Array.isArray(ctx.assets)    ? ctx.assets : [];

    prompt += '\n\n## Contexto actual de la cartera del usuario\n';
    if (totalValue != null) prompt += `- **Valor total de la cartera:** ${totalValue} €\n`;
    if (invested   != null) prompt += `- **Capital invertido:** ${invested} €\n`;
    if (gainAmt    != null) prompt += `- **Ganancia total:** ${gainAmt} €${gainPct != null ? ` (${gainPct} %)` : ''}\n`;
    if (liquidity  != null) prompt += `- **Liquidez:** ${liquidity} €\n`;
    if (divIncome  != null) prompt += `- **Ingresos anuales por dividendos:** ${divIncome} €\n`;
    if (ctx.score != null)  prompt += `- **Health Score:** ${ctx.score}/100\n`;

    if (positions.length > 0) {
      prompt += '\n### Posiciones\n';
      for (const p of positions.slice(0, 40)) {
        const name = p.name || p.shortName || p.ticker || p.isin || '—';
        let line = `- **${name}**`;
        const qty = p.quantity ?? p.shares;
        if (qty != null && qty !== '') line += ` | ${qty} part.`;
        const val = fmtVal(p.value);
        if (val != null) line += ` | valor: ${val} €`;
        const gp = fmtPct(p.gainPct);
        if (gp != null) line += ` | rendimiento: ${gp} %`;
        if (p.sector) line += ` | ${p.sector}`;
        prompt += line + '\n';
      }
    }
    prompt += '\nUsa estos datos cuando el usuario pregunte sobre su cartera. Si un dato no está disponible, indícalo.';
  }

  return prompt;
}

export default async function handler(req) {
  // ── CORS ─────────────────────────────────────────────────────────────────
  const origin = req.headers?.get('origin') || '';
  const ALLOWED_ORIGINS = new Set([
    'https://finasset.app',
    'https://www.finasset.app',
    'https://trackfolio.vercel.app',
  ]);
  const PREVIEW_RE = /^https:\/\/trackfolio-[a-z0-9]+-grigoms-projects\.vercel\.app$/;
  const LOCAL_RE   = /^https?:\/\/localhost(:\d+)?$/;
  const allowOrigin =
    ALLOWED_ORIGINS.has(origin) || PREVIEW_RE.test(origin) || LOCAL_RE.test(origin) ? origin : null;

  const corsHeaders = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } : {}),
  };
  const json = (obj, status) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  if (!aiRateLimit(req)) {
    return new Response(JSON.stringify({ error: 'Demasiadas peticiones. Espera un momento.' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: 'OPENAI_API_KEY no configurada en las variables de entorno de Vercel.' }, 503);

  // ── Auth: validate Supabase JWT + read plan/credits ───────────────────────
  const authHeader = req.headers?.get('authorization') || '';
  const userTok = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!userTok) return json({ error: 'Inicia sesión para usar Vera.' }, 401);

  const sbUrl  = process.env.SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !svcKey) return json({ error: 'Servicio no configurado.' }, 503);

  let user, meta, plan, limit, used, month, nowMonth;
  try {
    const ur = await fetch(`${sbUrl}/auth/v1/user`, { headers: { apikey: svcKey, Authorization: `Bearer ${userTok}` } });
    if (!ur.ok) return json({ error: 'Sesión no válida. Vuelve a iniciar sesión.' }, 401);
    user  = await ur.json();
    meta  = user.user_metadata || {};
    plan  = meta.plan || 'free';
    limit = planLimit(plan);
    nowMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const c = meta.credits || {};
    month = c.month === nowMonth ? nowMonth : nowMonth;   // reset happens below
    used  = c.month === nowMonth ? Number(c.used || 0) : 0; // new month → reset usage
  } catch {
    return json({ error: 'Error validando la sesión.' }, 500);
  }

  // Quota check (unlimited plans have limit < 0)
  if (limit >= 0 && used >= limit) {
    return json({
      error: `Has alcanzado tu límite mensual de mensajes de Vera (${limit}). Mejora a Premium para conversaciones ilimitadas.`,
      code: 'quota',
    }, 402);
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }

  const { messages } = body;
  const ctx = body.portfolio || body.portfolioContext || null;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'El campo "messages" es obligatorio.' }, 400);
  }

  const sanitized = messages
    .slice(-MAX_MESSAGES)
    .filter(m => m && typeof m === 'object' && ALLOWED_ROLES.has(m.role) && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_LEN) }));
  if (sanitized.length === 0) return json({ error: 'No hay mensajes válidos.' }, 400);

  const firstUser = sanitized.findIndex(m => m.role === 'user');
  const turns = firstUser >= 0 ? sanitized.slice(firstUser) : sanitized;

  const model = plan === 'pro' ? MODEL_PRO : MODEL_FREE;
  const oaMessages = [{ role: 'system', content: buildSystemPrompt(ctx) }, ...turns];

  // ── Reserva ATÓMICA de cuota antes de llamar a OpenAI ──────────────────────
  // Un único UPDATE ... WHERE used < limit (con bloqueo de fila) evita que peticiones
  // concurrentes se salten el límite. Pro tiene un tope duro de coste (PRO_HARD_CAP).
  // Si la RPC aún no existe (migración pendiente), se cae al comportamiento anterior.
  const effLimit = plan === 'pro' ? PRO_HARD_CAP : limit;
  const _bump = async (delta) => {
    try {
      const rr = await fetch(`${sbUrl}/rest/v1/rpc/bump_ai_usage`, {
        method: 'POST',
        headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_user: user.id, p_month: nowMonth, p_limit: effLimit, p_delta: delta }),
      });
      if (!rr.ok) return { ok: false, missing: rr.status === 404 };
      const v = await rr.json().catch(() => undefined);
      return { ok: true, value: (v === null || v === undefined) ? null : Number(v) };
    } catch { return { ok: false, missing: false }; }
  };
  let _atomic = false, newUsed = used + 1;
  const _res = await _bump(1);
  if (_res.ok) {
    _atomic = true;
    if (_res.value === null) {
      // Límite alcanzado (o tope de coste Pro) — no se ha consumido nada.
      return json({
        error: plan === 'pro'
          ? 'Has alcanzado el límite de seguridad mensual de Vera. Escríbenos si necesitas más.'
          : `Has alcanzado tu límite mensual de mensajes de Vera (${limit}). Mejora a Premium para conversaciones ilimitadas.`,
        code: 'quota',
      }, 402);
    }
    newUsed = _res.value;
  }
  // Si !_res.ok se usa el conteo no atómico (fallback): la comprobación previa de cuota ya aplicó.

  // ── Call OpenAI with streaming ─────────────────────────────────────────────
  let oaRes;
  try {
    oaRes = await fetch(OPENAI_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: oaMessages, max_tokens: MAX_TOKENS, temperature: TEMPERATURE, stream: true }),
    });
  } catch {
    if (_atomic) _bump(-1); // reembolsar: la llamada no llegó a realizarse
    return json({ error: 'Error de red al conectar con OpenAI.' }, 502);
  }

  if (!oaRes.ok) {
    if (_atomic) _bump(-1); // reembolsar: OpenAI devolvió error
    let errMsg = `Error de OpenAI: ${oaRes.status}`;
    try { const eb = await oaRes.json(); if (eb?.error?.message) errMsg = eb.error.message; } catch {}
    return json({ error: errMsg }, oaRes.status);
  }

  // La cuota ya se reservó atómicamente arriba (o se contará vía metadata en modo fallback).
  const newCredits = { used: newUsed, limit, remaining: limit < 0 ? -1 : Math.max(0, limit - newUsed), month: nowMonth };
  const persistUsage = () => {
    try {
      fetch(`${sbUrl}/auth/v1/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_metadata: { ...meta, credits: newCredits } }),
      }).catch(() => {});
    } catch { /* ignore */ }
  };

  // ── Transform OpenAI SSE → {text} SSE (same envelope both clients parse) ────
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = oaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let gotText = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          let parsed; try { parsed = JSON.parse(jsonStr); } catch { continue; }
          const text = parsed.choices?.[0]?.delta?.content || '';
          if (text) {
            gotText = true;
            await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
      }
      // Emit updated credits then DONE
      await writer.write(encoder.encode(`data: ${JSON.stringify({ credits: newCredits })}\n\n`));
      await writer.write(encoder.encode('data: [DONE]\n\n'));
      if (gotText) persistUsage(); else if (_atomic) _bump(-1); // sin texto → reembolsar la reserva
    } catch {
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`)); } catch {}
    } finally {
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders,
    },
  });
}
