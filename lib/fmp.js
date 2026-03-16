function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function getApiKey() {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new Error('Missing FMP_API_KEY');
  }
  return key;
}

async function fmpFetch(path, params = {}) {
  const apiKey = getApiKey();
  const url = new URL(`https://financialmodelingprep.com${path}`);
  Object.entries({ ...params, apikey: apiKey }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FMP ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

function getDateYearsAgo(years = 5) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

module.exports = { json, fmpFetch, getDateYearsAgo };
