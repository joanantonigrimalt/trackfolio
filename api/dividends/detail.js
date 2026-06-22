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

const { setupApi, validateIsins } = require('../../lib/security');
const portfolioSeed = require('../../portfolio-seed.json');
const { fetchDividendHistory } = require('../../lib/dividends');
const { getGbpEur, toEur } = require('../../lib/fx');
const { fetchExtraETFAnnual, validateAnnual } = require('../../lib/extraetf');

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
  if (!setupApi(req, res, { maxRequests: 20 })) return;

  const rawIsins = String(req.query?.isins || '');
  // FIX #9: support ?force=1 to bypass all caches
  const force = req.query?.force === '1';

  let isins;
  if (rawIsins) {
    const { isins: validated, error } = validateIsins(rawIsins);
    if (error) { res.statusCode = 400; return res.end(JSON.stringify({ error })); }
    isins = validated;
  } else {
    isins = portfolioSeed.positions.map(p => p.isin);
  }

  // FIX #2: get GBPEUR rate once for all conversions
  const gbpRate = await getGbpEur();

  const tasks = isins.map(isin => async () => {
    try {
      // Fetch Digrin detail + extraETF validation in parallel
      const [hist, extraETF] = await Promise.all([
        fetchDividendHistory(isin, { force }),
        fetchExtraETFAnnual(isin),
      ]);

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

      // Rebuild yearly using EUR amounts + attach extraETF validation per year
      const yearlyEur = {};
      for (const p of paymentsEur) {
        if (!yearlyEur[p.year]) yearlyEur[p.year] = { year: p.year, totalPerShare: 0, payments: [] };
        yearlyEur[p.year].totalPerShare = Math.round((yearlyEur[p.year].totalPerShare + p.amountEur) * 10000) / 10000;
        yearlyEur[p.year].payments.push({ exDate: p.exDate, amount: p.amountEur });
      }
      const yearly = Object.values(yearlyEur)
        .sort((a, b) => a.year - b.year)
        .map(y => {
          const extraTotal = extraETF.annual[String(y.year)] ?? null;
          const validation = validateAnnual(y.totalPerShare, extraTotal);
          return {
            ...y,
            totalUser: quantity > 0 ? Math.round(y.totalPerShare * quantity * 100) / 100 : null,
            extraEtfTotal: extraTotal,
            validation: validation.status,         // 'validated' | 'partially_validated' | 'inconsistent' | 'unvalidated'
            validationDiffPct: validation.diffPct, // numeric % or null
          };
        });

      // Overall validation status = worst year among last 2 COMPLETE years
      // Exclude current year — it's always partial (not all quarterly payments received yet)
      const currentYear = new Date().getFullYear();
      const recentYears = yearly.filter(y => y.year >= currentYear - 2 && y.year < currentYear);
      const overallStatus = recentYears.some(y => y.validation === 'inconsistent')
        ? 'inconsistent'
        : recentYears.some(y => y.validation === 'partially_validated')
          ? 'partially_validated'
          : recentYears.some(y => y.validation === 'validated')
            ? 'validated'
            : 'unvalidated';

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
        validationStatus: overallStatus,  // top-level flag for the UI
        validationSource: extraETF.source,
      };
    } catch (e) {
      return {
        isin,
        ticker: null,
        source: 'error',
        error: 'fetch_failed',
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
