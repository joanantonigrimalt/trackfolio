# Finasset

VersiÃ³n personalizada de Folio para Grigom.

## Objetivo

- Branding nuevo: Finasset
- Datos de mercado vÃ­a Financial Modeling Prep (FMP)
- CachÃ© de hasta 5 aÃ±os para los activos que se tengan o se agreguen
- Frontend estÃ¡tico + funciones serverless de Vercel

## Variables de entorno

Crea un `.env.local` a partir de `.env.example`.

- `FMP_API_KEY`: API key de Financial Modeling Prep
- `SUPABASE_URL`: URL del proyecto Supabase
- `SUPABASE_ANON_KEY`: clave anon de Supabase
- `FINASSET_CACHE_ENABLED`: `true` o `false`

## Desarrollo

```bash
vercel dev
```

## Endpoints

- `GET /api/fmp/quote?symbol=AAPL`
- `GET /api/fmp/history?symbol=AAPL&years=5`

## Nota de seguridad

La key de FMP no se expone en frontend; se usa solo desde las funciones serverless.

