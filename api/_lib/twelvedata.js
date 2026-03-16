const API_KEYS = [
  process.env.TWELVEDATA_API_KEY,
  process.env.TWELVEDATA_API_KEY_2,
  process.env.TWELVEDATA_API_KEY_3,
  process.env.TWELVEDATA_API_KEY_4
].filter(Boolean);

function isRetryableTwelveError(data = {}, status = 0) {
  const msg = `${data.message || ''} ${data.code || ''} ${data.status || ''}`;
  return status === 429 || /credits|limit|api credits|rate limit/i.test(msg);
}

async function twelveFetch(path, params = {}) {
  if (!API_KEYS.length) throw new Error('Missing TWELVEDATA_API_KEY');

  let lastError = null;
  for (const key of API_KEYS) {
    const url = new URL(`https://api.twelvedata.com${path}`);
    Object.entries({ ...params, apikey: key }).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok && !data.code && data.status !== 'error') {
      return { status: response.status, data, keyUsed: key.slice(0, 6) + '…' };
    }

    lastError = new Error(`TwelveData ${response.status}: ${data.message || data.code || 'Unknown error'}`);
    if (!isRetryableTwelveError(data, response.status)) {
      throw lastError;
    }
  }

  throw lastError || new Error('Twelve Data request failed');
}

async function getQuote(symbol) {
  return twelveFetch('/quote', { symbol });
}

async function getTimeSeries(symbol, outputsize = 500) {
  return twelveFetch('/time_series', { symbol, interval: '1day', outputsize });
}

async function searchSymbol(symbol) {
  return twelveFetch('/symbol_search', { symbol });
}

module.exports = { getQuote, getTimeSeries, searchSymbol };
