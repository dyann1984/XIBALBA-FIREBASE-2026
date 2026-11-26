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
  test.setTimeout(120_000);
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

  // El texto fijo «IA local» siempre aparece en .inference; no indica que
  // haya terminado la solicitud. Esperar al resultado evita falsos positivos.
  await expect(page.getByRole("button", { name: /Analizar contenido/i })).toBeEnabled({ timeout: 70_000 });

  // El resultado determinista es inequívocamente alto: la IA real no debe
  // haberlo rebajado, sea cual sea su propia lectura del texto.
  await expect(page.locator(".verdict-rojo")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".inference b")).toContainText(/NUBE|CLOUD/i);
});

/**
 * El estado visual "seguridad" del holograma del Guardián (verde en el
 * semáforo) solo es alcanzable con una interpretación de IA real: el motor
 * local nunca da verde por sí solo (ver xibalba.spec.ts, prueba 8). Por eso
 * esta captura vive aquí y no en la batería principal.
 */
test("Holograma del Guardián en estado de seguridad (verde) con IA real", async ({ page }) => {
  test.setTimeout(120_000);
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

  await expect(page.getByRole("button", { name: /Analizar contenido/i })).toBeEnabled({ timeout: 70_000 });
  await expect(page.locator(".inference b")).toContainText(/NUBE|CLOUD/i);

  await expect(page.locator(".verdict-verde")).toBeVisible({ timeout: 15_000 });
  const portrait = page.locator("[data-guardian-state]");
  await expect(portrait).toHaveAttribute("data-guardian-state", "seguridad");
  await portrait.screenshot({ path: path.join(ARTIFACTS_DIR, "03-retrato-seguridad.png") });
});

test("IA en la nube en inglés y recuperación limpia si se revoca el consentimiento", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const cloudReady = await page
    .getByText(/Nube: configurada|Cloud: configured/i)
    .waitFor({ timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!cloudReady, "App Check no entregó un token de depuración en 25s (sin red o sin cuota disponible ahora mismo).");

  await page.locator("button.language").click();
  await page.getByRole("navigation").getByRole("button", { name: /New analysis/i }).click();
  await page.locator(".consent input[type='checkbox']").first().check();
  await page.locator("#content").fill(
    "Hello, confirming our Thursday 10 AM appointment at the downtown branch with the documents requested.",
  );
  await page.getByRole("button", { name: /Analyse content/i }).click();
  await expect(page.getByRole("button", { name: /Analyse content/i })).toBeEnabled({ timeout: 70_000 });
  await expect(page.locator(".inference b")).toContainText(/CLOUD/i);
  await expect(page.locator(".verdict-verde")).toBeVisible({ timeout: 15_000 });

  // Sin consentimiento, vuelve a análisis local y nunca envía a la nube.
  await page.locator(".consent input[type='checkbox']").first().uncheck();
  await expect(page.getByRole("button", { name: /Audit on this device only/i })).toBeVisible();
});

test("IA en la nube real con captura de pantalla sintética (OCR + Gemini) y medición de latencia", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const cloudReady = await page
    .getByText(/Nube: configurada|Cloud: configured/i)
    .waitFor({ timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!cloudReady, "App Check no entregó un token de depuración en 25s (sin red o sin cuota disponible ahora mismo).");

  await page.locator("button.language").click();
  await page.getByRole("navigation").getByRole("button", { name: /New analysis/i }).click();
  await page.locator(".consent input[type='checkbox']").first().check();

  // Genera una captura PNG sintética con texto fraudulento en inglés
  const pngBuffer = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 240;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111111";
    ctx.font = "bold 28px Arial";
    ctx.fillText("BANK ALERT: Account suspended in 2 hours.", 24, 80);
    ctx.fillText("Verify OTP now at https://bbva.alert.example.com/login", 24, 140);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  await page.locator("#photo").setInputFiles({
    name: "phishing-en-screenshot.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBuffer),
  });

  const startedAt = Date.now();
  await page.getByRole("button", { name: /Analyse content/i }).click();
  await expect(page.getByRole("button", { name: /Analyse content/i })).toBeEnabled({ timeout: 75_000 });
  const elapsedMs = Date.now() - startedAt;
  console.info(`[CLOUD AI IMAGE+OCR LATENCY]: ${elapsedMs} ms`);

  await expect(page.locator(".inference b")).toContainText(/CLOUD/i);
  await expect(page.locator(".verdict-rojo, .verdict-amarillo").first()).toBeVisible({ timeout: 15_000 });
});
