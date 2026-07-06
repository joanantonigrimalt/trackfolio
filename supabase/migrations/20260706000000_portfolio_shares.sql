-- Finasset — enlaces públicos para compartir cartera (solo lectura, por token)
-- El endpoint /api/portfolio/shared usa service_role para resolver el token → cartera,
-- así que NO hace falta lectura pública: la tabla queda restringida al propietario.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.portfolio_shares (
  token         TEXT PRIMARY KEY,
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  hide_amounts  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pshares_user ON public.portfolio_shares(user_id);

ALTER TABLE public.portfolio_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own shares" ON public.portfolio_shares;
CREATE POLICY "Users manage own shares"
  ON public.portfolio_shares FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
