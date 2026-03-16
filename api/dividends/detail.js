// GET /api/dividends/detail?isins=DE000A0F5UH1,NL0011683594[&force=1]
//
// Returns full historical dividend payment breakdown from Digrin / StockAnalysis.
// ?force=1  bypasses all caches and re-scrapes from source.
//
// Response per ISIN:
//   { isin, ticker, source, currency, fetchedAt, isDelisted,
//     name, quantity,
//     payments: [{ exDate, amountEur, currency, year }],
//     yearly:   [{ year, totalPerShare, totalUser, payments }] }

const portfolioSeed = require('../../portfolio-seed.json');
const { fetchDividendHistory } = require('../_lib/dividends');
const { getGbpEur, toEur } = require('../_lib/fx');

// FIX #11: throttle parallel scrapes to avoid hammering Digrin
async function runThrottled(tasks, concurrency = 2) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
  }
  return results;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rawIsins = String(req.query?.isins || '');
  // FIX #9: support ?force=1 to bypass all caches
  const force = req.query?.force === '1';

  const isins = rawIsins
    ? rawIsins.split(',').map(s => s.trim()).filter(Boolean)
    : portfolioSeed.positions.map(p => p.isin);

  // FIX #2: get GBPEUR rate once for all conversions
  const gbpRate = await getGbpEur();

  const tasks = isins.map(isin => async () => {
    try {
      const hist = await fetchDividendHistory(isin, { force });
      const seed = portfolioSeed.positions.find(p => p.isin === isin);
      const quantity = seed?.quantity ?? 0;
      const name = seed?.name ?? hist.ticker ?? isin;

      // FIX #2: convert all payment amounts to EUR for display
      const paymentsEur = await Promise.all(
        hist.payments.map(async p => ({
          ...p,
          amountEur: await toEur(p.amount, p.currency, gbpRate),
        }))
      );

      // Rebuild yearly using EUR amounts
      const yearlyEur = {};
      for (const p of paymentsEur) {
        if (!yearlyEur[p.year]) yearlyEur[p.year] = { year: p.year, totalPerShare: 0, payments: [] };
        yearlyEur[p.year].totalPerShare = Math.round((yearlyEur[p.year].totalPerShare + p.amountEur) * 10000) / 10000;
        yearlyEur[p.year].payments.push({ exDate: p.exDate, amount: p.amountEur });
      }
      const yearly = Object.values(yearlyEur)
        .sort((a, b) => a.year - b.year)
        .map(y => ({
          ...y,
          totalUser: quantity > 0 ? Math.round(y.totalPerShare * quantity * 100) / 100 : null,
        }));

      return {
        isin,
        ticker: hist.ticker,
        source: hist.source,
        currency: 'EUR', // always EUR after conversion
        fetchedAt: hist.fetchedAt,
        isDelisted: hist.isDelisted,
        name,
        quantity,
        payments: paymentsEur,
        yearly,
      };
    } catch (e) {
      return {
        isin,
        ticker: null,
        source: 'error',
        error: e.message,
        currency: 'EUR',
        fetchedAt: new Date().toISOString(),
        isDelisted: false,
        name: isin,
        quantity: 0,
        payments: [],
        yearly: [],
      };
    }
  });

  // FIX #11: run in batches of 2 to avoid simultaneous rate-limit from Digrin
  const results = await runThrottled(tasks, 2);

  res.statusCode = 200;
  res.end(JSON.stringify({ results }, null, 2));
};
