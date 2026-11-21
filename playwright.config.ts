import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  retries: 0,
  use: {
    // Puerto poco común a propósito: 3000 es el valor por defecto de medio
    // Next.js en esta máquina, y una ejecución anterior de la Fase 5 se
    // enganchó sin darse cuenta al servidor equivocado («OLYMPUS») que ya
    // ocupaba el 3000, porque `reuseExistingServer` no comprueba qué hay
    // detrás del puerto. Ver XIBALBA_3_0_PHASE5_REPORT.md.
    baseURL: "http://127.0.0.1:3099",
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
    // `PORT` es la variable que `next start` respeta para no depender del
    // puerto 3000 por defecto, que es justo el que colisionó. Se pasa por
    // `env`, no en el propio comando, para que funcione igual en cmd.exe y
    // en shells POSIX.
    command: "npm.cmd run start",
    env: { PORT: "3099" },
    url: "http://127.0.0.1:3099",
    // Falso a propósito: si el puerto 3099 ya estuviera ocupado por otra
    // cosa, Playwright debe fallar al arrancar en vez de reutilizar en
    // silencio un servidor ajeno, que es justo lo que pasó con el 3000.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
