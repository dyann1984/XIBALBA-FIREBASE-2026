import { test, expect } from "@playwright/test";

/**
 * Escenarios de Fase 11: usuarios de distintos países frente al Escudo
 * Global. Ningún contacto se muestra de un país que la persona no eligió:
 * este test comprueba exactamente eso, no solo que el componente exista.
 */

function openGlobalShield(page: import("@playwright/test").Page) {
  return page.getByRole("navigation").getByRole("button", { name: /Escudo Global|Global Shield/i }).click();
}

test("13. Usuario de México ve el directorio de México, no el de otro país", async ({ page }) => {
  await page.goto("/");
  await openGlobalShield(page);
  await page.locator("#shield-country").selectOption("MX");
  await expect(page.locator(".shield-record")).toHaveCount(1);
  await expect(page.locator(".shield-record")).toContainText("CONDUSEF");
  await expect(page.locator(".shield-record")).not.toContainText("FTC");
});

test("14. Usuario de Estados Unidos ve un contacto verificado real (FTC)", async ({ page }) => {
  await page.goto("/");
  await openGlobalShield(page);
  await page.locator("#shield-country").selectOption("US");
  await expect(page.locator(".shield-record")).toContainText("Federal Trade Commission");
  await expect(page.locator(".shield-status-verificado")).toHaveCount(2); // insignia general + la del registro
});

test("15. Usuario de España ve el registro marcado honestamente como 'en revisión', no verificado", async ({ page }) => {
  await page.goto("/");
  await openGlobalShield(page);
  await page.locator("#shield-country").selectOption("ES");
  await expect(page.locator(".shield-record")).toContainText("Policía Nacional");
  await expect(page.locator(".shield-status-en-revision")).toHaveCount(2);
  await expect(page.locator(".shield-status-verificado")).toHaveCount(0);
});

test("16. Un país sin directorio verificado lo dice explícitamente, sin inventar un contacto", async ({ page }) => {
  await page.goto("/");
  await openGlobalShield(page);
  await page.locator("#shield-country").selectOption("UY");
  await expect(page.locator(".shield-records")).toHaveCount(0);
  await expect(page.getByText(/Todavía sin datos verificados|No verified data yet/i)).toBeVisible();
});

test("Botón de ayuda permanente abre el Escudo Global desde cualquier pantalla", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Agentes IA|AI agents/i }).click();
  await page.locator(".help-fab").click();
  await expect(page.getByText(/¿Necesitas ayuda ahora\?|Need help now\?/i)).toBeVisible();
  await page.getByRole("button", { name: /Abrir el Escudo Global|Open the Global Shield/i }).click();
  await expect(page.locator(".global-shield")).toBeVisible();
});
