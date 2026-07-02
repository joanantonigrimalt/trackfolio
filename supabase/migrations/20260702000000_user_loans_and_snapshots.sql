-- Finasset — user_loans + portfolio_snapshots
-- These tables are written/read by desktop.html & mobile.html (loan sync, value snapshots)
-- and by api/admin/delete-user.js, but were never part of a committed migration.
-- Idempotent: safe to run even if they were already created manually in the dashboard.
-- ─────────────────────────────────────────────────────────────────────────────

-- Loans / credits synced from localStorage['fa_loans']
CREATE TABLE IF NOT EXISTS public.user_loans (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own loans"   ON public.user_loans;
DROP POLICY IF EXISTS "Users insert own loans" ON public.user_loans;
DROP POLICY IF EXISTS "Users update own loans" ON public.user_loans;

CREATE POLICY "Users read own loans"
  ON public.user_loans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own loans"
  ON public.user_loans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own loans"
  ON public.user_loans FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Portfolio value snapshots synced from localStorage['fa_value_snapshots']
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own snapshots"   ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Users insert own snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Users update own snapshots" ON public.portfolio_snapshots;

CREATE POLICY "Users read own snapshots"
  ON public.portfolio_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own snapshots"
  ON public.portfolio_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own snapshots"
  ON public.portfolio_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id);
