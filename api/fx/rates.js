export const config = { runtime: 'edge' };

// Proxy para Frankfurter FX rates — evita CORS del redirect api.frankfurter.app → api.frankfurter.dev
// Cache CDN 15min (900s) para no bombardear Frankfurter
export default async (req) => {
  const CORS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const r = await fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,GBP,CHF', {
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error(`Frankfurter ${r.status}`);
    const d = await r.json();
    if (!d?.rates) throw new Error('no rates');
    return new Response(JSON.stringify({ rates: d.rates, date: d.date }), { headers: CORS });
  } catch (e) {
    // Fallback: return sensible defaults so client can still show something
    return new Response(
      JSON.stringify({ rates: { USD: 1.15, GBP: 0.87, CHF: 0.93 }, fallback: true, error: e.message }),
      { status: 200, headers: CORS }
    );
  }
};
