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

---

## 6. Auditoría final de lanzamiento controlado (21 de noviembre de 2026, sesión posterior)

Continuación directa desde `8124966`. No se repite nada de las secciones 1-5;
esto es lo nuevo verificado hoy.

### 6.1 Pruebas

- 220/220 unitarias (`node --test`).
- 29/31 Playwright principal, 2 omitidas por diseño + **2/2** de
  `cloud-ai.spec.ts` corridas aparte contra servicios reales: sin regresiones.

### 6.2 App Check y Gemini en el dominio de producción — **HALLAZGO BLOQUEANTE**

Se probó `https://xibalba-firebase-2026.vercel.app` (alias de producción,
despliegue actual, sin modificarlo), con dos navegadores distintos (el panel
integrado y Chrome real de la persona usuaria, para descartar que fuera un
bloqueo anti-bot específico de automatización):

- El dominio **sí** está correctamente autorizado en la clave reCAPTCHA
  Enterprise `xibalba-firebase-2026-vercel` (confirmado en Google Cloud
  Console: `xibalba-firebase-2026.vercel.app` aparece en su lista de dominios).
- Aun así, el intercambio de App Check falla con **HTTP 400** en ambos
  navegadores: `@firebase/app-check: AppCheck: 400 error`
  (`appCheck/initial-throttle` tras el primer rechazo).
- La URL real de la llamada fallida es reveladora:
  `https://content-firebaseappcheck.googleapis.com/v1/projects/%EF%BB%BFxibalba-ai-2026/apps/%EF%BB%BF1:955339811744:…`
  — `%EF%BB%BF` es el BOM UTF-8 (U+FEFF), y aparece **dos veces**: antes del ID
  del proyecto y antes del ID de la app de Firebase. Esa marca invisible hace
  que la URL no coincida con el proyecto/app reales, y el backend de App
  Check la rechaza.
- Esto **no ocurre** por el código de la aplicación (que solo interpola las
  variables de entorno sin tocarlas) ni por la configuración de la clave
  reCAPTCHA. Apunta directamente a que `NEXT_PUBLIC_FIREBASE_PROJECT_ID` y/o
  `NEXT_PUBLIC_FIREBASE_APP_ID`, tal como están guardadas en Vercel para el
  entorno **Production**, llevan un BOM al inicio del valor — típico de pegar
  un valor copiado de un archivo guardado con BOM en Windows.
- No pude confirmar el valor exacto: `vercel env pull` para leerlo fue
  bloqueado por el propio mecanismo de permisos de esta sesión (correcto: es
  una acción que expone variables, y no se intentó evadir). La evidencia de
  la URL (el BOM visible dos veces, en los dos campos que vienen de variables
  de entorno) ya es concluyente por sí sola.
- **Efecto en la persona usuaria real**: con la casilla de consentimiento
  marcada, el veredicto determinista se calcula correctamente (ej. Rojo con
  13→3 señales en la prueba), pero la interpretación de IA queda siempre en
  "No disponible — No se pudo conectar", en producción, ahora mismo.

**Esto contradice la premisa "Gemini ya funciona" para producción**: funciona
verificado en Preview y en local con token de depuración (secciones 1-5), pero
no en el dominio de producción tal como está configurado hoy en Vercel.

**No se tocó Vercel ni Google Cloud Console para corregir esto.** La
corrección propuesta (bajo riesgo, sin costo, sin tocar código ni
reCAPTCHA): volver a introducir `NEXT_PUBLIC_FIREBASE_PROJECT_ID` y
`NEXT_PUBLIC_FIREBASE_APP_ID` en Vercel → Settings → Environment Variables →
Production, pegando el valor sin BOM (verificable localmente con
`Format-Hex` sobre un archivo `.env` exportado, o escribiendo el valor a mano
en vez de pegarlo), y volviendo a desplegar producción para que tome el
valor nuevo. **Se detiene aquí y se consulta**, tal como se indicó: esto
toca configuración de producción y no es algo que deba corregirse sin
autorización explícita.

### 6.3 Reglas de Firebase, restricciones de dominio y CSP

- `firestore.rules` y `storage.rules`: deniegan toda lectura/escritura sin
  excepción — correcto, consistente con que la app no usa Firestore ni
  Storage de verdad.
- Dominios: confirmado en 6.2 que el de producción está en la clave
  reCAPTCHA; el problema no es de restricción de dominio.
- CSP: sigue siendo una lista cerrada (`tests/e2e/csp.spec.ts` la verifica
  byte a byte contra la cabecera real); nada se amplió de forma genérica.

### 6.4 `data:` en `connect-src`: ¿amplía la superficie de ataque?

Evaluado a fondo, con una alternativa real considerada y descartada:

- **Por qué `data:` aquí no es equivalente a abrir un host**: una fuente
  `data:` en `connect-src` solo permite que `fetch`/`XHR` resuelvan URIs cuyo
  contenido ya está embebido en la propia URL (`data:mime;base64,...`). No
  hay ningún servidor al otro lado: el navegador decodifica bytes que ya
  tenía en memoria. Un script malicioso que ya pudiera ejecutar en la página
  (el escenario que `connect-src` intenta limitar) no gana ninguna vía nueva
  de exfiltración con este permiso — exfiltrar datos exige poder hablar con
  un host que los reciba, y `data:` nunca sale del proceso del navegador.
  Es cualitativamente distinto de, por ejemplo, añadir `https://*` o un host
  de terceros.
- **Alternativa más restrictiva evaluada**: cambiar el modo de inferencia de
  `PREFER_ON_DEVICE` a `ONLY_IN_CLOUD` eliminaría por completo la necesidad
  de `data:` (la ruta en la nube no pasa por ese `fetch` interno del SDK).
  Se descartó implementarla en esta auditoría porque es un cambio de
  comportamiento del producto no solicitado (se perdería el beneficio de
  inferencia local en navegadores compatibles) y, de implementarse mal,
  arriesgaría una regresión sobre una ruta ya verificada funcionando en
  Preview — contrario a la instrucción de no repetir ni deshacer trabajo ya
  cerrado. Queda documentada como opción disponible, no aplicada.
- **Conclusión**: no existe una sintaxis de CSP más estrecha que "permitir
  `data:` en `connect-src`" (no se puede acotar por tipo MIME dentro de la
  propia directiva), y el permiso actual no amplía realmente la superficie de
  ataque de exfiltración. Se mantiene sin cambios.

### 6.5 OCR: texto real, baja calidad, archivos no compatibles

- Cobertura existente confirmada (no repetida, solo verificada que sigue
  pasando): `tests/e2e/phase2.spec.ts` (capturas sintéticas SMS/WhatsApp/
  correo con texto real embebido) y `tests/xibalba.spec.ts` prueba 7
  (corrección manual del texto reconocido).
- Archivos no compatibles: `lib/analysis/images.ts::describeImageRejection`
  valida el tipo MIME real del archivo (no solo el atributo `accept` del
  input, que un archivo renombrado podría evadir) y lo rechaza con un
  mensaje explícito antes de procesarlo; cubierto por pruebas unitarias
  220/220 (`una imagen sin OCR...`, `OCR sin API nativa...`).
- Imagen de baja calidad / sin texto reconocible: el propio flujo contempla
  "comprobación pendiente" como resultado válido (nunca inventa texto ni
  fuerza una clasificación), confirmado por la prueba unitaria "una imagen
  sin OCR mantiene una comprobación pendiente".

### 6.6 Privacidad del historial

Revisado `lib/history.ts` línea por línea: el historial solo guarda
resultado (semáforo, nivel, confianza, agentes, conteo de señales) y un
fragmento de texto saneado a 90 caracteres con enmascarado agresivo (todo
dígito en corridas de 4+, correos reducidos a dominio, monederos recortados).
Nunca guarda imágenes ni el contenido completo. Solo se persiste a
`localStorage` si la persona lo autoriza explícitamente; nunca a Firestore
(reglas lo deniegan de cualquier forma). Sin hallazgos nuevos.

### 6.7 Consumo, cuotas y abuso de Gemini

- No existe limitador de solicitudes propio delante de las llamadas a
  Gemini: las llamadas van del navegador directo a Firebase AI Logic (sin
  pasar por un backend propio), así que no hay un punto donde insertar un
  contador del lado del servidor sin construir uno nuevo — fuera del alcance
  de "no agregues funcionalidades nuevas".
- El único freno real hoy es el propio App Check (bloquea dominios y
  clientes no autorizados) más las cuotas que Google aplica por defecto al
  proyecto de Firebase/Vertex AI.
- **Riesgo residual real**: una persona (o un script) podría pulsar
  "Analizar contenido" repetidamente y agotar cuota/generar costo, sin que la
  aplicación lo frene. Recomendación: configurar una alerta de presupuesto
  y, si existe, un tope de cuota diario para la API de Gemini/Vertex AI en el
  propio proyecto de Google Cloud — no lo configuré yo mismo porque toca
  ajustes de facturación, fuera de los permisos concedidos.

### 6.8 Interfaz móvil (Android/iPhone)

- Verificado por emulación: 360, 390, 430, 768, 1024 y 1440px sin
  desbordamiento horizontal (`tests/e2e/xibalba.spec.ts` prueba 5), más
  capturas del Escudo Global y del laboratorio forense en viewport móvil.
- **Lo que de verdad requiere un dispositivo físico** (no se puede verificar
  por emulación, y no se intentó simular): el comportamiento real del teclado
  virtual de iOS/Android sobre los formularios, permisos reales de cámara y
  micrófono en Safari iOS y Chrome Android (la emulación de Playwright no
  replica el flujo real de permisos nativo), rendimiento real de Tesseract.js
  (WASM) en CPUs móviles de gama baja, y si el modelo on-device de Chrome
  (Gemini Nano) existe siquiera en builds móviles de Chrome (hoy es
  característica de escritorio). Esto queda honestamente como pendiente de
  prueba en dispositivo real antes de publicitar la experiencia móvil como
  completamente verificada.

### 6.9 Estrategia de rollback

- Despliegue de producción estable actual (previo a cualquier merge de esta
  rama): `dpl_AHxHbSYryFGhKfMyEFq7odSpsZ4F`, alias
  `https://xibalba-firebase-2026.vercel.app`, creado 2026-11-20 20:12 UTC-6.
- Rollback en Vercel no requiere revertir el merge en git: el panel del
  proyecto (o `vercel rollback <url>`) permite volver a promover ese
  despliegue anterior a producción en segundos si el nuevo merge presenta un
  problema, sin tocar el repositorio.
- Recomendación antes de mergear: anotar el ID del despliegue de producción
  vigente en ese momento (cambiará respecto al de hoy si hay despliegues
  intermedios) inmediatamente antes de promover el nuevo.

### 6.10 Dictamen

**NO-GO por un bloqueo puntual y acotado**: todo lo construido y probado en
esta rama (análisis de imagen, i18n, accesibilidad, CSP, suite completa)
está listo. El único bloqueante real es el hallazgo de 6.2 — App Check y
Gemini no funcionan hoy en el dominio de producción por un valor de entorno
corrupto en Vercel, no por nada de este branch ni de este merge. Corregir
ese valor en Vercel (Production) y volver a verificar con el mismo método de
6.2 convertiría el dictamen en GO. No se tocó Vercel: queda pendiente de tu
autorización explícita, según me pediste.

**Pasos exactos para publicar, en orden:**
1. Autorizar y corregir `NEXT_PUBLIC_FIREBASE_PROJECT_ID` y
   `NEXT_PUBLIC_FIREBASE_APP_ID` en Vercel → Production (sin BOM) y
   redesplegar producción con la configuración actual de `release/xibalba-2026`
   (sin mezclar con esta rama todavía) para confirmar que, por sí solo, ese
   cambio resuelve el 400 de App Check.
2. Repetir la prueba de 6.2 contra ese despliegue corregido: consentimiento
   marcado, mensaje de fraude de prueba, confirmar HTTP 200 en el
   intercambio y una interpretación de IA real (no "No disponible").
3. Revisar y aprobar el PR de integración (ver sección 7) de
   `finalizacion/app-check-y-pendientes` hacia `release/xibalba-2026`.
4. Anotar el ID del despliegue de producción vigente en ese momento (para
   rollback, ver 6.9).
5. Mergear el PR y dejar que Vercel despliegue `release/xibalba-2026`
   actualizado — con autorización tuya explícita en el momento, no antes.
6. Repetir una vez más la prueba de 6.2 contra el nuevo despliegue de
   producción ya con el merge, como verificación final.

## 7. PR de integración

Rama `finalizacion/app-check-y-pendientes` (commit `8124966`) hacia
`release/xibalba-2026`. Abierto como borrador: no se mergea sin tu
autorización explícita.
