// Cron: mantiene fresco el histórico de precios (price_history) para que las cargas
// normales (sin refresh=1) y los gráficos muestren datos recientes sin depender del
// refresco en segundo plano del cliente.
//
// ⚠ Por qué cambió: antes la lista de ISINs se leía de la tabla `assets_metadata`, pero
// esa tabla NUNCA se puebla (dbSaveMetadata está definida pero no se llama en ningún sitio)
// → el cron recibía 0 ISINs y no refrescaba nada. Ahora la lista sale de:
//   1) el catálogo estático empaquetado (portfolio-seed.json + portfolio-providers.json), y
//   2) los activos personalizados de los usuarios (user_positions.custom_assets).
//
// Además, para que la escritura no dependa del guardado "fire-and-forget" de coverage
// (que Vercel puede congelar en cuanto responde), el propio cron persiste el histórico
// devuelto con dbSaveHistory AWAIT → la escritura se completa antes de responder.
//
// Protegido por CRON_SECRET (Vercel envía `Authorization: Bearer <CRON_SECRET>`).
// Idempotente y best-effort: cualquier fallo por ISIN se ignora y no aborta el resto.

const portfolioSeed = require('../../portfolio-seed.json');
const portfolioProviders = require('../../portfolio-providers.json');
const { dbSaveHistory } = require('../../lib/cache');

const BATCH = 8;            // ISINs por petición a coverage (coverage los resuelve en paralelo)
const MAX_ISINS = 48;       // tope por ejecución (deja margen bajo maxDuration=60s de la lambda)

function baseUrl() {
  // En producción usamos el dominio canónico; en preview, la URL del despliegue.
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://finasset.app';
}

// ISINs del catálogo conocido, empaquetado con el código (siempre disponible, sin depender de la BD).
function catalogIsins() {
  const seed = (portfolioSeed.positions || []).map(p => p.isin);
  const prov = (portfolioProviders.assets || []).map(a => a.isin);
  return [...seed, ...prov].filter(Boolean);
}

// ISINs de los activos personalizados de los usuarios (user_positions.custom_assets es un
// objeto indexado por ISIN). Best-effort: si falla, seguimos solo con el catálogo.
async function customAssetIsins(SB, hdrs) {
  try {
    const r = await fetch(`${SB}/rest/v1/user_positions?select=custom_assets`, {
      headers: hdrs, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const rows = await r.json();
    const out = [];
    for (const row of (Array.isArray(rows) ? rows : [])) {
      let ca = row.custom_assets;
      if (typeof ca === 'string') { try { ca = JSON.parse(ca); } catch { ca = null; } }
      if (ca && typeof ca === 'object') out.push(...Object.keys(ca));
    }
    return out;
  } catch (_) {
    return [];
  }
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

  // Lista de trabajo: primero el catálogo (cartera demo + activos mapeados), luego los
  // personalizados de usuarios. Dedup + tope. El catálogo va primero → siempre se cubre.
  const custom = await customAssetIsins(SB, hdrs);
  const isins = [...new Set([...catalogIsins(), ...custom])].slice(0, MAX_ISINS);

  if (!isins.length) {
    res.status(200).json({ ok: true, refreshed: 0, persisted: 0, note: 'sin ISINs' });
    return;
  }

  const B = baseUrl();
  let refreshed = 0;   // ISINs cuya petición a coverage respondió OK
  let persisted = 0;   // ISINs cuyo histórico fresco se escribió en price_history
  for (let i = 0; i < isins.length; i += BATCH) {
    const chunk = isins.slice(i, i + BATCH);
    try {
      const cr = await fetch(
        `${B}/api/portfolio/coverage?isin=${encodeURIComponent(chunk.join(','))}&refresh=1`,
        { signal: AbortSignal.timeout(25000) }
      );
      if (!cr.ok) continue;
      refreshed += chunk.length;

      // Persistimos el histórico devuelto AQUÍ (await) para no depender del guardado
      // fire-and-forget de coverage, que la lambda puede matar tras responder.
      const body = await cr.json().catch(() => null);
      const results = (body && Array.isArray(body.results)) ? body.results : [];
      for (const r of results) {
        const hist = (r && r.data && Array.isArray(r.data.history)) ? r.data.history : [];
        if (hist.length > 10) {
          const ok = await dbSaveHistory(r.isin, hist, r.data.provider || 'cron').catch(() => false);
          if (ok) persisted++;
        }
      }
    } catch (_) { /* best-effort */ }
  }

  res.status(200).json({ ok: true, total: isins.length, refreshed, persisted, at: new Date().toISOString() });
};
