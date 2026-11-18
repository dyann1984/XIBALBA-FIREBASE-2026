import type { NextConfig } from "next";

// Cabeceras de seguridad HTTP.
//
// ALCANCE HONESTO DE ESTA CSP
// ---------------------------
// Es una CSP **de refuerzo**, no estricta. `script-src` conserva
// `'unsafe-inline'` porque Next.js inyecta scripts en línea para hidratar la
// página; una CSP estricta exige un nonce por petición, lo que requiere un
// middleware que aún no existe. Está anotado como pendiente en
// `docs/pendientes-hackathon.md`. Lo que sí aporta hoy:
//   · `connect-src` limita a qué servidores puede hablar la página: Firebase y
//     nada más. Un script inyectado no podría enviar el contenido analizado a
//     un servidor cualquiera.
//   · `frame-ancestors`, `object-src` y `base-uri` cierran el secuestro por
//     incrustación, por complementos y por reescritura de URLs relativas.
//   · `form-action 'self'` impide que un formulario envíe datos fuera.
//
// `Permissions-Policy` hace cumplir desde el navegador los permisos reales de la
// interfaz: cámara (`camera=(self)`) para adjuntar fotos de mensajes y
// micrófono (`microphone=(self)`) para la voz conversacional explícita con el
// Guardián bajo autorización de la persona; el resto queda cerrado.

const development = process.env.NODE_ENV === "development";

/**
 * Orígenes de Firebase que el SDK necesita de verdad.
 *
 * `content-firebaseappcheck.googleapis.com` no es un adorno: es el host real
 * al que el SDK de App Check pide el token, tanto en el intercambio de
 * depuración como con reCAPTCHA Enterprise. Se descubrió al probar la política
 * contra el servidor de desarrollo, donde la consola mostró la petición
 * bloqueada. Sin esta entrada, App Check falla en producción y con él la
 * interpretación de IA.
 */
const FIREBASE_ENDPOINTS = [
  "https://firebaseappcheck.googleapis.com",
  "https://content-firebaseappcheck.googleapis.com",
  "https://firebasevertexai.googleapis.com",
  "https://generativelanguage.googleapis.com",
  "https://firestore.googleapis.com",
  "https://firebaseinstallations.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://www.googleapis.com",
];

const csp = [
  "default-src 'self'",
  // El nonce es el pendiente conocido; ver la nota de arriba.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${development ? " 'unsafe-eval'" : ""} https://www.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // `blob:` es para las vistas previas de imagen y audio que la persona adjunta
  // y que nunca salen del dispositivo.
  "img-src 'self' data: blob: https://www.google.com https://www.gstatic.com",
  "media-src 'self' blob:",
  `connect-src 'self' ${FIREBASE_ENDPOINTS.join(" ")}`,
  // reCAPTCHA Enterprise, proveedor de App Check.
  "frame-src https://www.google.com https://recaptcha.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(development ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), bluetooth=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS solo fuera de desarrollo: en http://localhost el navegador la ignora,
  // y anunciarla en local no aporta nada.
  ...(development
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
