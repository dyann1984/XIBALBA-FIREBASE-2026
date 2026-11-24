# XIBALBÁ 2.0 — INFORME FINAL DE QA, RELEASE, DEMO Y VIDEO

**Fecha:** 2026-11-23  
**Repositorio:** `D:\XIBALBA-FIREBASE-2026`  
**Proyecto Firebase:** `xibalba-ai-2026`  
**Rama actual:** `mejora-visual/holograma-guardian-y-mapa` (HEAD `5a373c4` + cambios integrados de estabilidad 3D, calidad gráfica, activación 3D por defecto, E2E y demo)  
**Preview URL (Vercel, sin tocar Production):** https://xibalba-firebase-2026-888cxkpiq-dyann1984s-projects.vercel.app  
**Inspector Vercel:** https://vercel.com/dyann1984s-projects/xibalba-firebase-2026/4DBoc8mJ24fDP6CEtUZu4eRJ2Nxz

---

## 1. Resumen de cambios y recuperación del trabajo de Claude

Se verificaron e integraron sin pérdidas los 5 commits reportados en `mejora-visual/holograma-guardian-y-mapa` (`6097e9d`, `2c49ab9`, `1e86a54`, `c770db7`, `5a373c4`) y los archivos de estabilidad en progreso:
- Se completó el cableado de `detectGraphicsQuality()` y `dprRangeFor(quality)` en `components/guardian/GuardianHologram3D.tsx` (eliminando el error de TypeScript `TS2741` y omitiendo el eco wireframe en dispositivos de calidad baja).
- Se conservó `components/guardian/Scene3DBoundary.tsx` como red de seguridad ante fallos de WebGL/Three.js.
- Tras validar la estabilidad 3D en escritorio y móvil con cero errores de consola/página, se activó la experiencia 3D por defecto mediante `use3DEnabled()` en `lib/useQueryFlag.ts` (consumido en `components/Guardian.tsx` y `components/Dashboard.tsx`), manteniendo `JaguarAvatar` 2.5D y `AgentOperationsBoard` como fallback automático cuando WebGL no está disponible o si se pasa `?preview3d=0` / `?no3d=1`.
- Se añadió soporte de puerto configurable (`PW_PORT`) en `playwright.config.ts`.
- Se añadió `.vercelignore` para excluir `artifacts/`, `test-results/` y `.env*` en despliegues.

---

## 2. Funcionalidades verificadas

- **Análisis de texto y detección de estafas:** Motor determinista local (`lib/analysis/audit.ts`, `patterns.ts`, `voice.ts`, `finance.ts`, `phone.ts`, `coordinator.ts`) operativo en navegador sin red.
- **Análisis de imágenes y OCR:** Subida PNG/JPEG/WebP, compresión en cliente, cámara simulada en Chromium y OCR con Tesseract (`phase2.spec.ts`, `xibalba.spec.ts`).
- **Cinco agentes y mapa 3D (`GodsMap3D.tsx` + `AgentOperationsBoard.tsx`):** Emisión progresiva de eventos reales, plataformas ceremoniales y figuras procedurales de los 5 dioses mayas con conexiones iluminadas únicamente para agentes participantes y selección por clic/toque.
- **Jaguar 3D (`GuardianHologram3D.tsx`):** Volumen real con iluminación direccional + Fresnel, ojo luminoso acotado a la mitad superior, postura fija en reposo (`t=0.17`) y animación vinculada a los estados (`reposo`, `alerta`, `analizando`, `hablando`, `escuchando`, `seguridad`, `error`).
- **Semáforo de riesgo y evidencias:** Separación estricta A (determinista), A′ (externo), B (IA), C (pendiente) y D (error).
- **Traducción ES/EN y persistencia:** Cambio dinámico con actualización de `html[lang]` y persistencia en `localStorage`.
- **Historial, búsqueda, filtros y correlación:** Persistencia local bajo consentimiento explícito, enmascarado de dígitos, filtros por semáforo, correlación de incidentes/campañas y mapa de investigaciones.
- **Exportación de reportes:** Descarga verificada en `.md`, `.json` y soporte `.pdf` (`jspdf`).
- **Escudo Global:** Directorios reales diferenciados por país (`MX`, `US`, `ES` en revisión, etc.) y botón de ayuda accesible.

---

## 3. Resultados de pruebas ejecutadas

| Suite / Validación | Comando | Resultado real observado |
|---|---|---|
| **TypeScript** | `npm.cmd run typecheck` | **APROBADO** (0 errores). |
| **ESLint** | `npm.cmd run lint` | **APROBADO** (0 errores, 0 advertencias). |
| **Pruebas unitarias e integración** | `npm.cmd test` | **APROBADO** (**228/228** pruebas pasan, 0 fallos, 0 omitidas). |
| **Build de producción** | `npm.cmd run build` | **APROBADO** (7/7 rutas generadas, incluye `/manifest.webmanifest`). |
| **Playwright E2E (con 3D activo por defecto)** | `npx.cmd playwright test --reporter=list` | **31 APROBADAS, 0 FALLIDAS, 2 OMITIDAS** (`cloud-ai.spec.ts` omitidas por falta de `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` en `.env.local` para IA en la nube en vivo). |
| **Accesibilidad (`axe-core`)** | `tests/e2e/a11y.spec.ts` | **APROBADO** (4/4 escenarios sin violaciones en escritorio y móvil 375 px). |
| **CSP** | `tests/e2e/csp.spec.ts` | **APROBADO** (1/1). |
| **3D + Fallback WebGL** | `tests/e2e/hologram-3d.spec.ts` | **APROBADO** (2/2: WebGL activo sin errores en escritorio y móvil 375×812; fallback limpio a `JaguarAvatar` 2.5D cuando WebGL es `null`). |

---

## 4. Estado real de módulos clave

- **Jaguar 3D:** Activo por defecto cuando `isWebGLAvailable()` es `true`; protegido por `Scene3DBoundary` con fallback automático a `JaguarAvatar` 2.5D.
- **Voz conversacional:** TTS (`speechSynthesis`) y STT (`SpeechRecognition` / `webkitSpeechRecognition`) implementados con permisos explícitos en `Permissions-Policy: microphone=(self)` y alternativa de texto siempre operativa. *Nota: las pruebas automatizadas verifican permisos y UI sin hardware de micrófono físico ni voz humana real en CI.*
- **IA local y nube:** Fallback determinista y modo local probados al 100%. La inferencia en la nube (Firebase AI Logic + Gemini) depende de configurar `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` en entorno público/local para validar el intercambio de App Check.
- **Firebase y Seguridad:** `firestore.rules` y `storage.rules` deniegan todo acceso (`allow read, write: if false;`), lo cual **no bloquea ninguna función actual** porque las imágenes y el audio permanecen únicamente en la memoria del navegador. `/api/audit/external` verifica firma RS256 de App Check y aplica rate limiting por proceso.
- **Compatibilidad móvil:** Validado en viewports `360px`, `375px`, `390px`, `430px`, `768px`, `1024px` sin desbordamiento horizontal; PWA instalable (`app/manifest.ts`).

---

## 5. Evidencias visuales y video del hackathon generados

Todas las evidencias reales se encuentran en [artifacts/xibalba-2.0/](file:///D:/XIBALBA-FIREBASE-2026/artifacts/xibalba-2.0):
- **Video demo 1080p MP4 (H.264, 23.7 s, 3.8 MB):** [xibalba-2.0-demo.mp4](file:///D:/XIBALBA-FIREBASE-2026/artifacts/xibalba-2.0/xibalba-2.0-demo.mp4) (grabado con Playwright + FFmpeg sobre `next start`, script en [record-demo.mjs](file:///D:/XIBALBA-FIREBASE-2026/scripts/record-demo.mjs)).
- **Guion, storyboard y guía de grabación:** [guion-video-xibalba-2.0.md](file:///D:/XIBALBA-FIREBASE-2026/docs/guion-video-xibalba-2.0.md).
- **Capturas reales:** `01-home-desktop.png`, `02-dashboard-full.png`, `03-jaguar-idle.png`, `04-jaguar-alert.png`, `05-scam-analysis-result.png`, `06-ui-spanish.png`, `07-ui-english.png`, `08-home-mobile-390.png`, `09-analysis-mobile-390.png`, además de `10-agentes-en-vivo.png` a `18-agentes.png`.

---

## 6. Pendientes críticos y recomendación GO / NO-GO

### Pendientes para Production público
1. **App Check de producción:** Configurar `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` (reCAPTCHA Enterprise) en Vercel y registrar el dominio final en Firebase Console (`xibalba-ai-2026`). Sin esta clave, las consultas de Gemini en nube y `/api/audit/external` responden `401`.
2. **Vercel Deployment Protection:** El Preview URL actual tiene `vercel_authentication` habilitado por configuración del proyecto en Vercel; para que el jurado externo acceda sin iniciar sesión en Vercel, debe promoverse a Production (con autorización) o desactivar la protección en el panel de Vercel.
3. **Prueba manual con micrófono físico:** Realizar una prueba rápida en vivo con micrófono real para validar la dictación de voz en el dispositivo desde el que se grabará o presentará.

### Veredicto: **GO CONDICIONADO PARA DEMO / HACKATHON**
- **GO** para demostración inmediata, grabación con narración sobre el recorrido y presentación técnica: todas las validaciones de código, 228 pruebas unitarias, 31 pruebas E2E, accesibilidad, 3D con fallback y build de producción están en verde.
- **Condicionado para Production público** únicamente a configurar `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` y recibir autorización expresa para promover a Production (`vercel deploy --prod`) y hacer merge/push de la rama.
