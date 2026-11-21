# Checklist de publicación — XIBALBÁ 2.0

Fecha: 20 de noviembre de 2026. Candidato: rama `xibalba-global-defense`,
commit `05817cb`. Esta checklist se deja comprobada, **sin ejecutar el
despliegue a producción**, a la espera de autorización explícita.

## 1. Código y pruebas (verificado hoy)

- [x] `tsc --noEmit` — 0 errores.
- [x] `eslint .` — 0 problemas.
- [x] `npm test` (unitarias) — **214/214** pasan.
- [x] `npx playwright test` (E2E) — **28/28** pasan, 2 omitidos a propósito
      (dependen de credenciales reales de Firebase/Gemini que no están
      configuradas; ver `tests/e2e/cloud-ai.spec.ts`).
- [x] `next build` — compila limpio, sin warnings nuevos.
- [x] Sin secretos en el historial nuevo: `git diff c93ea2c..HEAD` revisado
      contra patrones de claves de Google, reCAPTCHA y tokens — solo
      coincidencias falsas (hashes de integridad de `package-lock.json`).
      Ningún `.env*` salvo `.env.example` (vacío) se añadió nunca.

## 2. Git (verificado hoy)

- [x] Rama de trabajo: `xibalba-global-defense`, árbol limpio.
- [x] 31 commits por delante de `origin/release/xibalba-2026` (tip actual:
      `c93ea2c`, del 14 de noviembre).
- [x] Ningún commit usa `--amend` sobre historial ya publicado; todo es
      avance limpio.
- [ ] **Pendiente de tu autorización**: `git push` de la rama a `origin` y
      apertura del Pull Request (ver sección 4).

## 3. Firebase y Vercel — variables pendientes

Confirmado con `vercel env ls production` y `vercel env ls preview`: en
ambos entornos solo están cargadas `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID` y `NEXT_PUBLIC_FIREBASE_APP_ID`.

**Faltan, en los dos entornos (Production y Preview):**

| Variable | Qué es | Dónde se obtiene |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Clave pública de Firebase (no es secreta, pero Vercel pide confirmación humana para cargarla) | Tu `.env.local`, o Firebase Console → Configuración del proyecto → Tus apps |
| `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` | Clave de sitio de reCAPTCHA Enterprise | Firebase Console → App Check → Apps → Registrar con reCAPTCHA Enterprise. Dominios permitidos: `xibalba-firebase-2026.vercel.app` y `localhost` |

**Nunca cargar en producción:** `NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG` ni
`FIREBASE_APP_CHECK_DEBUG_TOKEN`. El código ya lo impide (solo se activan en
`localhost` y `NODE_ENV=development`), pero no deben existir como variables
de entorno de Vercel bajo ninguna circunstancia.

Sin estas dos variables: la interfaz muestra honestamente «IA · SIN
CONFIGURAR», el endpoint `/api/audit/external` falla cerrado (401/503, nunca
abre sin verificar), y **el motor determinista sigue funcionando
completo** — confirmado hoy contra la URL pública ya desplegada. Esto es
intencional: la plataforma nunca finge tener IA cuando no la tiene.

Procedimiento exacto, paso a paso, ya escrito en
[docs/app-check.md](app-check.md) y [docs/despliegue.md](despliegue.md). No
se repite aquí para no duplicar instrucciones que puedan desincronizarse.

## 4. Propuesta de integración (no ejecutada — pendiente de tu autorización)

1. `git push -u origin xibalba-global-defense` — crea la rama remota, **sin
   tocar ninguna rama existente**, sin `--force`.
2. Abrir un Pull Request: `xibalba-global-defense` → `release/xibalba-2026`
   (la rama de producción fijada en Vercel). Resumen propuesto para el PR:
   - 31 commits, 170 archivos, +18206/-1401 líneas.
   - Incluye: Fases 2-9 de XIBALBÁ 3.0, Global Defense 4.0 (Escudo Global,
     Centro de Auxilio con Modo B), Guardián con animación corregida y
     perceptible, rediseño premium Maya Cyber Intelligence Laboratory,
     corrección de i18n en razones de agentes, investigación y corrección
     de los 5 fallos OCR en Playwright.
   - Validación adjunta: la de la sección 1 de este documento.
3. **No se hará merge, no se activará auto-merge, y no se desplegará a
   producción** hasta que lo confirmes explícitamente, incluso después de
   abierto el PR.

## 5. Lo que sigue dependiendo de ti, sin bloquear nada más

- Autorizar el `push` y la apertura del PR (paso 4).
- Generar y cargar las dos variables de Firebase (sección 3) en Vercel,
  Production y Preview.
- Decidir si promueves el PR a producción una vez revisado, o si prefieres
  probarlo primero como *vista previa* (`vercel deploy`, sin `--prod`).
