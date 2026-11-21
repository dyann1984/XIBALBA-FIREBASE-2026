# Matriz final de cierre — rama `finalizacion/app-check-y-pendientes`

Fecha: 21 de noviembre de 2026. Último commit verificado: `507f3ef`.

Este documento no repite auditorías ya cerradas en sesiones anteriores
(`docs/auditoria-fase3.md`, `docs/auditoria-finalizacion.md`,
`docs/pruebas-finalizacion.md`, `docs/release-candidate-fase5.5.md`, los
`artifacts/xibalba-*` de cada fase). Recoge lo verificado **en esta sesión**
contra la Preview desplegada y contra servicios reales (no mocks), más lo que
sigue pendiente o bloqueado.

## 1. Verificado en esta sesión (con evidencia real, no inferida)

| Área | Resultado | Evidencia |
|---|---|---|
| App Check en Preview (`appCheck/recaptcha-error`) | **Corregido.** El dominio de Preview faltaba en la clave reCAPTCHA Enterprise `xibalba-firebase-2026-vercel` (Google Cloud Console). Se añadió conservando el dominio de producción | `exchangeRecaptchaEnterpriseToken` → HTTP 200 real contra la Preview reconstruida |
| Gemini en la nube (Firebase AI Logic) | **Confirmado real**, no solo on-device | Llamada forzando `ONLY_IN_CLOUD` (commit `911e224`) respondida por `firebasevertexai.googleapis.com` en la Preview |
| Análisis de imagen real (OCR + IA + veredicto) | **Corregido y verificado.** La CSP bloqueaba `data:` en `connect-src`, lo que rompía la conversión de imágenes para el modelo on-device de Firebase AI Logic (`Failed to fetch`) | Captura de WhatsApp en español (fraude bancario): OCR vía IA reconoció el texto completo, veredicto **Rojo · no continúes**, 13 señales deterministas. Captura de conversación amistosa: **Gris · información insuficiente**, nunca marcada como fraude |
| IA real nunca rebaja un veredicto determinista alto | **Confirmado con servicios reales**, no con mocks | `tests/e2e/cloud-ai.spec.ts` contra App Check (debug) + Gemini real: veredicto rojo real y retrato "seguridad" (verde) real, 2/2 |
| Traducciones ES/EN de resultados dinámicos | **Corregido** (commit `01887fe`, sesión previa) y reverificado | `tests/i18n.test.mjs`: listas de señales/pendientes del veredicto y de la mesa de investigación se traducen, no solo la plantilla |
| Suite unitaria | 220/220 | `node --test` |
| Suite E2E principal (determinista, sin red externa) | 29/31, 2 omitidas por diseño (dependen de nube real; ver fila de arriba, donde sí se ejecutaron por separado) | `npx playwright test` |
| Accesibilidad (axe-core) | 0 violaciones en inicio, laboratorio (vacío y con resultado), historial/mapa/agentes/privacidad, y en 375px | `tests/e2e/a11y.spec.ts`, 4/4 |
| Responsive | 360, 390, 430, 768, 1024, 1440px sin desbordamiento horizontal | `tests/e2e/xibalba.spec.ts` prueba 5, `tests/e2e/phase2.spec.ts` |
| Historial (filtro y búsqueda) | OK | `tests/e2e/xibalba.spec.ts` prueba 11 |
| Mapa de investigaciones (solo correlaciona con motivo real) | OK | `tests/e2e/xibalba.spec.ts` prueba 12 |
| Los 5 agentes (actividad progresiva, no solo al final) | OK | `tests/e2e/xibalba.spec.ts` prueba 6 y 10 |
| Retrato del Guardián (reposo/alerta reales) | OK | `tests/e2e/guardian-portrait.spec.ts` |
| TypeScript estricto | Limpio | `npx tsc --noEmit` |
| Dependencias (`npm audit`) | 4 altas reportadas en `@grpc/grpc-js`, transitiva de `@firebase/firestore` | **No explotable aquí**: 0 referencias a `grpc-js` en el bundle de navegador (`.next/static/chunks`) — ese paquete solo corre en Node/Admin SDK, nunca en el cliente. Firestore además no se usa (`lib/firebase.ts`: `getFirestore()` se inicializa pero ninguna regla permite acceso) |
| Secretos en el repositorio | Ninguno encontrado | `.env*` ignorado salvo `.env.example`; búsqueda de patrones de claves (`AIza…`, `sk-…`, bloques `PRIVATE KEY`) sin resultados en el árbol versionado |
| Rendimiento (tamaño de carga) | Sin regresión | Build de producción: página `/` 151 kB, First Load JS 272 kB (consistente con la línea base histórica; el SDK de Firebase sigue cargado de forma diferida) |

## 2. Corregido en esta sesión (commits en `finalizacion/app-check-y-pendientes`)

1. `911e224` — Verificación forzada `ONLY_IN_CLOUD` para distinguir inferencia real en la nube de la ruta on-device.
2. `7a5500d` — `data:` añadido a `connect-src` (CSP): desbloquea el análisis de imágenes con el modelo cuando el OCR local no basta.
3. `507f3ef` — Timeout realista en `cloud-ai.spec.ts` para no fallar por una carrera de tiempos contra un servicio real.

Y, en la configuración externa (Google Cloud Console, fuera del repositorio):
dominio de Preview añadido a la clave reCAPTCHA Enterprise existente, sin
crear claves nuevas, sin desactivar App Check ni la protección de dominios.

## 3. Pendiente (no bloquea el lanzamiento de la Preview, documentado para decidir)

Tomado de `docs/pendientes-hackathon.md` §4, sigue abierto y no se repitió su
auditoría aquí porque nada de esta sesión lo tocó:

- CSP con nonce por petición (hoy `'unsafe-inline'` en `script-src`, con el
  resto de la política como lista cerrada).
- Protección contra reenvío de tokens de App Check (requiere Admin SDK).
- Límite de solicitudes distribuido (hoy en memoria, por instancia).
- Historial en la nube por usuario (requiere Firebase Authentication).
- WHOIS `.mx` y DNS/RDAP públicos (implementados, deshabilitados a propósito).
- No hay `lint` instalado; la comprobación estática es `tsc --noEmit` estricto.

## 4. Bloqueado

Nada bloquea la Preview a día de hoy. Lo único que sigue dependiendo de una
decisión del dueño del proyecto, no de un agente:

- Fijar `release/xibalba-2026` como rama de producción en Vercel (pendiente
  desde `docs/pendientes-hackathon.md`, sin cambios esta sesión).
- Revisar la licencia del logo antes de publicar el repositorio en abierto.
- Decidir si se habilitan DNS/RDAP públicos (consumo de cuota externa).

## 5. Estado de candidata a lanzamiento

La rama `finalizacion/app-check-y-pendientes` está, a `507f3ef`, en estado
verificable para convertirse en candidata: build limpio, suites unitaria y
E2E en verde (incluidas las que dependen de servicios reales), sin
regresiones de accesibilidad ni de responsive, y con los tres defectos reales
reportados por la persona usuaria (Error 2 y Error 3 del encargo original)
corregidos y verificados contra la Preview desplegada, no solo en local.

**No se hizo merge a `release/xibalba-2026` ni ningún despliegue a
producción**: esa decisión y su autorización quedan para la persona dueña del
proyecto.
