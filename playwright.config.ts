import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    // Sin esto, Chromium no manda preferencia de idioma y el autodetector de
    // LanguageProvider.tsx elige inglés por defecto, invirtiendo el sentido
    // del botón de idioma en las pruebas (ver test 2). Fijar la preferencia
    // hace la prueba determinista sin tocar la función real de autodetección.
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
  webServer: {
    command: "npm.cmd run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
