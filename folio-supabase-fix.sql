-- ══════════════════════════════════════════════════════════════
-- FOLIO — SQL ADICIONAL (ejecuta esto después del primero)
-- Supabase Dashboard → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════

-- 1. Permitir acceso anónimo a price_history y assets_metadata
-- (ya incluido en el schema, pero por si acaso)
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read price history" ON public.price_history;
DROP POLICY IF EXISTS "Service role can write price history" ON public.price_history;
DROP POLICY IF EXISTS "Anyone can read metadata" ON public.assets_metadata;

CREATE POLICY "Public read price_history" ON public.price_history
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anon insert price_history" ON public.price_history
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anon update price_history" ON public.price_history
  FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Public read metadata" ON public.assets_metadata
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anon update metadata" ON public.assets_metadata
  FOR UPDATE TO anon, authenticated USING (true);

-- 2. Permitir insertar transacciones sin autenticación (demo mode)
-- SOLO para desarrollo. En producción elimina la política anon.
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
CREATE POLICY "Auth users manage transactions" ON public.transactions
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 3. Verificar que las tablas existen y tienen datos
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 4. Ver los 17 activos insertados
SELECT isin, name, tipo FROM public.assets_metadata ORDER BY name;

-- 5. Ver precio histórico cacheado (se llena automáticamente desde la app)
SELECT isin, COUNT(*) as registros, MIN(date) as desde, MAX(date) as hasta
FROM public.price_history
GROUP BY isin
ORDER BY registros DESC;

-- 6. Vista rápida de portfolio (ejecutar después de tener datos)
-- SELECT * FROM portfolio_summary WHERE user_id = auth.uid();

-- ══════════════════════════════════════════════════════════════
-- PARA VERCEL — instrucciones paso a paso
-- ══════════════════════════════════════════════════════════════
-- 1. Descarga folio-app-v2.html de Claude
-- 2. Crea una carpeta llamada "folio" en tu ordenador
-- 3. Mueve el archivo HTML a esa carpeta y renómbralo "index.html"
-- 4. Ve a https://vercel.com → New Project → "Import Third-Party Git"
--    O más fácil: instala Vercel CLI y ejecuta:
--
--    npm install -g vercel
--    cd folio
--    vercel
--
-- 5. Vercel te dará un dominio tipo: folio-xxxx.vercel.app
-- 6. Listo — tu app está en línea con HTTPS
--
-- ALTERNATIVA más fácil sin CLI:
-- 1. Ve a https://vercel.com/new
-- 2. Elige "Continue with GitHub"
-- 3. Crea un repo en GitHub con el index.html
-- 4. Conecta el repo → Vercel lo despliega automáticamente
-- ══════════════════════════════════════════════════════════════
