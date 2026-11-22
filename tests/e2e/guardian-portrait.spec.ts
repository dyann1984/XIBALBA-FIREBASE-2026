import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACTS_DIR = path.resolve(process.cwd(), "artifacts", "xibalba-3-phase5.4");

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

function newAnalysisButton(page: import("@playwright/test").Page) {
  return page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis|New analysis/i });
}

/**
 * Captura real del holograma del Guardián (Fase 6: avatar SVG procedural,
 * ver docs/mejora-visual-holograma-y-mapa.md) en los estados alcanzables sin
 * servicios en la nube. El estado "seguridad" (verde) solo ocurre con
 * interpretación de IA real: ver tests/e2e/cloud-ai.spec.ts.
 */
test("Holograma del Guardián: reposo y alerta reales", async ({ page }) => {
  await page.goto("/");
  await newAnalysisButton(page).click();

  const portrait = page.locator(".guardian-stage.jaguar");
  await expect(portrait).toHaveAttribute("data-guardian-state", "reposo");
  await expect(page.locator(".jaguar-svg")).toBeVisible();
  await portrait.screenshot({ path: path.join(ARTIFACTS_DIR, "01-retrato-reposo.png") });

  await page.locator("#content").fill(
    "BBVA: detectamos actividad sospechosa en tu cuenta. Envíanos el código de verificación que te llegó.",
  );
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();
  await expect(portrait).toHaveAttribute("data-guardian-state", "alerta");
  await portrait.screenshot({ path: path.join(ARTIFACTS_DIR, "02-retrato-alerta.png") });
});
