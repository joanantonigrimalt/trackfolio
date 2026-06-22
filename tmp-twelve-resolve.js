const { resolveAssetData } = require('./api/_lib/providers');
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
const isins = ['IE00BYX5NK04','IE00B4ND3602','IE000QAZP7L2'];
(async()=>{
  const out=[];
  for (const isin of isins) {
    const r = await resolveAssetData(isin);
    out.push({
      isin,
      symbol: r.data?.symbol,
      quote: r.data?.coverage?.quote,
      history: r.data?.coverage?.history,
      note: r.data?.coverage?.note,
      histLen: r.data?.history?.length || 0
    });
    await sleep(9000);
  }
  console.log(JSON.stringify(out, null, 2));
})();
