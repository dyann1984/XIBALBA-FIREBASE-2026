import { defineConfig } from "@playwright/test";

// Apunta al dominio público real de producción (no Preview, no localhost).
// Sin `webServer`: no se construye ni se arranca nada local, se navega
// directamente contra el despliegue ya publicado para verificar el camino
// que de verdad usan los jueces y el público.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/production-image-analysis.spec.ts",
  timeout: 90_000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.XIBALBA_PROD_URL || "https://xibalba-firebase-2026.vercel.app",
    locale: "es-MX",
    viewport: { width: 1440, height: 900 },
  },
});
