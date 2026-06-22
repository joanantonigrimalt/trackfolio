const urls = [
  'https://www.justetf.com/en/etf-profile.html?isin=NL0011683594',
  'https://www.justetf.com/en/etf-profile.html?isin=IE00BYX5NK04',
  'https://www.justetf.com/en/etf-profile.html?isin=IE00B4ND3602',
  'https://www.justetf.com/en/etf-profile.html?isin=IE000QAZP7L2',
  'https://www.justetf.com/en/etf-profile.html?isin=IE00B579F325',
  'https://www.justetf.com/en/etf-profile.html?isin=IE00B9CQXS71',
  'https://www.justetf.com/en/etf-profile.html?isin=IE00BZ4BMM98'
];

(async () => {
  for (const url of urls) {
    console.log('URL=' + url);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await r.text();
      const title = (html.match(/<title>(.*?)<\/title>/i) || [])[1];
      const divs = (html.match(/The dividends in the ETF are ([^<\.]+)/i) || [])[1];
      const repl = (html.match(/The ETF replicates the performance of the underlying index by ([^<\.]+)/i) || [])[1];
      const launched = (html.match(/The ETF was launched on ([^<\.]+)/i) || [])[1];
      console.log('TITLE=' + (title || ''));
      console.log('DIVIDENDS=' + (divs || ''));
      console.log('REPLICATION=' + (repl || ''));
      console.log('LAUNCHED=' + (launched || ''));
    } catch (e) {
      console.log('ERROR=' + e.message);
    }
    console.log('---');
  }
})();
