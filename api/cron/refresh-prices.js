// Cron: refresca el histórico de precios de los ISIN ya cacheados para que no se
// queden congelados indefinidamente si el refresco en segundo plano del cliente falla.
//
// Protegido por CRON_SECRET (Vercel envía `Authorization: Bearer <CRON_SECRET>` a los crons).
// En plan Hobby los crons se ejecutan ~1 vez/día; refrescamos un lote rotatorio de los más
// desactualizados en cada ejecución, de modo que en pocos días se cubre todo el catálogo cacheado.
//
// Idempotente y best-effort: cualquier fallo por ISIN se ignora y no aborta el resto.

const BATCH = 6;            // ISINs por petición a coverage
const MAX_ISINS = 48;       // tope por ejecución (evita superar el tiempo de la lambda)

function baseUrl() {
  // En producción usamos el dominio canónico; en preview, la URL del despliegue.
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://finasset.app';
}

module.exports = async (req, res) => {
  // ── Auth: solo el cron de Vercel (o quien tenga el secreto) puede invocar ──
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] || '';
    const qs = (req.query && req.query.key) || '';
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  const SB = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SB || !KEY) { res.status(503).json({ error: 'supabase no configurado' }); return; }

  const hdrs = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  let isins = [];
  try {
    // Los ISIN cuyo último dato es más antiguo primero (rotación natural).
    const r = await fetch(
      `${SB}/rest/v1/assets_metadata?select=isin&order=updated_at.asc.nullsfirst&limit=${MAX_ISINS}`,
      { headers: hdrs }
    );
    if (r.ok) {
      const rows = await r.json();
      isins = [...new Set((Array.isArray(rows) ? rows : []).map(x => x.isin).filter(Boolean))];
    }
  } catch (e) {
    res.status(502).json({ error: 'no se pudo listar ISINs', detail: e.message });
    return;
  }

  if (!isins.length) { res.status(200).json({ ok: true, refreshed: 0, note: 'sin ISINs cacheados' }); return; }

  const B = baseUrl();
  let refreshed = 0;
  for (let i = 0; i < isins.length; i += BATCH) {
    const chunk = isins.slice(i, i + BATCH);
    try {
      const cr = await fetch(`${B}/api/portfolio/coverage?isin=${encodeURIComponent(chunk.join(','))}&refresh=1`, {
        signal: AbortSignal.timeout(25000),
      });
      if (cr.ok) refreshed += chunk.length;
    } catch (_) { /* best-effort */ }
  }

  res.status(200).json({ ok: true, total: isins.length, refreshed, at: new Date().toISOString() });
};
