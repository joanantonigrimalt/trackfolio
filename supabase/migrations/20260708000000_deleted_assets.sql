-- Finasset — columna deleted_assets (tombstones) para user_positions
-- Permite que los BORRADOS de activos personalizados se propaguen entre dispositivos.
-- El merge de custom_assets es aditivo; sin tombstones un activo borrado reaparecía desde la nube.
-- Idempotente. Seguro re-ejecutar. La app tiene fallback si esta columna aún no existe.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_positions
  ADD COLUMN IF NOT EXISTS deleted_assets JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_positions.deleted_assets IS
  'Tombstones {isin: ISO-timestamp} de activos personalizados borrados. LWW frente a _uts del activo.';
