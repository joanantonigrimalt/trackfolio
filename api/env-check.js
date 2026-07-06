export const config = { runtime: 'edge' };

// TEMPORAL — diagnóstico de variables de entorno. Reporta solo si existen
// (booleanos + longitud), nunca el valor. Borrar tras depurar.
export default function handler() {
  const k = process.env.OPENAI_API_KEY || '';
  return new Response(JSON.stringify({
    OPENAI_API_KEY_present: !!process.env.OPENAI_API_KEY,
    OPENAI_API_KEY_len: k.length,
    OPENAI_API_KEY_prefix: k.slice(0, 7),
    CRON_SECRET_present: !!process.env.CRON_SECRET,
    SUPABASE_URL_present: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY_present: !!process.env.ANTHROPIC_API_KEY,
    runtime: 'edge',
    VERCEL_ENV: process.env.VERCEL_ENV || null,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7),
    deployUrl: process.env.VERCEL_URL || null,
    allKeys: Object.keys(process.env).filter(k => /OPENAI|CRON|ANTHROPIC/i.test(k)),
  }, null, 2), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
