import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACTS_DIR = path.resolve(process.cwd(), "artifacts", "xibalba-3-phase5.4");

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

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
  //
  // Timeout ampliado a propósito, igual que en `answered` arriba: el filtro
  // de `.inference` por LOCAL/NUBE/ON-DEVICE/CLOUD puede cumplirse mientras
  // el análisis todavía muestra "SIN VERIFICAR" un instante (el motor aún no
  // terminó de combinar el veredicto), así que el locator por defecto de 5s
  // podía fallar aquí aunque la llamada real a la nube sí hubiera respondido
  // — visto de forma reproducible corriendo esta prueba contra servicios
  // reales el 21 de noviembre de 2026.
  await expect(page.locator(".verdict-rojo")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".inference")).not.toContainText(/SIN VERIFICAR|UNVERIFIED/i);
});

/**
 * El estado visual "seguridad" del holograma del Guardián (verde en el
 * semáforo) solo es alcanzable con una interpretación de IA real: el motor
 * local nunca da verde por sí solo (ver xibalba.spec.ts, prueba 8). Por eso
 * esta captura vive aquí y no en la batería principal.
 */
test("Holograma del Guardián en estado de seguridad (verde) con IA real", async ({ page }) => {
  await page.goto("/");
  const cloudReady = await page
    .getByText(/Nube: configurada|Cloud: configured/i)
    .waitFor({ timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!cloudReady, "App Check no entregó un token de depuración en 25s (sin red o sin cuota disponible ahora mismo).");

  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis/i }).click();
  await page.locator(".consent input[type='checkbox']").first().check();
  await page.locator("#content").fill(
    "Hola, confirmo nuestra cita del jueves a las 10 en la sucursal del centro. Llevo los documentos que me pediste. Nos vemos ahí.",
  );
  await page.getByRole("button", { name: /Analizar contenido/i }).click();

  const answered = await page
    .locator(".inference")
    .filter({ hasText: /LOCAL|NUBE|ON-DEVICE|CLOUD/i })
    .waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!answered, "La llamada real al modelo no respondió en 30s (red o cuota del proveedor).");

  await expect(page.locator(".verdict-verde")).toBeVisible({ timeout: 15_000 });
  const portrait = page.locator(".guardian-stage.jaguar");
  await expect(portrait).toHaveAttribute("data-guardian-state", "seguridad");
  await portrait.screenshot({ path: path.join(ARTIFACTS_DIR, "03-retrato-seguridad.png") });
});
