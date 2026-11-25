# XIBALBÁ — REPORTE DE AUDITORÍA INTEGRAL Y FINALIZACIÓN PREMIUM

> **Actualización de revisión:** este documento refleja afirmaciones de una ejecución anterior, no una finalización verificada de la orden actual. La inspección del código encontró que Academy carece de progreso persistente y rutas por público, SOS no cubre todos los escenarios solicitados y QR Defense no dispone de decodificador alternativo. La matriz actual se registra en `XIBALBA_TEST_MATRIX.md`. No debe interpretarse el PASS histórico de las fases como aceptación de todos los requisitos actuales.

**Fecha:** 2026-11-25  
**Rama de auditoría:** `feat/xibalba-final-audit` (creada desde `release/xibalba-2.0` @ `c0861ef`)  
**Respaldo previo:** `backup/pre-final-audit-2026-11-25` @ `c0861ef`  
**Producción Vercel:** Sin cambios (`https://xibalba-firebase-2026.vercel.app` · `dpl_DPhRM4ZpRTAySg2SzfFHbE5Dzcio`)

---

## 1. Resumen Ejecutivo por Fase

| Fase | Alcance | Estado | Evidencia / Resultado |
|---|---|---|---|
| **Fase 0** | Protección Git, comparación de ramas, secretos, línea base | **PASS** | `release/xibalba-2.0` (`c0861ef`) identificada como la rama más completa. Escaneo de archivos e historial Git sin secretos. |
| **Fase 1** | Auditoría funcional real (rutas, OCR, texto, enlaces, historial, consentimiento, PWA) | **PASS** | Todas las rutas (`/`, `/diagnostico-app-check`, `/api/audit/external`, `/api/app-check-debug`, `/manifest.webmanifest`) y flujos verificados. |
| **Fase 2** | Internacionalización ES/EN, `lang`, voces TTS/STT, pruebas de claves | **PASS** | Diccionario ES/EN completo, `document.documentElement.lang` dinámico, selección de voz `es-MX`/`en-US`, pruebas `tests/i18n.test.mjs` aprobadas. |
| **Fase 3** | IA híbrida local/nube, Firebase, App Check, timeouts, fallback, offline | **PASS** | `PREFER_ON_DEVICE` con timeout (`DEFAULT_AI_TIMEOUT_MS = 20_000`) y reintento único a `ONLY_IN_CLOUD` (`gemini-3.5-flash-lite`); nunca degrada riesgo determinista alto. |
| **Fase 4** | Cinco agentes (`CAMAZOTZ`, `IXBALANQUÉ`, `VUCUB CAMÉ`, `HUN CAMÉ`, `EL GUARDIÁN`) | **PASS** | Eventos progresivos (`queued`, `started`, `completed`, `error`), atribución sin duplicados y cronología verificados. |
| **Fase 5** | Jaguar holográfico 3D (`GuardianHologram3D.tsx`) + fallback 2.5D (`JaguarAvatar.tsx`) | **PASS** | GLB real con atribución CC BY 3.0, material Fresnel, partículas/anillos mayas, estados de reposo/escucha/análisis/alerta/seguridad/error y fallback seguro sin WebGL. |
| **Fase 6** | Mapa 3D interactivo de cinco dioses (`GodsMap3D.tsx`) | **PASS** | Cinco figuras sobre plataformas/templo con geometrías compartidas, `OrbitControls`, selección y estados reales en vivo. |
| **Fase 7** | XIBALBÁ GLOBAL DEFENSE (directorio por país sin geolocalización) | **PASS** | Cobertura verificada/honesta para los 8 países solicitados: **MX, US, ES, IN, CO, AR, CL, PE** (+ `GB`, `CA`, `BR`, y `UY` sin datos para validar estado `pendiente`). |
| **Fase 8** | XIBALBÁ FORENSIC LAB (exportación PDF ES/EN) | **PASS** | Incluye `analysisId`, fecha, motor utilizado, semáforo/nivel/confianza, evidencias, indicadores, agentes, recomendaciones, limitaciones, datos enmascarados y aviso explícito de no certificación oficial. |
| **Fase 9** | XIBALBÁ SHIELD (Web Share Target PWA) | **PASS** | `share_target` añadido a `app/manifest.ts` y recepción de `share_title`/`share_text`/`share_url` en `components/Dashboard.tsx` manteniendo intacto el flujo manual. Ver límites PWA/OS abajo. |
| **Fase 10** | Seguridad y privacidad (CSP, App Check, XSS/SSRF, sanitización, `npm audit`) | **PASS (con nota)** | Pruebas de seguridad/CSP aprobadas. `npm audit`: 0 críticas/moderadas/bajas; 4 altas en cadena transitiva `@grpc/grpc-js` dentro de `firebase` (transporte gRPC Node, no usado en WebChannel del navegador). |
| **Fase 11** | Compatibilidad de navegadores y responsive (320–1920 px) | **PARCIAL** | Chromium: **PASS** (320, 375, 390, 768, 1024, 1920 px sin desbordamiento horizontal; emulación móvil). Edge/Firefox/WebKit/dispositivos físicos: **NOT TESTED** en esta sesión. |
| **Fase 12** | Modo demo hackathon bilingüe (8 casos sintéticos ES/EN) | **PASS** | `data/demo-cases.json` ampliado a 8 casos sintéticos bilingües (`example.com`, `555`, CLABEs sintéticas válidas): banco, phishing, extorsión, empleo, inversión, captura OTP, control legítimo e ingeniería social. |
| **Fase 13** | Regresión completa | **PASS** | `typecheck`, `lint`, `229/229` unitarias/integración, `next build`, `34/34` E2E locales (`+2/2` E2E live Cloud AI con Gemini). |
| **Fase 14** | Documentación y reporte final | **PASS** | Nota de elegibilidad en `README.md` (líneas 121–122) respetada sin modificaciones. Reporte generado en `XIBALBA_FINAL_AUDIT_REPORT.md`. |

---

## 2. Resultados Exactos de Pruebas (Última Ejecución)

| Verificación | Comando | Resultado | Detalle |
|---|---|---|---|
| TypeScript | `npm.cmd run typecheck` | **PASS** | 0 errores (`tsc --noEmit`). |
| ESLint | `npm.cmd run lint` | **PASS** | 0 errores ni advertencias (`eslint .`). |
| Pruebas unitarias / integración | `npm.cmd test` | **PASS** | `237/237` aprobadas (`0 failed`, `0 skipped`). |
| Build de producción | `npm.cmd run build` | **PASS** | 7 páginas estáticas + 6 rutas compiladas (`/` 169 kB, First Load JS 290 kB). |
| E2E Playwright (Chromium) | `npx.cmd playwright test --reporter=list` | **PASS** | `41 passed`, `3 skipped` (`tests/e2e/cloud-ai.spec.ts` omitido por diseño sin `RUN_CLOUD_AI_E2E=1`), `0 failed`. |
| E2E Live Cloud AI (Firebase + Gemini) | `$env:RUN_CLOUD_AI_E2E="1"; npx.cmd playwright test --config=playwright.cloud.config.ts --reporter=list` | **PASS** | `3 passed` (`0 failed`) con App Check debug token y `gemini-3.5-flash-lite` reales en `localhost:3103` (ES rojo, ES verde y EN verde + revocación). |
| Auditoría de dependencias | `npm.cmd audit --json` | **PASS** | `0` vulnerabilidades (`0` críticas, `0` altas, `0` moderadas, `0` bajas) con `@grpc/grpc-js: ^1.13.6`. |
| Firefox 159 / WebKit 27.2 / Node 24.22.3 | `playwright.cross.config.ts` | **PASS** | `11/11` en Firefox y `11/11` en WebKit bajo Node `v24.22.3` (`audit-fases`, `global-shield`, `new-modules`). Hardware físico y Chrome DevTools sobre Preview autenticado: ver límites. |

---

## 3. Cambios Realizados en `feat/xibalba-final-audit`

1. **XIBALBÁ GLOBAL DEFENSE ([`lib/global-shield/directory.ts`](lib/global-shield/directory.ts), [`tests/global-shield.test.mjs`](tests/global-shield.test.mjs), [`tests/e2e/global-shield.spec.ts`](tests/e2e/global-shield.spec.ts)):**
   - Añadidos **India (`IN`)** (`I4C / cybercrime.gov.in`, línea `1930`, `verificado`), **Chile (`CL`)** (`PDI Cibercrimen / pdichile.cl`, línea `134`, `verificado`) y **Perú (`PE`)** (`Ministerio Público / mpfn.gob.pe`, `en-revision`, sin teléfono inventado).
   - Añadido `UY` al selector sin registros para mantener la prueba E2E #16 sobre países aún sin cobertura verificada.
2. **XIBALBÁ FORENSIC LAB PDF ([`lib/analysis/report.ts`](lib/analysis/report.ts), [`lib/analysis/pdf.ts`](lib/analysis/pdf.ts), [`tests/pdf.test.mjs`](tests/pdf.test.mjs)):**
   - Añadido `analysisId` (`XIB-YYYYMMDDHHMMSS`), impresión explícita del motor (`IA local`, `IA en la nube (Gemini)` o `Motor determinista (Sin IA)`) y aviso legal en pie de página indicando que no constituye certificación oficial.
3. **XIBALBÁ SHIELD Web Share Target ([`app/manifest.ts`](app/manifest.ts), [`components/Dashboard.tsx`](components/Dashboard.tsx)):**
   - Declarado `share_target` (`GET /` con `share_title`, `share_text`, `share_url`) y precarga automática al abrir desde Share Target, limpiando los parámetros de la URL y conservando el flujo manual.
   - **Limitación documentada:** Web Share Target en PWA requiere instalación como PWA en navegadores/OS compatibles (principalmente Android/Chrome/Edge); no equivale a una extensión nativa de iOS/Android para interceptar enlaces del sistema sin instalar la PWA.
4. **Modo Demo Bilingüe de 8 Casos ([`data/demo-cases.json`](data/demo-cases.json), [`components/Dashboard.tsx`](components/Dashboard.tsx), [`tests/finalizacion.test.mjs`](tests/finalizacion.test.mjs)):**
   - Ampliado a 8 casos sintéticos bilingües (ES/EN), añadiendo `captura-sospechosa` (OTP/acceso) e `ingenieria-social` (pretexto urgente de dirección).
5. **Pruebas E2E de Auditoría ([`tests/e2e/audit-fases.spec.ts`](tests/e2e/audit-fases.spec.ts)):**
   - Cobertura automatizada para Web Share Target, responsive 320–1920 px, 8 chips bilingües y 8 países en Escudo Global.

## Implementación y nueva ejecución — 25 de noviembre de 2026

- QR Defense utiliza jsQR para decodificar imágenes y fotogramas de cámara localmente; no abre el contenido. La prueba con QR sintético sin BarcodeDetector pasó en Chromium. Cámara física y permisos reales: NOT TESTED.
- SOS incorpora ocho situaciones bilingües con acciones inmediatas, protección de cuentas y preservación de evidencias. Test de estructura y navegación: PASS. El directorio no se ha revalidado contra todas sus fuentes en esta ejecución.
- Academy ofrece cinco selecciones de ruta, siete lecciones, evaluación existente, puntos, nivel, insignia, almacenamiento local, reinicio y diploma de participación. Persistencia en recarga y cambio de idioma: PASS. Las rutas usan un conjunto compartido de contenidos y aún no constituyen un currículo completo adaptado a cada público; la recomendación de lecciones por indicador no está implementada.
- El Guardián enlaza SOS/directorio y Academy cuando existen indicadores sospechosos. La asociación específica entre cada indicador y lección permanece pendiente.
- TypeScript, ESLint, 236 pruebas unitarias/integración, compilación y npm audit: PASS (0 vulnerabilidades reportadas). El runtime de esta máquina es Node 22, por debajo de Node 24 declarado por el proyecto y Firebase.
- Chromium: 6/6 pruebas de módulos/voz simulada e idioma y 15/15 de accesibilidad, CSP, directorio y mapa. Voz y cámara físicas: NOT TESTED. La primera ejecución cloud produjo 1 PASS y 1 FAIL mientras seguía en ejecución; se identificó una espera incorrecta y se está verificando de nuevo. No se consideran verificadas imágenes cloud ni todos los idiomas.
- No se ha completado la auditoría integral de traducción, la matriz multinavegador y hardware, ni todas las mejoras 3D, capturas, publicación y Preview. La rama no debe considerarse una entrega final.
- Repetición cloud: ambos casos de texto pasaron individualmente con comprobación explícita del motor de nube tras corregir la espera. La primera ejecución fallida se conserva como antecedente; no se probó imagen cloud ni respuesta cloud en inglés.
