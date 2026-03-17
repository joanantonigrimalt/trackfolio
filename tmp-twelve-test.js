const key = process.env.TWELVEDATA_API_KEY;
const urls = [
  `https://api.twelvedata.com/price?symbol=AAPL&apikey=${key}`,
  `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${key}`,
  `https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&outputsize=5&apikey=${key}`
];
(async()=>{
  for (const url of urls) {
    const r = await fetch(url);
    const j = await r.json();
    console.log(JSON.stringify({ url, status: r.status, keys: Object.keys(j).slice(0,8), data: j }, null, 2));
  }
})();
