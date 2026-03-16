const { json, fmpFetch } = require('../../lib/fmp');

module.exports = async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').trim().toUpperCase();
    if (!symbol) return json(res, 400, { error: 'Missing symbol' });

    const data = await fmpFetch('/stable/quote', { symbol });
    const quote = Array.isArray(data) ? data[0] : data;
    if (!quote) return json(res, 404, { error: 'Quote not found' });

    return json(res, 200, {
      symbol,
      price: quote.price ?? null,
      change: quote.change ?? null,
      changesPercentage: quote.changesPercentage ?? null,
      name: quote.name ?? symbol,
      exchange: quote.exchange ?? null,
      raw: quote
    });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
