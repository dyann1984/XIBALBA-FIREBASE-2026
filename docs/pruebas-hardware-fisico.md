# Guía de pruebas manuales en hardware físico — XIBALBÁ

Esta guía cubre las capacidades que **no pueden validarse de forma concluyente con emulación ni stubs** y requieren ejecución en un teléfono o equipo físico con sensores reales.

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
