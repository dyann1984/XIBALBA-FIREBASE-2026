# Fase 6 — Holograma del Guardián y mapa de investigaciones

Mejora puramente visual, sin cambios en la lógica de análisis, Gemini, App
Check, OCR, historial, idiomas o exportación PDF.

## Guardián

- El avatar por defecto pasa del retrato fotográfico estático
  (`JaguarPortrait`) al avatar SVG procedural (`JaguarAvatar`), ya existente
  pero no usado como opción principal. `JaguarPortrait.tsx` se conserva sin
  usar por si se quiere retomar.
- Se añaden, dentro del SVG: un anillo de runas (`.jg-rune-ring`) y motas de
  energía (`.jg-particle`) en posiciones fijas (sin aleatoriedad, para no
  romper la hidratación de React), animadas solo con `animation-delay`.
- CSS: brillo volumétrico (`::before` con `color-mix` + `blur`), halo
  ambiental reactivo al estado vía `:has()` en `.jaguar-frame` (con
  `@supports selector(:has(a))` como resguardo), reflejo de "piso" bajo el
  holograma, barrido vertical sutil permanente, y auras específicas para
  `analizando`, `alerta` y `seguridad`.
- Todo gestado por `prefers-reduced-motion` y la clase `.paused` ya existente
  (pausa fuera de vista / modo ligero), igual que el resto del componente.

## Mapa de investigaciones

- Fondo tipo "constelación": rejilla de puntos + barrido cónico lento
  (`.map-canvas::before/::after`).
- Nodos con glifo por tipo de caso (enlace, llamada, dinero, mensaje) en vez
  de círculos genéricos, aura rotatoria y anillo de selección.
- Líneas verificadas con un segundo trazo animado (`.map-edge-flow`) solo
  sobre relaciones tocadas por el nodo seleccionado.
- Caso único: ya no es un punto perdido en el vacío. Se autoselecciona, se le
  dibuja un pedestal ritual (anillos concéntricos) y un texto bilingüe explica
  que aún no hay relaciones verificadas.
- Sigue sin inventar relaciones: una línea solo existe cuando
  `correlateIncidents` encontró un motivo real compartido.

## Pendiente / fuera de alcance de esta fase

- Zoom/paneo libre (rueda del ratón, arrastrar el lienzo) no se implementó;
  solo el enfoque/pulso al seleccionar un nodo. Si se quiere, es un cambio
  aparte con su propia superficie de prueba.
- El holograma sigue siendo 2.5D (SVG + CSS), preparado para una eventual
  migración a 3D real si se decide más adelante.

## Nota técnica: por qué el anillo del nodo no rota con `transform`

Un `<circle>` SVG dentro de un `<g>` ya trasladado, animado con
`transform: rotate()` (incluso con `transform-box: fill-box`), hace que
Chromium recalcule mal su caja delimitadora cuadro a cuadro: en vez de girar
en su sitio, el anillo "crece" progresivamente — lo que además deja al nodo
permanentemente inestable para Playwright (`element is not stable`). La
animación de los anillos (`.map-node-aura`, `.map-node-ring`) se resolvió con
`stroke-dashoffset` en su lugar (el mismo patrón que ya usa `.map-edge-flow`
para las líneas): mismo efecto de "energía recorriendo el anillo", sin tocar
ninguna transformación geométrica.
