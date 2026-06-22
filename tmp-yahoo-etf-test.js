const { yahooChart } = require('./api/_lib/yahoo');

const tests = [
  ['IE00BYX5NK04', 'SWDA.L'],
  ['IE00B4ND3602', 'IGLN.L'],
  ['IE000QAZP7L2', 'EIMI.L'],
  ['IE00B579F325', 'SGLD.L'],
  ['IE00B9CQXS71', 'GBDV.L'],
  ['NL0011683594', 'TDIV.AS'],
  ['DE000A0F5UH1', 'EXW1.DE']
];

(async () => {
  const out = [];
  for (const [isin, symbol] of tests) {
    try {
      const data = await yahooChart(symbol, '5y', '1d');
      out.push({ isin, symbol, ok: true, price: data.price, points: data.points.length });
    } catch (error) {
      out.push({ isin, symbol, ok: false, error: error.message });
    }
  }
  console.log(JSON.stringify(out, null, 2));
})();
