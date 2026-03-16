// Merged FMP endpoint — replaces api/fmp/quote.js + api/fmp/history.js
// GET /api/fmp?mode=quote&symbol=AAPL
// GET /api/fmp?mode=history&symbol=AAPL&years=5

const { json, fmpFetch, getDateYearsAgo } = require('../lib/fmp');

module.exports = async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').trim().toUpperCase();
    const mode   = (req.query.mode   || 'quote').trim();
    if (!symbol) return json(res, 400, { error: 'Missing symbol' });

    if (mode === 'history') {
      const years = Math.min(Math.max(Number(req.query.years || 5), 1), 10);
      const from  = getDateYearsAgo(years);
      const data  = await fmpFetch('/stable/historical-price-full', { symbol, from, serietype: 'line' });
      const history = Array.isArray(data?.historical) ? data.historical : [];
      return json(res, 200, {
        symbol, years, from,
        points: history.map(item => ({ date: item.date, close: item.close }))
                       .sort((a, b) => a.date.localeCompare(b.date))
      });
    }

    // default: quote
    const data  = await fmpFetch('/stable/quote', { symbol });
    const quote = Array.isArray(data) ? data[0] : data;
    if (!quote) return json(res, 404, { error: 'Quote not found' });
    return json(res, 200, {
      symbol,
      price:             quote.price             ?? null,
      change:            quote.change            ?? null,
      changesPercentage: quote.changesPercentage ?? null,
      name:              quote.name              ?? symbol,
      exchange:          quote.exchange          ?? null,
      raw:               quote
    });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
