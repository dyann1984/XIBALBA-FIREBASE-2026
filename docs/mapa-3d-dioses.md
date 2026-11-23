# Prototipo: mapa 3D de los cinco agentes (fase evaluación)

Fase 2 de la recomendación de Bojak. Añade `components/guardian/GodsMap3D.tsx`,
una escena three.js/R3F con cinco plataformas ceremoniales mayas y una figura
procedural distinta por agente, integrada en el tablero "B · MESA DE
INVESTIGACIÓN" junto a `AgentOperationsBoard` (no en su lugar). Solo se carga
con `?preview3d=1`; **no sustituye** al tablero 2D por defecto.

## Qué se construyó

- **Geometría 100% procedural, sin asset externo:** como tampoco existe
  ningún modelo gratuito de "dios maya" con licencia verificable (mismo
  resultado de búsqueda que para el jaguar, ver `docs/holograma-3d-jaguar.md`),
  cada una de las 5 figuras es una combinación de primitivas three.js propia
  y distinta — nunca la misma forma repetida con otro color:
  - **CAMAZOTZ** (voz/llamadas): cono invertido + dos "alas" triangulares.
  - **IXBALALANQUÉ** (mensajes): octaedro.
  - **VUCUB CAMÉ** (finanzas): pila de 3 discos (monedas).
  - **HUN CAMÉ** (enlaces): dos aros entrelazados (cadena).
  - **EL GUARDIÁN**: tetraedro con dos puntos luminosos (ojos), en la
    plataforma central, más grande que las otras cuatro.
- **Plataformas ceremoniales:** 3 cuerpos hexagonales escalonados por
  plataforma (geometría propia, no textura), con intensidad emisiva real
  según participación.
- **Datos reales, cero simulación:** reutiliza exactamente
  `lib/analysis/agentPhase.ts` (`phaseOf`, `participatedIn`, `PHASE_LABEL`) —
  la misma lógica que ya usa `AgentOperationsBoard` — y el roster real de
  `lib/agents.ts` / `AGENT_NAMES`. Una plataforma solo se ilumina y conecta si
  ese agente de verdad participó en el análisis (`executed`/`events`); nunca
  es decorativo ni fijo.
- **Conexiones luminosas:** línea guardián↔especialista, solo dibujada si
  hubo participación real; mientras el agente está `started`, un punto viaja
  por la curva en tiempo real.
- **Selección por click o touch:** cada figura es un `<group onClick>` de
  R3F (maneja mouse y touch por igual); abre un panel de información real
  bajo el lienzo (nombre, rol, descripción bilingüe vía `t("agents", ...)`,
  fase y `elapsedMs` reales) — nunca texto inventado.
- **Cámara limitada:** `OrbitControls` con zoom (`minDistance`/`maxDistance`)
  y rotación acotada (`minPolarAngle`/`maxPolarAngle`), sin paneo.
- **Rendimiento:** mismo patrón que el holograma del jaguar —
  `frameloop="never"` fuera de vista o pestaña oculta, `prefers-reduced-motion`
  congela el movimiento, `dpr` limitado, carga perezosa tras
  `next/dynamic(..., {ssr:false})` solo bajo `?preview3d=1`.

## Decisiones técnicas durante la verificación

- **drei `<Html>` descartado:** al seleccionar una figura, React lanzaba
  `"Attempted to synchronously unmount a root while React was already
  rendering"` (el portal interno de `<Html>` no es estable bajo React 19 en
  este proyecto). Probado sin `occlude` también falló igual.
- **drei `<Text>` (troika-three-text) descartado:** fallaba con
  `"Worker module function was called but 'init' did not return a callable
  function"` (worker de fuentes incompatible con este bundler), dejando el
  lienzo en blanco.
- Por ambos motivos, las etiquetas flotantes sobre cada figura se quitaron:
  el nombre/rol/fase real de cada agente se muestra en el panel de
  información bajo el mapa al seleccionarlo, que sí es estable y además más
  legible en móvil que un texto diminuto flotando en el lienzo 3D.

## Verificación hecha

- `npm run typecheck`, `npm run lint`, `npm test` (228 pruebas): limpios.
- `npm run build`: compila.
- Verificación visual en navegador con un caso real ejecutado (llamada con
  secuestro virtual + cuenta dictada): CAMAZOTZ y VUCUB CAMÉ se iluminan,
  conectan al GUARDIÁN y muestran su figura distinta; IXBALANQUÉ y HUN CAMÉ
  quedan atenuados y sin conexión por no haber participado — coincide
  exactamente con `AgentOperationsBoard` y con el resultado real del análisis.
- Selección verificada: clic en EL GUARDIÁN muestra el anillo de selección y
  el panel inferior con "EL GUARDIÁN · Coordinación y riesgo · Completado ·
  19.0 ms" (dato real del evento, no inventado).
- Verificación en viewport móvil (375×812): el mapa y el panel de selección
  se ven y funcionan igual, sin recortes.

## Limitaciones honestas

- Las figuras son geometría procedural simple (combinaciones de primitivas),
  no esculturas detalladas de las deidades mayas reales — no existe ningún
  asset gratuito verificable para eso (ver `docs/holograma-3d-jaguar.md`).
- Es un prototipo de evaluación tras `?preview3d=1`; `AgentOperationsBoard`
  sigue siendo lo único que ve cualquier usuario real.
