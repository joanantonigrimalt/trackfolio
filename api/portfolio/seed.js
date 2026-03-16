// GET /api/portfolio/seed
// Returns portfolio positions with provider metadata.
//
// ?live=1  — enriches each position with the latest real price from its provider.
//            Uses Yahoo quote for ETFs, NAV from Morningstar/Leeway for funds.
//            Falls back to the hardcoded seed price if no live quote is available.

const portfolioSeed = require('../../portfolio-seed.json');
const portfolioProviders = require('../../portfolio-providers.json');
const { resolveAssetData } = require('../_lib/providers');

module.exports = async (req, res) => {
  const live = req.query.live === '1';

  try {
    const positions = await Promise.all(
      portfolioSeed.positions.map(async (position) => {
        const provider = portfolioProviders.assets.find(a => a.isin === position.isin) || null;

        let currentPrice = position.currentPrice;
        let priceSource = 'seed';

        if (live) {
          try {
            const resolved = await resolveAssetData(position.isin);
            const livePrice = resolved.data?.quote?.price ?? resolved.data?.quote?.close;
            if (livePrice && Number.isFinite(livePrice) && livePrice > 0) {
              currentPrice = livePrice;
              priceSource = resolved.data?.provider || 'live';
            }
          } catch (_) { /* keep seed price */ }
        }

        return { ...position, currentPrice, priceSource, provider };
      })
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      owner: portfolioSeed.owner,
      currency: portfolioSeed.currency,
      live,
      positions
    }, null, 2));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message }));
  }
};
