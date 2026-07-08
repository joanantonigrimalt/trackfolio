export const config = { runtime: 'edge' };

// Proxy para Frankfurter FX rates — evita CORS del redirect api.frankfurter.app → api.frankfurter.dev
// Cache CDN 15min (900s) para no bombardear Frankfurter
export default async (req) => {
  const CORS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
    'Access-Control-Allow-Origin': '*',
  };

  // Fallback compartido con el cliente (mismos valores en desktop.html/mobile.html)
  // para que un fallo de red no produzca conversiones distintas según la plataforma.
  const FALLBACK = { USD: 1.08, GBP: 0.85, CHF: 0.94, JPY: 168, CAD: 1.47, AUD: 1.63, SEK: 11.3, NOK: 11.5, DKK: 7.46, PLN: 4.3, CNY: 7.8, HKD: 8.5, SGD: 1.46, NZD: 1.78, MXN: 19.8, BRL: 5.9, ZAR: 19.6, TRY: 38, INR: 92, KRW: 1470, CZK: 25.2, HUF: 395, RON: 4.97, ILS: 4.0 };

  try {
    // Sin `to=` → Frankfurter devuelve TODAS las divisas (evita tratar divisas no soportadas como EUR).
    const r = await fetch('https://api.frankfurter.dev/v1/latest?from=EUR', {
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error(`Frankfurter ${r.status}`);
    const d = await r.json();
    if (!d?.rates) throw new Error('no rates');
    return new Response(JSON.stringify({ rates: d.rates, date: d.date }), { headers: CORS });
  } catch (e) {
    // Fallback: return sensible defaults so client can still show something
    return new Response(
      JSON.stringify({ rates: FALLBACK, fallback: true, error: e.message }),
      { status: 200, headers: CORS }
    );
  }
};
