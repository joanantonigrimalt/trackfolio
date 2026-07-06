-- Finasset — programa de referidos (códigos + registros de referidos)
-- Idempotente. Seguro re-ejecutar.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Códigos de referido: un código único por usuario ────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- SELECT abierto a autenticados: el usuario referido necesita resolver
-- code → referrer_id (lee el código de OTRA persona) al registrarse.
DROP POLICY IF EXISTS "referral_codes read" ON public.referral_codes;
CREATE POLICY "referral_codes read"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (true);

-- Cada usuario solo puede crear/actualizar su propio código.
DROP POLICY IF EXISTS "referral_codes insert own" ON public.referral_codes;
CREATE POLICY "referral_codes insert own"
  ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "referral_codes update own" ON public.referral_codes;
CREATE POLICY "referral_codes update own"
  ON public.referral_codes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Registros de referidos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referrer_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email TEXT,
  code_used      TEXT,
  subscribed     BOOLEAN NOT NULL DEFAULT false,
  subscribed_at  TIMESTAMPTZ,
  registered_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (referred_id)  -- un usuario solo puede ser referido una vez
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- El referente ve sus referidos; el referido ve su propio registro.
DROP POLICY IF EXISTS "referrals read own" ON public.referrals;
CREATE POLICY "referrals read own"
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- Solo el propio usuario referido puede crear su registro de referido.
DROP POLICY IF EXISTS "referrals insert as referred" ON public.referrals;
CREATE POLICY "referrals insert as referred"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (referred_id = auth.uid());
