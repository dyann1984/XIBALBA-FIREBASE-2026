# El Guardián: de SVG procedural a retrato premium (Fase 5.4)

## Qué se pidió y qué existía

El encargo de la Fase 5.4 pedía sustituir la apariencia del Guardián por un
jaguar negro maya futurista de calidad cinematográfica, tomando como
referencia una imagen aprobada que la persona compartió en la conversación, y
explícitamente prohibía "presentar otro avatar geométrico como si fuera el
diseño solicitado".

Antes de construir nada se buscó en el repositorio cualquier recurso 3D
(`*.glb`, `*.gltf`) o documentación de uno. **No existe ninguno.** `three` ya
se había quitado como dependencia muerta en la Fase 5.3 (sin un solo `import`
en el código). El único activo disponible es la imagen de referencia que la
persona adjuntó en esta conversación.

## Qué se construyó

1. Se recortó la ilustración de referencia a un retrato (`sharp`, en código,
   reproducible: ver el script de recorte si se necesita repetir con otra
   imagen), guardado en `public/guardian/jaguar-portrait.{jpg,webp}`
   (84–115 KB).
2. `components/guardian/JaguarPortrait.tsx`: componente **nuevo e
   independiente**. Muestra esa imagen dentro del mismo marco premium
   (`jaguar-frame`) que ya existía, con capas de animación CSS reales:
   - **Respiración**: escala sutil continua.
   - **Parpadeo**: una franja oscura cruza la banda de los ojos ~140 ms cada
     4–8 s (aleatorio), nunca con `prefers-reduced-motion`.
   - **Brillo de ojos** por estado, coloreado con `guardianAccentFor()`
     (función compartida, exportada desde `JaguarAvatar.tsx`, para que las
     dos representaciones nunca diverjan de color).
   - **Barrido de escaneo** durante `analizando`.
   - **Viñeta de color** reactiva: roja pulsante en `alerta`, verde suave en
     `seguridad`, gris y atenuada en `error` — confirmada con una respuesta
     real de Gemini en esta sesión (ver más abajo).
   - **Brillo cerca del hocico** sincronizado con `speaking` (TTS activo).
3. **Honestidad explícita, en el propio código y aquí**: esto es una
   ilustración estática con animación por capas, no un modelo 3D ni una
   escena con rig. Ninguna parte de la interfaz ni de la documentación afirma
   lo contrario.
4. **Fallback real, no solo en el código fuente**: si la imagen falla al
   cargar (`onError`), el componente renderiza automáticamente
   `JaguarAvatar.tsx` (el SVG procedural de la Fase 2, intacto) en su lugar.
   Es una recuperación en tiempo de ejecución, verificable desmontando la
   imagen, no una promesa.

## Verificación real, no simulada

- `tests/e2e/guardian-portrait.spec.ts`: estados `reposo` y `alerta` con el
  motor local (determinista, sin IA).
- `tests/e2e/cloud-ai.spec.ts`: el estado `seguridad` (verde) **solo** es
  alcanzable con una interpretación de IA real — el motor local nunca da
  verde por sí solo. Esta prueba obtuvo una respuesta real de Gemini vía
  Firebase AI Logic y capturó el retrato con la viñeta verde reactiva,
  confirmando que la animación responde a un estado genuino, no a un
  temporizador decorativo.
- Capturas en `artifacts/xibalba-3-phase5.4/`.

## Pendiente real, no resuelto aquí

Un modelo 3D rigged y animado (GLB) con licencia verificada para este
proyecto sigue sin existir. Si el equipo decide encargarlo o generarlo más
adelante, este componente es el punto de integración natural: su interfaz de
props (`state`, `light`, `speaking`, `lang`) es la misma que ya usa
`JaguarAvatar.tsx`, así que un futuro componente 3D podría sustituir a
`JaguarPortrait.tsx` en `Guardian.tsx` con un cambio de una línea, sin tocar
el resto de la aplicación.
