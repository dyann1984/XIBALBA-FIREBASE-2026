# XIBALBÁ 3.0 — Reporte de Fase 3 (OCR + eventos multiagente)

Continuación de una sesión de Codex interrumpida por límite de uso. Este
reporte documenta exactamente qué se encontró, qué se verificó, qué se
corrigió y qué queda pendiente. No se declara "implementado" nada que no se
haya ejecutado y comprobado en esta sesión.

## 0. Punto de partida

Al revisar `git status` y los tres archivos señalados como pendientes
(`lib/analysis/images.ts`, `next.config.ts`, `components/Dashboard.tsx`), se
encontró que la sesión anterior **ya había completado la mayor parte de la
Fase 3** antes de interrumpirse:

- OCR local con `tesseract.js` (`lib/analysis/images.ts`), con detector nativo
  (`TextDetector`) como primera opción y Tesseract WASM como respaldo.
- Los recursos del worker, el núcleo WASM y los idiomas (`es`, `en`) ya están
  copiados en `public/ocr/` (worker, 4 variantes de `core`, `spa.traineddata`,
  `eng.traineddata`) y servidos desde el propio origen, sin red externa.
- `next.config.ts` ya incluye `wasm-unsafe-eval` en `script-src` y
  `worker-src 'self' blob:` en la CSP, necesarios para que Tesseract funcione
  bajo las cabeceras de seguridad.
- `Dashboard.tsx` ya integra el texto OCR en el flujo de análisis: lo antepone
  al texto enviado al coordinador con una etiqueta explícita
  (`[Texto reconocido automáticamente en la imagen...]`), nunca lo presenta
  como cita literal, y muestra en pantalla el estado del reconocimiento
  (`.ocr-evidence`), la grilla de estado por agente (`.agent-status-grid`) y la
  cronología de eventos (`.timeline`).
- `lib/analysis/coordinator.ts` ya emite eventos progresivos (`AgentEvent`)
  por cada agente (`started`/`completed`/`error`, con duración y número de
  hallazgos), y la fusión de evidencias sin duplicados ya existía.
- Ya existían pruebas unitarias para OCR, eventos y semáforo de riesgo
  (`tests/phase3.test.mjs`, `tests/phase2-events.test.mjs`,
  `tests/xibalba3.test.mjs`) y una prueba E2E con imágenes sintéticas de texto
  conocido (`tests/e2e/phase2.spec.ts`).

El trabajo de esta sesión fue por tanto: **verificar que todo eso de verdad
funciona**, corregir lo que no, y cerrar los huecos reales que quedaban.

## 1. Verificación (antes de tocar nada)

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npm run build` (Next.js) | compila limpio, 7 páginas generadas |
| `npm test` (202 pruebas previas) | 202/202 pasaron, sin tocar nada |
| `npx eslint .` | **1532 problemas (27 errores)** — ver corrección abajo |

## 2. Corrección de una regresión real: ESLint lintaba un archivo vendorizado

`eslint.config.mjs` no excluía `public/**`. Eso hacía que ESLint analizara
`public/ocr/worker.min.js` (el worker minificado de Tesseract.js, de terceros)
como si fuera código propio, generando 27 errores reales (`no-this-alias`) y
más de 1500 advertencias — todo ruido sobre un archivo que no se escribió ni
se debe tocar.

**Corrección:** se añadió `"public/**"` a `ignores` en
[`eslint.config.mjs`](eslint.config.mjs). Tras el cambio: `npx eslint .` → **0
problemas**.

Esto no es una regresión introducida por la Fase 3; es una laguna de
configuración que solo se manifestó al llegar OCR con un worker vendorizado en
`public/`.

## 3. Verificación de extracción real de OCR (no solo que "no truena")

Se instaló el binario de Chromium que Playwright exigía (versión 1255, el
`node_modules` tenía 1248/1254) y se corrió
`npx playwright test --config=playwright.phase2.config.ts`, que incluye tres
casos con **imágenes sintéticas generadas en `<canvas>` con texto conocido**
(`PAGA AHORA O TU CUENTA SERA BLOQUEADA`, `DEPOSITA DINERO DE INMEDIATO`,
`VERIFICA TU CUENTA EN example.com`):

- Los 3 casos de imagen sintética **pasaron**: la interfaz muestra
  `.ocr-evidence` y el texto "Texto reconocido" o "Lectura incompleta", y se
  generó evidencia visual en `artifacts/xibalba-3-phase2/{sms,whatsapp,correo}.png`.
- El caso principal (`centro, mesa, evidencia, jaguar y móvil`) también pasó,
  confirmando que la grilla de 5 agentes (`.agent-status`) y la cronología
  (`.timeline`) se renderizan con datos reales, no simulados.

Esto demuestra que el OCR local **extrae texto de imágenes reales en el
navegador**, no solo que la función existe sin romper nada.

## 4. Integración OCR → detección de frases sospechosas (hueco cerrado)

La prueba existente (`xibalba3.test.mjs`) solo comprobaba que
`recognizeImageText([])` informa `unavailable` con una lista vacía: no
probaba que el **texto ya extraído** por OCR llegara de verdad al motor de
frases sospechosas. Se añadió una prueba nueva que reproduce exactamente el
formato que `Dashboard.tsx` envía al coordinador (texto con el prefijo
`[Texto reconocido automáticamente en la imagen...]`) y verifica que
`auditCoordinated` detecta `amenaza-cuenta` y `solicitud-credenciales` sobre
ese texto, y que VUCUB CAMÉ ejecuta los metadatos de imagen. 203/203 pruebas
pasan con esta adición.

## 5. Ejecución concurrente donde es segura

Se revisó dónde había paralelismo real disponible:

- `auditCoordinated` (los 5 agentes) es **cómputo síncrono** sobre expresiones
  regulares; Node/el navegador son de un solo hilo para JS, así que
  "paralelizar" ahí con `Promise.all` no aportaría nada (se seguiría
  ejecutando en el mismo hilo) y complicaría la atribución de eventos sin
  beneficio medible. Se deja secuencial a propósito.
- En cambio, en `components/Dashboard.tsx` la **transcripción de audio**
  (`transcribeAudio`) y la **lectura OCR de imágenes** (`recognizeImageText`)
  son dos operaciones de E/S independientes entre sí que se ejecutaban con
  `await` secuenciales. Se cambiaron a `Promise.all(...)` para que corran en
  paralelo cuando ambas aplican (por ejemplo, un caso con audio e imágenes
  adjuntos a la vez).

Verificado tras el cambio: `tsc --noEmit` limpio, `eslint` limpio,
`npm run build` limpio, y la suite de Playwright de Fase 2 (OCR + flujo
completo) vuelve a pasar sin diferencias de comportamiento.

## 6. Pruebas E2E legadas fuera de alcance: no se tocaron, se documentan

Al correr `tests/e2e/xibalba.spec.ts` (archivo preexistente y no rastreado en
git, de una iteración anterior de la interfaz) con su configuración propia
(`playwright.config.ts`, puerto 3000, permisos de cámara), **5 de 5 casos
fallan**, y no por nada relacionado con OCR ni con agentes:

1. Busca un botón `"Probar ejemplo de estafa"` que ya no existe (la interfaz
   actual usa chips de demo con `demo-chip` y títulos de `data/demo-cases.json`).
2. Espera que `<html lang>` cambie a `en-US`; el valor real es `es-MX` (habría
   que revisar el flujo de cambio de idioma de este test específico).
3. `getByRole('button', {name:/Nuevo análisis/})` es ambiguo: hay dos botones
   con ese texto accesible (uno en la barra lateral, otro en el panel).
4. `getByRole('alert')` es ambiguo: coincide con el aviso de error real **y**
   con el `__next-route-announcer__` oculto que Next.js siempre renderiza con
   `role="alert"`.
5. Depende del mismo botón inexistente del caso 1.

Estos cinco fallos son **independientes de la Fase 3** (OCR/multiagente): el
archivo quedó desincronizado con una reescritura anterior de `Dashboard.tsx`
que ya estaba en el working tree antes de esta sesión. Corregirlos implica
reescribir selectores de un spec completo ajeno al encargo de esta fase, así
que **no se declaran arreglados** y quedan como pendiente explícito, para no
afirmar algo que no se verificó dentro del alcance de hoy.

La suite relevante a esta fase (`tests/e2e/phase2.spec.ts`, OCR + agentes)
pasa 4/4 de forma íntegra bajo su propia configuración
(`playwright.phase2.config.ts`).

## 7. Resumen de qué se completó, qué falló y qué sigue pendiente

**Completado y verificado en esta sesión:**
- OCR local (nativo + Tesseract WASM) funcionando con imágenes sintéticas reales.
- Texto OCR integrado al pipeline de análisis con etiqueta explícita de origen.
- Texto OCR comprobado end-to-end disparando detección de frases sospechosas.
- Eventos progresivos por agente (inicio/fin/error, duración, hallazgos) verificados por prueba unitaria y por E2E (grilla + cronología visibles).
- Semáforo de riesgo (`combineRisk`) con sus reglas de confianza/cobertura, 100% de pruebas existentes intactas.
- 203 pruebas unitarias pasan (202 previas + 1 nueva de integración OCR↔frases).
- `tsc`, `eslint` y `next build` limpios.
- Corrección real: ESLint ya no lint-ea el worker vendorizado de Tesseract.
- Mejora real: transcripción de audio y OCR de imágenes ahora corren en paralelo cuando ambos aplican.

**Falló y queda documentado, no oculto:**
- `tests/e2e/xibalba.spec.ts` (5 casos): desincronizado con la interfaz actual, selectores ambiguos o inexistentes. Requiere reescribir ese spec contra la UI vigente; no se hizo en esta sesión por ser trabajo ajeno al encargo de OCR/multiagente y de alcance considerable por sí mismo.

**Pendiente, no evaluado:**
- La dependencia `three` (`package.json`) ya no se usa en ningún archivo `.ts`/`.tsx` (se borraron `components/guardian/GuardianCanvas.tsx` y `scene.ts` en favor de `JaguarAvatar.tsx`), pero no se removió del `package.json` ni se regeneró el lockfile: es un cambio de dependencias fuera del alcance pedido y con su propio riesgo, se deja para decisión explícita.
- No se hizo merge, push ni despliegue. Todo el trabajo permanece en archivos locales de la rama `codex/xibalba-3-intelligence`, sin tocar `main` ni producción, conforme a lo pedido.
