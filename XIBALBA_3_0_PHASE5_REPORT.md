# XIBALBÁ 3.0 — Reporte de Fase 5 (Command Center premium y Laboratorio Forense)

Rama de esta fase: `codex/xibalba-3-phase5-command-center`, creada a partir
del commit `b1b0c00` ("Fases 2-4: OCR local, agentes instrumentados,
correlación, reportes y E2E reparadas") en `codex/xibalba-3-intelligence`,
que quedó committeado al inicio de esta sesión para no perder ese trabajo
antes de abrir la rama nueva. Todo lo descrito aquí son cambios locales en
esta rama; **no se hizo merge, push ni deploy**.

## 0. Qué pedía esta fase y qué se decidió hacer

El encargo original pedía, en una sola sesión, un rediseño visual completo
("premium, futurista, cinematográfico"), un laboratorio forense de tres
áreas, un centro de operaciones de agentes, integración mejorada del jaguar,
navegación con búsqueda e indicadores de carga, validación responsive en 6
anchos y pruebas nuevas — todo sin tocar el motor de riesgo ni eliminar
agentes. Se ejecutó todo lo anterior **excepto** la parte que el propio
encargo marca como "no todavía": la reconstrucción 3D del jaguar y el
sistema comercial, que quedan fuera de alcance por diseño del propio pedido,
y el mapa de investigaciones, que no estaba en el encargo de esta fase (sí
en el de la Fase 4, donde ya se documentó por qué no se construyó: no existe
ningún componente de grafos en el proyecto).

## 1. Archivos modificados o creados

**Nuevos:**
- [components/AgentOperationsBoard.tsx](components/AgentOperationsBoard.tsx) — centro de operaciones de los 5 agentes.
- `artifacts/xibalba-3-phase5/` — capturas reales de esta fase.

**Modificados:**
- [components/Dashboard.tsx](components/Dashboard.tsx) — Command Center con métricas reales, laboratorio de 3 áreas con pestañas móviles, búsqueda/filtro de historial, insignia de actividad por agente.
- [components/Guardian.tsx](components/Guardian.tsx) — marco premium ("jaguar-frame") alrededor del avatar existente.
- [app/globals.css](app/globals.css) — nueva capa aditiva "Fase 5" (ver §3): tokens jade/obsidiana, Command Center, laboratorio, tablero de agentes, encuadre del jaguar, búsqueda de historial.
- [playwright.config.ts](playwright.config.ts) — puerto dedicado y `reuseExistingServer: false` (ver §5, hallazgo real).
- [tests/e2e/xibalba.spec.ts](tests/e2e/xibalba.spec.ts) — 3 pruebas nuevas (9, 10, 11) y el ancho 1440px añadido a la prueba 5.
- [tests/e2e/phase2.spec.ts](tests/e2e/phase2.spec.ts) — 1 aserción corregida (ver §5).

**Conservado sin tocar, como pedía el encargo:** `lib/analysis/risk.ts`,
`lib/analysis/coordinator.ts` y el resto del motor de riesgo/agentes no se
modificaron en esta fase; los 5 agentes siguen siendo los mismos, con los
mismos nombres e identidades.

## 2. Mejoras visuales y componentes nuevos

### 2.1 Command Center (pantalla "Panel principal")
Se añadió una fila de 4 tarjetas de estado real, derivadas de datos que ya
existían en el componente (nunca inventadas):
- **OCR**: detector nativo del navegador (`TextDetector`) vs. WASM local
  (Tesseract), por `navigator`/`window`, no una constante fija.
- **Inferencia de IA**: estado local (`localAvailability()`, ya existente) +
  si Firebase/App Check están configurados.
- **Resumen de incidentes**: conteo real por color de semáforo sobre el
  historial de la sesión, con una barra proporcional construida en CSS puro
  (sin librería de gráficos).
- **Acceso al laboratorio**: enlace directo a "Nuevo análisis".

Cuando hay incidentes de riesgo alto en el historial reciente, aparece una
alerta (`role="alert"`) con el conteo real y un enlace a revisarlos; no
aparece si no los hay.

Las tarjetas de agente de la portada ahora muestran, cuando aplica, cuántas
veces participó ese agente en los análisis de la sesión (contado desde
`history`, el mismo dato que ya se guardaba).

### 2.2 Laboratorio forense de tres áreas
La pantalla de análisis se reorganizó en A (Evidencia) / B (Investigación) /
C (Evaluación):
- **A — Evidencia**: el formulario de entrada (tipo de contenido, texto,
  imágenes, audio) **más el bloque de OCR con su corrección manual**, que
  antes vivía mezclado dentro del panel de investigación y ahora está donde
  conceptualmente pertenece — junto al resto de la evidencia de entrada.
- **B — Investigación**: el tablero de operaciones de los 5 agentes (§2.3),
  la mesa de estado por agente, la cronología de eventos y el desglose de
  hallazgos por agente. Todo esto ya existía desde la Fase 3/4; aquí se
  agrupó visualmente como su propia área.
- **C — Evaluación**: semáforo, correlación, exportación, razones por
  agente y la lista de evidencia A/B/C/D — también ya existente, ahora en su
  propia columna.

En escritorio (≥1100px) las tres columnas se ven a la vez. En tableta
(701–1099px) se apilan verticalmente, todas visibles — hay espacio de sobra
y ocultar contenido no aportaba nada. En móvil (≤700px) solo un área es
visible a la vez, elegida con pestañas (`role="tab"`); la app cambia de
pestaña automáticamente según el progreso real del análisis (a
"Investigación" al empezar, a "Evaluación" al terminar, de vuelta a
"Evidencia" si hay un error), pero la persona puede cambiarla a mano en
cualquier momento.

### 2.3 Centro de operaciones de los 5 agentes
Componente nuevo (`AgentOperationsBoard.tsx`): EL GUARDIÁN al centro, los
cuatro especialistas alrededor, dibujado en SVG puro (sin librería de
diagramas). **Las líneas que conectan a un especialista con EL GUARDIÁN
solo existen si ese agente de verdad participó** en el análisis en curso —
ni una conexión fija ni una "red" decorativa. Verificado con una prueba E2E
dedicada (prueba 10): un mensaje sin dinero, llamada ni enlaces solo activa
a IXBALANQUÉ, y las otras tres líneas simplemente no se dibujan.

Los nodos reflejan la fase real del evento más reciente de ese agente
(`queued` / `started` / `completed` / `error`, los mismos que ya emitía
`coordinator.ts` desde la Fase 4), así que el tablero no es una animación de
relleno: si un agente no participó, su nodo queda atenuado y lo dice
("No participó" / "Did not participate").

### 2.4 Encuadre premium del jaguar
El avatar SVG 2.5D existente (`JaguarAvatar.tsx`, de una fase anterior) no
se tocó ni se reconstruyó en 3D — así lo pedía explícitamente el encargo
("No realizar todavía una reconstrucción 3D completa"). Se le añadió un
marco (`jaguar-frame`) con un borde degradado jade/turquesa/oro que cambia
de tono según el semáforo, una insignia "GUARDIÁN" y un halo de luz
ambiental, para que se vea integrado al resto del tablero del laboratorio en
vez de flotar sobre el fondo del panel.

### 2.5 Navegación, búsqueda e historial
- **Búsqueda y filtro de historial**, que no existía: un campo de texto que
  busca sobre la vista previa, los agentes y las señales ya guardadas
  (nunca sobre contenido no conservado), más chips de filtro por color de
  semáforo. Un estado vacío explícito ("Ningún elemento del historial
  coincide con este filtro") quita la ambigüedad entre "sin resultados por
  el filtro" y "sin historial".
- Los estados de carga, error y vacíos ya existentes (`.notice`,
  `.error-notice`, `.empty-row`) no se reconstruyeron: ya cumplían su
  función y el encargo pide no eliminar funcionalidad existente para
  simplificar el diseño.
- El inicio ya permitía analizar desde cualquier pantalla relevante (barra
  lateral siempre visible + análisis rápido en el inicio); no se encontró
  necesidad de añadir más puntos de entrada.

## 3. Paleta y dirección de arte

Se añadieron `--jade` (acento verde técnico) y `--obsidiana` como variables
nuevas, usadas en los componentes de esta fase (Command Center, laboratorio,
tablero de agentes, buscador de historial) junto al turquesa y el oro que
ya existían desde la capa de dirección de arte de una fase anterior
(`app/globals.css`, sección "XIBALBÁ 2.0 · capa de dirección de arte").

**Con honestidad sobre el alcance:** esto es una capa **aditiva** sobre un
sistema de diseño que ya era sólido (fondos en degradado, paneles con
elevación, animaciones de entrada que respetan `prefers-reduced-motion`,
motivos mayas discretos) — no una reconstrucción de las ~850 líneas de CSS
existentes. Reescribir superficies ya resueltas (como el propio semáforo o
las tarjetas de evidencia, que ya se ven bien) sin una revisión visual
humana habría sido arriesgar una regresión estética para ganar muy poco; en
su lugar, el acento jade se introdujo específicamente en los componentes
nuevos de esta fase, donde sí aporta una identidad propia frente al
turquesa ya existente.

## 4. Rendimiento y calidad

- **Sin dependencias nuevas**: el tablero de agentes es SVG en línea, las
  barras del resumen de incidentes son `<div>` con `flex-grow` por CSS, sin
  ninguna librería de gráficos o diagramas.
- Tamaño del bundle de la portada: 138 kB → 140 kB (First Load JS), un
  incremento marginal por el componente nuevo; sin paquetes añadidos a
  `package.json`.
- `prefers-reduced-motion`: las líneas animadas del tablero de agentes
  (`ops-link-started`) respetan la preferencia ya existente en el proyecto;
  se verificó explícitamente en el CSS nuevo, no se asumió.
- Las tres áreas del laboratorio permanecen montadas en móvil (solo se
  ocultan con `display:none` según la pestaña activa) para que cambiar de
  pestaña no vuelva a disparar peticiones ni pierda el estado de los
  formularios.

## 5. Dos hallazgos reales durante la verificación (no cosméticos)

1. **Colisión de puerto real durante las pruebas E2E.** Al ejecutar la
   batería completa, 8 de 11 pruebas fallaron con el mismo timeout en el
   primer clic. La inspección del snapshot de Playwright mostró que
   `http://127.0.0.1:3000` estaba sirviendo **otra aplicación completamente
   distinta** ("OLYMPUS · Centro de mando"), no XIBALBÁ — un servidor de
   otro proyecto en esta misma máquina que ocupó el puerto 3000 durante una
   sesión de depuración anterior. `playwright.config.ts` tenía
   `reuseExistingServer: true`, que **no comprueba qué aplicación hay detrás
   del puerto** antes de reutilizarlo. Corregido: la Fase 5 corre en el
   puerto 3099 (variable `PORT` pasada por `env`, no por el comando, para
   que funcione igual en Windows y en POSIX) con `reuseExistingServer:
   false`, de modo que un futuro choque de puertos **falle ruidosamente en
   vez de ejecutar las pruebas contra la aplicación equivocada en
   silencio**. No se tocó el proceso ajeno que ocupaba el 3000.
2. **Un `.ocr-evidence` que se movió de área rompía una aserción de la Fase
   4** (`tests/e2e/phase2.spec.ts`): buscaba el texto reconocido dentro de
   `.investigation` (Área B), que es donde vivía antes de este rediseño.
   Ahora que el OCR vive en el Área A, se corrigió la aserción para apuntar
   a `.ocr-evidence` directamente — un ajuste de prueba legítimo por un
   cambio de estructura intencional, no una ocultación de una regresión.

## 6. Pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npx eslint .` | 0 problemas |
| `npm test` (unitarias) | **204/204** (sin cambios: esta fase es solo interfaz) |
| `npm run build` | compila limpio |
| `tests/e2e/xibalba.spec.ts` (`playwright.config.ts`, puerto 3099) | **11/11** (8 anteriores + 3 nuevas: laboratorio por pestañas, tablero de agentes real, búsqueda/filtro de historial) |
| `tests/e2e/phase2.spec.ts` (`playwright.phase2.config.ts`, puerto 3102) | **4/4** |
| Responsive | 360 / 390 / 430 / 768 / 1024 / 1440 px, sin desbordamiento horizontal (prueba 5, ancho 1440 añadido esta fase) |
| Accesibilidad básica | Pestañas con `role="tab"`/`aria-selected`, tablero de agentes con `role="img"` y texto descriptivo, alerta de incidentes con `role="alert"`; no se ejecutó un auditor dedicado (axe/Lighthouse) — **pendiente, no declarado como hecho**. |

No se eliminó ninguna prueba para conseguir un resultado en verde: las dos
fallas reales que aparecieron (arriba) se diagnosticaron hasta la causa y se
corrigieron.

## 7. Capturas reales

En `artifacts/xibalba-3-phase5/`, generadas por las propias pruebas de
Playwright de esta sesión (no mockups):

| Archivo | Contenido |
|---|---|
| `01-command-center.png` | Portada con las 4 tarjetas de estado real |
| `02-mesa-cinco-agentes.png` | Mesa de agentes con cronología, tras un análisis real |
| `02b-centro-operaciones-agentes.png` | Laboratorio completo con el tablero EL GUARDIÁN + especialistas |
| `03-laboratorio-forense.png` | Las tres áreas del laboratorio, panel de análisis vacío |
| `04-ocr-evidencia.png` / `04b-ocr-correccion-manual.png` | OCR reconocido y corrección manual disparando evidencia |
| `05-resultado-riesgo.png` / `05b-semaforo-gris.png` | Semáforo rojo (estafa) y gris (sin IA) |
| `06-historial-filtro.png` | Búsqueda y filtro de historial en acción |
| `07-jaguar-reposo.png` / `07b-jaguar-alerta.png` | El jaguar en su nuevo marco premium, en reposo y en alerta |
| `08-movil-inicio.png` / `08b-movil-analisis.png` / `08c-movil-lab-tabs.png` | Interfaz móvil, incluidas las pestañas del laboratorio |
| `09-interfaz-ingles.png` | Interfaz en inglés |

## 8. Pendientes explícitos (heredados de la Fase 4, sin cambios)

- **Mapa de investigaciones interactivo**: sigue sin construirse. No había
  pedido explícito de hacerlo en esta fase; la correlación de datos real
  (`lib/analysis/correlation.ts`) existe y es lo que un mapa debería
  visualizar, pero la visualización interactiva en sí es un componente
  nuevo de principio a fin.
- **Jaguar 3D (GLB)**: explícitamente fuera de alcance de esta fase por el
  propio encargo. Lo que se hizo fue el "espacio visual premium" que lo
  pueda recibir después (el marco con degradado), no el modelo mismo.
- **Preparación comercial** (autenticación, roles, planes): no se tocó;
  sigue sin existir ningún sistema de cuentas de usuario en el código.
- **Auditoría de accesibilidad formal** (axe/Lighthouse): no ejecutada esta
  sesión.

## 9. Evaluación GO / NO-GO

**GO para continuar — la base de interfaz ya sostiene una demo o un piloto
cerrado; sigue siendo NO-GO para lanzamiento comercial abierto**, por las
mismas razones ya documentadas en la Fase 4 (sin autenticación, sin
validación de OCR con capturas reales, sin mapa de investigaciones) más:

- El rediseño es una **mejora real y verificada** sobre una base visual que
  ya era decente, no una transformación "de cero a premium": alguien
  evaluando la plataforma para comprarla notará que es coherente y
  funcional, pero el pulido final (tipografía a medida, micro-animaciones
  más elaboradas, una revisión de diseño por un humano con ojo estético)
  sigue pendiente — ningún modelo de lenguaje puede certificar por sí solo
  que algo "impresiona desde el primer momento".
- El centro de operaciones de agentes y el laboratorio de tres áreas son la
  pieza que más directamente responde al pedido de "que los agentes sean
  los protagonistas": están verificados y son honestos (no inventan
  conexiones ni actividad), pero no se validaron con usuarios reales.

Recomendación: si el siguiente paso es una demo a inversionistas o
compradores, esta base ya alcanza. Si el siguiente paso es vender la
plataforma, los bloqueos de la Fase 4 (autenticación, OCR con datos reales,
accesibilidad formal) siguen siendo los que hay que resolver primero, no el
diseño visual.
