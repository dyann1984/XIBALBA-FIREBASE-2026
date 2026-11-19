import { defineConfig } from "@playwright/test";

// Config aparte y deliberadamente distinta de playwright.config.ts: el único
// propósito de este archivo es exercer el camino con servicios REALES de
// Firebase/Gemini (ver tests/e2e/cloud-ai.spec.ts). Para eso necesita
// hostname literal "localhost" -- `lib/firebase.ts` solo activa el token de
// depuración de App Check cuando `window.location.hostname === "localhost"`,
// nunca con "127.0.0.1" -- y por eso vive en su propio puerto y archivo en
// lugar de mezclarse con la batería principal, que es intencionalmente
// determinista y no depende de red ni de cuota de ningún proveedor.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/cloud-ai.spec.ts",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3103",
    locale: "es-MX",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    // `next start` corre en modo producción, y `lib/firebase.ts` solo activa
    // el token de depuración de App Check cuando `NODE_ENV === "development"`
    // (además de hostname "localhost"); sin reCAPTCHA Enterprise real, el
    // único modo real posible aquí es `next dev`.
    command: "npm.cmd run dev -- --hostname localhost --port 3103",
    env: { PORT: "3103" },
    url: "http://localhost:3103",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
