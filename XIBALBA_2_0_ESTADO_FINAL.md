# XIBALBÁ 2.0 — ESTADO FINAL DE AUDITORÍA, REPARACIÓN Y EVOLUCIÓN

**Fecha:** 2026-11-18  
**Repositorio:** `D:\XIBALBA-FIREBASE-2026`  
**Proyecto Firebase:** `xibalba-ai-2026`  
**Rama de trabajo:** `xibalba-2.0-audit-evolution` (ramificada desde `bb49ea6` preservando intactos los cambios locales existentes en el árbol de trabajo)  
**Auditoría inicial:** [XIBALBA_AUDITORIA_2026.md](file:///D:/XIBALBA-FIREBASE-2026/XIBALBA_AUDITORIA_2026.md)

---

## 1. Inventario de funcionalidades conservadas y activas

1. **Los cinco agentes coordinados (`lib/analysis/coordinator.ts`, `lib/agents.ts`):**
   - `CAMAZOTZ` (voz, llamadas, audio y análisis telefónico local).
   - `IXBALANQUÉ` (mensajes, empleos y catálogo general).
   - `VUCUB CAMÉ` (verificación aritmética de CLABE 18 dígitos, Luhn para tarjetas, instituciones SPEI y señales financieras).
   - `HUN CAMÉ` (análisis estructural de URLs: homoglifos, marcas, TLDs abusivos, acortadores, ejecutables y auditorías externas DNS/RDAP).
   - `EL GUARDIÁN` (coordinación multiagente, fusión sin duplicados, semáforo único y conversación de seguimiento).
2. **Separación estricta de evidencias (`lib/analysis/risk.ts`, `components/EvidenceList.tsx`):**
   - Categorías A (`determinista`), A′ (`verificado-externo`), B (`ia`), C (`pendiente-externo`) y D (`error`).
3. **Inferencia híbrida (`lib/firebase.ts`, `lib/analysis/analyze.ts`):**
   - `InferenceMode.PREFER_ON_DEVICE` con respaldo en nube (`gemini-3.5-flash-lite`) y fallback determinista completo cuando la IA falla o no hay consentimiento.
4. **Historial local con enmascarado (`lib/history.ts`):**
   - Enmascara secuencias de >=4 dígitos, correos y monederos; vive en memoria o `localStorage` bajo consentimiento explícito.

---

## 2. Errores encontrados y corregidos

| Área | Defecto real encontrado | Corrección aplicada |
|---|---|---|
| **Cámara e imágenes** | `ImageAttachments.tsx` asignaba `video.current.srcObject` antes de que `<video>` se montara en el DOM al cambiar `cameraOn`. Además, `lib/analysis/images.ts` rechazaba `image/webp`, archivos móviles sin `file.type` y fotos > 4 MB sin compresión. | Se sincronizó `srcObject` y `.play()` en `useEffect` tras montar `<video>`; se añadió soporte `image/webp` e inferencia por extensión en `resolveImageMimeType`; se agregó compresión/redimensionado automático en cliente vía `<canvas>` hasta `MAX_IMAGE_BYTES` (4 MB, borde máx. 2048 px) y soporte i18n completo. |
| **Permiso de micrófono** | `next.config.ts` bloqueaba el micrófono a nivel de navegador con `Permissions-Policy: microphone=()`. | Se actualizó `Permissions-Policy` a `camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), bluetooth=()`. |
| **Selector de idioma ES/EN** | `Guardian.tsx`, `JaguarAvatar.tsx`, `ImageAttachments.tsx`, `AudioAttachment.tsx` y `images.ts` tenían textos hardcodeados en español; el prompt de seguimiento y el TTS solo usaban español. | Todos los componentes consumen `useI18n()`; `Guardian.tsx` adapta el prompt y la selección de voz TTS (`es-MX` / `en-US`); se ampliaron `lib/i18n/dictionary.ts` y `lib/i18n/evidence.ts` manteniendo paridad exacta ES/EN. |
| **Estado falso de escucha** | `Guardian.tsx` mostraba `state = "escuchando"` mientras esperaba una respuesta de texto (`asking === true`). | Se separaron los estados reales: `escuchando` solo se activa cuando el micrófono (`SpeechRecognition`) está realmente abierto; `analizando` cubre `busy || asking`; `hablando` cubre TTS activo; `seguridad` cubre semáforo verde. |
| **Firebase Storage Rules** | Existía `firestore.rules` (`allow read, write: if false;`) pero faltaba `storage.rules`. | Se creó `storage.rules` con denegación explícita (`allow read, write: if false;`) y se registró en `firebase.json`. |

---

## 3. Nuevas capacidades implementadas

1. **Analizador determinista de números telefónicos (`lib/analysis/phone.ts`):**
   - Extrae números MX, US/CA e internacionales sin confundir CLABEs de 18 dígitos ni tarjetas de 16 dígitos.
   - Enmascara dígitos en todas las evidencias (`maskPhone`).
   - Detecta prefijos de tarificación especial (`900`), múltiples teléfonos en un mensaje, teléfonos en avisos institucionales/bancarios y prefijos internacionales combinados con enlaces, declarando explícitamente como pendiente la consulta de reputación/titularidad externa.
2. **Correlación local de incidentes y campañas (`lib/analysis/correlation.ts`, `lib/history.ts`):**
   - Almacena huellas no sensibles (`domains`, `phonePrefixes`, `signalIds`) en `HistoryEntry` y correlaciona incidentes relacionados en el historial local, detectando patrones de campaña (suplantación bancaria/SPEI, extorsión telefónica, phishing por enlace, inversión/cripto).
3. **Reportes exportables (`lib/analysis/report.ts`, `components/Dashboard.tsx`):**
   - Descarga directa en navegador en formato **Markdown (`.md`)** y **JSON (`.json`)** con datos sensibles enmascarados y separación estricta A / B / C.
4. **Guardián Jaguar Maya Futurista + Voz Conversacional (`components/guardian/JaguarAvatar.tsx`, `components/Guardian.tsx`):**
   - Avatar SVG 2.5D obsidiana/jade/turquesa/oro con 7 estados reales (`reposo`, `escuchando`, `analizando`, `hablando`, `alerta`, `seguridad`, `error`) + `explicando`.
   - Reconocimiento de voz (Web Speech API `SpeechRecognition` / `webkitSpeechRecognition`) con botón explícito, indicador visual `mic-live`, timeout de 15 s, manejo de errores de permiso/silencio y alternativa de texto siempre disponible (incluyendo respuestas locales deterministas cuando la IA en la nube no está configurada).
5. **Experiencia UX/UI y PWA móvil (`app/manifest.ts`, `app/layout.tsx`, `app/globals.css`):**
   - Efecto cristal tecnológico (`backdrop-filter`), microinteracciones, manifest PWA instalable en Android/iOS, `viewportFit: "cover"` y objetivos táctiles >= 44 px en móvil.

---

## 4. Resultados de pruebas ejecutadas (post-edición final)

| Validación | Comando | Resultado real observado |
|---|---|---|
| **Typecheck** | `npm.cmd run typecheck` (`tsc --noEmit`) | **APROBADO** (0 errores). |
| **Pruebas unitarias e integración** | `npm.cmd test` (`node --test tests/*.test.mjs`) | **APROBADO** (**197/197** pruebas pasan, 0 fallos, 0 omitidas; incluye `tests/xibalba2.test.mjs`). |
| **Build de producción** | `npm.cmd run build` (`next build`) | **APROBADO** (compilado en 30.0 s, 7/7 rutas generadas incluyendo `/manifest.webmanifest`). |
| **Lint (ESLint)** | — | **NO EJECUTADO**: el proyecto no tiene ESLint instalado ni script `lint` en `package.json`. |
| **E2E en navegador real / dispositivo físico** | — | **NO EJECUTADO** en esta sesión (validado mediante build de producción y suite Node). |

---

## 5. Limitaciones técnicas y evaluación móvil

- **iOS / Safari:** No permite lectura de SMS/WhatsApp ni protección en segundo plano para apps de terceros; el dictado por Web Speech API puede variar según versión de iOS Safari, por lo que la entrada por texto y la subida/compresión de capturas permanecen siempre disponibles.
- **App Android complementaria (evaluación):** Para protección futura en segundo plano (ej. verificación de enlaces compartidos mediante Intent `ACTION_SEND` o `NotificationListenerService` con permiso explícito del usuario en Android), se recomienda un cliente Android nativo/Kotlin o Capacitor que consuma la misma lógica determinista y endpoints protegidos por App Check, sin prometer acceso oculto ni monitoreo sin consentimiento.
- **Reconocimiento de voz:** El dictado del navegador (`SpeechRecognition`) procesa el audio a través del servicio del fabricante del navegador y requiere conexión/permiso del usuario.

---

## 6. Riesgos de seguridad y recomendaciones para publicación

1. **Clave de App Check en producción:** `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` está vacía en `.env.local`. Debe configurarse con la clave de reCAPTCHA Enterprise registrada en Firebase Console (`xibalba-ai-2026`) junto con el dominio de producción antes de publicar; sin ella, la IA en nube y `/api/audit/external` responderán `401`.
2. **Desactivar depuración en producción:** Asegurar `NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG=false` y no definir `FIREBASE_APP_CHECK_DEBUG_TOKEN` en el entorno de producción.
3. **Auditorías externas (`XIBALBA_EXTERNAL_AUDITS`):** Permanecen deshabilitadas salvo `XIBALBA_EXTERNAL_AUDITS=1`; si se habilitan en producción, considerar un rate limiter distribuido (Redis/Upstash) en lugar de memoria por instancia serverless.
4. **Historial en la nube:** `firestore.rules` y `storage.rules` deniegan todo acceso (`if false`). Cualquier persistencia en la nube futura requiere implementar Firebase Authentication y reglas por `request.auth.uid`.
5. **Control de cambios:** Ningún cambio fue fusionado, empujado (`push`) ni desplegado públicamente; todo permanece en la rama local `xibalba-2.0-audit-evolution`.
