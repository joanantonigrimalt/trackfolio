const API_KEYS = [
  process.env.EODHD_API_KEY_4,
  process.env.EODHD_API_KEY_3,
  process.env.EODHD_API_KEY_2,
  process.env.EODHD_API_KEY
].filter(Boolean);

function isRetryableEodhdError(status, bodyText = '') {
  return status === 401 || status === 402 || status === 403 || status === 429 || /limit|quota|unauthorized|forbidden/i.test(bodyText);
}

async function eodhdFetch(path, params = {}) {
  if (!API_KEYS.length) throw new Error('Missing EODHD_API_KEY');

  let lastError = null;
  for (const key of API_KEYS) {
    const url = new URL(`https://eodhd.com${path}`);
    Object.entries({ ...params, api_token: key, fmt: 'json' }).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });

    const response = await fetch(url);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (response.ok) {
      return { data, keyUsed: key.slice(0, 6) + '…' };
    }

    lastError = new Error(`EODHD ${response.status}: ${String(text).slice(0, 200)}`);
    if (!isRetryableEodhdError(response.status, text)) {
      throw lastError;
    }
  }

  throw lastError || new Error('EODHD request failed');
}

async function getQuote(symbol) {
  return eodhdFetch(`/api/real-time/${encodeURIComponent(symbol)}`);
}

async function getHistory(symbol, from = '2021-03-15') {
  return eodhdFetch(`/api/eod/${encodeURIComponent(symbol)}`, {
    from,
    period: 'd'
  });
}

async function search(query, limit = 5) {
  return eodhdFetch(`/api/search/${encodeURIComponent(query)}`, { limit });
}

module.exports = { getQuote, getHistory, search };
