-- Finasset — contador ATÓMICO de uso de la IA (Vera)
-- Antes: la cuota se leía del JWT y se incrementaba fire-and-forget → peticiones concurrentes
-- se saltaban el límite (carrera). Pro era ilimitado (coste sin techo).
-- Ahora: un único UPDATE ... WHERE used < limit (con bloqueo de fila) hace el check+incremento
-- de forma atómica. Pro tiene un tope duro de coste aplicado en el servidor.
-- Idempotente. Seguro re-ejecutar. La app tiene fallback si esta RPC aún no existe.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month      TEXT NOT NULL,               -- 'YYYY-MM'
  used       INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, month)
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
-- Solo el servidor (service_role) escribe/lee; el cliente nunca toca esta tabla directamente.

-- Incremento atómico con control de límite.
--   p_limit < 0  → ilimitado (aun así se registra el consumo)
--   p_delta = 1  → consumir; p_delta = -1 → reembolsar (p. ej. si OpenAI falla)
-- Devuelve el nuevo contador, o NULL si se ha alcanzado el límite (no se consume).
CREATE OR REPLACE FUNCTION public.bump_ai_usage(p_user UUID, p_month TEXT, p_limit INT, p_delta INT DEFAULT 1)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v INT;
BEGIN
  INSERT INTO public.ai_usage(user_id, month, used) VALUES (p_user, p_month, 0)
    ON CONFLICT (user_id, month) DO NOTHING;
  IF p_delta < 0 THEN
    UPDATE public.ai_usage SET used = GREATEST(0, used + p_delta), updated_at = NOW()
      WHERE user_id = p_user AND month = p_month RETURNING used INTO v;
    RETURN v;
  END IF;
  IF p_limit < 0 THEN
    UPDATE public.ai_usage SET used = used + p_delta, updated_at = NOW()
      WHERE user_id = p_user AND month = p_month RETURNING used INTO v;
    RETURN v;
  END IF;
  UPDATE public.ai_usage SET used = used + p_delta, updated_at = NOW()
    WHERE user_id = p_user AND month = p_month AND used < p_limit RETURNING used INTO v;
  RETURN v; -- NULL si used >= p_limit (límite alcanzado)
END $$;

REVOKE ALL ON FUNCTION public.bump_ai_usage(UUID, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(UUID, TEXT, INT, INT) TO service_role;
