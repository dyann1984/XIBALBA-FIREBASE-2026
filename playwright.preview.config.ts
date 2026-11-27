import { defineConfig, devices } from "@playwright/test";

/**
 * Batería móvil contra un despliegue real (Vercel Preview), no contra un
 * servidor local.
 *
 * Por qué existe aparte de `playwright.config.ts`: ahí el objetivo es el
 * servidor local, y el proyecto WebKit necesita `next dev` justamente porque
 * sobre HTTP plano la directiva `upgrade-insecure-requests` de la CSP de
 * producción rompe la carga en WebKit. Contra el Preview no hay nada de eso:
 * se sirve por HTTPS con la CSP de producción completa, que es exactamente lo
 * que hay que comprobar. Sin `webServer`: el despliegue ya está en línea.
 *
 * Variables de entorno (ninguna se guarda en el repositorio):
 *   PREVIEW_URL     URL del despliegue, p. ej. https://<algo>.vercel.app
 *   PREVIEW_BYPASS  secreto de Protection Bypass for Automation de Vercel,
 *                   para entrar sin desactivar la protección del despliegue.
 */
const baseURL = process.env.PREVIEW_URL;
const bypass = process.env.PREVIEW_BYPASS;

if (!baseURL) {
  throw new Error("Falta PREVIEW_URL: la URL del despliegue a probar.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/xibalba.spec.ts",
  grep: /3[bc]\./,
  timeout: 90_000,
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL,
    locale: "es-MX",
    ...(bypass ? { extraHTTPHeaders: { "x-vercel-protection-bypass": bypass } } : {}),
  },
  projects: [
    {
      name: "preview-chromium-mobile",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 }, permissions: [] },
    },
    {
      name: "preview-webkit-mobile",
      use: { ...devices["iPhone 13"], permissions: [], launchOptions: {} },
    },
  ],
});
