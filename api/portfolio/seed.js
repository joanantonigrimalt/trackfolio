// GET /api/portfolio/seed
// Returns portfolio positions with provider metadata.
//
// ?live=1  — enriches each position with the latest real price from its provider.
//            Uses Yahoo quote for ETFs, NAV from Morningstar/Leeway for funds.
//            Falls back to the hardcoded seed price if no live quote is available.
//
// Cache: live results cached in-memory for 15 min (TTL 900s).
//        Static (live=0) results are never cached — they come from a JSON file.
//        X-Cache: HIT | MISS header added for observability.

const portfolioSeed = require('../../portfolio-seed.json');
const portfolioProviders = require('../../portfolio-providers.json');
const { resolveAssetData } = require('../../lib/providers');
const { getCache, setCache } = require('../../lib/cache');
const { toEur } = require('../../lib/fx');

const LIVE_TTL = 900; // 15 min

module.exports = async (req, res) => {
  const live = req.query.live === '1';

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Only cache live requests — static seed is already instant (JSON file)
  if (live) {
    const cacheKey = 'seed:live';
    const cached = getCache(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.statusCode = 200;
      return res.end(JSON.stringify(cached));
    }
    res.setHeader('X-Cache', 'MISS');
  }

  try {
    const positions = await Promise.all(
      portfolioSeed.positions.map(async (position) => {
        const provider = portfolioProviders.assets.find(a => a.isin === position.isin) || null;

        let currentPrice = position.currentPrice; // seed price: siempre en EUR
        let priceSource = 'seed';
        let nativePrice = null;
        let nativeCurrency = null;

        if (live) {
          try {
            // live=1 debe ser VIVO: skipCache evita reutilizar una entrada de L1/Supabase marcada
            // como rancia (compartida con el endpoint de coverage) y servirla como precio "en vivo".
            const resolved = await resolveAssetData(position.isin, { skipCache: true });
            const livePrice = resolved.data?.quote?.price ?? resolved.data?.quote?.close;
            if (livePrice && Number.isFinite(livePrice) && livePrice > 0) {
              // El quote viene en divisa nativa (USD/GBp/…). Conviértelo a EUR — antes se devolvía
              // el precio nativo sin convertir, así que un fondo en USD llegaba como si fuera EUR.
              const ccy = resolved.data?.quote?.currency || provider?.nativeCurrency || 'EUR';
              const eur = await toEur(livePrice, ccy);
              if (eur && Number.isFinite(eur) && eur > 0) {
                currentPrice = Number(eur.toFixed(4)); // EUR
                priceSource = resolved.data?.provider || 'live';
                nativePrice = livePrice;
                nativeCurrency = ccy;
              }
            }
          } catch (_) { /* keep seed price (EUR) */ }
        }

        return { ...position, currentPrice, priceSource, nativePrice, nativeCurrency, provider };
      })
    );

    const body = {
      owner: portfolioSeed.owner,
      currency: portfolioSeed.currency,
      live,
      positions,
    };

    if (live) setCache('seed:live', body, LIVE_TTL);

    res.statusCode = 200;
    res.end(JSON.stringify(body, null, 2));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to load portfolio' }));
  }
};
