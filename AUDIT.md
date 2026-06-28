# Finasset — Auditoría de seguridad y calidad (sesión nocturna)

> PM: Claude (Opus 4.8) · Rama: `master` · Regla autoimpuesta: **no romper producción**.
> Solo se aplicaron cambios verificables; lo dudoso queda documentado abajo, no tocado.

## ✅ Arreglado y desplegado esta noche

### 1. `/api/email/send` era un **relay abierto** (crítico) — ARREGLADO
- **Antes:** solo comprobaba que el header `Authorization` empezara por `Bearer ` — nunca validaba el token. Cualquiera podía enviar correos arbitrarios (`to`/`subject`/`html`) desde `noreply@finasset.app`.
- **Impacto:** spam/phishing suplantando el dominio, quema de la cuota de Resend, riesgo de blacklist del dominio.
- **Fix:** validación real del JWT contra `${SUPABASE_URL}/auth/v1/user`; validación de destinatarios (regex email, máx. 10), tope de `subject` (200) y `html` (100 KB), y restricción del `From` al dominio verificado `finasset.app`.
- **Riesgo del cambio:** nulo — el frontend **no llama** a este endpoint, así que no se rompe ningún flujo actual.

### 2. `/api/ai/chat` sin rate-limit (coste) — ARREGLADO
- **Antes:** sin ningún tope; cada llamada factura a Anthropic. El límite de "3 msgs/día" es solo del cliente (se puede saltar).
- **Fix:** rate-limit per-IP in-edge (15/min) replicando el patrón de `/api/auth/config`. Muy por encima del uso normal de chat.
- **Riesgo del cambio:** nulo para usuarios legítimos.

### 3. `/api/portfolio/seed` filtraba `error.message` — ARREGLADO
- Mensaje de error genérico en vez de exponer detalles internos.

## ⚠️ Encontrado pero **NO** tocado (requiere tu decisión — no toco auth a ciegas)

### A. `/api/auth/config?u=<username>` filtra emails (privacidad/RGPD) — PRIORIDAD ALTA
- Devuelve el **email** de cualquier usuario cuyo `full_name` coincida → enumeración de usuarios y filtrado de PII.
- **No lo cambié** porque el login-por-usuario lo usa (desktop.html:7251 / mobile.html:7287). Cambiarlo a ciegas rompería el acceso.
- **Fix recomendado:** resolver usuario→email **y** completar el `signInWithPassword` en el servidor, sin devolver nunca el email; o tabla `usernames` con RLS. Lo implemento cuando me lo confirmes.

### B. `/api/ai/chat` sin auth de sesión — PRIORIDAD MEDIA
- El rate-limit ya frena el abuso masivo, pero el endpoint sigue siendo anónimo (no consume créditos del usuario en servidor).
- **Fix recomendado:** verificar el `fa_token` (JWT Supabase) y descontar créditos server-side. Requiere tocar el flujo de créditos → lo hago supervisado.

## ✅ Revisado y CORRECTO (sin cambios)
- **Secretos:** no hay claves reales commiteadas; `.env.example` solo placeholders; `service_role` solo en server.
- **`lib/security.js`:** CORS allowlist, rate-limit, validación ISIN/símbolo, tope de body (32 KB). Sólido.
- **`vercel.json`:** headers fuertes — HSTS preload, CSP real, COOP/CORP, X-Frame DENY, Permissions-Policy. (Único matiz: `script-src 'unsafe-inline'`, inevitable en una app de script inline; no se toca.)
- **Render de la IA (`_veraMarkdown`):** escapa `& < >` **antes** del markdown y solo genera `<strong>/<em>/<br>` → **no es XSS**. Mensajes de usuario con `escapeHtml`. Correcto.
- **`localStorage` / token:** todas las lecturas con `JSON.parse` van con try/catch (incluido el getter de sesión). Robusto.
- **Endpoints de datos** (`search`, `dividends`, `etf/profile`, `intraday`, `coverage`, `insiders`): proxies de datos públicos con `setupApi` (rate-limit + validación). Correctos sin auth.
- **App mono-usuario:** la cartera vive en `portfolio-seed.json` (server); no hay riesgo de aislamiento multi-tenant.

## 🔭 Backlog sugerido (para aprobar por la mañana)
1. **[Alta]** Reescribir login-por-usuario para no filtrar emails (punto A).
2. **[Media]** Auth + créditos server-side en `/api/ai/chat` (punto B).
3. **[Baja]** Limpieza del repo: hay ~30 ficheros `fix-*.js`, `tmp-*.js`, `*.bak`, `mk-desktop.js` (scripts de construcción/parches de una sola vez) en la raíz. Mover a `/scripts` o borrar para reducir superficie y ruido.
4. **[Baja]** `fx/rates.js` también filtra `e.message` en el fallback (muy bajo impacto).
5. **[Baja]** Considerar mover el rate-limit de los endpoints edge a un KV (Upstash/Vercel KV) para que sea global y no per-instancia.

---
*Generado de forma autónoma durante la noche. Todo lo de "Arreglado" está commiteado y desplegado; nada de "No tocado" se ha modificado.*
