export const config = { runtime: 'edge' };

// POST /api/ai/chat
// Body: { messages: [{role, content}], portfolioContext?: {...} }
// Streams back Anthropic claude-haiku-3-5-20251001 via Server-Sent Events.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-haiku-3-5-20251001';
const MAX_TOKENS    = 1500;
const TEMPERATURE   = 0.3;

const ALLOWED_ROLES   = new Set(['user', 'assistant']);
const MAX_CONTENT_LEN = 4000;
const MAX_MESSAGES    = 20;

// Build system prompt — optionally enriched with live portfolio data
function buildSystemPrompt(portfolioContext) {
  let prompt = `Eres FinAsset AI, el asistente financiero personal integrado en FinAsset (finasset.app), una aplicación de seguimiento de carteras de inversión.

## Identidad y tono
- Responde SIEMPRE en español, con un tono cercano, claro y profesional.
- Eres experto en ETFs, fondos indexados, acciones, dividendos y fiscalidad española (IRPF / plus-valías).
- Cuando menciones fondos o ETFs, cita el TER (Total Expense Ratio) si lo conoces.
- Usa formato Markdown: negritas, listas y encabezados cuando ayuden a la claridad.

## Capacidades principales
- Calcular rendimientos (rentabilidad total, CAGR, retorno sobre el coste).
- Analizar la diversificación geográfica, sectorial y por tipo de activo.
- Comparar carteras con benchmarks (MSCI World, S&P 500, IBEX 35).
- Explicar la fiscalidad española de inversiones: tramos de IRPF de ahorro, diferimiento fiscal en fondos, regla FIFO, compensación de pérdidas.
- Estimar ingresos por dividendos anuales y calcular la rentabilidad por dividendo (YoC, yield actual).
- Sugerir mejoras a la cartera basándose en los datos reales del usuario.
- Responder preguntas generales sobre mercados, economía y finanzas personales.

## Limitaciones honestas
- No tienes acceso a precios en tiempo real salvo los que se te proporcionen en el contexto.
- No puedes ejecutar operaciones ni dar consejos personalizados de inversión con responsabilidad legal.
- Cuando no sepas algo con certeza, dilo abiertamente.`;

  if (portfolioContext && typeof portfolioContext === 'object') {
    prompt += '\n\n## Contexto actual de la cartera del usuario\n';

    if (portfolioContext.totalValue != null) {
      prompt += `- **Valor total de la cartera:** ${Number(portfolioContext.totalValue).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €\n`;
    }
    if (portfolioContext.totalInvested != null) {
      prompt += `- **Capital invertido:** ${Number(portfolioContext.totalInvested).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €\n`;
    }
    if (portfolioContext.totalGain != null) {
      prompt += `- **Ganancia total:** ${Number(portfolioContext.totalGain).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
      if (portfolioContext.totalGainPct != null) {
        prompt += ` (${Number(portfolioContext.totalGainPct).toFixed(2)} %)`;
      }
      prompt += '\n';
    }
    if (portfolioContext.annualDividendIncome != null) {
      prompt += `- **Ingresos anuales por dividendos:** ${Number(portfolioContext.annualDividendIncome).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €\n`;
    }
    if (portfolioContext.portfolioYield != null) {
      prompt += `- **Rentabilidad por dividendo (yield):** ${(Number(portfolioContext.portfolioYield) * 100).toFixed(2)} %\n`;
    }
    if (Array.isArray(portfolioContext.positions) && portfolioContext.positions.length > 0) {
      prompt += '\n### Posiciones\n';
      for (const p of portfolioContext.positions) {
        const name    = p.name || p.shortName || p.isin || '—';
        const qty     = p.quantity != null ? Number(p.quantity) : null;
        const current = p.currentPrice != null ? Number(p.currentPrice) : null;
        const buy     = p.buyPrice != null ? Number(p.buyPrice) : null;
        const value   = qty != null && current != null ? qty * current : null;
        const gainPct = buy != null && buy > 0 && current != null
          ? ((current - buy) / buy * 100).toFixed(2)
          : null;

        let line = `- **${name}**`;
        if (qty != null)     line += ` | ${qty.toLocaleString('es-ES', { maximumFractionDigits: 4 })} participaciones`;
        if (current != null) line += ` | precio actual: ${current.toFixed(4)} €`;
        if (buy != null)     line += ` | precio de compra: ${buy.toFixed(4)} €`;
        if (gainPct != null) line += ` | rendimiento: ${gainPct} %`;
        if (value != null)   line += ` | valor: ${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
        prompt += line + '\n';
      }
    }

    prompt += '\nUsa estos datos cuando el usuario pregunte sobre su cartera. Si los datos no están disponibles para una pregunta concreta, indícalo.';
  }

  return prompt;
}

export default async function handler(req) {
  // ── CORS preflight ───────────────────────────────────────────────────────
  const origin = req.headers?.get('origin') || '';
  const ALLOWED_ORIGINS = new Set([
    'https://finasset.app',
    'https://www.finasset.app',
    'https://trackfolio.vercel.app',
  ]);
  const PREVIEW_RE = /^https:\/\/trackfolio-[a-z0-9]+-grigoms-projects\.vercel\.app$/;
  const LOCAL_RE   = /^https?:\/\/localhost(:\d+)?$/;
  const allowOrigin =
    ALLOWED_ORIGINS.has(origin) || PREVIEW_RE.test(origin) || LOCAL_RE.test(origin)
      ? origin
      : null;

  const corsHeaders = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } : {}),
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // ── API key check ────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en las variables de entorno de Vercel.' }),
      { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido en el cuerpo de la petición.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { messages, portfolioContext } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'El campo "messages" es obligatorio y no puede estar vacío.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // ── Sanitize messages (strip system roles — prompt injection guard) ───────
  const sanitized = messages
    .slice(-MAX_MESSAGES)
    .filter(m => m && typeof m === 'object' && ALLOWED_ROLES.has(m.role) && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_LEN) }));

  if (sanitized.length === 0) {
    return new Response(JSON.stringify({ error: 'No hay mensajes válidos.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Anthropic requires alternating user/assistant turns; ensure first is 'user'
  const firstUser = sanitized.findIndex(m => m.role === 'user');
  const turns = firstUser >= 0 ? sanitized.slice(firstUser) : sanitized;

  // ── Call Anthropic with streaming ────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(
    portfolioContext && typeof portfolioContext === 'object' ? portfolioContext : null,
  );

  let anthropicRes;
  try {
    anthropicRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system:     systemPrompt,
        messages:   turns,
        stream:     true,
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error de red al conectar con Anthropic.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!anthropicRes.ok) {
    let errMsg = `Error de Anthropic: ${anthropicRes.status}`;
    try {
      const errBody = await anthropicRes.json();
      if (errBody?.error?.message) errMsg = errBody.error.message;
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: errMsg }), {
      status: anthropicRes.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // ── Transform Anthropic SSE stream → SSE stream for the client ───────────
  // Anthropic sends: event: content_block_delta  data: { delta: { type, text } }
  // We re-emit:       data: { text }    (compatible with OpenAI-style streaming)
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last chunk

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('event:')) continue;
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;

          let parsed;
          try { parsed = JSON.parse(jsonStr); } catch { continue; }

          // content_block_delta carries the text chunk
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            const text = parsed.delta.text || '';
            if (text) {
              const sseChunk = `data: ${JSON.stringify({ text })}\n\n`;
              await writer.write(encoder.encode(sseChunk));
            }
          }

          // message_stop signals end of generation
          if (parsed.type === 'message_stop') {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
          }
        }
      }
    } catch (e) {
      // Write an error event before closing
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`));
      } catch { /* ignore */ }
    } finally {
      try { await writer.close(); } catch { /* ignore */ }
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type':  'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      Connection:      'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering on Vercel
      ...corsHeaders,
    },
  });
}
