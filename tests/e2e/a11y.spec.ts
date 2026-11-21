import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Auditoría de accesibilidad con axe-core (WCAG 2.0/2.1 A y AA). Pendiente
 * explícito desde la Fase 5 (ver XIBALBA_3_0_PHASE5_REPORT.md §8); esta es
 * la primera ejecución real, no una promesa.
 *
 * Solo falla por violaciones reales reportadas por axe-core: no hay
 * exclusiones de regla a medida para ocultar hallazgos.
 */

function newAnalysisButton(page: import("@playwright/test").Page) {
  return page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis|New analysis/i });
}

async function auditNoViolations(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  if (results.violations.length) {
    const detail = results.violations
      .map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodo(s))`)
      .join("\n");
    throw new Error(`${label}: ${results.violations.length} violación(es) de axe-core:\n${detail}`);
  }
  expect(results.violations).toEqual([]);
}

test("a11y 1. Pantalla de inicio sin violaciones de axe-core", async ({ page }) => {
  await page.goto("/");
  await auditNoViolations(page, "Inicio");
});

test("a11y 2. Laboratorio de análisis (vacío y con resultado) sin violaciones", async ({ page }) => {
  await page.goto("/");
  await newAnalysisButton(page).click();
  await auditNoViolations(page, "Laboratorio vacío");

  await page.locator("#content").fill("BBVA: detectamos actividad sospechosa en tu cuenta. Envíanos el código de verificación que te llegó.");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo|Analizar contenido/i }).click();
  await expect(page.locator(".verdict-rojo")).toBeVisible();
  await auditNoViolations(page, "Laboratorio con resultado");
});

test("a11y 3. Historial, mapa, agentes y privacidad sin violaciones", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /^(Historial|History)$/i }).click();
  await auditNoViolations(page, "Historial");

  await page.getByRole("navigation").getByRole("button", { name: /Mapa de relaciones|Relationship map/i }).click();
  await auditNoViolations(page, "Mapa de investigaciones");

  await page.getByRole("navigation").getByRole("button", { name: /^(Agentes IA|AI agents)$/i }).click();
  await auditNoViolations(page, "Agentes");

  await page.getByRole("navigation").getByRole("button", { name: /^(Privacidad|Privacy)$/i }).click();
  await auditNoViolations(page, "Privacidad");
});

test("a11y 4. Pantalla principal en 375px sin violaciones", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await auditNoViolations(page, "Inicio móvil 375px");
});
