const key = process.env.TWELVEDATA_API_KEY;
const tests = [
  { label: 'MSCI World UCITS', symbol: 'IWDA.AS' },
  { label: 'iShares Physical Gold', symbol: 'IGLN.L' },
  { label: 'EM IMI UCITS', symbol: 'EMIM.L' },
  { label: 'Invesco Gold ETC', symbol: 'SGLD.L' },
  { label: 'Global Dividend Aristocrats', symbol: 'GBDV.L' },
  { label: 'VanEck Dividend Leaders', symbol: 'TDIV.MI' },
  { label: 'Horos Value Internacional ISIN', symbol: 'ES0146309002' },
  { label: 'Cobas International ISIN', symbol: 'LU1598719752' }
];

async function get(url) {
  const r = await fetch(url);
  const j = await r.json();
  return { status: r.status, data: j };
}

(async()=>{
  const out = [];
  for (const test of tests) {
    const quote = await get(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(test.symbol)}&apikey=${key}`);
    const series = await get(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(test.symbol)}&interval=1day&outputsize=30&apikey=${key}`);
    out.push({
      label: test.label,
      symbol: test.symbol,
      quoteStatus: quote.status,
      quoteOk: !quote.data.code && !!quote.data.close,
      quoteKeys: Object.keys(quote.data).slice(0,8),
      seriesStatus: series.status,
      seriesOk: series.data.status === 'ok' && Array.isArray(series.data.values) && series.data.values.length > 10,
      seriesPoints: Array.isArray(series.data.values) ? series.data.values.length : 0,
      note: quote.data.message || quote.data.code || series.data.message || series.data.code || null
    });
  }
  console.log(JSON.stringify(out, null, 2));
})();
