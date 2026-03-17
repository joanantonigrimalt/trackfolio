const { setupApi } = require('../../lib/security');
const portfolioSeed = require('../../portfolio-seed.json');
const portfolioProviders = require('../../portfolio-providers.json');

const dividendCandidates = {
  IE00BZ4BMM98: { label: 'Invesco High Dividend Low Volatility UCITS ETF', status: 'pending_source', note: 'ETF de dividendos; falta conectar proveedor real para yield e histórico de pagos.' },
  IE00B9CQXS71: { label: 'SPDR S&P Global Dividend Aristocrats UCITS ETF', status: 'pending_source', note: 'ETF de dividendos; ticker mapeado GBDV.L, falta fuente de dividendos real.' },
  NL0011683594: { label: 'VanEck Morningstar Developed Markets Dividend Leaders UCITS ETF', status: 'pending_source', note: 'ETF de dividendos; ticker mapeado TDIV.AS, falta fuente real de dividendos.' },
  DE000A0F5UH1: { label: 'iShares Core EURO STOXX 50 UCITS ETF (DE)', status: 'pending_source', note: 'Puede repartir según clase/listing; falta validar política exacta y proveedor de pagos.' }
};

module.exports = async (req, res) => {
  if (!setupApi(req, res, { maxRequests: 30 })) return;
  const positions = portfolioSeed.positions
    .filter((position) => dividendCandidates[position.isin])
    .map((position) => ({
      isin: position.isin,
      quantity: position.quantity,
      candidate: dividendCandidates[position.isin],
      provider: portfolioProviders.assets.find((asset) => asset.isin === position.isin) || null
    }));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    status: 'pending_real_provider',
    message: 'Dividend section is live, but payout data will remain empty until a verified dividend source is connected.',
    positions
  }, null, 2));
};
