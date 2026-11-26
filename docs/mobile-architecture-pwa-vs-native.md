# XIBALBÁ 2.0 — Protección Móvil: Capacidades PWA vs Arquitectura Nativa (Android / iOS)

## 1. Qué funciona hoy en la PWA (sin simular acceso del sistema)
- **Instalación PWA (`manifest.webmanifest` + `public/sw.js`)**: Modo `standalone`, caché de cascarón offline (`xibalba-shell-v3`) y auditoría determinista 100 % local sin conexión.
- **Web Share Target (`share_target` en `app/manifest.ts`)**: En Android con Chrome/Edge tras instalar la PWA, permite recibir texto/enlaces compartidos en `/?share_title=...&share_text=...&share_url=...` y precargar el laboratorio sin enviar datos automáticamente.
- **Carga de capturas, cámara y QR**: Adjunto de imágenes JPEG/PNG/WebP, captura vía `<input accept="image/*" capture>`, OCR local (detector nativo / Tesseract WASM) y decodificación QR local (`BarcodeDetector` + `jsQR`).
- **Análisis de texto copiado**: Pegado manual en el Laboratorio Forense o Análisis Rápido en la portada.

## 2. Limitaciones reales de la PWA (no se simulan)
- **Sin lectura automática de WhatsApp, SMS ni llamadas**: Ninguna PWA web tiene permiso del SO para interceptar mensajes entrantes, notificaciones de terceros o audio de llamadas telefónicas en segundo plano.
- **iOS / Safari**: Soporta "Añadir a pantalla de inicio", pero **no** soporta `share_target` de PWA ni procesamiento en segundo plano persistente; el flujo en iOS requiere copiar/pegar o adjuntar capturas manualmente.
- **Notificaciones y segundo plano**: Sujetas a permiso explícito del usuario y restricciones de ahorro de energía del sistema operativo; XIBALBÁ no ejecuta monitoreo oculto en segundo plano.

## 3. Arquitectura futura para aplicación nativa (Android / iOS)
Para ampliar la protección manteniendo el principio de privacidad local-primero:
- **Android (Kotlin / Capacitor + Share Intent + Call Screening API opcional)**: Recepción nativa `ACTION_SEND` para texto e imágenes desde cualquier app, análisis determinista local en dispositivo y alertas con consentimiento explícito del usuario.
- **iOS (Swift / Share Extension)**: Extensión nativa de compartir (`NSExtensionActivationRule`) para enviar texto, URLs o capturas al motor local sin depender de Safari `share_target`.
- **Principio inmutable**: Incluso en móvil nativo, ningún mensaje se enviaría a la nube sin consentimiento explícito y nunca se leerían conversaciones privadas en segundo plano sin acción del usuario.
