# Matriz de pruebas — revisión del 25 de noviembre de 2026

## Actualización — 26 de noviembre de 2026 (candidato definitivo `08001ee`)

Sobre el commit candidato de cierre, sin repetir lo ya verificado abajo.
`08001ee` es solo un fix de robustez del arnés de pruebas (ver fila de
`production-image-analysis.spec.ts` más abajo); no toca producto.

| Verificación | Estado | Evidencia exacta |
| --- | --- | --- |
| TypeScript / ESLint / build (Node `v24.22.3`) | **PASS** | `tsc --noEmit` 0 errores · `eslint .` 0 errores · `next build` compiló 7 páginas/6 rutas. |
| Pruebas unitarias e integración | **PASS** | **240/240** (antes `237/237`; +3 por el fix de prompt injection y el borrado individual de historial). |
| Análisis de imágenes contra producción real (`setInputFiles`, no localhost) | **PASS** | `5/5` en `tests/e2e/production-image-analysis.spec.ts` (ES/EN fraudulento, legítimo, archivo incompatible, archivo >4MB). |
| Regresión local completa (`playwright.config.ts`, sin nube configurada) | **PASS** | `46 passed`, `3 skipped` (`cloud-ai.spec.ts`) + ahora `3 skipped` adicionales en `production-image-analysis.spec.ts` (se omiten con motivo explícito en vez de colgar 100s cada uno: ese spec depende de variables de Firebase que no existen en el build local), `0 failed`. |
| Inferencia real de Gemini sobre imágenes en producción, bajo automatización headless | **BLOCKED (por diseño, no es un defecto)** | reCAPTCHA Enterprise rechaza el tráfico automatizado (401); reproducido igual con solo texto. Verificación humana pendiente: [`docs/pruebas-hardware-fisico.md`](docs/pruebas-hardware-fisico.md) §5. |
| CSP `connect-src` con `blob:` (OCR nativo del navegador) | **FIXED** | `tests/e2e/csp.spec.ts` actualizado; no desplegado a producción todavía. |
| Borrado individual del historial | **FIXED** | Prueba unitaria en `tests/finalizacion.test.mjs` + verificación manual en navegador. |
| Prompt injection (delimitador falsificable) | **FIXED** | Dos pruebas nuevas en `tests/phase1.test.mjs` reproducen el payload antes/después del fix. |
| Dependencias (`npm audit`) | **PASS** | `0` vulnerabilidades. |
| Secretos en el historial completo de git | **PASS** | Sin coincidencias (claves Google/privadas/Anthropic). |

Detalle completo, correcciones y acciones pendientes del usuario:
[`XIBALBA_2_0_INFORME_CONSOLIDADO_FINAL.md`](XIBALBA_2_0_INFORME_CONSOLIDADO_FINAL.md).

## Resultados verificados tras la última edición

| Verificación | Estado | Evidencia exacta |
| --- | --- | --- |
| TypeScript (`npm.cmd run typecheck`) | **PASS** | `tsc --noEmit` — 0 errores. |
| ESLint (`npm.cmd run lint`) | **PASS** | `eslint .` — 0 errores ni advertencias. |
| Pruebas unitarias e integración (`npm.cmd test`) | **PASS** | `237/237` aprobadas (`0 failed`, `0 skipped`), incluyendo Academy (5 rutas diferenciadas y recomendaciones por indicador), SOS (8 escenarios), QR Defense (`jsQR` + esquemas), PDF, i18n, App Check y seguridad. |
| Auditoría de dependencias (`npm.cmd audit --json`) | **PASS** | `0` vulnerabilidades (`0` críticas, `0` altas, `0` moderadas, `0` bajas) tras fijar `@grpc/grpc-js: ^1.13.6` en `package.json`. |
| Build de producción (`npm.cmd run build`) | **PASS** | `next build` compiló 7 páginas estáticas y 6 rutas (`/` 169 kB, First Load JS 290 kB) sin avisos de SWC. |
| Descargas reales (MD, JSON, PDF y diploma Academy) | **PASS** | `5/5` en `voice-and-audit.spec.ts`, validando `xibalba-report-*.md`, `.json`, `.pdf` y `xibalba-academy.pdf`. |
| Despliegue Vercel Preview (`dpl_GVZJNg4huJbNsFFA7YucY2dj7HRc`, commit `8d78883`) | **PASS / PARCIAL** | `READY` en `https://xibalba-firebase-2026-1j5mvms7v-dyann1984s-projects.vercel.app`; las 5 variables `NEXT_PUBLIC_FIREBASE_*` (incl. App Check site key) están en Preview. La navegación interactiva en Chrome sobre el Preview autenticado quedó **BLOCKED** hasta aprobar `chrome://inspect/#remote-debugging`. |
| E2E Playwright (`playwright.config.ts`) | **PASS** | `41 passed`, `3 skipped` (`cloud-ai.spec.ts` omitido por diseño sin `RUN_CLOUD_AI_E2E=1`), `0 failed`. Incluye `voice-and-audit.spec.ts`, `audit-fases.spec.ts`, `new-modules.spec.ts`, `a11y.spec.ts`, `csp.spec.ts`, `hologram-3d.spec.ts`, `global-shield.spec.ts`, `golden-path.spec.ts`, `phase2.spec.ts` y `xibalba.spec.ts`. |
| E2E de mapas y regresión solicitada | **PASS** | En Node `v24.22.3`: `19/19` en `maps-redesign.spec.ts` (1), `hologram-3d.spec.ts` (2), `xibalba.spec.ts` (12) y `a11y.spec.ts` (4), más `3/3` tras el refinamiento `3ab4dd1`. FPS en Chromium headless (software): `7`; en navegador interactivo: `48 FPS` escritorio y `58 FPS` móvil. |
| Mapa 3D móvil (390×844) | **PASS** | Sin overflow horizontal; cinco templos mayas escalonados con escalinatas orientadas al Guardián visibles sin recortes. Capturas en `artifacts/maps-redesign/after-gods-map-3d-mobile.png` y `after-gods-map-3d-closeup.png`. |
| Preview del rediseño 3D (`3ab4dd1`) | **READY** | `dpl_4WrgXFm4gxM1uzbuz2JT2Rx4CUMY` en `https://xibalba-firebase-2026-54i647ody-dyann1984s-projects.vercel.app`; acceso web protegido por SSO de Vercel. |
| E2E Cloud AI real (`playwright.cloud.config.ts`, `RUN_CLOUD_AI_E2E=1`) | **PASS** | `3 passed`, `0 failed`: texto rojo (nunca degradado por Gemini), texto limpio verde + retrato `seguridad`, y análisis en inglés verde + revocación de consentimiento verificando `.inference b` (`NUBE`/`CLOUD`). |
| Capturas ES/EN escritorio (1440px) y móvil (390px) | **PASS** | Generadas en `artifacts/audit-final/` e inspeccionadas visualmente. |
| Compatibilidad Firefox 159 y WebKit 27.2 (`playwright.cross.config.ts`) | **PASS** | `11/11` en Firefox y `11/11` en WebKit bajo Node `v24.22.3` (`audit-fases.spec.ts`, `global-shield.spec.ts`, `new-modules.spec.ts`). WebKit corrió contra servidor HTTP dev porque `upgrade-insecure-requests` de `next start` bloquea assets en `http://127.0.0.1` sin TLS. |
| Voz/Micrófono/Cámara con hardware físico | **NOT TESTED** | Las pruebas en Chromium usan stubs/emulación; guía manual lista en [`docs/pruebas-hardware-fisico.md`](docs/pruebas-hardware-fisico.md). |
| Web Share Target en PWA instalada en Android/iOS | **NOT TESTED** | Se verificó `/manifest.webmanifest` (`share_target`), `/sw.js` (`200 OK`) y la precarga vía `/?share_title=...`; la hoja de compartir nativa del SO requiere dispositivo físico con PWA instalada. |
| Compatibilidad Node.js 24 | **PASS** | Node `v24.22.3` verificado en `C:\Program Files\nodejs\node.exe` ejecutando las baterías cross-browser. |
