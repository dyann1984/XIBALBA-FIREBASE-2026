# Prototipo: holograma 3D real del jaguar (fase evaluación)

Atiende la recomendación técnica de Bojak (pipeline GLB real + shaders
Fresnel/wireframe/energía + animación orgánica) sin tocar ninguna función de
análisis. **No sustituye** a `JaguarAvatar` (SVG 2.5D) por defecto: solo se
carga con `?preview3d=1` en la URL, para que el equipo lo evalúe antes de
decidir si reemplaza al avatar actual. Ningún usuario real lo recibe hoy.

## Qué se construyó

- **Pipeline:** `three` 0.187, `@react-three/fiber` 9.8, `@react-three/drei`
  10.7 (React 19 / Next 15, mismas versiones ya usadas en el proyecto).
- **Modelo base:** `public/guardian/models/black-panther-base.glb` (94 KB),
  una pantera negra real (geometría + animación de carrera por morph
  targets, 12 fotogramas a 24 fps), CC BY 3.0, ver `ATTRIBUTION.md` en la
  misma carpeta. No es un jaguar maya exacto ni un modelo de pago: es la
  malla CC0/CC-BY de mejor calidad que existe gratis y con licencia
  verificable (se buscó en Poly Pizza, Sketchfab, Quaternius, itch.io,
  OpenGameArt — no hay ningún "guardián jaguar maya futurista" ni "dios
  maya" gratuito en ningún banco de assets; ver sección *Pendiente*).
- **Material holográfico propio** (`components/guardian/hologramMaterial.ts`):
  shader Fresnel (`pow(1 - dot(normal, viewDir), power)`) + bandas de energía
  en función de la posición del vértice (no hay UV en el GLB de origen, así
  que no hay textura ni decal real: la banda es procedural) + una segunda
  malla en wireframe aditivo sincronizada con los mismos morph targets.
  Colores: cian/turquesa (`guardianAccentFor`, el mismo acento que ya usa el
  resto del Guardián) + dorado de acento, como pidió el usuario.
- **Animación:** el único clip del GLB (`mountainlionRun_A`) se reproduce en
  bucle con `AnimationMixer` (vía `useAnimations` de drei) y cambia de
  velocidad según el estado real (`reposo` lento, `alerta` rápido, etc.) —
  igual que el resto del componente, nunca un estado inventado.
- **Rendimiento:** `frameloop="never"` fuera de vista o con la pestaña oculta
  (mismo patrón de `IntersectionObserver` que ya usaba `JaguarAvatar`),
  `prefers-reduced-motion` congela la animación, `dpr` limitado a `[1, 1.5]`,
  `antialias: false`. Carga perezosa: `next/dynamic(..., { ssr: false })` +
  el `import()` solo ocurre si `preview3d=1`, así que three.js/r3f/drei
  **no** se descargan para ningún usuario normal (confirmado en
  `npm run build`: el chunk con nuestro código pesa 4.2 KB y no aparece en el
  "First Load JS" de la ruta `/`; la librería va en chunks separados que solo
  se piden bajo demanda).

## Verificación hecha

- `npm run typecheck` y `npm run lint`: limpios.
- `npm test` (228 pruebas: Gemini, OCR, IA local, correlación, traducciones,
  reportes): **sin tocar**, todas pasan igual que antes de este cambio.
- `npm run build`: compila. Tamaño de `/` sin cambios relevantes (153 KB /
  274 KB First Load JS); el pipeline 3D vive en chunks separados cargados
  solo bajo `?preview3d=1`.
- Verificación visual en el navegador (desktop y viewport móvil 375×812):
  el jaguar se renderiza completo, con volumen, silueta reconocible de felino
  corriendo, brillo Fresnel en los bordes, wireframe superpuesto, y la
  animación de carrera visiblemente en marcha (comparación de dos capturas
  separadas en el tiempo). Sin errores en consola ni en el servidor de
  desarrollo.

## Limitaciones honestas (no se declara "terminado")

- El GLB de origen no trae UV ni normales: las normales se recalculan en
  cliente (`computeVertexNormals`) y las "bandas de energía" son proceduales
  por posición, no glifos mayas reales superpuestos con textura.
- Es una pantera, no un jaguar maya futurista imponente: incorpora la
  anatomía felina y la animación reales que pidió Bojak, pero el diseño del
  guardián (ornamentos, proporciones, pose de guardián en vez de carrera)
  sigue siendo el de `JaguarAvatar`, no éste.
- Solo hay un clip de animación (carrera). No hay poses de "reposo",
  "escuchando" ni "alerta" distintas: se simula variando la velocidad del
  mismo ciclo, nunca un estado falso.
- Esto es un prototipo de evaluación, no una sustitución: `JaguarAvatar`
  sigue siendo lo único que ve cualquier usuario real.

## Pendiente / fuera de alcance de este cambio

- **Mapa interactivo con los 5 dioses en 3D:** no se construyó todavía
  (pieza grande y separada). Como tampoco existe ningún modelo gratuito de
  "dios maya" con licencia verificable, la vía que pidió el usuario
  (sin pago) es geometría procedural por código para cada uno de los 5,
  no un asset descargado — queda para una fase siguiente.
- **Modelo definitivo del jaguar:** si se quiere un jaguar maya futurista
  real (no una pantera genérica), hace falta modelarlo/comisionarlo
  — no se encontró ningún recurso gratuito con licencia verificable que lo
  cubra. Mientras tanto, este prototipo documenta el pipeline listo para
  recibir ese modelo el día que exista (basta con cambiar `MODEL_URL` en
  `GuardianHologram3D.tsx`, siempre que conserve nombres de malla/clip
  compatibles o se adapten los nombres en el código).
- **Decisión de reemplazar a `JaguarAvatar`:** pendiente de aprobación
  explícita del usuario, que es quien dijo "no declares terminados modelos
  que aún no tengan calidad suficiente".
