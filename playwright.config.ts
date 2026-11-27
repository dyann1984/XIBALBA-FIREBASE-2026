import { defineConfig, devices } from "@playwright/test";

const port = process.env.PW_PORT || "3099";
// Puerto propio para el proyecto WebKit (ver más abajo: necesita `next dev`,
// no el mismo servidor de producción que usa `chromium`).
const webkitPort = process.env.PW_WEBKIT_PORT || "3105";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  // Diagnóstico real (no la primera hipótesis): "UNKNOWN: unknown error,
  // open '...<nombre>.png'" al escribir una captura con `page.screenshot`
  // también ocurre con `workers: 1` (un solo proceso, un archivo nuevo y
  // único cada vez, sin ningún otro test corriendo a la vez) — así que NO
  // es una colisión entre dos pruebas escribiendo la misma ruta. Es un
  // bloqueo transitorio de Windows sobre el archivo recién creado (por
  // ejemplo el antivirus en tiempo real escaneándolo) y desaparece solo al
  // reintentar. `workers: 1` solo lo hacía MENOS frecuente al reducir
  // cuántas escrituras a disco ocurren por segundo, a costa de ~6x más
  // tiempo total; la corrección real es `retries`, no serializar.
  retries: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "es-MX",
    viewport: { width: 1440, height: 900 },
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
  },
  webServer: [
    {
      command: "npm.cmd run start",
      env: { PORT: port },
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    // Servidor aparte para `webkit-mobile-images`, en modo `next dev` (no
    // `next start`). Causa raíz real, confirmada con requests/consola: con
    // el build de producción, `next.config.ts` añade `upgrade-insecure-requests`
    // a la CSP (solo fuera de `development`); WebKit lo aplica también a
    // 127.0.0.1 y reescribe TODAS las subpeticiones (JS, CSS, imágenes) a
    // `https://`, que este servidor de pruebas no habla — `SSL connect error`
    // en cada una. Chromium no hace esa reescritura sobre loopback, así que
    // el mismo proyecto nunca lo mostró. En Vercel esto no aplica: la app ya
    // se sirve por HTTPS, así que la directiva no reescribe nada de verdad.
    // `next dev` fija `NODE_ENV=development`, con lo que la CSP omite la
    // directiva y WebKit carga la página con normalidad.
    {
      command: "npm.cmd run dev",
      // `distDir` propio: corre en paralelo al `next start` de arriba durante
      // toda la batería; compartir `.next` entre un build de producción y un
      // servidor de desarrollo corriendo a la vez lo corrompe (visto en vivo:
      // un `next dev` suelto dejó sin "BUILD_ID" al `.next` que acababa de
      // generar `next build`, y el siguiente `next start` ya no arrancaba).
      env: { PORT: webkitPort, NEXT_DIST_DIR: ".next-webkit-dev" },
      url: `http://127.0.0.1:${webkitPort}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  projects: [
    // Motor por defecto, batería completa: igual que antes de añadir `projects`.
    { name: "chromium", use: { browserName: "chromium" } },
    // WebKit real (el motor de Safari/iOS), limitado a prueba 3b (carga de
    // imágenes en móvil): es el flujo donde Safari en iOS se comporta
    // distinto a Chromium (ver el `accept="image/*"` en ImageAttachments.tsx),
    // así que es ahí donde vale la pena pagar un segundo motor de navegador.
    // `devices["iPhone 13"]` emula un dispositivo real (user agent, touch,
    // viewport), no solo un viewport angosto en Chromium.
    {
      name: "webkit-mobile-images",
      grep: /3b\./,
      use: {
        ...devices["iPhone 13"],
        baseURL: `http://127.0.0.1:${webkitPort}`,
        // Camera/microphone no son permisos soportados en WebKit, y esta
        // prueba no usa cámara (solo `setInputFiles`); los flags de Chromium
        // tampoco aplican aquí.
        permissions: [],
        launchOptions: {},
      },
    },
  ],
});
