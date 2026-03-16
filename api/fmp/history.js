const { json, fmpFetch, getDateYearsAgo } = require('../_lib/fmp');

module.exports = async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').trim().toUpperCase();
    const years = Math.min(Math.max(Number(req.query.years || 5), 1), 10);
    if (!symbol) return json(res, 400, { error: 'Missing symbol' });

    const from = getDateYearsAgo(years);
    const data = await fmpFetch(`/stable/historical-price-full`, {
      symbol,
      from,
      serietype: 'line'
    });

    const history = Array.isArray(data?.historical) ? data.historical : [];
    return json(res, 200, {
      symbol,
      years,
      from,
      points: history.map((item) => ({
        date: item.date,
        close: item.close
      })).sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
