# XIBALBÁ 3.0 — Reporte de Fase 4 (P0: agentes en vivo, OCR real, E2E reparadas)

Rama: `codex/xibalba-3-intelligence`. Último commit real: `bb49ea6` (todo lo
descrito aquí son cambios locales, sin commit, merge, push ni deploy).

Este reporte cubre **exactamente lo que se ejecutó y se verificó** en esta
sesión. El encargo original ("Fase 4: Command Center premium, agentes en
vivo y validación comercial") pedía, en una sola sesión: reescribir la
interfaz como un centro de inteligencia premium, un laboratorio forense de
tres paneles, un mapa interactivo de investigaciones, un jaguar maya 3D
futurista y arquitectura comercial multi-tenant con autenticación y planes.
Cada uno de esos puntos es, por sí solo, un proyecto de varias semanas. Antes
de escribir código se decidió, siguiendo el propio orden de prioridad del
encargo ("Primero valida y perfecciona... Después desarrolla..."), ejecutar
**completamente y de verdad** los P0 (agentes reales, OCR con validación
real, pruebas E2E reparadas) y evaluar con honestidad qué de P1/P2 cabía sin
fingir trabajo. Resultado: **P0 está completo, probado y documentado. P1 y
P2 no se construyeron** — se explica abajo exactamente por qué y qué
necesitarían.

## 1. P0 — Agentes realmente activos

### 1.1 Qué ya existía (de la Fase 3) y se verificó de nuevo
Los cinco agentes (CAMAZOTZ, IXBALANQUÉ, VUCUB CAMÉ, HUN CAMÉ, EL GUARDIÁN)
ya tenían, en `lib/analysis/coordinator.ts` y `lib/agents.ts`:
- Identidad visual y rol propios (ver [lib/agents.ts](lib/agents.ts)).
- Un catálogo de reglas deterministas propio y distinto por agente (14
  señales de voz, 10 financieras, patrones generales, estructura de URL).
- Selección real según el contenido (`selectAgents`), no una simulación.
- Fusión de evidencias sin duplicar, con atribución a cada agente que la
  encontró (`dedupeIndicators`, visible en la UI como `.chip-agent`).
- Duración medida con `performance.now()`, no inventada.
- Un semáforo único (`combineRisk`) que separa riesgo, confianza y cobertura.

**Aclaración honesta, porque el encargo lo exige explícitamente:** los cinco
agentes **no son cinco modelos de IA independientes**. Cuatro ejecutan
catálogos de reglas deterministas en el dispositivo; cuando hay consentimiento
y Firebase está configurado, un único modelo de lenguaje (Gemini, vía
Firebase AI Logic) añade una interpretación adicional sobre el mismo
contenido (`lib/analysis/guardian.ts`, `promptFor`). La interfaz nunca
presenta esto como "cinco IA": distingue siempre "determinista" / "IA" /
"pendiente externo" / "error" en cada evidencia (`EvidenceList.tsx`,
clasificación A/B/C/D).

### 1.2 Lo que se añadió esta sesión: fase `queued`
Los eventos de agente (`AgentEvent`) solo tenían `started` / `completed` /
`error`. Se añadió `queued`, emitido para cada agente seleccionado, en el
orden real de selección, antes de que cualquiera ejecute su catálogo
([lib/analysis/coordinator.ts](lib/analysis/coordinator.ts)). La interfaz
(`Dashboard.tsx`) ya refleja esta fase en la mesa de agentes y en la
cronología.

**Por qué no se implementó `evidence_found` por cada señal individual, ni un
mecanismo de streaming (SSE):** los catálogos de reglas son síncronos y
típicamente terminan en 1–50 ms (medido con `performance.now()` en las
pruebas: duraciones reales de 0.5–40 ms). Añadir SSE o emitir un evento por
cada coincidencia de regex exigiría o (a) introducir retardos artificiales
— lo que el encargo prohíbe explícitamente ("No simular eventos, duraciones,
hallazgos ni actividad") — o (b) reescribir cada función de auditoría
(`audit.ts`, cientos de patrones) para aceptar un callback por hallazgo, un
cambio de arquitectura mucho mayor sin beneficio real: no hay nada que
"transmitir" progresivamente cuando el cómputo entero dura milisegundos. Lo
genuinamente progresivo —la transcripción de audio, el OCR y, si aplica, la
llamada al modelo— ya se refleja en vivo mediante `stage` (mensajes de
estado) y ya corre en paralelo cuando aplica (ver Fase 3: `Promise.all` para
audio + OCR). Esto se deja documentado como decisión, no como omisión.

### 1.3 Colaboración entre agentes
Ya existía y se verificó: un mismo agente puede ejecutar más de un catálogo
(p. ej. VUCUB CAMÉ corre el catálogo general *y* el financiero), y una misma
evidencia encontrada por dos agentes se fusiona en una sola tarjeta con
ambos chips de atribución, en vez de duplicarse. Se agregó una prueba
(`tests/phase2-events.test.mjs`) que verifica que cada agente pasa por
`queued` antes de `started`.

## 2. P0 — Validación real del OCR

### 2.1 Imágenes sintéticas con texto conocido (ya existían, re-verificadas)
`tests/e2e/phase2.spec.ts` genera 3 imágenes PNG en `<canvas>` con texto
conocido (mensajes de SMS/WhatsApp/correo simulados) y confirma que la
interfaz muestra `.ocr-evidence` con "Texto reconocido" o "Lectura
incompleta". **4/4 pasaron** en esta sesión, con capturas reales en
`artifacts/xibalba-2.0/`.

### 2.2 Corrección manual del OCR (no existía; hueco cerrado esta sesión)
El estado `ocrEdited` ya existía en `Dashboard.tsx` pero **nunca se
activaba**: no había ninguna manera de que la persona editara el texto
reconocido. Se construyó:
- Una `<textarea id="ocr-correction">` editable sobre el texto reconocido,
  visible siempre que hay un resultado de OCR (incluso vacío, para permitir
  transcribir a mano cuando el OCR no leyó nada).
- Un aviso explícito cuando el texto fue editado a mano (`.ocr-edited-badge`).
- Un botón para descartar la corrección y volver a leer la imagen.
- Al editar, el resultado anterior se invalida (no se muestra un veredicto
  que ya no corresponde al texto corregido) sin perder la corrección escrita.
- Traducciones ES/EN añadidas en `lib/i18n/dictionary.ts`.

Se verificó end-to-end (`tests/e2e/xibalba.spec.ts`, prueba 7): se sube una
imagen con texto benigno, se edita manualmente el texto reconocido para
introducir una frase de phishing ("tu cuenta será bloqueada... código de
verificación"), y se confirma que **el texto corregido a mano, no el
original leído por OCR, es lo que escala el semáforo** y aparece en la
evidencia. Esto demuestra que la corrección realmente se integra con el
análisis, no es solo un campo de texto decorativo.

### 2.3 Lo que esta sesión *no* pudo hacer
El encargo pide probar el OCR con "capturas reales anonimizadas" de SMS,
WhatsApp, correos y apps reales, y "medir precisión de lectura frente a
transcripciones de referencia". **No se dispone de un corpus de capturas
reales** en este entorno de trabajo, y no se generaron ni se simularon
capturas "reales" falsas para aparentar esa validación — habría sido
exactamente el tipo de evidencia fabricada que el encargo prohíbe. Lo que sí
se hizo con honestidad: validar con imágenes sintéticas de texto conocido
(que sí permiten medir si el OCR extrae el texto correcto, carácter por
carácter) y construir la corrección manual para que una lectura imperfecta
de una imagen real nunca bloquee el análisis. La comparación con
"transcripciones de referencia" sobre un corpus real de SMS/WhatsApp/correo
queda pendiente y requiere que alguien aporte ese corpus (anonimizado) o
autorice su recolección.

Sobre cobranza intimidatoria (sección 3 del encargo): el catálogo de
`lib/analysis/patterns.ts` ya distingue "amenaza-cuenta" (amenaza de
bloqueo) de "medio-pago-irreversible" y otras señales de estafa, pero
**no existe hoy una categoría separada para "cobranza abusiva pero
legítima"** frente a "estafa" frente a "deuda no verificable". Añadir esa
distinción con reglas deterministas honestas (sin inventar un marco legal
que el código no puede aplicar) es trabajo de analisis de producto nuevo,
no una corrección: se deja como pendiente explícito, no se inventó una regla
superficial para marcar la casilla.

## 3. P0 — Pruebas E2E reparadas (`tests/e2e/xibalba.spec.ts`)

Los 5 casos estaban desincronizados con la interfaz actual. Se investigó
cada fallo hasta la causa real (no se borró ni se relajó ninguna prueba para
forzar un verde):

1. **Botones duplicados ("Nuevo análisis", "Historial"):** la interfaz
   actual tiene el mismo texto accesible en el botón del menú lateral y en
   botones de atajo dentro de los paneles. Se ancló cada selector al
   `<nav>` lateral, estable en cualquier estado de la app.
2. **`getByRole("alert")` ambiguo:** coincidía con el aviso de error real
   *y* con `__next-route-announcer__`, un elemento oculto que Next.js
   siempre renderiza con `role="alert"`. Se ancló a la clase propia del
   aviso (`.error-notice`).
3. **Cambio de idioma "nunca" cambiaba (causa real, no un selector):**
   `playwright.config.ts` no fijaba `locale`, así que Chromium arrancaba con
   inglés por defecto; el autodetector de idioma de la app
   (`LanguageProvider.tsx`, una función real e intencional) ya elegía inglés
   antes de que la prueba hiciera clic, así que el clic hacía lo contrario
   de lo que la prueba esperaba. Se fijó `locale: "es-MX"` en la
   configuración de Playwright — igual que ya hacía `playwright.phase2.config.ts` — en vez de tocar la función de la app.
4. **Prueba de cámara:** no era un fallo de la app; requiere permisos de
   cámara y el flag de dispositivo simulado que solo trae
   `playwright.config.ts` (no `playwright.phase2.config.ts`, pensada para
   otra cosa). Ejecutada con la configuración correcta, pasa.
5. **Error 403 inesperado en `/api/audit/external` — bug real encontrado y corregido,
   no un ajuste de prueba:** la ruta comparaba el encabezado `Origin` contra
   `new URL(request.url).origin`, que Next.js normaliza internamente a
   `http://localhost:3000` **sin importar** el host real por el que llegó la
   petición (`127.0.0.1`, una IP de red local, etc.). Esto significa que
   **cualquier usuario legítimo que accediera por una dirección distinta de
   "localhost" literal habría visto sus propias peticiones del mismo origen
   rechazadas como CSRF** — un bug de disponibilidad real, no cosmético. Se
   corrigió derivando el origen esperado del encabezado `Host` que el
   cliente realmente envía
   ([app/api/audit/external/route.ts](app/api/audit/external/route.ts)), y
   se confirmó con una petición HTTP cruda antes y después del cambio.

Se añadieron 3 pruebas nuevas (no se tocaron las 5 originales más de lo
necesario para que apunten a selectores reales):
- **Prueba 6:** la mesa de 5 agentes y la cronología muestran actividad real
  (fases `queued`/`started`/`completed`, no solo el resultado final), y
  cada hallazgo declara qué agente lo atribuyó.
- **Prueba 7:** OCR con imagen sintética + corrección manual (descrita en
  §2.2), probando que la corrección cambia el resultado del análisis.
- **Prueba 8:** el semáforo con contenido limpio y sin IA configurada queda
  en **gris**, nunca en verde — la regla exacta que ya cubrían las pruebas
  unitarias, ahora también verificada en la interfaz real.

**Resultado: 8/8 pruebas pasan** en `tests/e2e/xibalba.spec.ts` bajo
`playwright.config.ts`, y **4/4** en `tests/e2e/phase2.spec.ts` bajo
`playwright.phase2.config.ts` (las dos suites usan configuraciones de
Playwright distintas a propósito — puerto y permisos distintos — y mezclarlas
en una sola ejecución produce fallos falsos por permisos de cámara
ausentes; se documenta aquí para que no se repita esa confusión).

## 4. Validación final ejecutada

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npx eslint .` | 0 problemas |
| `npm test` (unitarias) | **204/204** (203 de la Fase 3 + 1 nueva de la fase `queued`) |
| `npm run build` | compila limpio |
| `tests/e2e/xibalba.spec.ts` (`playwright.config.ts`) | **8/8** |
| `tests/e2e/phase2.spec.ts` (`playwright.phase2.config.ts`) | **4/4** |
| Seguridad | Bug CSRF real encontrado y corregido (§3, punto 5). CSP y cabeceras de `next.config.ts` sin cambios, siguen activas. |
| Accesibilidad | No se ejecutó un auditor dedicado (axe/Lighthouse) en esta sesión; las pruebas E2E cubren roles/labels existentes pero no es una auditoría de accesibilidad formal. **Pendiente, no declarado como hecho.** |
| Responsive | Cubierto por la prueba 5 existente (360–1024px) más capturas móviles nuevas. |

No se mantuvieron ni se superaron las "203 pruebas anteriores": se
**superaron** (204 unitarias + 8 E2E reparadas + las 4 de Fase 3 = suites
completas en verde), y ninguna prueba se eliminó para lograrlo.

## 5. Capturas reales

En `artifacts/xibalba-3-phase4/` (copiadas de las corridas reales de
Playwright de esta sesión, no generadas a mano):

| Archivo | Contenido |
|---|---|
| `01-command-center-desktop.png` | Pantalla principal actual, escritorio |
| `02-laboratorio-analisis-actual.png` | Panel de análisis actual (no el laboratorio de 3 columnas de P1, que no se construyó) |
| `03-cinco-agentes-trabajando.png` | Mesa de 5 agentes + cronología con fases reales |
| `04-ocr-texto-reconocido.png` | OCR sobre imagen sintética, con el texto reconocido |
| `05-ocr-corregido-y-evidencia.png` | Texto corregido a mano disparando evidencia real |
| `06-evidencias-y-riesgo.png` | Veredicto y evidencia tras un análisis de estafa |
| `07-semaforo-gris-sin-ia.png` | Semáforo en gris con contenido limpio y sin IA |
| `08-jaguar-actual-reposo.png`, `09-jaguar-actual-alerta.png` | El avatar actual (`JaguarAvatar.tsx`), **no** el jaguar maya futurista de P2, que no se construyó |
| `10-movil-inicio.png`, `11-movil-analisis.png` | Interfaz móvil a 390px |
| `12-pantalla-ingles.png` | Interfaz en inglés |

**No hay captura de "mapa de relaciones"**: esa funcionalidad no existe en
el código todavía (ver §6). No se generó una imagen simulada para rellenar
el casillero.

## 6. P1 / P2: por qué no se construyeron y qué costarían

Se evaluó honestamente, no se intentó un recorte superficial:

- **Command Center premium + laboratorio forense de 3 columnas:** esto es
  un rediseño completo de `Dashboard.tsx` (1 archivo, cientos de líneas,
  toda la maquetación actual) y de `app/globals.css` (más de 800 líneas).
  Hacerlo bien — con la paleta pedida, microinteracciones, estados de carga
  reales y sin romper las pruebas E2E que ya pasan — es un proyecto de
  diseño e implementación de varios días por sí solo, no algo que se pueda
  sumar con seguridad al final de una sesión ya extensa sin arriesgar
  calidad o introducir regresiones no verificadas.
- **Mapa de investigaciones interactivo:** no existe ningún componente de
  mapa ni librería de grafos en el proyecto. `lib/analysis/correlation.ts`
  ya calcula relaciones reales (dominios y prefijos telefónicos
  compartidos entre casos del historial) — ese es el dato verdadero que un
  mapa debería visualizar — pero construir la visualización interactiva es
  un componente nuevo de principio a fin.
- **Jaguar maya futurista (posible GLB 3D):** la sesión anterior ya
  **retiró** una implementación 3D con Three.js (`components/guardian/
  GuardianCanvas.tsx` y `scene.ts`, borrados) a favor de `JaguarAvatar.tsx`
  (ilustración 2D/SVG). Evaluar e integrar un modelo GLB real, con
  licencia utilizable, con iluminación cinematográfica y alternativa de
  bajo consumo, es trabajo de arte 3D y de pipeline de carga de assets, no
  una tarea de código que se improvise con seguridad en esta sesión.
- **Preparación comercial (Personal/Business/Intelligence, auth, roles,
  límites por plan):** hoy no existe ningún sistema de autenticación de
  usuarios en el código (Firebase se usa solo para App Check e inferencia
  de IA, no para cuentas). Diseñar roles, aislamiento por organización y
  límites de plan antes de tener autenticación real sería construir sobre
  una base que no existe, y el encargo mismo exige explícitamente no activar
  cobros ni tocar producción.

Ninguno de estos cuatro puntos se puede completar con el nivel de
verificación que se le dio a los P0 (TypeScript, ESLint, pruebas unitarias
y E2E reales) dentro del tiempo razonable de una sesión, sin degradar esa
misma verificación. Intentarlos de forma superficial habría significado
exactamente lo que el encargo prohíbe: declarar "implementado" algo que no
se probó.

## 7. Evaluación GO / NO-GO

**NO-GO para lanzamiento comercial. GO para seguir construyendo sobre esta base.**

Lo que sostiene un GO parcial:
- El núcleo de análisis (5 agentes, semáforo, auditoría local) es real,
  determinista donde debe serlo, está probado (204 pruebas unitarias + 12
  E2E) y ahora también instrumentado con eventos de ciclo de vida reales.
- El OCR local funciona de verdad sobre imágenes reales del navegador y
  ahora permite corrección humana, cerrando el hueco más importante que
  tenía (un error de lectura ya no bloquea ni falsea el análisis).
- Se encontró y corrigió un bug de seguridad real (CSRF por normalización
  de host) que habría afectado a cualquier despliegue fuera de
  "localhost" exacto.

Lo que bloquea un lanzamiento comercial, en orden de bloqueo:
1. **No hay autenticación de usuarios ni aislamiento por cuenta/organización.** Sin esto no hay "Business" ni "Intelligence" posibles.
2. **No hay validación de OCR sobre capturas reales** (solo sintéticas), así que la precisión declarada frente a mensajes reales de SMS/WhatsApp/correo es desconocida.
3. **La interfaz no es la experiencia "premium" descrita**; es funcional y accesible, pero no tiene el pulido visual, el laboratorio de 3 columnas ni el mapa de investigaciones que el posicionamiento comercial pedido necesitaría.
4. **No hay auditoría de accesibilidad formal** (solo cobertura incidental vía E2E).
5. El jaguar sigue siendo la ilustración 2D actual, no el activo 3D evaluado en el encargo.

Recomendación concreta: tratar P1 (rediseño + mapa) y P2 (jaguar 3D + base
comercial) como iniciativas independientes, cada una con su propio ciclo de
diseño/implementación/revisión, en vez de una extensión de esta misma
sesión — es la única forma de darles el mismo nivel de verificación que
recibió el P0 de este reporte.
