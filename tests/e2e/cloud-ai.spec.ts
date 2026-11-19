import { test, expect } from "@playwright/test";

/**
 * CAMINO CON SERVICIOS REALES EN LA NUBE (Firebase App Check + Gemini).
 *
 * Deliberadamente separado de la batería principal (`playwright.config.ts`,
 * puerto 3099, `next start`, hostname 127.0.0.1): esta prueba corre con
 * `playwright.cloud.config.ts` (puerto 3103, `next dev`, hostname literal
 * "localhost"), porque `lib/firebase.ts` solo activa el token de depuración
 * de App Check bajo esas dos condiciones exactas. Sin reCAPTCHA Enterprise
 * configurado (no hay `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`), este es el
 * único camino real posible en este entorno hacia Firebase AI Logic.
 *
 * Esta prueba depende de red y de cuota de un proveedor externo. No es
 * determinista por diseño, así que si el intercambio de App Check o la
 * llamada al modelo no se completan, la prueba se omite con un motivo
 * explícito en vez de fallar o de simular un resultado. Cuando sí se
 * completa, comprueba algo real que no se puede lograr con un mock: que la
 * regla "la IA no puede bajar un veredicto determinista" se sostiene con una
 * respuesta real del modelo, no con una que el propio código fabricó.
 */
test("Interpretación de IA en la nube real (Firebase + Gemini) nunca baja un veredicto determinista", async ({
  page,
}) => {
  await page.goto("/");

  // Confirma, DESDE EL INICIO (la tarjeta "Nube" solo vive ahí), que App
  // Check realmente entregó el token de depuración antes de navegar a otra
  // pantalla. Si no ocurre en 25s, no hay red/cuota disponible ahora mismo:
  // se omite, no se falla.
  const cloudReady = await page
    .getByText(/Nube: configurada|Cloud: configured/i)
    .waitFor({ timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!cloudReady, "App Check no entregó un token de depuración en 25s (sin red o sin cuota disponible ahora mismo).");

  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis/i }).click();
  await page.locator(".consent input[type='checkbox']").first().check();
  await expect(page.getByRole("button", { name: /Analizar contenido/i })).toBeVisible();

  await page.locator("#content").fill(
    "BANORTE: Detectamos un cargo no reconocido de $8,450. Si no reconoces el cargo, verifica tu cuenta en las próximas 2 horas en https://banorte-mx.verificacion-segura.example.com o será bloqueada.",
  );
  await page.getByRole("button", { name: /Analizar contenido/i }).click();

  // Hasta 30s: una llamada real a Gemini, no una respuesta de caché local.
  const answered = await page
    .locator(".inference")
    .filter({ hasText: /LOCAL|NUBE|ON-DEVICE|CLOUD/i })
    .waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!answered, "La llamada real al modelo no respondió en 30s (red o cuota del proveedor).");

  // El resultado determinista es inequívocamente alto: la IA real no debe
  // haberlo rebajado, sea cual sea su propia lectura del texto.
  await expect(page.locator(".verdict-rojo")).toBeVisible();
  await expect(page.locator(".inference")).not.toContainText(/SIN VERIFICAR|UNVERIFIED/i);
});
