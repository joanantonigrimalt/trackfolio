-- Finasset — privacidad de referral_codes
-- Antes: SELECT abierto a cualquier autenticado → enumeración de (user_id, code) de todos.
-- Ahora: cada usuario solo lee SU propia fila; la resolución code → referrer_id al canjear
--        un código se hace vía una función SECURITY DEFINER que NO expone la tabla completa.
-- Idempotente. Seguro re-ejecutar.
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT restringido a la propia fila.
DROP POLICY IF EXISTS "referral_codes read" ON public.referral_codes;
DROP POLICY IF EXISTS "referral_codes read own" ON public.referral_codes;
CREATE POLICY "referral_codes read own"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Resolución segura de un código concreto → user_id del referente.
-- SECURITY DEFINER: se ejecuta con permisos del propietario, saltando RLS, pero SOLO
-- devuelve el user_id de la fila cuyo código coincide EXACTAMENTE (sin listar nada más).
CREATE OR REPLACE FUNCTION public.resolve_referral_code(p_code TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.referral_codes WHERE code = p_code LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_referral_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_referral_code(TEXT) TO authenticated;
