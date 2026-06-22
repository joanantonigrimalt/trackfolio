const key = process.env.TWELVEDATA_API_KEY;
const queries = [
  'iShares Core MSCI World UCITS ETF',
  'iShares Physical Gold ETC',
  'iShares Core MSCI EM IMI UCITS ETF',
  'Invesco Physical Gold ETC',
  'SPDR S&P Global Dividend Aristocrats UCITS ETF',
  'VanEck Morningstar Developed Markets Dividend Leaders UCITS ETF'
];

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

(async()=>{
  const out = [];
  for (const q of queries) {
    const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&apikey=${key}`;
    const r = await fetch(url);
    const j = await r.json();
    out.push({ query: q, status: r.status, data: Array.isArray(j.data) ? j.data.slice(0,5) : j, meta: j.meta || null });
    await sleep(9000);
  }
  console.log(JSON.stringify(out, null, 2));
})();
