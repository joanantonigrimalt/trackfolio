const key = process.env.ALPHAVANTAGE_API_KEY;
const symbols = ['SWDA.LON', 'EIMI.LON', 'SGLD.LON', 'TDIV.AMS'];

(async () => {
  for (const s of symbols) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(s)}&outputsize=full&apikey=${key}`;
    const r = await fetch(url);
    const j = await r.json();
    const series = j['Time Series (Daily)'];
    console.log(JSON.stringify({
      symbol: s,
      ok: !!series,
      keys: Object.keys(j).slice(0, 4),
      points: series ? Object.keys(series).length : 0,
      note: j['Note'] || j['Information'] || j['Error Message'] || null
    }, null, 2));
  }
})();
