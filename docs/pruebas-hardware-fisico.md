# Guía de pruebas manuales en hardware físico — XIBALBÁ

Esta guía cubre las capacidades que **no pueden validarse de forma concluyente con emulación ni stubs** y requieren ejecución en un teléfono o equipo físico con sensores reales.

**Tiempo estimado: ~10 minutos** (computadora + teléfono). Hazla en
`https://xibalba-firebase-2026.vercel.app` (producción real, no Preview).

**Cómo reportar un error:** para cada paso que falle, anota (1) el número de
sección, (2) qué esperabas vs. qué pasó realmente, (3) navegador y sistema
operativo exactos, y (4) si es posible, abre las herramientas de desarrollo
del navegador (F12 → Consola) y copia cualquier línea en rojo. No se
necesita más que eso — no compartas capturas con datos personales reales;
usa siempre contenido sintético (`example.com`, montos y nombres
inventados).

## 1. Micrófono y dictado al Guardián
1. Abrir la aplicación en Chrome/Edge (escritorio o Android) o Safari (iOS).
2. Ejecutar un análisis (ej. primer caso de demostración).
3. En la tarjeta del **Guardián**, pulsar **Dictar pregunta / Dictate a question**.
4. Aceptar el permiso del navegador cuando solicite acceso al micrófono.
5. Hablar una pregunta clara (ej. *"¿Qué señal reviso primero?"*).
6. **Criterio de aceptación:** El estado cambia a `Escuchando / Listening`, el texto se transcribe en el campo de pregunta sin quedarse bloqueado al terminar, y al enviarlo responde el Guardián.

## 2. Voz del Guardián (TTS)
1. Pulsar **Activar voz / Turn on voice** y luego **Escuchar explicación / Hear the explanation**.
2. Cambiar el idioma de **ES** a **EN** y repetir **Hear the explanation**.
3. **Criterio de aceptación:** Se escucha audio real por las bocinas del dispositivo en español (`es-MX`/`es`) y luego en inglés (`en-US`/`en`), y **Detener / Stop** interrumpe la reproducción al instante.

## 3. Cámara y escaneo QR físico
1. En **Nuevo análisis**, pulsar **Usar cámara / Use camera** (o adjuntar foto tomada con la cámara del teléfono).
2. En **QR DEFENSE**, pulsar **Leer imagen QR / Scan QR image** con un código QR real impreso o en otra pantalla (sin usar datos bancarios reales; usar un QR de prueba hacia `https://example.com`).
3. **Criterio de aceptación:** La cámara captura la imagen sin errores de permisos, OCR/QR decodifica el contenido y permite enviarlo al análisis de `HUN CAMÉ`.

## 4. Instalación PWA y Web Share Target (Android / Chrome)
1. Abrir la URL en **Chrome para Android** (o Edge/Chrome en escritorio).
2. Instalar la aplicación mediante el menú **Instalar aplicación / Añadir a pantalla de inicio**.
3. En Android, abrir un SMS o enlace de prueba (`https://example.com`), pulsar **Compartir** y elegir **XIBALBÁ**.
4. **Criterio de aceptación:** La PWA se abre en modo `standalone`, precarga el laboratorio con el texto/enlace compartido y limpia los parámetros de la URL sin enviar nada automáticamente sin consentimiento.
5. **Nota iOS/Safari:** iOS Safari soporta añadir a pantalla de inicio, pero **no** soporta `share_target` de PWA de forma nativa; en iOS debe usarse el flujo manual de copiar y pegar.

## 5. Análisis de una imagen real con IA en la nube (lo único que la automatización no pudo probar)

Esta es la pieza que una batería automatizada (Playwright headless) no puede
verificar en producción: reCAPTCHA Enterprise bloquea correctamente ese
tráfico por parecer un bot, así que la interpretación real de Gemini sobre
una imagen necesita, por diseño de seguridad, un navegador humano.

1. Toma o descarga una captura de pantalla **sintética** (invéntala tú mismo:
   un mensaje de texto con un enlace a `example.com` y un monto inventado).
   No uses una captura real con datos de otra persona.
2. Abre `https://xibalba-firebase-2026.vercel.app` en un navegador normal
   (no en modo incógnito con bloqueador de terceros agresivo).
3. **Nuevo análisis** → marca la casilla de consentimiento de nube → **Añadir
   imagen** → selecciona la captura.
4. Pulsa **Analizar contenido**.
5. **Resultado esperado:** aparece "OCR" con el texto reconocido (o la nota
   de que no se reconoció y puedes corregirlo a mano), y bajo "Interpretación
   de IA" aparece **Motor: NUBE** con una lectura del modelo — no "SIN
   VERIFICAR" ni un error de App Check.
6. **Cómo reportar:** si el motor se queda en "SIN VERIFICAR" o aparece un
   error, abre la consola del navegador (F12) y copia el texto exacto del
   error (suele empezar con `[xibalba] interpretación de IA falló:`).

## 6. Funcionamiento sin conexión

1. Con la aplicación ya abierta una vez (para que el *service worker* se
   registre), activa el modo avión o desconecta la red.
2. Recarga la página.
3. **Resultado esperado:** la aplicación sigue abriendo (no "sin conexión" en
   blanco de Chrome) y puedes ejecutar **Auditar solo en este dispositivo**
   con un caso de demostración; el botón que requiere la nube debe
   indicar claramente que no hay conexión, no fallar en silencio.

## 7. Interacción con los mapas 3D

1. Ejecuta cualquier análisis y entra a la **Mesa de Investigación**
   (mapa ceremonial de los 5 agentes) o a **Mapa de relaciones**.
2. En el mapa ceremonial: toca un templo distinto a "General" y confirma que
   la cámara se mueve con una animación suave hacia ese agente, mostrando su
   nombre y duración real en ms; vuelve a "General" y confirma que regresa.
3. En el mapa de relaciones: usa dos dedos (teléfono) o la rueda del mouse
   (escritorio) para hacer zoom, y arrastra para desplazarte (pan).
4. **Resultado esperado:** ambos mapas responden sin saltos bruscos ni
   errores en consola; en un teléfono de gama media, el framerate puede bajar
   pero no debe congelarse por completo.
