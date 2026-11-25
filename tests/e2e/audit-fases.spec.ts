import { test, expect } from "@playwright/test";

test("Fase 9: Web Share Target precarga el laboratorio desde query params sin romper el flujo manual", async ({ page }) => {
  await page.goto("/?share_title=Alerta&share_text=Urgente+deposita+ahora&share_url=https://bbva-mx.example.com/acceso");
  await expect(page.locator("#content")).toBeVisible();
  await expect(page.locator("#content")).toHaveValue(/Urgente deposita ahora/);
  await expect(page.locator("#content")).toHaveValue(/https:\/\/bbva-mx\.example\.com\/acceso/);
  // Los parámetros compartidos se limpian de la URL tras precargar.
  await expect(page).not.toHaveURL(/share_text=/);
});

test("Fase 11: Compatibilidad responsive en 320, 375, 390, 768, 1024 y 1920px sin desbordamiento horizontal", async ({ page }) => {
  const widths = [320, 375, 390, 768, 1024, 1920];
  await page.goto("/");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `desbordamiento horizontal en ${width}px`).toBeLessThanOrEqual(2);
  }
});

test("Fase 12 y Fase 7: 8 casos de demostración bilingües y directorio Global Defense de 8 países", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
  await expect(page.locator(".demo-chip")).toHaveCount(8);

  // Cambio a inglés traduce los chips de demo
  await page.locator("button.language").click();
  await expect(page.locator(".demo-chip").first()).toContainText(/Your bank/i);

  // Directorio Global Defense incluye MX, US, ES, IN, CO, AR, CL, PE
  await page.getByRole("navigation").getByRole("button", { name: /Escudo Global|Global Shield/i }).click();
  for (const code of ["MX", "US", "ES", "IN", "CO", "AR", "CL", "PE"]) {
    await page.locator("#shield-country").selectOption(code);
    await expect(page.locator(".shield-record").first()).toBeVisible();
  }
});
