# XIBALBÁ 2.0 — AUDITORÍA INICIAL DEL REPOSITORIO (2026)

**Fecha de auditoría:** 2026-11-18  
**Repositorio:** `D:\XIBALBA-FIREBASE-2026`  
**Proyecto Firebase:** `xibalba-ai-2026`  
**Rama de origen:** `codex/finalizacion-xibalba` (HEAD `bb49ea6`)  
**Rama de trabajo aislada:** `xibalba-2.0-audit-evolution` (creada preservando todos los cambios locales sin sobrescribir)

---

## 1. Estado de Git y entorno

- **Cambios pendientes heredados en el árbol de trabajo:**
  - Modificados: `.env.example`, `README.md`, `app/globals.css`, `app/layout.tsx`, `components/Dashboard.tsx`, `components/EvidenceList.tsx`, `components/Guardian.tsx`, `components/RiskVerdict.tsx`, `docs/architecture.md`, `lib/agents.ts`, `lib/analysis/analyze.ts`, `lib/analysis/audit.ts`, `lib/analysis/coordinator.ts`, `lib/analysis/guardian.ts`, `lib/analysis/risk.ts`, `lib/firebase.ts`, `package-lock.json`, `package.json`.
  - Eliminados: `components/guardian/GuardianCanvas.tsx`, `components/guardian/scene.ts` (reemplazados por `JaguarAvatar.tsx`).
  - Nuevos sin rastrear: `.github/`, `components/LanguageProvider.tsx`, `components/guardian/JaguarAvatar.tsx`, `data/demo-cases.json`, `lib/analysis/clabe-institutions.ts`, `lib/analysis/errors.ts`, `lib/history.ts`, `lib/i18n/`, `next.config.ts`, `vercel.json`, `tests/finalizacion.test.mjs`, `tests/i18n.test.mjs`, `tests/integracion.test.mjs`, y documentación en `docs/`.
- **Variables de entorno (`.env.local`):**
  - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`: configuradas.
  - `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`: **vacía** (requerida para reCAPTCHA Enterprise en producción).
  - `NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG`: `true` (duplicada en `.env.local`).
  - `FIREBASE_APP_CHECK_DEBUG_TOKEN`: configurada para desarrollo local.

---

## 2. Resultados de pruebas y compilación inicial

- **`tsc --noEmit` (`npm.cmd run typecheck`):** APROBADO (0 errores).
- **`node --test tests/*.test.mjs` (`npm.cmd test`):** APROBADO (**190/190** pruebas pasan).
- **`lint`:** NO EXISTE script `lint` ni ESLint configurado en `package.json`.
- **`npm.cmd run build`:** Primer intento falló por `EPERM: operation not permitted, mkdir ...\.next\static\chunks\app` (error transitorio de sandbox en Windows); reintento en ejecución.

---

## 3. Inventario de arquitectura y componentes funcionales

1. **Motor determinista local (`lib/analysis/`):**
   - `patterns.ts`, `voice.ts`, `finance-patterns.ts`, `finance.ts`, `clabe-institutions.ts`, `audit.ts`, `risk.ts`, `coordinator.ts`.
   - Separa estrictamente evidencia comprobada (`determinista`, `verificado-externo`), estimada por IA (`ia`), pendiente (`pendiente-externo`) y fallida (`error`).
   - Verifica dígito de control CLABE (18 dígitos), suma de Luhn para tarjetas, direcciones cripto, URLs (homoglifos, marcas, TLDs abusivos, acortadores, ejecutables) y señales de voz/fraude financiero.
2. **Cinco agentes coordinados:**
   - `CAMAZOTZ` (voz y llamadas), `IXBALANQUÉ` (mensajes y empleos), `VUCUB CAMÉ` (fraude financiero), `HUN CAMÉ` (tiendas y enlaces), `EL GUARDIÁN` (coordinación y explicación).
3. **Auditoría externa (`lib/external/` + `app/api/audit/external/route.ts`):**
   - DNS sobre DoH y RDAP implementados con verificación RS256 de token de App Check y rate limit en memoria; deshabilitados por defecto salvo `XIBALBA_EXTERNAL_AUDITS=1`.
4. **Historial local (`lib/history.ts`):**
   - Enmascara secuencias de >=4 dígitos, correos y monederos; vive en memoria y opcionalmente en `localStorage` bajo consentimiento explícito.

---

## 4. Defectos críticos identificados y brechas frente a XIBALBÁ 2.0

### Prioridad crítica (bloqueos y fallos reales)
1. **Análisis de imágenes y cámara bloqueados (`components/ImageAttachments.tsx`, `lib/analysis/images.ts`):**
   - **Bug de cámara en vivo:** `startCamera()` asigna `video.current.srcObject = media` antes de que `<video ref={video}>` exista en el DOM (porque `cameraOn` se vuelve `true` en el mismo ciclo). En el primer intento, `video.current` es `null` y la vista previa queda negra/inoperante.
   - **Formatos restringidos y rechazo sin compresión:** Solo acepta `image/jpeg` y `image/png` de hasta 4 MB. Fotos móviles recientes (`image/webp`, `image/heic`, capturas >4 MB o archivos sin `file.type` pero con extensión válida) son rechazadas en lugar de aceptarse o redimensionarse en cliente.
   - **Textos de error y UI sin i18n:** `ImageAttachments.tsx` y `images.ts` están completamente hardcodeados en español.
2. **Selector de idioma ES/EN incompleto:**
   - `Dashboard.tsx`, `RiskVerdict.tsx` y `EvidenceList.tsx` usan `useI18n()`, pero **`Guardian.tsx`**, **`JaguarAvatar.tsx`**, **`ImageAttachments.tsx`**, **`AudioAttachment.tsx`**, **`lib/analysis/images.ts`** y **`lib/analysis/audio.ts`** tienen cadenas hardcodeadas en español.
   - El prompt de seguimiento del Guardián (`Guardian.tsx`) siempre pide respuesta en español y el TTS solo selecciona voces `es-*`.
3. **Guardián sin escucha ni voz conversacional real:**
   - **Bloqueo en `next.config.ts`:** La cabecera `Permissions-Policy` incluye `microphone=()`, bloqueando el acceso al micrófono a nivel de navegador.
   - **Sin reconocimiento de voz (STT):** No existe integración con Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) ni indicador real de micrófono activo.
   - **Estado `"escuchando"` engañoso:** `Guardian.tsx` muestra `state = "escuchando"` mientras espera una petición de texto (`asking === true`), violando la regla de no mostrar escucha cuando el micrófono no está activo.
   - **Falta estado `"confirmando seguridad"`:** `JaguarAvatar.tsx` tiene 6 estados (`reposo`, `escuchando`, `analizando`, `explicando`, `alerta`, `error`), falta distinguir explícitamente `seguridad` (confirmando seguridad cuando el veredicto es verde) y sincronizar mejor con eventos reales.
4. **Seguridad, Firebase y App Check:**
   - `firestore.rules` bloquea todo; no hay `storage.rules` explícitas.
   - `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` vacía impide App Check en producción (reCAPTCHA Enterprise).
   - `diagnostico-app-check` solo opera en desarrollo.
   - Falta verificación explícita de seguridad para futuras capacidades y documentación clara de límites.
5. **Capacidades antifraude faltantes para XIBALBÁ 2.0:**
   - **Análisis de números telefónicos reportados / patrones telefónicos:** No existe analizador específico para números telefónicos (formato MX/internacional, prefijos de riesgo/tarificación, códigos cortos, suplantación de líneas bancarias, historial de reportes locales/correlación).
   - **Correlación de incidentes relacionados y campañas sospechosas:** El historial guarda entradas aisladas sin detectar dominios, teléfonos, CLABEs enmascaradas o patrones compartidos entre investigaciones.
   - **Reportes exportables:** No hay exportación de investigaciones (JSON / Markdown / resumen imprimible sin datos sensibles).
6. **Experiencia UX/UI y móvil:**
   - Falta rediseño visual premium (obsidiana, jade maya, turquesa luminoso, oro metálico, cristal tecnológico, microinteracciones fluidas) sin perder funcionalidad.
   - Falta soporte PWA instalable (`manifest.webmanifest`, metadatos móviles iOS/Android, viewport seguro) y evaluación documentada de app Android complementaria.
