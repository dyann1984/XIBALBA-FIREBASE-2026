import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACTS_DIR = path.resolve(process.cwd(), "artifacts", "xibalba-global-defense");

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

test("Capturas reales: Escudo Global (escritorio y móvil) e Impacto potencial", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Escudo Global/i }).click();
  await page.locator("#shield-country").selectOption("US");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "01-escudo-global-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "02-escudo-global-movil.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis/i }).click();
  await page.locator("#content").fill(
    "BBVA: detectamos actividad sospechosa en tu cuenta. Envíanos el código de verificación que te llegó.",
  );
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await page.locator("text=Impacto potencial").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "03-impacto-potencial.png"), fullPage: true });

  await page.locator(".help-fab").click();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "04-boton-ayuda-permanente.png"), fullPage: false });
});
