-- Finasset — initial schema
-- Applied automatically via: supabase db push

-- ─────────────────────────────────────────────────────────────────
-- Price history (L2 cache for historical closes)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_history (
  id         BIGSERIAL PRIMARY KEY,
  isin       TEXT NOT NULL,
  date       DATE NOT NULL,
  close      DOUBLE PRECISION NOT NULL,
  provider   TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(isin, date)
);
CREATE INDEX IF NOT EXISTS idx_ph_isin      ON public.price_history(isin);
CREATE INDEX IF NOT EXISTS idx_ph_isin_date ON public.price_history(isin, date DESC);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read price_history"  ON public.price_history;
DROP POLICY IF EXISTS "Anon write price_history"   ON public.price_history;
DROP POLICY IF EXISTS "Anon upsert price_history"  ON public.price_history;
CREATE POLICY "Public read price_history"  ON public.price_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anon write price_history"   ON public.price_history FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon upsert price_history"  ON public.price_history FOR UPDATE TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────
-- Asset metadata
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assets_metadata (
  isin                 TEXT PRIMARY KEY,
  name                 TEXT,
  tipo                 TEXT,
  recommended_provider TEXT,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assets_metadata ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read assets_metadata" ON public.assets_metadata;
DROP POLICY IF EXISTS "Anon write assets_metadata"  ON public.assets_metadata;
CREATE POLICY "Public read assets_metadata" ON public.assets_metadata FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anon write assets_metadata"  ON public.assets_metadata FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────
-- Dividend payments
-- ─────────────────────────────────────────────────────────────────
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
DROP POLICY IF EXISTS "Public read dividend_payments" ON public.dividend_payments;
DROP POLICY IF EXISTS "Anon write dividend_payments"  ON public.dividend_payments;
DROP POLICY IF EXISTS "Anon upsert dividend_payments" ON public.dividend_payments;
CREATE POLICY "Public read dividend_payments" ON public.dividend_payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anon write dividend_payments"  ON public.dividend_payments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon upsert dividend_payments" ON public.dividend_payments FOR UPDATE TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────
-- ETF profiles (from extraETF)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.etf_profiles (
  isin       TEXT PRIMARY KEY,
  overview   JSONB,
  holdings   JSONB,
  source     TEXT DEFAULT 'extraetf',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.etf_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read etf_profiles" ON public.etf_profiles;
DROP POLICY IF EXISTS "Anon write etf_profiles"  ON public.etf_profiles;
CREATE POLICY "Public read etf_profiles" ON public.etf_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anon write etf_profiles"  ON public.etf_profiles FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────
-- Insider transactions cache
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.insider_cache (
  symbol     TEXT PRIMARY KEY,
  data       JSONB NOT NULL DEFAULT '[]',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.insider_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read insider_cache" ON public.insider_cache;
DROP POLICY IF EXISTS "Anon write insider_cache"  ON public.insider_cache;
CREATE POLICY "Public read insider_cache" ON public.insider_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anon write insider_cache"  ON public.insider_cache FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────
-- User positions (synced from localStorage)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_positions (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  overrides     JSONB NOT NULL DEFAULT '{}',
  custom_assets JSONB NOT NULL DEFAULT '{}',
  liquidity     JSONB NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own positions"   ON public.user_positions;
DROP POLICY IF EXISTS "Users insert own positions" ON public.user_positions;
DROP POLICY IF EXISTS "Users update own positions" ON public.user_positions;
CREATE POLICY "Users read own positions"   ON public.user_positions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own positions" ON public.user_positions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own positions" ON public.user_positions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- Community posts
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   TEXT,
  content        TEXT NOT NULL,
  image_url      TEXT,
  likes_count    INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cp_user_id   ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_cp_created   ON public.community_posts(created_at DESC);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read community_posts"  ON public.community_posts;
DROP POLICY IF EXISTS "Auth insert community_posts"  ON public.community_posts;
DROP POLICY IF EXISTS "Auth update community_posts"  ON public.community_posts;
DROP POLICY IF EXISTS "Auth delete community_posts"  ON public.community_posts;
CREATE POLICY "Public read community_posts"  ON public.community_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth insert community_posts"  ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth update community_posts"  ON public.community_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Auth delete community_posts"  ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- Community likes
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth manage own likes" ON public.community_likes;
CREATE POLICY "Auth manage own likes" ON public.community_likes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Read likes for like-count display
DROP POLICY IF EXISTS "Public read likes" ON public.community_likes;
CREATE POLICY "Public read likes" ON public.community_likes FOR SELECT TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────
-- Community comments
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cc_post_id ON public.community_comments(post_id);

ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read community_comments"  ON public.community_comments;
DROP POLICY IF EXISTS "Auth insert community_comments"  ON public.community_comments;
DROP POLICY IF EXISTS "Auth delete community_comments"  ON public.community_comments;
CREATE POLICY "Public read community_comments"  ON public.community_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth insert community_comments"  ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth delete community_comments"  ON public.community_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- Helper RPC: increment comment count atomically
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_comments_count(post_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.community_posts
  SET comments_count = comments_count + 1
  WHERE id = post_id;
$$;
