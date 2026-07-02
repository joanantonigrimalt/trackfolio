-- Finasset — enable Supabase Realtime for cross-device sync
-- Adds the user tables to the supabase_realtime publication so a change on one
-- device is pushed to the user's other devices. RLS still applies: each client
-- only receives changes for rows it can SELECT (its own user_id).
-- Idempotent (ignores "already member of publication").
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_positions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_loans;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
