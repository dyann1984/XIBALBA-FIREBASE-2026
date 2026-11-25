import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOTS = path.join(process.cwd(), "artifacts", "maps-redesign");

test("Rediseño de Mapas: Mapa de Investigaciones (stats, leyenda, zoom, ES/EN) y Mapa 3D Maya (templos, FPS, móvil)", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // 1. Estado vacío del Mapa 1
  await page.getByRole("navigation").getByRole("button", { name: /Mapa de relaciones|Relationship map/i }).click();
  await expect(page.getByText(/Todavía no hay investigaciones|No investigations yet/i)).toBeVisible();
  await expect(page.locator(".map-empty-guide")).toBeVisible();

  // 2. Ejecutar 2 casos relacionados + 1 aislado y verificar Mapa 2 (3D Maya)
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
  await page.locator("#content").fill("Tu paquete está detenido: http://envios-mx.validacion-paquete.example.com/pagar");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict")).toBeVisible();

  // Verificar Mapa 2 (GodsMap3D) y medir FPS reales
  const godsWrap = page.locator(".gods-map-3d-wrap");
  await expect(godsWrap).toBeVisible();
  await expect(page.locator(".gods-map-3d canvas")).toBeVisible();
  await page.waitForTimeout(1400);
  const fps = await page.locator(".gods-map-3d").getAttribute("data-fps");
  console.info(`[MEASURED GodsMap3D FPS]: ${fps}`);
  expect(Number(fps)).toBeGreaterThan(0);

  await page.locator(".gods-map-pill", { hasText: "IXBALANQUÉ" }).click();
  await expect(page.locator(".gods-map-info")).toContainText("IXBALANQUÉ");
  await godsWrap.screenshot({ path: path.join(SHOTS, "after-gods-map-3d-es.png") });
  await page.getByRole("button", { name: /General|Overview/i }).click();

  // 2do caso relacionado + 3er caso aislado
  await page.locator("#content").fill("Confirma entrega en http://envios-mx.validacion-paquete.example.com/confirmar");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict")).toBeVisible();

  await page.locator("#content").fill("Hola, ¿comemos el viernes a las 2?");
  await page.getByRole("button", { name: /Auditar solo en este dispositivo/i }).click();
  await expect(page.locator(".verdict")).toBeVisible();

  // 3. Verificar Mapa 1 rediseñado (contadores, leyenda, zoom, ES/EN)
  await page.getByRole("navigation").getByRole("button", { name: /Mapa de relaciones|Relationship map/i }).click();
  await expect(page.locator(".map-stat-card")).toHaveCount(4);
  await expect(page.locator(".map-node")).toHaveCount(3);
  await expect(page.locator(".map-edge")).toHaveCount(1);

  await page.getByRole("button", { name: /Acercar mapa|Zoom in/i }).click();
  await expect(page.locator(".map-zoom-readout")).toHaveText("120%");
  await page.getByRole("button", { name: /Restablecer vista|Reset map view/i }).click();
  await expect(page.locator(".map-zoom-readout")).toHaveText("100%");

  await page.locator(".map-node").first().click();
  await page.screenshot({ path: path.join(SHOTS, "after-investigation-map-es.png"), fullPage: true });

  // Cambio a inglés
  await page.locator("button.language").click();
  await expect(page.locator(".map-stats-grid")).toContainText("CASES");
  await expect(page.locator(".map-stats-grid")).toContainText("RELATIONS");
  await page.screenshot({ path: path.join(SHOTS, "after-investigation-map-en.png"), fullPage: true });

  // 4. Vista móvil 390px del Mapa 3D Maya
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("button.menu-button").click();
  await page.getByRole("navigation").getByRole("button", { name: /New analysis/i }).click();
  await page.getByRole("tab", { name: /B · Investigation/i }).click();
  await expect(page.locator(".gods-map-3d canvas")).toBeVisible();
  await page.locator(".gods-map-3d-wrap").screenshot({ path: path.join(SHOTS, "after-gods-map-3d-mobile.png") });

  expect(consoleErrors).toEqual([]);
});
