import { test, expect } from "@playwright/test";
import QRCode from "qrcode";

test("decodes a synthetic QR image without BarcodeDetector", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "BarcodeDetector", { value: undefined }); });
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Nuevo análisis|New analysis/i }).click();
  const png = await QRCode.toBuffer("https://example.com/test", { type: "png", width: 400 });
  await page.locator("#qr-file-input").setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".qr-result")).toContainText("https://example.com/test");
  await expect(page).not.toHaveURL(/example\.com/);
});

test("Academy progress survives language changes and reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Academia|Academy/i }).click();
  await page.locator("#academy-path").selectOption("children");
  await page.getByRole("button", { name: /Marcar completada|Mark complete/i }).first().click();
  await page.locator("button.language").click();
  await expect(page.getByRole("button", { name: /Completed|Completada/i }).first()).toBeVisible();
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: /Academia|Academy/i }).click();
  await expect(page.locator("#academy-path")).toHaveValue("children");
  await expect(page.getByRole("button", { name: /Completed|Completada/i }).first()).toBeVisible();
});

test("SOS offers eight scenarios and localized guidance", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: /Escudo Global|Global Shield/i }).click();
  await expect(page.locator("#sos-scenario option")).toHaveCount(9);
  await page.locator("#sos-scenario").selectOption("code");
  await expect(page.locator(".sos-panel")).toContainText(/código compartido|shared code/i);
});
