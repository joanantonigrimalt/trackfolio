-- Finasset — cerrar la ESCRITURA anónima en las tablas de caché
-- Antes: cualquiera con la anon key podía INSERT/UPDATE price_history, dividend_payments,
-- etf_profiles, assets_metadata e insider_cache → envenenamiento de caché para TODOS los usuarios.
-- Ahora: la lectura sigue siendo pública; la escritura queda reservada a service_role.
--
-- ⚠ ORDEN DE DESPLIEGUE IMPORTANTE:
--   1) Define la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Vercel (proyecto "trackfolio").
--   2) Despliega el código (lib/cache.js, lib/dividends.js, lib/extraetf.js ya usan la
--      service-role key para escribir, con fallback a anon si no está definida).
--   3) Aplica ESTA migración.
-- Si aplicas esta migración sin la service-role key, el servidor dejará de poblar la caché
-- (los proveedores seguirán respondiendo en vivo, pero sin persistencia). No hay pérdida de datos.
-- Idempotente. Seguro re-ejecutar.
-- ─────────────────────────────────────────────────────────────────────────────

-- price_history
DROP POLICY IF EXISTS "Anon write price_history"  ON public.price_history;
DROP POLICY IF EXISTS "Anon upsert price_history" ON public.price_history;
DROP POLICY IF EXISTS "Service write price_history" ON public.price_history;
CREATE POLICY "Service write price_history" ON public.price_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- dividend_payments
DROP POLICY IF EXISTS "Anon write dividend_payments"  ON public.dividend_payments;
DROP POLICY IF EXISTS "Anon upsert dividend_payments" ON public.dividend_payments;
DROP POLICY IF EXISTS "Service write dividend_payments" ON public.dividend_payments;
CREATE POLICY "Service write dividend_payments" ON public.dividend_payments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- etf_profiles
DROP POLICY IF EXISTS "Anon write etf_profiles" ON public.etf_profiles;
DROP POLICY IF EXISTS "Service write etf_profiles" ON public.etf_profiles;
CREATE POLICY "Service write etf_profiles" ON public.etf_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- assets_metadata
DROP POLICY IF EXISTS "Anon write assets_metadata" ON public.assets_metadata;
DROP POLICY IF EXISTS "Service write assets_metadata" ON public.assets_metadata;
CREATE POLICY "Service write assets_metadata" ON public.assets_metadata FOR ALL TO service_role USING (true) WITH CHECK (true);

-- insider_cache
DROP POLICY IF EXISTS "Anon write insider_cache" ON public.insider_cache;
DROP POLICY IF EXISTS "Service write insider_cache" ON public.insider_cache;
CREATE POLICY "Service write insider_cache" ON public.insider_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- NOTA: service_role ignora RLS por defecto en Supabase, pero dejamos las políticas explícitas
-- por claridad y por si se usa un rol con RLS forzado.
