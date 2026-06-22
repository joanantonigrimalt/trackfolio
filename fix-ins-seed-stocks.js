/**
 * fix-ins-seed-stocks.js
 * Reduces _INS_POPULAR from 8 stocks to 3 to avoid SEC rate limiting on parallel seed calls.
 */
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldStr = "const _INS_POPULAR = ['AAPL','MSFT','NVDA','JPM','META','TSLA','V','WMT'];";
const newStr = "const _INS_POPULAR = ['AAPL','MSFT','JPM'];";

if (!html.includes(oldStr)) {
  console.error('NOT FOUND — trying alternate search...');
  // Try finding any _INS_POPULAR line
  const idx = html.indexOf('_INS_POPULAR');
  if (idx === -1) { console.error('_INS_POPULAR not found at all'); process.exit(1); }
  console.log('Context:', JSON.stringify(html.slice(idx - 10, idx + 80)));
  process.exit(1);
}

html = html.replace(oldStr, newStr);
fs.writeFileSync('index.html', html);
console.log('OK: _INS_POPULAR reduced to 3 stocks.');
