# Matriz de pruebas — revisión del 25 de noviembre de 2026

## Resultados verificados tras la última edición

| Verificación | Estado | Evidencia exacta |
| --- | --- | --- |
| TypeScript (`npm.cmd run typecheck`) | **PASS** | `tsc --noEmit` — 0 errores. |
| ESLint (`npm.cmd run lint`) | **PASS** | `eslint .` — 0 errores ni advertencias. |
| Pruebas unitarias e integración (`npm.cmd test`) | **PASS** | `237/237` aprobadas (`0 failed`, `0 skipped`), incluyendo Academy (5 rutas diferenciadas y recomendaciones por indicador), SOS (8 escenarios), QR Defense (`jsQR` + esquemas), PDF, i18n, App Check y seguridad. |
| Auditoría de dependencias (`npm.cmd audit --json`) | **PASS** | `0` vulnerabilidades (`0` críticas, `0` altas, `0` moderadas, `0` bajas) tras fijar `@grpc/grpc-js: ^1.13.6` en `package.json`. |
| Build de producción (`npm.cmd run build`) | **PASS** | `next build` compiló 7 páginas estáticas y 6 rutas (`/` 169 kB, First Load JS 290 kB). |
| E2E Playwright (`playwright.config.ts`) | **PASS** | `41 passed`, `3 skipped` (`cloud-ai.spec.ts` omitido por diseño sin `RUN_CLOUD_AI_E2E=1`), `0 failed`. Incluye `voice-and-audit.spec.ts`, `audit-fases.spec.ts`, `new-modules.spec.ts`, `a11y.spec.ts`, `csp.spec.ts`, `hologram-3d.spec.ts`, `global-shield.spec.ts`, `golden-path.spec.ts`, `phase2.spec.ts` y `xibalba.spec.ts`. |
| E2E Cloud AI real (`playwright.cloud.config.ts`, `RUN_CLOUD_AI_E2E=1`) | **PASS** | `3 passed`, `0 failed`: texto rojo (nunca degradado por Gemini), texto limpio verde + retrato `seguridad`, y análisis en inglés verde + revocación de consentimiento verificando `.inference b` (`NUBE`/`CLOUD`). |
| Capturas ES/EN escritorio (1440px) y móvil (390px) | **PASS** | Generadas en `artifacts/audit-final/` e inspeccionadas visualmente. |
| Voz/Micrófono/Cámara con hardware físico y navegadores Firefox/WebKit | **NOT TESTED** | Las pruebas de micrófono y síntesis de voz en E2E usan stubs en Chromium (`FakeSpeechRecognition` y `speechSynthesis` mock); no se probaron en micrófono/cámara física ni en Firefox/WebKit. |
| Web Share Target en PWA instalada en Android/iOS | **NOT TESTED** | Se verificó `/manifest.webmanifest` (`share_target`), `/sw.js` (`200 OK`) y la precarga vía `/?share_title=...`; la hoja de compartir nativa del SO requiere dispositivo físico con PWA instalada. |
| Versión de Node.js local vs Vercel | **LIMITACIÓN** | Ejecutado localmente con Node `v22.23.2` (instalación de Node 24 vía MSI requirió elevación UAC); `package.json` mantiene `engines.node: "24.x"` para Vercel. |
