# XIBALBÁ 2.0 RC — Informe de Seguridad y Rendimiento

## 1. Seguridad y Privacidad (Fase 7)

| Control | Estado | Evidencia / Implementación |
| --- | --- | --- |
| **Firebase Security Rules (`firestore.rules`)** | **PASS** | `allow read, write: if false;` en todos los documentos (ningún código escribe datos personales en Firestore). |
| **Firebase App Check** | **PASS** | `ReCaptchaEnterpriseProvider` en producción/Preview; intercambio de token debug únicamente en `localhost` + `NODE_ENV=development`. Verificación JWKS en servidor en `lib/security/app-check.ts` y `tests/security.test.mjs`. |
| **Content Security Policy (`next.config.ts`)** | **PASS** | `connect-src` cerrada a orígenes de Firebase y `www.google.com` (telemetría reCAPTCHA Enterprise); `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, `Permissions-Policy` acotada a `camera=(self), microphone=(self)`. Validado en `tests/e2e/csp.spec.ts`. |
| **Dependencias (`npm audit`)** | **PASS** | **0 vulnerabilidades** (`0` críticas, `0` altas, `0` moderadas, `0` bajas) con overrides de `postcss` y `@grpc/grpc-js`. |
| **Prompt injection** | **PASS** | Contenido del usuario delimitado en `<contenido_no_confiable>` serializado con `JSON.stringify` (`lib/analysis/guardian.ts`), con regla determinista inamovible: la IA nunca degrada un riesgo alto comprobado. |
| **Validación de archivos y límites** | **PASS** | Límite de 6000 caracteres en texto, validación estricta de esquemas `http:`/`https:` sin credenciales, MIME/tamaño de imágenes y audio (`lib/analysis/images.ts`, `lib/analysis/audio.ts`), y límites de cuerpo HTTP en `/api/audit/external` (`tests/limited-body.test.mjs`). |
| **Privacidad, enmascaramiento y consentimiento** | **PASS** | Números de tarjeta/CLABE/teléfono enmascarados en evidencias, historial y PDF (`maskSensitive`). Historial local desactivado por defecto salvo consentimiento explícito; botón de borrado inmediato (`forgetHistory`). |
| **Exposición de secretos** | **PASS** | Escaneo en archivos rastreados e historial Git sin claves privadas ni `.env` rastreados. |

## 2. Rendimiento y Compatibilidad (Fase 8)

- **Carga diferida (`next/dynamic`, `ssr: false`)**: `GuardianHologram3D` y `GodsMap3D` se cargan solo en cliente; el SDK de Firebase se importa dinámicamente (`import("@/lib/firebase")`) fuera del bundle inicial de portada.
- **Suspensión fuera del viewport**: Ambos visores 3D usan `IntersectionObserver` + `visibilitychange` para cambiar `frameloop` a `"never"` cuando no son visibles.
- **Calidad gráfica adaptativa (`lib/graphicsQuality.ts`)**: Ajusta `dprRangeFor(quality)`, detalle de geometrías (`lowDetail`), `antialias: !lowDetail` y presupuesto de partículas (`70` alta, `35` media, `0` baja).
- **Fallback sin WebGL (`Scene3DBoundary` + `isWebGLAvailable`)**: Degradación automática a `JaguarAvatar` 2.5D verificada en `tests/e2e/hologram-3d.spec.ts`.
- **Movimiento reducido**: Respeta `prefers-reduced-motion: reduce` en CSS y en los loops `useFrame` de Three.js.
- **FPS medidos (distinguiendo hardware vs emulación)**:
  - Navegador interactivo con aceleración gráfica: **48 FPS** escritorio (`1440×900`) y **58 FPS** móvil emulado (`390×844`).
  - Chromium headless (Playwright / SwiftShader software WebGL): **7 FPS** (no representa GPU física).
  - Hardware móvil físico: **NOT TESTED**.
