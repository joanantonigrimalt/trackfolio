-- Finasset - Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Price history table: one row per (ISIN, date)
CREATE TABLE IF NOT EXISTS public.price_history (
  id          BIGSERIAL PRIMARY KEY,
  isin        TEXT NOT NULL,
  date        DATE NOT NULL,
  close       DOUBLE PRECISION NOT NULL,
  provider    TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(isin, date)
);

CREATE INDEX IF NOT EXISTS idx_ph_isin      ON public.price_history(isin);
CREATE INDEX IF NOT EXISTS idx_ph_isin_date ON public.price_history(isin, date DESC);

-- Asset metadata table
CREATE TABLE IF NOT EXISTS public.assets_metadata (
  isin                 TEXT PRIMARY KEY,
  name                 TEXT,
  tipo                 TEXT,
  recommended_provider TEXT,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (allow anon read + write for single-user portfolio app)
-- For multi-user: restrict INSERT/UPDATE to authenticated or service_role

ALTER TABLE public.price_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_metadata  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read price_history"   ON public.price_history;
DROP POLICY IF EXISTS "Anon write price_history"    ON public.price_history;
DROP POLICY IF EXISTS "Public read assets_metadata" ON public.assets_metadata;
DROP POLICY IF EXISTS "Anon write assets_metadata"  ON public.assets_metadata;

CREATE POLICY "Public read price_history"
  ON public.price_history FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anon write price_history"
  ON public.price_history FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anon upsert price_history"
  ON public.price_history FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Public read assets_metadata"
  ON public.assets_metadata FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anon write assets_metadata"
  ON public.assets_metadata FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dividend payments table: one row per (ISIN, ex-dividend date)
-- Populated by api/_lib/dividends.js (Digrin / StockAnalysis scraper)

CREATE TABLE IF NOT EXISTS public.dividend_payments (
  id         BIGSERIAL PRIMARY KEY,
  isin       TEXT NOT NULL,
  ex_date    DATE NOT NULL,
  amount     DOUBLE PRECISION NOT NULL,
  currency   TEXT DEFAULT 'EUR',
  source     TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(isin, ex_date)
);

CREATE INDEX IF NOT EXISTS idx_dp_isin      ON public.dividend_payments(isin);
CREATE INDEX IF NOT EXISTS idx_dp_isin_date ON public.dividend_payments(isin, ex_date DESC);

ALTER TABLE public.dividend_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read dividend_payments"  ON public.dividend_payments;
DROP POLICY IF EXISTS "Anon write dividend_payments"   ON public.dividend_payments;
DROP POLICY IF EXISTS "Anon upsert dividend_payments"  ON public.dividend_payments;

CREATE POLICY "Public read dividend_payments"
  ON public.dividend_payments FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anon write dividend_payments"
  ON public.dividend_payments FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anon upsert dividend_payments"
  ON public.dividend_payments FOR UPDATE TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- ETF profiles table: normalized overview + top holdings from extraETF
-- Populated by api/_lib/extraetf.js  |  Staleness: 7 days

CREATE TABLE IF NOT EXISTS public.etf_profiles (
  isin        TEXT PRIMARY KEY,
  overview    JSONB,
  holdings    JSONB,
  source      TEXT DEFAULT 'extraetf',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.etf_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read etf_profiles"  ON public.etf_profiles;
DROP POLICY IF EXISTS "Anon write etf_profiles"   ON public.etf_profiles;

CREATE POLICY "Public read etf_profiles"
  ON public.etf_profiles FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anon write etf_profiles"
  ON public.etf_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Insider transactions cache: one row per ticker symbol
-- Populated by api/insiders.js after fetching from SEC EDGAR.
-- Survives Vercel cold starts; 6-hour freshness window.

CREATE TABLE IF NOT EXISTS public.insider_cache (
  symbol      TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '[]',
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.insider_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read insider_cache"  ON public.insider_cache;
DROP POLICY IF EXISTS "Anon write insider_cache"   ON public.insider_cache;

CREATE POLICY "Public read insider_cache"
  ON public.insider_cache FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anon write insider_cache"
  ON public.insider_cache FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Useful queries after data is populated

-- Coverage summary
SELECT isin, COUNT(*) AS puntos, MIN(date) AS desde, MAX(date) AS hasta
FROM public.price_history
GROUP BY isin ORDER BY puntos DESC;

-- Check freshness (assets with stale data)
SELECT isin, MAX(date) AS ultimo, NOW()::date - MAX(date) AS dias_sin_update
FROM public.price_history
GROUP BY isin
HAVING NOW()::date - MAX(date) > 1
ORDER BY dias_sin_update DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- User positions table: syncs localStorage positions to Supabase
CREATE TABLE IF NOT EXISTS public.user_positions (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  overrides    JSONB NOT NULL DEFAULT '{}',
  custom_assets JSONB NOT NULL DEFAULT '{}',
  liquidity    JSONB NOT NULL DEFAULT '[]',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Add liquidity column if table already exists (migration)
ALTER TABLE public.user_positions ADD COLUMN IF NOT EXISTS liquidity JSONB NOT NULL DEFAULT '[]';

ALTER TABLE public.user_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own positions"   ON public.user_positions;
DROP POLICY IF EXISTS "Users insert own positions" ON public.user_positions;
DROP POLICY IF EXISTS "Users update own positions" ON public.user_positions;

CREATE POLICY "Users read own positions"
  ON public.user_positions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own positions"
  ON public.user_positions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own positions"
  ON public.user_positions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
